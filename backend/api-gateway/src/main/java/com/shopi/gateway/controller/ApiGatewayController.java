package com.shopi.gateway.controller;

import com.shopi.gateway.dto.*;
import com.shopi.gateway.service.JwtTokenService;
import com.shopi.gateway.service.RateLimiterService;
import com.shopi.marketplace.v1.*;
import io.grpc.StatusRuntimeException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT, RequestMethod.DELETE, RequestMethod.OPTIONS})
@RequiredArgsConstructor
public class ApiGatewayController {

    @GrpcClient("order-payment-service")
    private OrderServiceGrpc.OrderServiceBlockingStub orderServiceStub;

    @GrpcClient("shop-catalog-service")
    private CatalogServiceGrpc.CatalogServiceBlockingStub catalogServiceStub;

    @GrpcClient("identity-service")
    private AuthServiceGrpc.AuthServiceBlockingStub authServiceStub;

    private final RateLimiterService rateLimiterService;
    private final JwtTokenService jwtTokenService;

    private void enforceRateLimitAndSecurity(HttpServletRequest request) {
        String authHeader = request.getHeader("Authorization");
        String token = jwtTokenService.extractToken(authHeader);

        String clientKey;
        if (token != null) {
            if (jwtTokenService.isBlacklisted(token)) {
                log.warn("Unauthorized request: Access token is blacklisted");
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Access token has been revoked / blacklisted");
            }
            String userId = jwtTokenService.extractUserId(token);
            clientKey = (userId != null && !userId.isBlank()) ? "user:" + userId : "token:" + token.hashCode();
        } else {
            String clientIp = request.getHeader("X-Forwarded-For");
            if (clientIp == null || clientIp.isBlank()) {
                clientIp = request.getRemoteAddr();
            }
            clientKey = "ip:" + clientIp;
        }

        if (!rateLimiterService.allowRequest(clientKey)) {
            log.warn("Rate limit exceeded for clientKey: {}", clientKey);
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded. Please try again later.");
        }
    }

    private String getAuthenticatedUserId(HttpServletRequest request, String fallback) {
        String authHeader = request.getHeader("Authorization");
        String token = jwtTokenService.extractToken(authHeader);
        if (token != null) {
            String userId = jwtTokenService.extractUserId(token);
            if (userId != null && !userId.isBlank()) return userId;
        }
        if (fallback != null && !fallback.isBlank()) return fallback;
        return null;
    }

    private String extractApiKeyFromHeader(String authHeader) {
        if (authHeader == null || authHeader.isBlank()) {
            return null;
        }
        String header = authHeader.trim();
        if (header.toLowerCase().startsWith("apikey ")) {
            return header.substring(7).trim();
        }
        if (header.toLowerCase().startsWith("bearer ")) {
            return header.substring(7).trim();
        }
        return header;
    }

    // ==========================================
    // Catalog Endpoints (REST to shop-catalog-service gRPC)
    // ==========================================

