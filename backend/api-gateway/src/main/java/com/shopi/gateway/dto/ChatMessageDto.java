package com.shopi.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ChatMessageDto {
    private String id;
    private String conversationId;
    private String senderId;
    private String content;
    private String imageUrl;
    private Boolean isRead;
    private Long createdAt;
}
