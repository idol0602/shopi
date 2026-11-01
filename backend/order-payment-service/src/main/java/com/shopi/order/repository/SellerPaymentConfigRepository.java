package com.shopi.order.repository;

import com.shopi.order.domain.SellerPaymentConfigEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface SellerPaymentConfigRepository extends JpaRepository<SellerPaymentConfigEntity, UUID> {
    Optional<SellerPaymentConfigEntity> findBySellerId(UUID sellerId);
}