    @GetMapping("/products")
    public ResponseEntity<Map<String, Object>> listProducts(
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "query", required = false) String query,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);

        ListProductsRequest.Builder builder = ListProductsRequest.newBuilder()
                .setPage(page)
                .setPageSize(pageSize);

        if (category != null && !category.isBlank()) {
            builder.setCategory(category);
        }
        if (query != null && !query.isBlank()) {
            builder.setSearchQuery(query);
        }

        ProductListResponse grpcResponse = catalogServiceStub.listProducts(builder.build());

        List<Map<String, Object>> productList = new ArrayList<>();
        for (Product p : grpcResponse.getProductsList()) {
            productList.add(mapProductToMap(p));
        }

        return ResponseEntity.ok(Map.of(
                "products", productList,
                "totalCount", grpcResponse.getTotalCount(),
                "currentPage", grpcResponse.getCurrentPage(),
                "totalPages", grpcResponse.getTotalPages()
        ));
    }

    @GetMapping("/products/{slug}")
    public ResponseEntity<Map<String, Object>> getProduct(
            @PathVariable("slug") String slug,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);

        ProductQueryRequest grpcRequest = ProductQueryRequest.newBuilder()
                .setSlug(slug)
                .build();

        ProductResponse grpcResponse = catalogServiceStub.getProduct(grpcRequest);
        return ResponseEntity.ok(mapProductToMap(grpcResponse.getProduct()));
    }

    // ==========================================
    // Order Endpoints (REST to order-payment-service gRPC)
    // ==========================================

    @PostMapping("/orders")
    public ResponseEntity<OrderResponseDto> createOrder(
            @Valid @RequestBody CreateOrderRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST CreateOrder received: productId={}, buyerId={}", requestDto.getProductId(), requestDto.getBuyerId());

        CreateOrderRequest grpcRequest = CreateOrderRequest.newBuilder()
                .setProductId(requestDto.getProductId())
                .setBuyerId(requestDto.getBuyerId())
                .build();

        OrderResponse grpcResponse = orderServiceStub.createOrder(grpcRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToOrderDto(grpcResponse));
    }

    @PostMapping("/orders/{id}/receipt")
    public ResponseEntity<OrderResponseDto> submitPaymentReceipt(
            @PathVariable("id") String orderId,
            @Valid @RequestBody SubmitReceiptRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST SubmitReceipt received: orderId={}", orderId);

        SubmitPaymentReceiptRequest grpcRequest = SubmitPaymentReceiptRequest.newBuilder()
                .setOrderId(orderId)
                .setBuyerId(requestDto.getBuyerId())
                .setReceiptImageUrl(requestDto.getReceiptImageUrl())
                .build();

        OrderResponse grpcResponse = orderServiceStub.submitPaymentReceipt(grpcRequest);
        return ResponseEntity.ok(mapToOrderDto(grpcResponse));
    }

    @PostMapping("/orders/{id}/confirm")
    public ResponseEntity<OrderResponseDto> confirmOrder(
            @PathVariable("id") String orderId,
            @Valid @RequestBody ConfirmOrderRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST ConfirmOrder received: orderId={}, sellerId={}", orderId, requestDto.getSellerId());

        ConfirmOrderRequest grpcRequest = ConfirmOrderRequest.newBuilder()
                .setOrderId(orderId)
                .setSellerId(requestDto.getSellerId())
                .build();

        OrderResponse grpcResponse = orderServiceStub.confirmOrder(grpcRequest);
        return ResponseEntity.ok(mapToOrderDto(grpcResponse));
    }

    @PostMapping("/orders/{id}/cancel")
    public ResponseEntity<OrderResponseDto> cancelOrder(
            @PathVariable("id") String orderId,
            @RequestBody(required = false) CancelOrderRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String requestedUserId = (requestDto != null) ? requestDto.getUserId() : null;
        String reason = (requestDto != null && requestDto.getReason() != null && !requestDto.getReason().isBlank())
                ? requestDto.getReason()
                : "Người mua hủy đơn hàng";
        String userId = getAuthenticatedUserId(request, requestedUserId);
        if (userId == null || userId.isBlank()) {
            userId = (requestedUserId != null && !requestedUserId.isBlank()) ? requestedUserId : "system";
        }

        log.info("REST CancelOrder received: orderId={}, userId={}, reason={}", orderId, userId, reason);

        CancelOrderRequest grpcRequest = CancelOrderRequest.newBuilder()
                .setOrderId(orderId)
                .setUserId(userId)
                .setReason(reason)
                .build();

        OrderResponse grpcResponse = orderServiceStub.cancelOrder(grpcRequest);
        return ResponseEntity.ok(mapToOrderDto(grpcResponse));
    }

    /**
     * Rollback Order (restore product inventory & mark order CANCELLED)
     * POST /api/orders/{id}/rollback
     */
    @PostMapping("/orders/{id}/rollback")
    public ResponseEntity<OrderResponseDto> rollbackOrder(
            @PathVariable("id") String orderId,
            @RequestBody(required = false) CancelOrderRequestDto requestDto,
            HttpServletRequest request
    ) {
        return cancelOrder(orderId, requestDto, request);
    }

    /**
     * Simulate Payment (for testing / demo when seller has test_mode = true)
     * POST /api/orders/{id}/simulate-payment
     */
    @PostMapping("/orders/{id}/simulate-payment")
    public ResponseEntity<OrderResponseDto> simulatePayment(
            @PathVariable("id") String orderId,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String userId = getAuthenticatedUserId(request, "test-buyer");

        log.info("REST SimulatePayment received: orderId={}, userId={}", orderId, userId);

        OrderResponse grpcResponse = orderServiceStub.simulatePayment(
                SimulatePaymentRequest.newBuilder()
                        .setOrderId(orderId)
                        .setUserId(userId != null ? userId : "")
                        .build()
        );

        return ResponseEntity.ok(mapToOrderDto(grpcResponse));
    }

    /**
     * Get single order details
     * GET /api/orders/{id}
     */
    @GetMapping("/orders/{id}")
    public ResponseEntity<OrderResponseDto> getOrder(
            @PathVariable("id") String orderId,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String userId = getAuthenticatedUserId(request, "");

        OrderResponse res = orderServiceStub.getOrder(
                GetOrderRequest.newBuilder()
                        .setOrderId(orderId)
                        .setUserId(userId != null ? userId : "")
                        .build()
        );

        return ResponseEntity.ok(mapToOrderDto(res));
    }

    /**
     * List Seller Orders / Invoices
     * GET /api/seller/orders
     */
    @GetMapping("/seller/orders")
    public ResponseEntity<Map<String, Object>> getSellerOrders(
            @RequestParam(value = "sellerId", required = false) String sellerIdParam,
            @RequestParam(value = "status", required = false) String statusParam,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String sellerId = getAuthenticatedUserId(request, sellerIdParam);
        if (sellerId == null || sellerId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sellerId is required");
        }

        ListOrdersRequest.Builder b = ListOrdersRequest.newBuilder()
                .setUserId(sellerId)
                .setRole("SELLER")
                .setPage(page)
                .setPageSize(pageSize);
        if (statusParam != null && !statusParam.isBlank()) {
            b.setStatusFilter(statusParam);
        }

        OrderListResponse protoRes = orderServiceStub.listOrders(b.build());
        List<OrderResponseDto> dtos = new ArrayList<>();
        for (Order o : protoRes.getOrdersList()) {
            dtos.add(mapProtoOrderToDto(o, ""));
        }

        return ResponseEntity.ok(Map.of(
                "orders", dtos,
                "totalCount", protoRes.getTotalCount(),
                "currentPage", protoRes.getCurrentPage(),
                "totalPages", protoRes.getTotalPages()
        ));
    }

    /**
     * General Orders Query (Supports ?sellerId=... or ?buyerId=...)
     * GET /api/orders
     */
    @GetMapping("/orders")
    public ResponseEntity<Map<String, Object>> listOrders(
            @RequestParam(value = "sellerId", required = false) String sellerIdParam,
            @RequestParam(value = "buyerId", required = false) String buyerIdParam,
            @RequestParam(value = "status", required = false) String statusParam,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);

        String role = "BUYER";
        String targetUserId = null;

        if (sellerIdParam != null && !sellerIdParam.isBlank()) {
            role = "SELLER";
            targetUserId = sellerIdParam;
        } else if (buyerIdParam != null && !buyerIdParam.isBlank()) {
            role = "BUYER";
            targetUserId = buyerIdParam;
        } else {
            targetUserId = getAuthenticatedUserId(request, null);
            if (targetUserId == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Must provide sellerId, buyerId, or authenticated token");
            }
        }

        ListOrdersRequest.Builder b = ListOrdersRequest.newBuilder()
                .setUserId(targetUserId)
                .setRole(role)
                .setPage(page)
                .setPageSize(pageSize);
        if (statusParam != null && !statusParam.isBlank()) {
            b.setStatusFilter(statusParam);
        }

        OrderListResponse protoRes = orderServiceStub.listOrders(b.build());
        List<OrderResponseDto> dtos = new ArrayList<>();
        for (Order o : protoRes.getOrdersList()) {
            dtos.add(mapProtoOrderToDto(o, ""));
        }

        return ResponseEntity.ok(Map.of(
                "orders", dtos,
                "totalCount", protoRes.getTotalCount(),
                "currentPage", protoRes.getCurrentPage(),
                "totalPages", protoRes.getTotalPages()
        ));
    }

    // ==========================================
    // SePay Webhook & Seller Payment Config
    // ==========================================

    @GetMapping("/seller/payment-config")
    public ResponseEntity<SellerPaymentConfigDto> getSellerPaymentConfig(
            @RequestParam(value = "sellerId", required = false) String sellerIdParam,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String sellerId = getAuthenticatedUserId(request, sellerIdParam);
        if (sellerId == null || sellerId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sellerId is required");
        }

        SellerPaymentConfigResponse res = orderServiceStub.getSellerPaymentConfig(
                GetSellerPaymentConfigRequest.newBuilder().setSellerId(sellerId).build()
        );

        SellerPaymentConfig c = res.getConfig();
        return ResponseEntity.ok(SellerPaymentConfigDto.builder()
                .id(c.getId())
                .sellerId(c.getSellerId())
                .bankName(c.getBankName())
                .accountNumber(c.getAccountNumber())
                .accountHolder(c.getAccountHolder())
                .sepayApiKey(c.getSepayApiKey())
                .sepayWebhookToken(c.getSepayWebhookToken())
                .testMode(c.getTestMode())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build());
    }

    @PostMapping("/seller/payment-config")
    public ResponseEntity<SellerPaymentConfigDto> saveSellerPaymentConfig(
            @Valid @RequestBody SellerPaymentConfigDto configDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        String sellerId = getAuthenticatedUserId(request, configDto.getSellerId());
        if (sellerId == null || sellerId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "sellerId is required");
        }

        SaveSellerPaymentConfigRequest.Builder b = SaveSellerPaymentConfigRequest.newBuilder()
                .setSellerId(sellerId)
                .setTestMode(configDto.getTestMode() == null || configDto.getTestMode());

        if (configDto.getBankName() != null) b.setBankName(configDto.getBankName());
        if (configDto.getAccountNumber() != null) b.setAccountNumber(configDto.getAccountNumber());
        if (configDto.getAccountHolder() != null) b.setAccountHolder(configDto.getAccountHolder());
        if (configDto.getSepayApiKey() != null) b.setSepayApiKey(configDto.getSepayApiKey());
        if (configDto.getSepayWebhookToken() != null) b.setSepayWebhookToken(configDto.getSepayWebhookToken());

        SellerPaymentConfigResponse res = orderServiceStub.saveSellerPaymentConfig(b.build());
        SellerPaymentConfig c = res.getConfig();

        return ResponseEntity.ok(SellerPaymentConfigDto.builder()
                .id(c.getId())
                .sellerId(c.getSellerId())
                .bankName(c.getBankName())
                .accountNumber(c.getAccountNumber())
                .accountHolder(c.getAccountHolder())
                .sepayApiKey(c.getSepayApiKey())
                .sepayWebhookToken(c.getSepayWebhookToken())
                .testMode(c.getTestMode())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build());
    }

    /**
     * Dedicated Per-Seller Incoming SePay Webhook Endpoint
     * POST /api/webhooks/sepay/{sellerId}
     */
    @PostMapping("/webhooks/sepay/{sellerId}")
    public ResponseEntity<Map<String, Object>> processSellerSepayWebhook(
            @PathVariable("sellerId") String sellerId,
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody SepayWebhookDto webhookDto
    ) {
        log.info("Received incoming dedicated SePay webhook for sellerId={}: gateway={}, transferAmount={}, content='{}'",
                sellerId, webhookDto.getGateway(), webhookDto.getTransferAmount(), webhookDto.getContent());

        // Validate webhook API Key / Token against seller's configured secret
        try {
            SellerPaymentConfigResponse configRes = orderServiceStub.getSellerPaymentConfig(
                    GetSellerPaymentConfigRequest.newBuilder().setSellerId(sellerId).build()
            );
            SellerPaymentConfig config = configRes.getConfig();
            String configuredToken = config.getSepayWebhookToken();

            if (configuredToken != null && !configuredToken.isBlank()) {
                String providedToken = extractApiKeyFromHeader(authHeader);
                if (providedToken == null || !providedToken.equals(configuredToken.trim())) {
                    log.warn("Unauthorized SePay webhook attempt for seller {}: token mismatch or missing", sellerId);
                    throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid SePay Webhook Apikey for seller: " + sellerId);
                }
            }
        } catch (StatusRuntimeException e) {
            if (e.getStatus().getCode() == io.grpc.Status.Code.NOT_FOUND) {
                log.warn("Payment config not found for seller {}. Rejecting webhook.", sellerId);
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No payment configuration found for seller: " + sellerId);
            }
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Failed to verify seller payment config: " + e.getMessage());
        }

        ProcessSepayWebhookRequest.Builder b = ProcessSepayWebhookRequest.newBuilder()
                .setSellerId(sellerId)
                .setContent(webhookDto.getContent() != null ? webhookDto.getContent() : "")
                .setTransferAmount(webhookDto.getTransferAmount() != null ? webhookDto.getTransferAmount() : 0L);

        if (webhookDto.getGateway() != null) b.setGateway(webhookDto.getGateway());
        if (webhookDto.getTransactionDate() != null) b.setTransactionDate(webhookDto.getTransactionDate());
        if (webhookDto.getAccountNumber() != null) b.setAccountNumber(webhookDto.getAccountNumber());
        if (webhookDto.getCode() != null) b.setCode(webhookDto.getCode());
        if (webhookDto.getTransferType() != null) b.setTransferType(webhookDto.getTransferType());
        if (webhookDto.getReferenceCode() != null) b.setReferenceCode(webhookDto.getReferenceCode());
        if (webhookDto.getSubAccount() != null) b.setSubAccount(webhookDto.getSubAccount());

        OrderResponse protoRes = orderServiceStub.processSepayWebhook(b.build());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", protoRes.getMessage(),
                "orderId", protoRes.getOrder().getId(),
                "orderStatus", protoRes.getOrder().getStatus().name()
        ));
    }

    /**
     * Incoming General / Fallback SePay Transaction Webhook Endpoint
     * POST /api/webhooks/sepay
     */
    @PostMapping("/webhooks/sepay")
    public ResponseEntity<Map<String, Object>> processSepayWebhook(@RequestBody SepayWebhookDto webhookDto) {
        log.info("Received incoming generic SePay webhook: gateway={}, transferAmount={}, content='{}'",
                webhookDto.getGateway(), webhookDto.getTransferAmount(), webhookDto.getContent());

        ProcessSepayWebhookRequest.Builder b = ProcessSepayWebhookRequest.newBuilder()
                .setContent(webhookDto.getContent() != null ? webhookDto.getContent() : "")
                .setTransferAmount(webhookDto.getTransferAmount() != null ? webhookDto.getTransferAmount() : 0L);

        if (webhookDto.getGateway() != null) b.setGateway(webhookDto.getGateway());
        if (webhookDto.getTransactionDate() != null) b.setTransactionDate(webhookDto.getTransactionDate());
        if (webhookDto.getAccountNumber() != null) b.setAccountNumber(webhookDto.getAccountNumber());
        if (webhookDto.getCode() != null) b.setCode(webhookDto.getCode());
        if (webhookDto.getTransferType() != null) b.setTransferType(webhookDto.getTransferType());
        if (webhookDto.getReferenceCode() != null) b.setReferenceCode(webhookDto.getReferenceCode());
        if (webhookDto.getSubAccount() != null) b.setSubAccount(webhookDto.getSubAccount());

        OrderResponse protoRes = orderServiceStub.processSepayWebhook(b.build());

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", protoRes.getMessage(),
                "orderId", protoRes.getOrder().getId(),
                "orderStatus", protoRes.getOrder().getStatus().name()
        ));
    }

    // ==========================================
    // Auth Endpoints (REST to identity-service gRPC)
    // ==========================================

    @PostMapping("/auth/register/send-otp")
    public ResponseEntity<Map<String, Object>> sendOtp(
            @Valid @RequestBody SendOtpRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST SendOtp request for email: {}", requestDto.getEmail());

        SendOtpRequest grpcRequest = SendOtpRequest.newBuilder()
                .setEmail(requestDto.getEmail().trim().toLowerCase())
                .build();

        SendOtpResponse grpcResponse = authServiceStub.sendOtp(grpcRequest);

        return ResponseEntity.ok(Map.of(
                "success", grpcResponse.getSuccess(),
                "message", grpcResponse.getMessage()
        ));
    }

    @PostMapping("/auth/register/verify-otp")
    public ResponseEntity<Map<String, Object>> verifyOtp(
            @Valid @RequestBody VerifyOtpRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST VerifyOtp request for email: {}", requestDto.getEmail());

        VerifyOtpRequest grpcRequest = VerifyOtpRequest.newBuilder()
                .setEmail(requestDto.getEmail().trim().toLowerCase())
                .setOtpCode(requestDto.getOtpCode().trim())
                .build();

        VerifyOtpResponse grpcResponse = authServiceStub.verifyOtp(grpcRequest);

        return ResponseEntity.ok(Map.of(
                "success", grpcResponse.getSuccess(),
                "message", grpcResponse.getMessage(),
                "verificationToken", grpcResponse.getVerificationToken()
        ));
    }

    @PostMapping("/auth/register/email")
    public ResponseEntity<LoginResponseDto> registerWithEmail(
            @Valid @RequestBody RegisterWithEmailRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST RegisterWithEmail request for email: {}", requestDto.getEmail());

        RegisterWithEmailRequest grpcRequest = RegisterWithEmailRequest.newBuilder()
                .setEmail(requestDto.getEmail().trim().toLowerCase())
                .setPassword(requestDto.getPassword())
                .setFullName(requestDto.getFullName().trim())
                .setVerificationToken(requestDto.getVerificationToken().trim())
                .build();

        LoginResponse grpcResponse = authServiceStub.registerWithEmail(grpcRequest);

        LoginResponseDto responseDto = LoginResponseDto.builder()
                .accessToken(grpcResponse.getAccessToken())
                .refreshToken(grpcResponse.getRefreshToken())
                .expiresIn(grpcResponse.getExpiresIn())
                .tokenType(grpcResponse.getTokenType())
                .userId(grpcResponse.getUserId())
                .email(grpcResponse.getEmail())
                .role(grpcResponse.getRole())
                .fullName(grpcResponse.getFullName())
                .build();

        return ResponseEntity.status(HttpStatus.CREATED).body(responseDto);
    }

    @PostMapping("/auth/google")
    public ResponseEntity<LoginResponseDto> loginWithGoogle(
            @RequestBody GoogleLoginRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST LoginWithGoogle request for email: {}", requestDto.getEmail());

        LoginWithGoogleRequest.Builder builder = LoginWithGoogleRequest.newBuilder();
        if (requestDto.getIdToken() != null) builder.setIdToken(requestDto.getIdToken());
        if (requestDto.getEmail() != null) builder.setEmail(requestDto.getEmail().trim().toLowerCase());
        if (requestDto.getFullName() != null) builder.setFullName(requestDto.getFullName().trim());
        if (requestDto.getAvatarUrl() != null) builder.setAvatarUrl(requestDto.getAvatarUrl());

        LoginResponse grpcResponse = authServiceStub.loginWithGoogle(builder.build());

        LoginResponseDto responseDto = LoginResponseDto.builder()
                .accessToken(grpcResponse.getAccessToken())
                .refreshToken(grpcResponse.getRefreshToken())
                .expiresIn(grpcResponse.getExpiresIn())
                .tokenType(grpcResponse.getTokenType())
                .userId(grpcResponse.getUserId())
                .email(grpcResponse.getEmail())
                .role(grpcResponse.getRole())
                .fullName(grpcResponse.getFullName())
                .build();

        return ResponseEntity.ok(responseDto);
    }

    @PostMapping("/auth/login")
    public ResponseEntity<LoginResponseDto> login(
            @Valid @RequestBody LoginRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST Login request for email: {}", requestDto.getEmail());

        LoginRequest grpcRequest = LoginRequest.newBuilder()
                .setEmail(requestDto.getEmail().trim().toLowerCase())
                .setPassword(requestDto.getPassword())
                .build();

        LoginResponse grpcResponse = authServiceStub.login(grpcRequest);

        LoginResponseDto responseDto = LoginResponseDto.builder()
                .accessToken(grpcResponse.getAccessToken())
                .refreshToken(grpcResponse.getRefreshToken())
                .expiresIn(grpcResponse.getExpiresIn())
                .tokenType(grpcResponse.getTokenType())
                .userId(grpcResponse.getUserId())
                .email(grpcResponse.getEmail())
                .role(grpcResponse.getRole())
                .fullName(grpcResponse.getFullName())
                .build();

        return ResponseEntity.ok(responseDto);
    }

    @PostMapping("/auth/refresh")
    public ResponseEntity<TokenResponseDto> refreshToken(
            @Valid @RequestBody RefreshTokenRequestDto requestDto,
            HttpServletRequest request
    ) {
        enforceRateLimitAndSecurity(request);
        log.info("REST RefreshToken request received via identity-service");

        RefreshTokenRequest grpcRequest = RefreshTokenRequest.newBuilder()
                .setRefreshToken(requestDto.getRefreshToken())
                .build();

        TokenResponse grpcResponse = authServiceStub.refreshToken(grpcRequest);

        TokenResponseDto responseDto = TokenResponseDto.builder()
                .accessToken(grpcResponse.getAccessToken())
                .refreshToken(grpcResponse.getRefreshToken())
                .expiresIn(grpcResponse.getExpiresIn())
                .tokenType(grpcResponse.getTokenType())
                .build();

        return ResponseEntity.ok(responseDto);
    }

    @PostMapping("/auth/logout")
    public ResponseEntity<Map<String, Object>> logout(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestParam(value = "refreshToken", required = false) String refreshTokenParam,
            @RequestBody(required = false) RefreshTokenRequestDto bodyDto,
            HttpServletRequest request
    ) {
        log.info("REST Logout request received via identity-service");

        String token = jwtTokenService.extractToken(authHeader);
        if (token != null) {
            jwtTokenService.blacklistToken(token, Duration.ofMinutes(15));
        }

        String refreshToken = null;
        if (bodyDto != null && bodyDto.getRefreshToken() != null && !bodyDto.getRefreshToken().isBlank()) {
            refreshToken = bodyDto.getRefreshToken();
        } else if (refreshTokenParam != null && !refreshTokenParam.isBlank()) {
            refreshToken = refreshTokenParam;
        }

        RevokeTokenRequest grpcRequest = RevokeTokenRequest.newBuilder()
                .setAccessToken(token != null ? token : "")
                .setRefreshToken(refreshToken != null ? refreshToken : "")
                .build();

        RevokeTokenResponse grpcResponse = authServiceStub.revokeToken(grpcRequest);

        return ResponseEntity.ok(Map.of(
                "success", grpcResponse.getSuccess(),
                "message", grpcResponse.getMessage().isBlank() ? "Logged out successfully" : grpcResponse.getMessage()
        ));
    }

    private OrderResponseDto mapToOrderDto(OrderResponse protoResponse) {
        return mapProtoOrderToDto(protoResponse.getOrder(), protoResponse.getMessage());
    }

    private OrderResponseDto mapProtoOrderToDto(Order order, String message) {
        return OrderResponseDto.builder()
                .id(order.getId())
                .productId(order.getProductId())
                .buyerId(order.getBuyerId())
                .sellerId(order.getSellerId())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency().isBlank() ? "VND" : order.getCurrency())
                .status(order.getStatus().name())
                .vietQrPayload(order.getVietQrPayload())
                .receiptImageUrl(order.getReceiptImageUrl())
                .paymentDeadlineEpochMs(order.getPaymentDeadlineEpochMs())
                .bankName(order.getBankName())
                .bankAccountNumber(order.getBankAccountNumber())
                .bankAccountHolder(order.getBankAccountHolder())
                .transactionReference(order.getTransactionReference())
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .message(message != null ? message : "")
                .build();
    }

    private Map<String, Object> mapProductToMap(Product p) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", p.getId());
        map.put("title", p.getTitle());
        map.put("slug", p.getSlug());
        map.put("description", p.getDescription());
        map.put("priceAmount", p.getPriceAmount());
        map.put("currency", p.getCurrency().isBlank() ? "VND" : p.getCurrency());
        map.put("category", p.getCategory());
        map.put("imageUrls", p.getImageUrlsList());
        map.put("status", p.getStatus().name());
        map.put("sellerId", p.getSellerId());
        map.put("quantity", p.getQuantity());
        return map;
    }
}
