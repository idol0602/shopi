package com.shopi.catalog.repository;

import com.shopi.catalog.domain.ProductEntity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<ProductEntity, UUID> {

    Optional<ProductEntity> findBySlug(String slug);

    Page<ProductEntity> findByStatus(String status, Pageable pageable);

    Page<ProductEntity> findByCategoryAndStatus(String category, String status, Pageable pageable);

    @Query("SELECT p FROM ProductEntity p WHERE " +
           "(:status IS NULL OR p.status = :status) AND " +
           "(:category IS NULL OR LOWER(p.category) = LOWER(:category)) AND " +
           "(:query IS NULL OR LOWER(p.title) LIKE LOWER(CONCAT('%', :query, '%')) OR LOWER(p.description) LIKE LOWER(CONCAT('%', :query, '%')))")
    Page<ProductEntity> searchProducts(
            @Param("status") String status,
            @Param("category") String category,
            @Param("query") String query,
            Pageable pageable);

    @Modifying
    @Query("UPDATE ProductEntity p SET " +
           "p.quantity = p.quantity - 1, " +
           "p.status = CASE WHEN (p.quantity - 1) <= 0 THEN 'OUT_OF_STOCK' ELSE 'AVAILABLE' END, " +
           "p.reservedByUserId = :buyerId, " +
           "p.lockedOrderId = :orderId, " +
           "p.lockedAt = :now, " +
           "p.updatedAt = :now " +
           "WHERE p.id = :productId AND p.quantity > 0")
    int deductInventoryAtomic(
            @Param("productId") UUID productId,
            @Param("buyerId") UUID buyerId,
            @Param("orderId") UUID orderId,
            @Param("now") Instant now);

    @Modifying
    @Query("UPDATE ProductEntity p SET " +
           "p.quantity = p.quantity + 1, " +
           "p.status = 'AVAILABLE', " +
           "p.reservedByUserId = NULL, " +
           "p.lockedOrderId = NULL, " +
           "p.lockedAt = NULL, " +
           "p.updatedAt = :now " +
           "WHERE p.id = :productId")
    int restoreInventoryAtomic(
            @Param("productId") UUID productId,
            @Param("now") Instant now);

    @Modifying
    @Query("UPDATE ProductEntity p SET " +
           "p.status = CASE WHEN p.quantity <= 0 THEN 'SOLD' ELSE 'AVAILABLE' END, " +
           "p.reservedByUserId = NULL, " +
           "p.lockedOrderId = NULL, " +
           "p.lockedAt = NULL, " +
           "p.updatedAt = :now " +
           "WHERE p.id = :productId")
    int markProductSoldAtomic(
            @Param("productId") UUID productId,
            @Param("now") Instant now);
}
