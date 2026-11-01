package com.shopi.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ConversationDto {
    private String id;
    private String buyerId;
    private String sellerId;
    private String productId;
    private String productTitle;
    private String productImageUrl;
    private Long productPrice;
    private String lastMessageContent;
    private Long lastMessageAt;
    private Integer unreadCount;
    private Long createdAt;
    private Long updatedAt;
}
