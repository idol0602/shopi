package com.shopi.order.repository;

import com.shopi.order.domain.ConversationEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ConversationRepository extends JpaRepository<ConversationEntity, UUID> {
    List<ConversationEntity> findByBuyerIdOrSellerIdOrderByUpdatedAtDesc(UUID buyerId, UUID sellerId);
    Optional<ConversationEntity> findByBuyerIdAndSellerIdAndProductId(UUID buyerId, UUID sellerId, UUID productId);
}
