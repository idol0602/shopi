package com.shopi.catalog.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "products", indexes = {
        @Index(name = "idx_products_slug", columnList = "slug", unique = true),
        @Index(name = "idx_products_status", columnList = "status"),
        @Index(name = "idx_products_seller", columnList = "seller_id"),
        @Index(name = "idx_products_category", columnList = "category")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProductEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, unique = true, length = 250)
    private String slug;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Long priceAmount;

    @Column(nullable = false, length = 10)
    private String currency;

    @Column(nullable = false, length = 100)
    private String category;

    @Column(name = "quantity", nullable = false)
    @Builder.Default
    private Integer quantity = 1;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "product_images", joinColumns = @JoinColumn(name = "product_id"))
    @Column(name = "image_url", length = 500)
    @Builder.Default
    private List<String> imageUrls = new ArrayList<>();

    @Column(nullable = false, length = 30)
    private String status; // AVAILABLE, RESERVED, SOLD, HIDDEN, OUT_OF_STOCK

    @Column(name = "seller_id", nullable = false)
    private UUID sellerId;

    @Column(name = "reserved_by_user_id")
    private UUID reservedByUserId;

    @Column(name = "locked_order_id")
    private UUID lockedOrderId;

    @Column(name = "locked_at")
    private Instant lockedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (currency == null) {
            currency = "VND";
        }
        if (status == null) {
            status = "AVAILABLE";
        }
        if (quantity == null) {
            quantity = 1;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}
