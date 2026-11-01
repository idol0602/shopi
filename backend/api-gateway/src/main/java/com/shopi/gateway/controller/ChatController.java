package com.shopi.gateway.controller;

import com.shopi.gateway.dto.*;
import com.shopi.gateway.service.JwtTokenService;
import com.shopi.marketplace.v1.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.client.inject.GrpcClient;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/chat")
@CrossOrigin(origins = "*", allowedHeaders = "*", methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.OPTIONS})
@RequiredArgsConstructor
public class ChatController {

    @GrpcClient("order-payment-service")
    private ChatServiceGrpc.ChatServiceBlockingStub chatServiceStub;

    private final JwtTokenService jwtTokenService;

    private String getAuthenticatedUserId(HttpServletRequest request, String fallbackParam) {
        String authHeader = request.getHeader("Authorization");
        String token = jwtTokenService.extractToken(authHeader);
        if (token != null) {
            String sub = jwtTokenService.extractUserId(token);
            if (sub != null && !sub.isBlank()) {
                return sub;
            }
        }
        if (fallbackParam != null && !fallbackParam.isBlank()) {
            return fallbackParam;
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Authentication required for chat access");
    }

    /**
     * List all conversations for the current user (as buyer or seller).
     * GET /api/chat/conversations
     */
    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationDto>> getConversations(
            @RequestParam(value = "userId", required = false) String userIdParam,
            HttpServletRequest request
    ) {
        String userId = getAuthenticatedUserId(request, userIdParam);
        log.info("Fetching conversations for userId: {}", userId);

        ConversationListResponse protoRes = chatServiceStub.getConversations(
                GetConversationsRequest.newBuilder().setUserId(userId).build()
        );

        List<ConversationDto> list = new ArrayList<>();
        for (Conversation c : protoRes.getConversationsList()) {
            list.add(ConversationDto.builder()
                    .id(c.getId())
                    .buyerId(c.getBuyerId())
                    .sellerId(c.getSellerId())
                    .productId(c.getProductId())
                    .productTitle(c.getProductTitle())
                    .productImageUrl(c.getProductImageUrl())
                    .productPrice(c.getProductPrice())
                    .lastMessageContent(c.getLastMessageContent())
                    .lastMessageAt(c.getLastMessageAt())
                    .unreadCount(c.getUnreadCount())
                    .createdAt(c.getCreatedAt())
                    .updatedAt(c.getUpdatedAt())
                    .build());
        }

        return ResponseEntity.ok(list);
    }

    /**
     * Create or retrieve an existing conversation for a product.
     * POST /api/chat/conversations
     */
    @PostMapping("/conversations")
    public ResponseEntity<ConversationDto> getOrCreateConversation(
            @Valid @RequestBody CreateConversationRequestDto requestDto,
            HttpServletRequest request
    ) {
        String buyerId = requestDto.getBuyerId();
        if (buyerId == null || buyerId.isBlank()) {
            buyerId = getAuthenticatedUserId(request, null);
        }

        log.info("GetOrCreateConversation: buyerId={}, productId={}", buyerId, requestDto.getProductId());

        ConversationResponse protoRes = chatServiceStub.getOrCreateConversation(
                GetOrCreateConversationRequest.newBuilder()
                        .setBuyerId(buyerId)
                        .setProductId(requestDto.getProductId())
                        .build()
        );

        Conversation c = protoRes.getConversation();
        return ResponseEntity.ok(ConversationDto.builder()
                .id(c.getId())
                .buyerId(c.getBuyerId())
                .sellerId(c.getSellerId())
                .productId(c.getProductId())
                .productTitle(c.getProductTitle())
                .productImageUrl(c.getProductImageUrl())
                .productPrice(c.getProductPrice())
                .createdAt(c.getCreatedAt())
                .updatedAt(c.getUpdatedAt())
                .build());
    }

    /**
     * Get message history for a conversation and mark as read.
     * GET /api/chat/conversations/{id}/messages
     */
    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<ChatMessageDto>> getMessages(
            @PathVariable("id") String conversationId,
            @RequestParam(value = "userId", required = false) String userIdParam,
            HttpServletRequest request
    ) {
        String userId = getAuthenticatedUserId(request, userIdParam);

        MessageListResponse protoRes = chatServiceStub.getMessages(
                GetMessagesRequest.newBuilder()
                        .setConversationId(conversationId)
                        .setUserId(userId)
                        .build()
        );

        List<ChatMessageDto> list = new ArrayList<>();
        for (ChatMessage m : protoRes.getMessagesList()) {
            list.add(ChatMessageDto.builder()
                    .id(m.getId())
                    .conversationId(m.getConversationId())
                    .senderId(m.getSenderId())
                    .content(m.getContent())
                    .imageUrl(m.getImageUrl())
                    .isRead(m.getIsRead())
                    .createdAt(m.getCreatedAt())
                    .build());
        }

        return ResponseEntity.ok(list);
    }

    /**
     * Send a new message with text and/or image in a conversation.
     * POST /api/chat/conversations/{id}/messages
     */
    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<ChatMessageDto> sendMessage(
            @PathVariable("id") String conversationId,
            @RequestBody SendMessageRequestDto requestDto,
            HttpServletRequest request
    ) {
        String senderId = requestDto.getSenderId();
        if (senderId == null || senderId.isBlank()) {
            senderId = getAuthenticatedUserId(request, null);
        }

        SendMessageRequest.Builder b = SendMessageRequest.newBuilder()
                .setConversationId(conversationId)
                .setSenderId(senderId);

        if (requestDto.getContent() != null) b.setContent(requestDto.getContent());
        if (requestDto.getImageUrl() != null) b.setImageUrl(requestDto.getImageUrl());

        MessageResponse protoRes = chatServiceStub.sendMessage(b.build());
        ChatMessage m = protoRes.getMessage();

        return ResponseEntity.status(HttpStatus.CREATED).body(ChatMessageDto.builder()
                .id(m.getId())
                .conversationId(m.getConversationId())
                .senderId(m.getSenderId())
                .content(m.getContent())
                .imageUrl(m.getImageUrl())
                .isRead(m.getIsRead())
                .createdAt(m.getCreatedAt())
                .build());
    }
}
