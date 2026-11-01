package com.shopi.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SellerPaymentConfigDto {
    private String id;
    private String sellerId;
    private String bankName;
    private String accountNumber;
    private String accountHolder;
    private String sepayApiKey;
    private String sepayWebhookToken;
    @Builder.Default
    private Boolean testMode = true;
    private Long createdAt;
    private Long updatedAt;
}
