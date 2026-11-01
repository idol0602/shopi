package com.shopi.order.grpc;

import com.shopi.marketplace.v1.*;
import com.shopi.order.domain.ConversationEntity;
import com.shopi.order.domain.MessageEntity;
import com.shopi.order.repository.ConversationRepository;
import com.shopi.order.repository.MessageRepository;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class ChatServiceGrpcImpl extends ChatServiceGrpc.ChatServiceImplBase {

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @GrpcClient("shop-catalog-service")
    private CatalogServiceGrpc.CatalogServiceBlockingStub catalogServiceStub;

    @Override
    public void getConversations(GetConversationsRequest request, StreamObserver<ConversationListResponse> responseObserver) {
        UUID userId;
        try {
            userId = UUID.fromString(request.getUserId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid user UUID: " + request.getUserId())
                    .asRuntimeException());
            return;
        }

        List<ConversationEntity> list = conversationRepository.findByBuyerIdOrSellerIdOrderByUpdatedAtDesc(userId, userId);
        ConversationListResponse.Builder responseBuilder = ConversationListResponse.newBuilder();

        for (ConversationEntity conv : list) {
            Conversation.Builder b = Conversation.newBuilder()
                    .setId(conv.getId().toString())
                    .setBuyerId(conv.getBuyerId().toString())
                    .setSellerId(conv.getSellerId().toString())
                    .setProductId(conv.getProductId().toString())
                    .setCreatedAt(conv.getCreatedAt().toEpochMilli())
                    .setUpdatedAt(conv.getUpdatedAt().toEpochMilli());

            // Fetch product metadata
            try {
                ProductResponse pRes = catalogServiceStub.getProduct(ProductQueryRequest.newBuilder()
                        .setProductId(conv.getProductId().toString())
                        .build());
                if (pRes.hasProduct()) {
                    Product p = pRes.getProduct();
                    b.setProductTitle(p.getTitle());
                    b.setProductPrice(p.getPriceAmount());
                    if (p.getImageUrlsCount() > 0) {
                        b.setProductImageUrl(p.getImageUrls(0));
                    }
                }
            } catch (Exception ex) {
                log.warn("Failed to fetch product {} for conversation {}: {}", conv.getProductId(), conv.getId(), ex.getMessage());
            }

            // Fetch latest message & unread count
            Optional<MessageEntity> lastMsg = messageRepository.findFirstByConversationIdOrderByCreatedAtDesc(conv.getId());
            if (lastMsg.isPresent()) {
                b.setLastMessageContent(lastMsg.get().getContent() != null ? lastMsg.get().getContent() : "[Hình ảnh]");
                b.setLastMessageAt(lastMsg.get().getCreatedAt().toEpochMilli());
            }

            long unread = messageRepository.countByConversationIdAndSenderIdNotAndIsReadFalse(conv.getId(), userId);
            b.setUnreadCount((int) unread);

            responseBuilder.addConversations(b.build());
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void getOrCreateConversation(GetOrCreateConversationRequest request, StreamObserver<ConversationResponse> responseObserver) {
        UUID buyerId;
        UUID productId;

        try {
            buyerId = UUID.fromString(request.getBuyerId());
            productId = UUID.fromString(request.getProductId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid UUID for buyerId or productId")
                    .asRuntimeException());
            return;
        }

        // Fetch seller from catalog service
        Product product;
        try {
            ProductResponse pRes = catalogServiceStub.getProduct(ProductQueryRequest.newBuilder()
                    .setProductId(productId.toString())
                    .build());
            product = pRes.getProduct();
        } catch (Exception ex) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Product not found: " + productId)
                    .asRuntimeException());
            return;
        }

        UUID sellerId = UUID.fromString(product.getSellerId());

        Optional<ConversationEntity> existing = conversationRepository.findByBuyerIdAndSellerIdAndProductId(buyerId, sellerId, productId);
        ConversationEntity entity = existing.orElseGet(() -> {
            Instant now = Instant.now();
            ConversationEntity newConv = ConversationEntity.builder()
                    .id(UUID.randomUUID())
                    .buyerId(buyerId)
                    .sellerId(sellerId)
                    .productId(productId)
                    .createdAt(now)
                    .updatedAt(now)
                    .build();
            return conversationRepository.save(newConv);
        });

        Conversation.Builder b = Conversation.newBuilder()
                .setId(entity.getId().toString())
                .setBuyerId(entity.getBuyerId().toString())
                .setSellerId(entity.getSellerId().toString())
                .setProductId(entity.getProductId().toString())
                .setProductTitle(product.getTitle())
                .setProductPrice(product.getPriceAmount())
                .setCreatedAt(entity.getCreatedAt().toEpochMilli())
                .setUpdatedAt(entity.getUpdatedAt().toEpochMilli());

        if (product.getImageUrlsCount() > 0) {
            b.setProductImageUrl(product.getImageUrls(0));
        }

        responseObserver.onNext(ConversationResponse.newBuilder().setConversation(b.build()).build());
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void getMessages(GetMessagesRequest request, StreamObserver<MessageListResponse> responseObserver) {
        UUID convId;
        UUID userId;

        try {
            convId = UUID.fromString(request.getConversationId());
            userId = UUID.fromString(request.getUserId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid UUID for conversationId or userId")
                    .asRuntimeException());
            return;
        }

        // Mark incoming messages as read
        messageRepository.markAllAsRead(convId, userId);

        List<MessageEntity> messages = messageRepository.findByConversationIdOrderByCreatedAtAsc(convId);
        MessageListResponse.Builder responseBuilder = MessageListResponse.newBuilder();

        for (MessageEntity m : messages) {
            responseBuilder.addMessages(ChatMessage.newBuilder()
                    .setId(m.getId().toString())
                    .setConversationId(m.getConversationId().toString())
                    .setSenderId(m.getSenderId().toString())
                    .setContent(m.getContent() != null ? m.getContent() : "")
                    .setImageUrl(m.getImageUrl() != null ? m.getImageUrl() : "")
                    .setIsRead(Boolean.TRUE.equals(m.getIsRead()))
                    .setCreatedAt(m.getCreatedAt().toEpochMilli())
                    .build());
        }

        responseObserver.onNext(responseBuilder.build());
        responseObserver.onCompleted();
    }

    @Override
    @Transactional
    public void sendMessage(SendMessageRequest request, StreamObserver<MessageResponse> responseObserver) {
        UUID convId;
        UUID senderId;

        try {
            convId = UUID.fromString(request.getConversationId());
            senderId = UUID.fromString(request.getSenderId());
        } catch (IllegalArgumentException e) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Invalid UUID format")
                    .asRuntimeException());
            return;
        }

        ConversationEntity conv = conversationRepository.findById(convId).orElse(null);
        if (conv == null) {
            responseObserver.onError(Status.NOT_FOUND
                    .withDescription("Conversation not found")
                    .asRuntimeException());
            return;
        }

        Instant now = Instant.now();
        MessageEntity message = MessageEntity.builder()
                .id(UUID.randomUUID())
                .conversationId(convId)
                .senderId(senderId)
                .content(request.getContent())
                .imageUrl(request.getImageUrl())
                .isRead(false)
                .createdAt(now)
                .build();

        MessageEntity saved = messageRepository.save(message);

        // Update conversation timestamp
        conv.setUpdatedAt(now);
        conversationRepository.save(conv);

        responseObserver.onNext(MessageResponse.newBuilder()
                .setMessage(ChatMessage.newBuilder()
                        .setId(saved.getId().toString())
                        .setConversationId(saved.getConversationId().toString())
                        .setSenderId(saved.getSenderId().toString())
                        .setContent(saved.getContent() != null ? saved.getContent() : "")
                        .setImageUrl(saved.getImageUrl() != null ? saved.getImageUrl() : "")
                        .setIsRead(false)
                        .setCreatedAt(saved.getCreatedAt().toEpochMilli())
                        .build())
                .build());
        responseObserver.onCompleted();
    }
}
