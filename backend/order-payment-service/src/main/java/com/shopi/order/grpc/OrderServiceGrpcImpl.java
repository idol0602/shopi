package com.shopi.order.grpc;

import com.shopi.marketplace.v1.*;
import com.shopi.order.domain.OrderEntity;
import com.shopi.order.domain.SellerPaymentConfigEntity;
import com.shopi.order.repository.OrderRepository;
import com.shopi.order.repository.SellerPaymentConfigRepository;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class OrderServiceGrpcImpl extends OrderServiceGrpc.OrderServiceImplBase {

    private final OrderRepository orderRepository;
    private final SellerPaymentConfigRepository sellerPaymentConfigRepository;
    private final StringRedisTemplate redisTemplate;

    @GrpcClient("shop-catalog-service")
    private CatalogServiceGrpc.CatalogServiceBlockingStub catalogServiceStub;

    private static final long FIFTEEN_MINUTES_MS = 15 * 60 * 1000L;
    private static final String REDIS_ORDER_TIMEOUT_PREFIX = "order:timeout:";
    private static final Pattern ORDER_CODE_PATTERN = Pattern.compile("SHOPI\\s+([a-f0-9\\-]{36})", Pattern.CASE_INSENSITIVE);

    @Override
    @Transactional
    public void createOrder(CreateOrderRequest request, StreamObserver<OrderResponse> responseObserver) {
        log.info("Received CreateOrder request for productId={}, buyerId={}", request.getProductId(), request.getBuyerId());

        if (request.getProductId().isBlank() || request.getBuyerId().isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("productId and buyerId must not be blank")
                    .asRuntimeException());
            return;
        }

        UUID orderId = UUID.randomUUID();

        try {
            // Saga Step 1: Direct Inventory Decrement (quantity -> quantity - 1)
            ReserveProductRequest reserveRequest = ReserveProductRequest.newBuilder()
                    .setProductId(request.getProductId())
                    .setBuyerId(request.getBuyerId())
                    .setOrderId(orderId.toString())
                    .build();

            ReserveProductResponse reserveResponse = catalogServiceStub.reserveProduct(reserveRequest);

            if (!reserveResponse.getSuccess()) {
                log.warn("Product reservation failed for productId={}: {}", request.getProductId(), reserveResponse.getMessage());
                responseObserver.onError(Status.ALREADY_EXISTS
                        .withDescription(reserveResponse.getMessage().isBlank()
                                ? "Product is already out of stock or unavailable"
                                : reserveResponse.getMessage())
                        .asRuntimeException());
                return;
            }

            Product product = reserveResponse.getProduct();
            String sellerId = (product != null && !product.getSellerId().isBlank()) ? product.getSellerId() : "seller-unknown";
            long totalAmount = (product != null) ? product.getPriceAmount() : 0L;
            String currency = (product != null && !product.getCurrency().isBlank()) ? product.getCurrency() : "VND";

            long now = System.currentTimeMillis();
            long paymentDeadlineEpochMs = 0L; // Immediate stock deduction, no countdown deadline

            // Look up seller payment configuration to build personal VietQR payload
            String bankName = "MBBank";
            String accountNumber = "0988776655";
            String accountHolder = "SHOPI ESCROW";

            try {
                UUID sellerUuid = UUID.fromString(sellerId);
                Optional<SellerPaymentConfigEntity> configOpt = sellerPaymentConfigRepository.findBySellerId(sellerUuid);
                if (configOpt.isPresent()) {
                    SellerPaymentConfigEntity config = configOpt.get();
                    if (config.getBankName() != null && !config.getBankName().isBlank()) bankName = config.getBankName();
                    if (config.getAccountNumber() != null && !config.getAccountNumber().isBlank()) accountNumber = config.getAccountNumber();
                    if (config.getAccountHolder() != null && !config.getAccountHolder().isBlank()) accountHolder = config.getAccountHolder();
                }
            } catch (Exception ex) {
                log.warn("Could not load seller payment config for sellerId {}: {}", sellerId, ex.getMessage());
            }

            // Generate VietQR dynamic payload for mobile banking
            String encodedAccountHolder = URLEncoder.encode(accountHolder, StandardCharsets.UTF_8);
            String vietQrPayload = String.format(
                    "https://img.vietqr.io/image/%s-%s-compact2.png?amount=%d&addInfo=SHOPI%%20%s&accountName=%s",
                    bankName, accountNumber, totalAmount, orderId, encodedAccountHolder
            );

            OrderEntity orderEntity = OrderEntity.builder()
                    .id(orderId)
                    .productId(request.getProductId())
                    .buyerId(request.getBuyerId())
                    .sellerId(sellerId)
                    .totalAmount(totalAmount)
                    .currency(currency)
                    .status(OrderStatus.PENDING_PAYMENT)
                    .vietQrPayload(vietQrPayload)
                    .receiptImageUrl("")
                    .paymentDeadlineEpochMs(paymentDeadlineEpochMs)
                    .bankName(bankName)
                    .bankAccountNumber(accountNumber)
                    .bankAccountHolder(accountHolder)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();

            OrderEntity savedOrder = orderRepository.save(orderEntity);

            // Set 15-minute expiration countdown key in Redis for saga timeout tracking
            try {
                redisTemplate.opsForValue().set(
                        REDIS_ORDER_TIMEOUT_PREFIX + savedOrder.getId().toString(),
                        request.getProductId(),
                        Duration.ofMinutes(15)
                );
            } catch (Exception redisEx) {
                log.warn("Redis reservation cache failure for order {}: {}", savedOrder.getId(), redisEx.getMessage());
            }

            OrderResponse response = OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(savedOrder))
                    .setMessage("Đơn hàng đã được tạo thành công. Số lượng sản phẩm đã được trừ ngay lập tức.")
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (StatusRuntimeException e) {
            log.error("CatalogService gRPC error during order creation: {}", e.getStatus());
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Unexpected error during CreateOrder: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Internal error during order creation: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    @Override
    @Transactional
    public void submitPaymentReceipt(SubmitPaymentReceiptRequest request, StreamObserver<OrderResponse> responseObserver) {
        log.info("Received SubmitPaymentReceipt for orderId={}, buyerId={}", request.getOrderId(), request.getBuyerId());

        if (request.getOrderId().isBlank() || request.getBuyerId().isBlank() || request.getReceiptImageUrl().isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("orderId, buyerId, and receiptImageUrl are required")
                    .asRuntimeException());
            return;
        }

        UUID orderId;
        try {
            orderId = UUID.fromString(request.getOrderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid orderId UUID format")
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + request.getOrderId())
                    .asRuntimeException());
            return;
        }

        if (!order.getBuyerId().equals(request.getBuyerId())) {
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("Buyer ID does not match order record")
                    .asRuntimeException());
            return;
        }

        if (order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription("Cannot submit receipt for order in status: " + order.getStatus())
                    .asRuntimeException());
            return;
        }

        if (order.getPaymentDeadlineEpochMs() != null && order.getPaymentDeadlineEpochMs() > 0 && System.currentTimeMillis() > order.getPaymentDeadlineEpochMs()) {
            responseObserver.onError(Status.DEADLINE_EXCEEDED
                    .withDescription("Payment deadline has expired. Order will be cancelled.")
                    .asRuntimeException());
            return;
        }

        order.setStatus(OrderStatus.PROOF_UPLOADED);
        order.setReceiptImageUrl(request.getReceiptImageUrl());
        order.setUpdatedAt(System.currentTimeMillis());

        OrderEntity savedOrder = orderRepository.save(order);

        OrderResponse response = OrderResponse.newBuilder()
                .setOrder(toProtoOrder(savedOrder))
                .setMessage("VietQR receipt submitted successfully. Awaiting seller confirmation.")
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void confirmOrder(ConfirmOrderRequest request, StreamObserver<OrderResponse> responseObserver) {
        log.info("Received ConfirmOrder request for orderId={}, sellerId={}", request.getOrderId(), request.getSellerId());

        if (request.getOrderId().isBlank() || request.getSellerId().isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("orderId and sellerId must not be blank")
                    .asRuntimeException());
            return;
        }

        UUID orderId;
        try {
            orderId = UUID.fromString(request.getOrderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid orderId UUID format")
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + request.getOrderId())
                    .asRuntimeException());
            return;
        }

        if (!order.getSellerId().equals(request.getSellerId())) {
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("Seller ID does not match order record")
                    .asRuntimeException());
            return;
        }

        if (order.getStatus() != OrderStatus.PROOF_UPLOADED && order.getStatus() != OrderStatus.PENDING_PAYMENT) {
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription("Order cannot be confirmed from current status: " + order.getStatus())
                    .asRuntimeException());
            return;
        }

        try {
            // Saga Step: Permanently commit product inventory to SOLD
            MarkProductSoldRequest soldRequest = MarkProductSoldRequest.newBuilder()
                    .setProductId(order.getProductId())
                    .setBuyerId(order.getBuyerId())
                    .setOrderId(order.getId().toString())
                    .build();

            catalogServiceStub.markProductSold(soldRequest);

            order.setStatus(OrderStatus.CONFIRMED);
            order.setUpdatedAt(System.currentTimeMillis());
            OrderEntity savedOrder = orderRepository.save(order);

            // Clean up Redis countdown key
            try {
                redisTemplate.delete(REDIS_ORDER_TIMEOUT_PREFIX + order.getId());
            } catch (Exception redisEx) {
                log.warn("Redis delete error for order {}: {}", order.getId(), redisEx.getMessage());
            }

            OrderResponse response = OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(savedOrder))
                    .setMessage("Order confirmed and product marked as SOLD.")
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (StatusRuntimeException e) {
            log.error("CatalogService error marking product sold: {}", e.getStatus());
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Unexpected error during ConfirmOrder: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Internal error confirming order: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    @Override
    @Transactional
    public void cancelOrder(CancelOrderRequest request, StreamObserver<OrderResponse> responseObserver) {
        log.info("Received CancelOrder for orderId={}, userId={}, reason={}", request.getOrderId(), request.getUserId(), request.getReason());

        if (request.getOrderId().isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("orderId must not be blank")
                    .asRuntimeException());
            return;
        }

        UUID orderId;
        try {
            orderId = UUID.fromString(request.getOrderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid orderId UUID format")
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + request.getOrderId())
                    .asRuntimeException());
            return;
        }

        String userId = request.getUserId();
        boolean isAuthorized = userId == null || userId.isBlank()
                || "system".equalsIgnoreCase(userId)
                || "admin".equalsIgnoreCase(userId)
                || order.getBuyerId().equals(userId)
                || order.getSellerId().equals(userId);

        if (!isAuthorized) {
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("User is not authorized to cancel this order")
                    .asRuntimeException());
            return;
        }

        if (order.getStatus() == OrderStatus.CONFIRMED || order.getStatus() == OrderStatus.SHIPPED || order.getStatus() == OrderStatus.CANCELLED) {
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription("Cannot cancel order in terminal status: " + order.getStatus())
                    .asRuntimeException());
            return;
        }

        try {
            // Saga Step: Compensation Rollback (Restore Inventory Quantity)
            String reason = (request.getReason() != null && !request.getReason().isBlank())
                    ? request.getReason()
                    : "Order cancelled by " + (userId != null && !userId.isBlank() ? userId : "user");
            ReleaseProductRequest releaseReq = ReleaseProductRequest.newBuilder()
                    .setProductId(order.getProductId())
                    .setOrderId(order.getId().toString())
                    .setReason(reason)
                    .build();

            catalogServiceStub.releaseProduct(releaseReq);

            order.setStatus(OrderStatus.CANCELLED);
            order.setUpdatedAt(System.currentTimeMillis());
            OrderEntity savedOrder = orderRepository.save(order);

            // Clean up Redis countdown key
            try {
                redisTemplate.delete(REDIS_ORDER_TIMEOUT_PREFIX + order.getId());
            } catch (Exception redisEx) {
                log.warn("Redis delete error for order {}: {}", order.getId(), redisEx.getMessage());
            }

            OrderResponse response = OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(savedOrder))
                    .setMessage("Đơn hàng đã được hủy và hoàn trả số lượng sản phẩm (+1) thành công.")
                    .build();

            responseObserver.onNext(response);
            responseObserver.onCompleted();

        } catch (StatusRuntimeException e) {
            log.error("CatalogService error releasing product reservation: {}", e.getStatus());
            responseObserver.onError(e);
        } catch (Exception e) {
            log.error("Unexpected error during CancelOrder: {}", e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Internal error cancelling order: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    @Override
    public void getSellerPaymentConfig(GetSellerPaymentConfigRequest request, StreamObserver<SellerPaymentConfigResponse> responseObserver) {
        UUID sellerId;
        try {
            sellerId = UUID.fromString(request.getSellerId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid sellerId UUID")
                    .asRuntimeException());
            return;
        }

        Optional<SellerPaymentConfigEntity> configOpt = sellerPaymentConfigRepository.findBySellerId(sellerId);
        if (configOpt.isEmpty()) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Payment configuration not found for seller " + request.getSellerId())
                    .asRuntimeException());
            return;
        }

        SellerPaymentConfig config = toProtoConfig(configOpt.get());
        responseObserver.onNext(SellerPaymentConfigResponse.newBuilder()
                .setConfig(config)
                .setMessage("Configuration retrieved successfully")
                .build());
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void saveSellerPaymentConfig(SaveSellerPaymentConfigRequest request, StreamObserver<SellerPaymentConfigResponse> responseObserver) {
        UUID sellerId;
        try {
            sellerId = UUID.fromString(request.getSellerId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid sellerId UUID")
                    .asRuntimeException());
            return;
        }

        SellerPaymentConfigEntity entity = sellerPaymentConfigRepository.findBySellerId(sellerId)
                .orElse(SellerPaymentConfigEntity.builder().sellerId(sellerId).build());

        entity.setBankName(request.getBankName());
        entity.setAccountNumber(request.getAccountNumber());
        entity.setAccountHolder(request.getAccountHolder());
        entity.setSepayApiKey(request.getSepayApiKey());
        entity.setSepayWebhookToken(request.getSepayWebhookToken());
        entity.setTestMode(request.getTestMode());

        SellerPaymentConfigEntity saved = sellerPaymentConfigRepository.save(entity);

        responseObserver.onNext(SellerPaymentConfigResponse.newBuilder()
                .setConfig(toProtoConfig(saved))
                .setMessage("Payment configuration saved successfully")
                .build());
        responseObserver.onCompleted();
    }

    /**
     * Process incoming SePay Webhook notification:
     * Extracts order UUID from content memo (e.g. "SHOPI <orderId>").
     * Validates payment amount, marks order CONFIRMED, and finalizes inventory lock.
     */
    @Override
    @Transactional
    public void processSepayWebhook(ProcessSepayWebhookRequest request, StreamObserver<OrderResponse> responseObserver) {
        String content = request.getContent();
        log.info("Processing SePay Webhook: content='{}', transferAmount={}, gateway='{}'",
                content, request.getTransferAmount(), request.getGateway());

        if (content == null || content.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Webhook content is empty")
                    .asRuntimeException());
            return;
        }

        Matcher matcher = ORDER_CODE_PATTERN.matcher(content);
        UUID orderId = null;
        if (matcher.find()) {
            try {
                orderId = UUID.fromString(matcher.group(1));
            } catch (Exception ignored) {}
        }

        // Fallback: search content for any 36-char UUID string
        if (orderId == null) {
            Pattern generalUuid = Pattern.compile("([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})", Pattern.CASE_INSENSITIVE);
            Matcher m = generalUuid.matcher(content);
            if (m.find()) {
                try {
                    orderId = UUID.fromString(m.group(1));
                } catch (Exception ignored) {}
            }
        }

        if (orderId == null) {
            log.warn("Could not find order ID in webhook content: '{}'", content);
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("No valid SHOPI Order ID found in transaction content: " + content)
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            log.warn("Order not found for ID extracted from webhook: {}", orderId);
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + orderId)
                    .asRuntimeException());
            return;
        }

        // 1. Tenant Isolation: Verify order seller matches the webhook seller
        if (request.getSellerId() != null && !request.getSellerId().isBlank()) {
            if (!order.getSellerId().equals(request.getSellerId())) {
                log.warn("Tenant isolation violation: Order {} belongs to seller {} but webhook was sent for seller {}",
                        orderId, order.getSellerId(), request.getSellerId());
                responseObserver.onError(Status.PERMISSION_DENIED
                        .withDescription(String.format("Tenant isolation violation: Order %s does not belong to seller %s",
                                orderId, request.getSellerId()))
                        .asRuntimeException());
                return;
            }
        }

        // 2. Account Number Cross-Check (if provided by SePay webhook)
        if (request.getAccountNumber() != null && !request.getAccountNumber().isBlank()) {
            String incomingAccount = request.getAccountNumber().replaceAll("\\s+", "").trim();
            String expectedAccount = order.getBankAccountNumber() != null ? order.getBankAccountNumber().replaceAll("\\s+", "").trim() : "";

            if (expectedAccount.isBlank()) {
                try {
                    UUID sId = UUID.fromString(order.getSellerId());
                    expectedAccount = sellerPaymentConfigRepository.findBySellerId(sId)
                            .map(c -> c.getAccountNumber() != null ? c.getAccountNumber().replaceAll("\\s+", "").trim() : "")
                            .orElse("");
                } catch (Exception ignored) {}
            }

            if (!expectedAccount.isBlank() && !incomingAccount.equalsIgnoreCase(expectedAccount)) {
                log.warn("Bank account mismatch for order {}: expected={}, received={}",
                        orderId, expectedAccount, incomingAccount);
                responseObserver.onError(Status.PERMISSION_DENIED
                        .withDescription(String.format("Account number mismatch: Webhook destination account '%s' does not match seller account '%s'",
                                incomingAccount, expectedAccount))
                        .asRuntimeException());
                return;
            }
        }

        if (order.getStatus() == OrderStatus.CONFIRMED) {
            log.info("Order {} is already CONFIRMED. Acknowledging webhook as idempotent.", orderId);
            responseObserver.onNext(OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(order))
                    .setMessage("Order was already confirmed previously (Idempotent webhook).")
                    .build());
            responseObserver.onCompleted();
            return;
        }

        if (request.getTransferAmount() < order.getTotalAmount()) {
            log.warn("Insufficient payment for order {}: received={}, required={}",
                    orderId, request.getTransferAmount(), order.getTotalAmount());
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription(String.format("Transfer amount %d is less than order total %d",
                            request.getTransferAmount(), order.getTotalAmount()))
                    .asRuntimeException());
            return;
        }

        try {
            // Finalize catalog status
            catalogServiceStub.markProductSold(MarkProductSoldRequest.newBuilder()
                    .setProductId(order.getProductId())
                    .setBuyerId(order.getBuyerId())
                    .setOrderId(order.getId().toString())
                    .build());

            String txRef = request.getReferenceCode();
            if (txRef == null || txRef.isBlank()) txRef = request.getCode();
            if (txRef == null || txRef.isBlank()) txRef = "SEPAY-" + System.currentTimeMillis();
            order.setTransactionReference(txRef);

            order.setStatus(OrderStatus.CONFIRMED);
            order.setUpdatedAt(System.currentTimeMillis());
            OrderEntity savedOrder = orderRepository.save(order);

            // Clean up Redis countdown key
            try {
                redisTemplate.delete(REDIS_ORDER_TIMEOUT_PREFIX + order.getId());
            } catch (Exception ex) {
                log.warn("Redis delete error: {}", ex.getMessage());
            }

            log.info("Order {} CONFIRMED via SePay Webhook! Amount: {} {}", order.getId(), request.getTransferAmount(), order.getCurrency());

            responseObserver.onNext(OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(savedOrder))
                    .setMessage("Payment verified and order confirmed successfully via SePay webhook.")
                    .build());
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Error processing SePay webhook for order {}: {}", orderId, e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Error confirming order via webhook: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    /**
     * Simulate Payment for Seller Test Mode:
     * Immediately confirms order without real bank transfer if seller has test_mode enabled.
     */
    @Override
    @Transactional
    public void simulatePayment(SimulatePaymentRequest request, StreamObserver<OrderResponse> responseObserver) {
        UUID orderId;
        try {
            orderId = UUID.fromString(request.getOrderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid orderId UUID")
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + request.getOrderId())
                    .asRuntimeException());
            return;
        }

        if (order.getStatus() == OrderStatus.CONFIRMED) {
            responseObserver.onNext(OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(order))
                    .setMessage("Order is already confirmed.")
                    .build());
            responseObserver.onCompleted();
            return;
        }

        // Validate seller test mode
        try {
            UUID sellerUuid = UUID.fromString(order.getSellerId());
            Optional<SellerPaymentConfigEntity> configOpt = sellerPaymentConfigRepository.findBySellerId(sellerUuid);
            boolean isTestMode = configOpt.map(SellerPaymentConfigEntity::getTestMode).orElse(true);

            if (!isTestMode) {
                responseObserver.onError(Status.FAILED_PRECONDITION
                        .withDescription("Simulate payment is only permitted when seller has test_mode enabled")
                        .asRuntimeException());
                return;
            }
        } catch (Exception ex) {
            log.warn("Error checking test mode for order {}: {}", orderId, ex.getMessage());
        }

        try {
            catalogServiceStub.markProductSold(MarkProductSoldRequest.newBuilder()
                    .setProductId(order.getProductId())
                    .setBuyerId(order.getBuyerId())
                    .setOrderId(order.getId().toString())
                    .build());

            order.setStatus(OrderStatus.CONFIRMED);
            order.setUpdatedAt(System.currentTimeMillis());
            OrderEntity savedOrder = orderRepository.save(order);

            try {
                redisTemplate.delete(REDIS_ORDER_TIMEOUT_PREFIX + order.getId());
            } catch (Exception ex) {
                log.warn("Redis delete error: {}", ex.getMessage());
            }

            log.info("Order {} CONFIRMED via simulated payment (Test Mode)", orderId);

            responseObserver.onNext(OrderResponse.newBuilder()
                    .setOrder(toProtoOrder(savedOrder))
                    .setMessage("Simulated test payment successful. Order is now CONFIRMED.")
                    .build());
            responseObserver.onCompleted();

        } catch (Exception e) {
            log.error("Error simulating payment for order {}: {}", orderId, e.getMessage(), e);
            responseObserver.onError(Status.INTERNAL
                    .withDescription("Error simulating payment: " + e.getMessage())
                    .asRuntimeException());
        }
    }

    /**
     * Saga Compensation Rollback Scheduler:
     * Automatically scans for orders remaining in PENDING_PAYMENT after the 15-minute deadline.
     * Triggers CatalogService.ReleaseProduct to return product to AVAILABLE.
     */
    @Scheduled(fixedDelay = 60000)
    @Transactional
    public void processExpiredOrdersSagaRollback() {
        long now = System.currentTimeMillis();
        List<OrderEntity> expiredOrders = orderRepository.findByStatusAndPaymentDeadlineEpochMsLessThanEqual(
                OrderStatus.PENDING_PAYMENT, now
        );

        for (OrderEntity order : expiredOrders) {
            if (order.getPaymentDeadlineEpochMs() == null || order.getPaymentDeadlineEpochMs() <= 0L) {
                continue;
            }
            try {
                log.info("Executing Saga Rollback for expired orderId={}, productId={}", order.getId(), order.getProductId());

                ReleaseProductRequest releaseReq = ReleaseProductRequest.newBuilder()
                        .setProductId(order.getProductId())
                        .setOrderId(order.getId().toString())
                        .setReason("Payment timeout: 15-minute deadline expired without receipt")
                        .build();

                catalogServiceStub.releaseProduct(releaseReq);

                order.setStatus(OrderStatus.CANCELLED);
                order.setUpdatedAt(now);
                orderRepository.save(order);

                try {
                    redisTemplate.delete(REDIS_ORDER_TIMEOUT_PREFIX + order.getId());
                } catch (Exception redisEx) {
                    log.warn("Redis key cleanup failed for {}: {}", order.getId(), redisEx.getMessage());
                }

                log.info("Saga Rollback succeeded: Order {} cancelled, product {} is AVAILABLE", order.getId(), order.getProductId());
            } catch (Exception ex) {
                log.error("Failed to execute Saga Rollback for order {}: {}", order.getId(), ex.getMessage());
            }
        }
    }

    @Override
    public void getOrder(GetOrderRequest request, StreamObserver<OrderResponse> responseObserver) {
        if (request.getOrderId().isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("orderId must not be blank")
                    .asRuntimeException());
            return;
        }

        UUID orderId;
        try {
            orderId = UUID.fromString(request.getOrderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid orderId UUID format")
                    .asRuntimeException());
            return;
        }

        OrderEntity order = orderRepository.findById(orderId).orElse(null);
        if (order == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Order not found with ID: " + request.getOrderId())
                    .asRuntimeException());
            return;
        }

        if (!request.getUserId().isBlank()) {
            boolean authorized = order.getBuyerId().equals(request.getUserId())
                    || order.getSellerId().equals(request.getUserId())
                    || "system".equalsIgnoreCase(request.getUserId())
                    || "admin".equalsIgnoreCase(request.getUserId());
            if (!authorized) {
                responseObserver.onError(Status.PERMISSION_DENIED
                        .withDescription("Access denied: You are not authorized to view order " + request.getOrderId())
                        .asRuntimeException());
                return;
            }
        }

        responseObserver.onNext(OrderResponse.newBuilder()
                .setOrder(toProtoOrder(order))
                .setMessage("Order retrieved successfully")
                .build());
        responseObserver.onCompleted();
    }

    @Override
    public void listOrders(ListOrdersRequest request, StreamObserver<OrderListResponse> responseObserver) {
        String userId = request.getUserId();
        String role = request.getRole() != null ? request.getRole().toUpperCase().trim() : "";
        String statusFilter = request.getStatusFilter() != null ? request.getStatusFilter().toUpperCase().trim() : "";

        OrderStatus targetStatus = null;
        if (!statusFilter.isBlank()) {
            try {
                targetStatus = OrderStatus.valueOf(statusFilter);
            } catch (Exception ignored) {}
        }

        List<OrderEntity> orders;
        if ("SELLER".equals(role)) {
            if (targetStatus != null) {
                orders = orderRepository.findBySellerIdAndStatusOrderByCreatedAtDesc(userId, targetStatus);
            } else {
                orders = orderRepository.findBySellerIdOrderByCreatedAtDesc(userId);
            }
        } else if ("BUYER".equals(role)) {
            if (targetStatus != null) {
                orders = orderRepository.findByBuyerIdAndStatusOrderByCreatedAtDesc(userId, targetStatus);
            } else {
                orders = orderRepository.findByBuyerIdOrderByCreatedAtDesc(userId);
            }
        } else if ("ADMIN".equals(role)) {
            orders = orderRepository.findAllByOrderByCreatedAtDesc();
            if (targetStatus != null) {
                OrderStatus finalStatus = targetStatus;
                orders = orders.stream().filter(o -> o.getStatus() == finalStatus).toList();
            }
        } else {
            orders = orderRepository.findBySellerIdOrderByCreatedAtDesc(userId);
            if (orders.isEmpty()) {
                orders = orderRepository.findByBuyerIdOrderByCreatedAtDesc(userId);
            }
            if (targetStatus != null) {
                OrderStatus finalStatus = targetStatus;
                orders = orders.stream().filter(o -> o.getStatus() == finalStatus).toList();
            }
        }

        OrderListResponse.Builder respBuilder = OrderListResponse.newBuilder()
                .setTotalCount(orders.size())
                .setCurrentPage(request.getPage() > 0 ? request.getPage() : 1)
                .setTotalPages(1);

        for (OrderEntity order : orders) {
            respBuilder.addOrders(toProtoOrder(order));
        }

        responseObserver.onNext(respBuilder.build());
        responseObserver.onCompleted();
    }

    private Order toProtoOrder(OrderEntity entity) {
        Order.Builder builder = Order.newBuilder()
                .setId(entity.getId() != null ? entity.getId().toString() : "")
                .setProductId(entity.getProductId() != null ? entity.getProductId() : "")
                .setBuyerId(entity.getBuyerId() != null ? entity.getBuyerId() : "")
                .setSellerId(entity.getSellerId() != null ? entity.getSellerId() : "")
                .setTotalAmount(entity.getTotalAmount() != null ? entity.getTotalAmount() : 0L)
                .setCurrency(entity.getCurrency() != null ? entity.getCurrency() : "VND")
                .setStatus(entity.getStatus() != null ? entity.getStatus() : OrderStatus.ORDER_STATUS_UNSPECIFIED)
                .setVietQrPayload(entity.getVietQrPayload() != null ? entity.getVietQrPayload() : "")
                .setReceiptImageUrl(entity.getReceiptImageUrl() != null ? entity.getReceiptImageUrl() : "")
                .setPaymentDeadlineEpochMs(entity.getPaymentDeadlineEpochMs() != null ? entity.getPaymentDeadlineEpochMs() : 0L)
                .setCreatedAt(entity.getCreatedAt() != null ? entity.getCreatedAt() : 0L)
                .setUpdatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt() : 0L);

        if (entity.getBankName() != null) builder.setBankName(entity.getBankName());
        if (entity.getBankAccountNumber() != null) builder.setBankAccountNumber(entity.getBankAccountNumber());
        if (entity.getBankAccountHolder() != null) builder.setBankAccountHolder(entity.getBankAccountHolder());
        if (entity.getTransactionReference() != null) builder.setTransactionReference(entity.getTransactionReference());

        return builder.build();
    }

    private SellerPaymentConfig toProtoConfig(SellerPaymentConfigEntity entity) {
        return SellerPaymentConfig.newBuilder()
                .setId(entity.getId() != null ? entity.getId().toString() : "")
                .setSellerId(entity.getSellerId() != null ? entity.getSellerId().toString() : "")
                .setBankName(entity.getBankName() != null ? entity.getBankName() : "")
                .setAccountNumber(entity.getAccountNumber() != null ? entity.getAccountNumber() : "")
                .setAccountHolder(entity.getAccountHolder() != null ? entity.getAccountHolder() : "")
                .setSepayApiKey(entity.getSepayApiKey() != null ? entity.getSepayApiKey() : "")
                .setSepayWebhookToken(entity.getSepayWebhookToken() != null ? entity.getSepayWebhookToken() : "")
                .setTestMode(Boolean.TRUE.equals(entity.getTestMode()))
                .setCreatedAt(entity.getCreatedAt() != null ? entity.getCreatedAt().toEpochMilli() : 0L)
                .setUpdatedAt(entity.getUpdatedAt() != null ? entity.getUpdatedAt().toEpochMilli() : 0L)
                .build();
    }
}
