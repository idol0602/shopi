package com.shopi.order.repository;

import com.shopi.marketplace.v1.OrderStatus;
import com.shopi.order.domain.OrderEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {

    List<OrderEntity> findByBuyerId(String buyerId);

    List<OrderEntity> findBySellerId(String sellerId);

    List<OrderEntity> findBySellerIdOrderByCreatedAtDesc(String sellerId);

    List<OrderEntity> findByBuyerIdOrderByCreatedAtDesc(String buyerId);

    List<OrderEntity> findBySellerIdAndStatusOrderByCreatedAtDesc(String sellerId, OrderStatus status);

    List<OrderEntity> findByBuyerIdAndStatusOrderByCreatedAtDesc(String buyerId, OrderStatus status);

    List<OrderEntity> findAllByOrderByCreatedAtDesc();

    Optional<OrderEntity> findByIdAndBuyerId(UUID id, String buyerId);

    Optional<OrderEntity> findByIdAndSellerId(UUID id, String sellerId);

    List<OrderEntity> findByStatusAndPaymentDeadlineEpochMsLessThanEqual(OrderStatus status, Long deadlineEpochMs);

    boolean existsByProductIdAndStatusIn(String productId, Collection<OrderStatus> statuses);
}
