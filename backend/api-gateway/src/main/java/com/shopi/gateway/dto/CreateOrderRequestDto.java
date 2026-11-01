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
public class CreateOrderRequestDto {

    @NotBlank(message = "productId must not be blank")
    private String productId;

    @NotBlank(message = "buyerId must not be blank")
    private String buyerId;
}
