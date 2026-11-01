package com.shopi.order;

import com.shopi.marketplace.v1.*;
import com.shopi.order.domain.OrderEntity;
import com.shopi.order.grpc.OrderServiceGrpcImpl;
import com.shopi.order.repository.OrderRepository;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@SpringBootTest
@Testcontainers
public class OrderServiceGrpcIntegrationTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine")
            .withDatabaseName("shopi_test_order_db")
            .withUsername("shopi_test_user")
            .withPassword("shopi_test_pass");

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl);
        registry.add("spring.datasource.username", postgres::getUsername);
        registry.add("spring.datasource.password", postgres::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", () -> redis.getMappedPort(6379));
        registry.add("SPRING_DATA_REDIS_HOST", redis::getHost);
        registry.add("SPRING_DATA_REDIS_PORT", () -> String.valueOf(redis.getMappedPort(6379)));
        registry.add("grpc.client.shop-catalog-service.address", () -> "in-process:test");
    }

    @Autowired
    private OrderServiceGrpcImpl orderServiceGrpc;

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Mock
    private CatalogServiceGrpc.CatalogServiceBlockingStub catalogServiceStub;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(orderServiceGrpc, "catalogServiceStub", catalogServiceStub);
        orderRepository.deleteAll();
        try {
            redisTemplate.getConnectionFactory().getConnection().serverCommands().flushAll();
        } catch (Exception ignored) {}
    }

    /**
     * Test 1: Full Saga Happy Path:
     * CreateOrder (reserves product AVAILABLE -> RESERVED)
     * -> SubmitPaymentReceipt (status PROOF_UPLOADED)
     * -> ConfirmOrder (status CONFIRMED & product status SOLD).
     */
    @Test
    @DisplayName("Saga Happy Path: CreateOrder -> SubmitReceipt -> ConfirmOrder -> Product SOLD")
    void testFullSagaHappyPath() throws Exception {
        // Arrange
        String productId = "prod-macbook-pro-16-m1-max";
        String buyerId = "buyer-alice-01";
        String sellerId = "b0000000-0000-0000-0000-000000000099";
        long price = 43500000L;

        when(catalogServiceStub.reserveProduct(any(ReserveProductRequest.class))).thenAnswer(invocation -> {
            ReserveProductRequest req = invocation.getArgument(0);
            return ReserveProductResponse.newBuilder()
                    .setSuccess(true)
                    .setMessage("Reservation acquired")
                    .setProduct(Product.newBuilder()
                            .setId(req.getProductId())
                            .setSellerId(sellerId)
                            .setPriceAmount(price)
                            .setCurrency("VND")
                            .setStatus(ProductStatus.RESERVED)
                            .build())
                    .build();
        });

        when(catalogServiceStub.markProductSold(any(MarkProductSoldRequest.class))).thenAnswer(invocation -> {
            MarkProductSoldRequest req = invocation.getArgument(0);
            return ProductResponse.newBuilder()
                    .setProduct(Product.newBuilder()
                            .setId(req.getProductId())
                            .setStatus(ProductStatus.SOLD)
                            .build())
                    .build();
        });

        // Act 1: Buyer creates order (Atomic Reservation)
        CreateOrderRequest createReq = CreateOrderRequest.newBuilder()
                .setProductId(productId)
                .setBuyerId(buyerId)
                .build();

        SyncObserver<OrderResponse> createObserver = new SyncObserver<>();
        orderServiceGrpc.createOrder(createReq, createObserver);
        OrderResponse createRes = createObserver.get(5, TimeUnit.SECONDS);

        assertThat(createRes).isNotNull();
        String orderId = createRes.getOrder().getId();
        assertThat(orderId).isNotBlank();
        assertThat(createRes.getOrder().getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(createRes.getOrder().getVietQrPayload()).contains("amount=43500000");

        // Verify database persistence & Redis TTL countdown key
        OrderEntity createdEntity = orderRepository.findById(UUID.fromString(orderId)).orElse(null);
        assertThat(createdEntity).isNotNull();
        assertThat(createdEntity.getStatus()).isEqualTo(OrderStatus.PENDING_PAYMENT);
        assertThat(createdEntity.getBuyerId()).isEqualTo(buyerId);
        assertThat(createdEntity.getSellerId()).isEqualTo(sellerId);

        String redisTimeoutProductId = redisTemplate.opsForValue().get("order:timeout:" + orderId);
        assertThat(redisTimeoutProductId).isEqualTo(productId);

        // Act 2: Buyer submits VietQR payment receipt proof
        String receiptUrl = "https://cdn.shopi.vn/receipts/proof-alice-transfer.jpg";
        SubmitPaymentReceiptRequest receiptReq = SubmitPaymentReceiptRequest.newBuilder()
                .setOrderId(orderId)
                .setBuyerId(buyerId)
                .setReceiptImageUrl(receiptUrl)
                .build();

        SyncObserver<OrderResponse> receiptObserver = new SyncObserver<>();
        orderServiceGrpc.submitPaymentReceipt(receiptReq, receiptObserver);
        OrderResponse receiptRes = receiptObserver.get(5, TimeUnit.SECONDS);

        assertThat(receiptRes.getOrder().getStatus()).isEqualTo(OrderStatus.PROOF_UPLOADED);
        assertThat(receiptRes.getOrder().getReceiptImageUrl()).isEqualTo(receiptUrl);

        OrderEntity receiptEntity = orderRepository.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(receiptEntity.getStatus()).isEqualTo(OrderStatus.PROOF_UPLOADED);

        // Act 3: Seller validates proof and confirms order -> Marks SOLD
        ConfirmOrderRequest confirmReq = ConfirmOrderRequest.newBuilder()
                .setOrderId(orderId)
                .setSellerId(sellerId)
                .build();

        SyncObserver<OrderResponse> confirmObserver = new SyncObserver<>();
        orderServiceGrpc.confirmOrder(confirmReq, confirmObserver);
        OrderResponse confirmRes = confirmObserver.get(5, TimeUnit.SECONDS);

        assertThat(confirmRes.getOrder().getStatus()).isEqualTo(OrderStatus.CONFIRMED);

        // Assert: Catalog stub was invoked to commit product to SOLD
        ArgumentCaptor<MarkProductSoldRequest> soldCaptor = ArgumentCaptor.forClass(MarkProductSoldRequest.class);
        verify(catalogServiceStub, times(1)).markProductSold(soldCaptor.capture());
        assertThat(soldCaptor.getValue().getProductId()).isEqualTo(productId);
        assertThat(soldCaptor.getValue().getOrderId()).isEqualTo(orderId);

        // Assert: Redis countdown key deleted upon confirmation
        Boolean hasTimeoutKey = redisTemplate.hasKey("order:timeout:" + orderId);
        assertThat(hasTimeoutKey).isFalse();

        // Assert: Order marked CONFIRMED in database
        OrderEntity finalEntity = orderRepository.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(finalEntity.getStatus()).isEqualTo(OrderStatus.CONFIRMED);
    }

    /**
     * Test 2: Concurrency & Race Condition (Double-Spending Prevention):
     * Simulates 2 concurrent buyers attempting to reserve the exact same used item at the exact same millisecond.
     * Verifies strictly that exactly 1 thread succeeds and the other thread receives an ALREADY_EXISTS gRPC error.
     */
    @Test
    @DisplayName("Concurrency: Two buyers race to reserve the same unique item -> Strictly 1 succeeds, 1 receives ALREADY_EXISTS")
    void testConcurrentProductReservationZeroDoubleSpending() throws Exception {
        // Arrange
        String uniqueProductId = "prod-vintage-rolex-1972";
        AtomicBoolean itemLocked = new AtomicBoolean(false);

        when(catalogServiceStub.reserveProduct(any(ReserveProductRequest.class))).thenAnswer(invocation -> {
            ReserveProductRequest req = invocation.getArgument(0);
            if (itemLocked.compareAndSet(false, true)) {
                return ReserveProductResponse.newBuilder()
                        .setSuccess(true)
                        .setMessage("Reservation acquired")
                        .setProduct(Product.newBuilder()
                                .setId(req.getProductId())
                                .setSellerId("seller-collector")
                                .setPriceAmount(185000000L)
                                .setStatus(ProductStatus.RESERVED)
                                .build())
                        .build();
            } else {
                return ReserveProductResponse.newBuilder()
                        .setSuccess(false)
                        .setMessage("Product is already reserved by another buyer")
                        .build();
            }
        });

        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch alignStartLatch = new CountDownLatch(1);
        CountDownLatch finishLatch = new CountDownLatch(threadCount);

        List<OrderResponse> successfulOrders = Collections.synchronizedList(new ArrayList<>());
        List<Throwable> errorsEncountered = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger successCounter = new AtomicInteger(0);
        AtomicInteger conflictCounter = new AtomicInteger(0);

        // Act: Launch 2 concurrent buyer threads
        for (int i = 1; i <= threadCount; i++) {
            final String buyerId = "concurrent-buyer-" + i;
            executor.submit(() -> {
                try {
                    alignStartLatch.await(); // Synchronize threads to strike at exact same instant
                    SyncObserver<OrderResponse> observer = new SyncObserver<>();
                    CreateOrderRequest request = CreateOrderRequest.newBuilder()
                            .setProductId(uniqueProductId)
                            .setBuyerId(buyerId)
                            .build();

                    orderServiceGrpc.createOrder(request, observer);
                    OrderResponse response = observer.get(5, TimeUnit.SECONDS);
                    successfulOrders.add(response);
                    successCounter.incrementAndGet();
                } catch (Throwable t) {
                    errorsEncountered.add(t);
                    conflictCounter.incrementAndGet();
                } finally {
                    finishLatch.countDown();
                }
            });
        }

        // Release the latch to let both threads fire concurrently
        alignStartLatch.countDown();
        boolean completedInTime = finishLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        // Assert: Concurrency safety
        assertThat(completedInTime).isTrue();
        assertThat(successCounter.get()).isEqualTo(1);
        assertThat(conflictCounter.get()).isEqualTo(1);

        // Verify successful order
        assertThat(successfulOrders).hasSize(1);
        OrderResponse winnerResponse = successfulOrders.get(0);
        assertThat(winnerResponse.getOrder().getProductId()).isEqualTo(uniqueProductId);

        // Verify rejected order error code is ALREADY_EXISTS
        assertThat(errorsEncountered).hasSize(1);
        Throwable error = errorsEncountered.get(0);
        Status status = Status.fromThrowable(error);
        assertThat(status.getCode()).isEqualTo(Status.Code.ALREADY_EXISTS);
        assertThat(status.getDescription()).contains("Product is already reserved");

        // Verify database integrity: only 1 order saved
        List<OrderEntity> persistedOrders = orderRepository.findAll();
        assertThat(persistedOrders).hasSize(1);
        assertThat(persistedOrders.get(0).getProductId()).isEqualTo(uniqueProductId);
    }

    /**
     * Test 3: Saga Rollback Compensation:
     * Part A: CreateOrder -> Explicit CancelOrder -> verifies product released back to AVAILABLE.
     * Part B: CreateOrder -> 15-minute deadline expiration -> scheduled scanner triggers releaseProduct.
     */
    @Test
    @DisplayName("Saga Compensation Rollback: Cancelled or expired order automatically releases inventory back to AVAILABLE")
    void testSagaRollbackCompensation() throws Exception {
        // Arrange
        String productId = "prod-sony-a7iv";
        String buyerId = "buyer-charlie";
        String sellerId = "seller-david";

        when(catalogServiceStub.reserveProduct(any(ReserveProductRequest.class))).thenReturn(
                ReserveProductResponse.newBuilder()
                        .setSuccess(true)
                        .setProduct(Product.newBuilder()
                                .setId(productId)
                                .setSellerId(sellerId)
                                .setPriceAmount(41000000L)
                                .setStatus(ProductStatus.RESERVED)
                                .build())
                        .build()
        );

        when(catalogServiceStub.releaseProduct(any(ReleaseProductRequest.class))).thenReturn(
                ReleaseProductResponse.newBuilder()
                        .setSuccess(true)
                        .setMessage("Product reservation released to AVAILABLE")
                        .build()
        );

        // Part A: Explicit Order Cancellation
        SyncObserver<OrderResponse> createObserver = new SyncObserver<>();
        orderServiceGrpc.createOrder(
                CreateOrderRequest.newBuilder().setProductId(productId).setBuyerId(buyerId).build(),
                createObserver
        );
        OrderResponse createRes = createObserver.get(5, TimeUnit.SECONDS);
        String orderId = createRes.getOrder().getId();

        CancelOrderRequest cancelReq = CancelOrderRequest.newBuilder()
                .setOrderId(orderId)
                .setUserId(buyerId)
                .setReason("Buyer changed mind")
                .build();

        SyncObserver<OrderResponse> cancelObserver = new SyncObserver<>();
        orderServiceGrpc.cancelOrder(cancelReq, cancelObserver);
        OrderResponse cancelRes = cancelObserver.get(5, TimeUnit.SECONDS);

        assertThat(cancelRes.getOrder().getStatus()).isEqualTo(OrderStatus.CANCELLED);

        // Verify compensation call was dispatched to CatalogService
        ArgumentCaptor<ReleaseProductRequest> releaseCaptor = ArgumentCaptor.forClass(ReleaseProductRequest.class);
        verify(catalogServiceStub, times(1)).releaseProduct(releaseCaptor.capture());
        assertThat(releaseCaptor.getValue().getProductId()).isEqualTo(productId);
        assertThat(releaseCaptor.getValue().getOrderId()).isEqualTo(orderId);
        assertThat(releaseCaptor.getValue().getReason()).contains("Buyer changed mind");

        // Verify status in repository
        OrderEntity cancelledOrder = orderRepository.findById(UUID.fromString(orderId)).orElseThrow();
        assertThat(cancelledOrder.getStatus()).isEqualTo(OrderStatus.CANCELLED);

        // Part B: Deadline Expiration Saga Rollback Scanner
        reset(catalogServiceStub);
        when(catalogServiceStub.reserveProduct(any(ReserveProductRequest.class))).thenReturn(
                ReserveProductResponse.newBuilder()
                        .setSuccess(true)
                        .setProduct(Product.newBuilder().setId(productId).setSellerId(sellerId).build())
                        .build()
        );
        when(catalogServiceStub.releaseProduct(any(ReleaseProductRequest.class))).thenReturn(
                ReleaseProductResponse.newBuilder().setSuccess(true).build()
        );

        SyncObserver<OrderResponse> createObserver2 = new SyncObserver<>();
        orderServiceGrpc.createOrder(
                CreateOrderRequest.newBuilder().setProductId(productId).setBuyerId(buyerId).build(),
                createObserver2
        );
        OrderResponse createRes2 = createObserver2.get(5, TimeUnit.SECONDS);
        String expiredOrderId = createRes2.getOrder().getId();

        // Artificially advance time past the 15-minute deadline
        OrderEntity expiredEntity = orderRepository.findById(UUID.fromString(expiredOrderId)).orElseThrow();
        expiredEntity.setPaymentDeadlineEpochMs(System.currentTimeMillis() - 60000L); // 1 minute in the past
        orderRepository.save(expiredEntity);

        // Execute scheduled compensation scanner
        orderServiceGrpc.processExpiredOrdersSagaRollback();

        // Verify CatalogService.releaseProduct was triggered
        verify(catalogServiceStub, times(1)).releaseProduct(any(ReleaseProductRequest.class));

        // Verify order transitioned to CANCELLED in DB
        OrderEntity rollbackedEntity = orderRepository.findById(UUID.fromString(expiredOrderId)).orElseThrow();
        assertThat(rollbackedEntity.getStatus()).isEqualTo(OrderStatus.CANCELLED);
    }

    /**
     * Synchronous gRPC StreamObserver helper for blocking integration test assertions.
     */
    private static class SyncObserver<T> implements StreamObserver<T> {
        private final CompletableFuture<T> future = new CompletableFuture<>();
        private final AtomicReference<Throwable> errorRef = new AtomicReference<>();

        @Override
        public void onNext(T value) {
            future.complete(value);
        }

        @Override
        public void onError(Throwable t) {
            errorRef.set(t);
            future.completeExceptionally(t);
        }

        @Override
        public void onCompleted() {
            // No-op
        }

        public T get(long timeout, TimeUnit unit) throws Exception {
            return future.get(timeout, unit);
        }

        public Throwable getError() {
            return errorRef.get();
        }
    }
}
