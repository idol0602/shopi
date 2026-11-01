package com.shopi.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrderResponseDto {

    private String id;
    private String productId;
    private String buyerId;
    private String sellerId;
    private Long totalAmount;
    private String currency;
    private String status;
    private String vietQrPayload;
    private String receiptImageUrl;
    private Long paymentDeadlineEpochMs;
    private String bankName;
    private String bankAccountNumber;
    private String bankAccountHolder;
    private String transactionReference;
    private Long createdAt;
    private Long updatedAt;
    private String message;
}
