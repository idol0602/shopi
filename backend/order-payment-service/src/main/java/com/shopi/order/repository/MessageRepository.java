package com.shopi.order.repository;

import com.shopi.order.domain.MessageEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface MessageRepository extends JpaRepository<MessageEntity, UUID> {
    List<MessageEntity> findByConversationIdOrderByCreatedAtAsc(UUID conversationId);
    Optional<MessageEntity> findFirstByConversationIdOrderByCreatedAtDesc(UUID conversationId);
    long countByConversationIdAndSenderIdNotAndIsReadFalse(UUID conversationId, UUID currentUserId);

    @Modifying
    @Query("UPDATE MessageEntity m SET m.isRead = true WHERE m.conversationId = :conversationId AND m.senderId != :currentUserId AND m.isRead = false")
    int markAllAsRead(@Param("conversationId") UUID conversationId, @Param("currentUserId") UUID currentUserId);
}
