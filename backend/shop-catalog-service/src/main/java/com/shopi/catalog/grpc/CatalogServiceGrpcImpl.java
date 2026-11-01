package com.shopi.catalog.grpc;

import com.shopi.catalog.domain.ProductEntity;
import com.shopi.catalog.repository.ProductRepository;
import com.shopi.marketplace.v1.*;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class CatalogServiceGrpcImpl extends CatalogServiceGrpc.CatalogServiceImplBase {

    private final ProductRepository productRepository;

    @Override
    public void getProduct(ProductQueryRequest request, StreamObserver<ProductResponse> responseObserver) {
        Optional<ProductEntity> productOpt;

        if (!request.getProductId().isBlank()) {
            try {
                productOpt = productRepository.findById(UUID.fromString(request.getProductId()));
            } catch (IllegalArgumentException e) {
                responseObserver.onError(Status.INVALID_ARGUMENT
                        .withDescription("Invalid UUID format for productId")
                        .asRuntimeException());
                return;
            }
        } else if (!request.getSlug().isBlank()) {
            productOpt = productRepository.findBySlug(request.getSlug());
        } else {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Must provide either productId or slug")
                    .asRuntimeException());
            return;
        }

        if (productOpt.isEmpty()) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Product not found")
                    .asRuntimeException());
            return;
        }

        Product product = mapToProto(productOpt.get());
        responseObserver.onNext(ProductResponse.newBuilder().setProduct(product).build());
        responseObserver.onCompleted();
    }

    @Override
    public void listProducts(ListProductsRequest request, StreamObserver<ProductListResponse> responseObserver) {
        int page = Math.max(0, request.getPage() - 1);
        int pageSize = request.getPageSize() > 0 ? request.getPageSize() : 12;
        Pageable pageable = PageRequest.of(page, pageSize, Sort.by(Sort.Direction.DESC, "createdAt"));

        String status = request.getStatusFilter() != ProductStatus.PRODUCT_STATUS_UNSPECIFIED
                ? request.getStatusFilter().name()
                : null;
        String category = !request.getCategory().isBlank() ? request.getCategory() : null;
        String query = !request.getSearchQuery().isBlank() ? request.getSearchQuery() : null;

        Page<ProductEntity> productPage = productRepository.searchProducts(status, category, query, pageable);

        ProductListResponse.Builder responseBuilder = ProductListResponse.newBuilder()
                .setTotalCount((int) productPage.getTotalElements())
                .setCurrentPage(request.getPage() > 0 ? request.getPage() : 1)
                .setTotalPages(productPage.getTotalPages());

        for (ProductEntity entity : productPage.getContent()) {
            responseBuilder.addProducts(mapToProto(entity));
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void createProduct(CreateProductRequest request, StreamObserver<ProductResponse> responseObserver) {
        if (request.getTitle().isBlank() || request.getPriceAmount() <= 0) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Product title and price must be valid")
                    .asRuntimeException());
            return;
        }

        String baseSlug = generateSlug(request.getTitle());
        String uniqueSlug = baseSlug + "-" + UUID.randomUUID().toString().substring(0, 8);
        int quantity = request.getQuantity() > 0 ? request.getQuantity() : 1;

        ProductEntity entity = ProductEntity.builder()
                .title(request.getTitle())
                .slug(uniqueSlug)
                .description(request.getDescription())
                .priceAmount(request.getPriceAmount())
                .currency(request.getCurrency().isBlank() ? "VND" : request.getCurrency())
                .category(request.getCategory().isBlank() ? "DoDienTu" : request.getCategory())
                .imageUrls(request.getImageUrlsList())
                .quantity(quantity)
                .status("AVAILABLE")
                .sellerId(UUID.fromString(request.getSellerId()))
                .build();

        ProductEntity saved = productRepository.save(entity);
        responseObserver.onNext(ProductResponse.newBuilder().setProduct(mapToProto(saved)).build());
        responseObserver.onCompleted();
    }

    /**
     * Direct Inventory Deduction:
     * Atomically decrements quantity by 1.
     * Transitions status to OUT_OF_STOCK if remaining quantity reaches 0.
     */
    @Override
    @Transactional
    public void reserveProduct(ReserveProductRequest request, StreamObserver<ReserveProductResponse> responseObserver) {
        UUID productId;
        UUID buyerId = null;
        UUID orderId = null;

        try {
            productId = UUID.fromString(request.getProductId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid UUID format for productId: " + request.getProductId())
                    .asRuntimeException());
            return;
        }

        if (!request.getBuyerId().isBlank()) {
            try {
                buyerId = UUID.fromString(request.getBuyerId());
            } catch (IllegalArgumentException ignored) {
                buyerId = UUID.nameUUIDFromBytes(request.getBuyerId().getBytes());
            }
        }

        if (!request.getOrderId().isBlank()) {
            try {
                orderId = UUID.fromString(request.getOrderId());
            } catch (IllegalArgumentException ignored) {
                orderId = UUID.nameUUIDFromBytes(request.getOrderId().getBytes());
            }
        }

        Instant now = Instant.now();
        int updatedRows = productRepository.deductInventoryAtomic(productId, buyerId, orderId, now);

        if (updatedRows == 0) {
            log.warn("Direct inventory deduction failed for product {}: Out of stock (quantity <= 0)", productId);
            responseObserver.onError(Status.ALREADY_EXISTS
                    .withDescription("Sản phẩm đã hết hàng hoặc không đủ số lượng (Out of stock)")
                    .asRuntimeException());
            return;
        }

        ProductEntity product = productRepository.findById(productId).orElseThrow();
        log.info("Product {} inventory decremented directly. Remaining quantity: {}", productId, product.getQuantity());

        ReserveProductResponse response = ReserveProductResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Inventory decremented successfully")
                .setProduct(mapToProto(product))
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    /**
     * Atomic Inventory Restoration (Compensation Rollback):
     * Restores 1 quantity and sets status back to AVAILABLE upon order cancellation/timeout.
     */
    @Override
    @Transactional
    public void releaseProduct(ReleaseProductRequest request, StreamObserver<ReleaseProductResponse> responseObserver) {
        UUID productId;
        try {
            productId = UUID.fromString(request.getProductId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid product UUID")
                    .asRuntimeException());
            return;
        }

        Instant now = Instant.now();
        int updatedRows = productRepository.restoreInventoryAtomic(productId, now);

        if (updatedRows == 0) {
            log.warn("Product release failed for {}: Product not found", productId);
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Product not found to release inventory")
                    .asRuntimeException());
            return;
        }

        ProductEntity product = productRepository.findById(productId).orElseThrow();
        log.info("Product {} inventory restored. Current quantity: {}, status: {}", productId, product.getQuantity(), product.getStatus());

        ReleaseProductResponse response = ReleaseProductResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Product inventory successfully restored to AVAILABLE")
                .setProduct(mapToProto(product))
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void markProductSold(MarkProductSoldRequest request, StreamObserver<ProductResponse> responseObserver) {
        UUID productId;
        try {
            productId = UUID.fromString(request.getProductId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid product UUID")
                    .asRuntimeException());
            return;
        }

        Instant now = Instant.now();
        productRepository.markProductSoldAtomic(productId, now);

        ProductEntity product = productRepository.findById(productId).orElseThrow();
        log.info("Product {} permanently marked as SOLD", productId);

        responseObserver.onNext(ProductResponse.newBuilder().setProduct(mapToProto(product)).build());
        responseObserver.onCompleted();
    }

    private Product mapToProto(ProductEntity entity) {
        ProductStatus status;
        try {
            status = ProductStatus.valueOf(entity.getStatus());
        } catch (IllegalArgumentException e) {
            status = ProductStatus.PRODUCT_STATUS_UNSPECIFIED;
        }

        Product.Builder builder = Product.newBuilder()
                .setId(entity.getId().toString())
                .setTitle(entity.getTitle())
                .setSlug(entity.getSlug())
                .setDescription(entity.getDescription())
                .setPriceAmount(entity.getPriceAmount())
                .setCurrency(entity.getCurrency() != null ? entity.getCurrency() : "VND")
                .setCategory(entity.getCategory() != null ? entity.getCategory() : "DoDienTu")
                .addAllImageUrls(entity.getImageUrls())
                .setStatus(status)
                .setSellerId(entity.getSellerId().toString())
                .setQuantity(entity.getQuantity() != null ? entity.getQuantity() : 1)
                .setCreatedAt(entity.getCreatedAt().toEpochMilli())
                .setUpdatedAt(entity.getUpdatedAt().toEpochMilli());

        if (entity.getReservedByUserId() != null) {
            builder.setReservedByUserId(entity.getReservedByUserId().toString());
        }

        return builder.build();
    }

    private String generateSlug(String input) {
        return input.toLowerCase()
                .replaceAll("[àáạảãâầấậẩẫăằắặẳẵ]", "a")
                .replaceAll("[èéẹẻẽêềếệểễ]", "e")
                .replaceAll("[ìíịỉĩ]", "i")
                .replaceAll("[òóọỏõôồốộổỗơờớợởỡ]", "o")
                .replaceAll("[ùúụủũưừứựửữ]", "u")
                .replaceAll("[ỳýỵỷỹ]", "y")
                .replaceAll("[đ]", "d")
                .replaceAll("[^a-z0-9\\s-]", "")
                .replaceAll("\\s+", "-")
                .replaceAll("-+", "-")
                .trim();
    }
}
