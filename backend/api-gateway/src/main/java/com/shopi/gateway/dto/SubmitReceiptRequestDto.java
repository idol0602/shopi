package com.shopi.gateway.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubmitReceiptRequestDto {

    @NotBlank(message = "buyerId must not be blank")
    private String buyerId;

    @NotBlank(message = "receiptImageUrl must not be blank")
    private String receiptImageUrl;
}
