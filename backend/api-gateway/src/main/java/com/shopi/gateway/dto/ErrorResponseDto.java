package com.shopi.gateway.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ErrorResponseDto {

    @Builder.Default
    private String timestamp = Instant.now().toString();
    private int status;
    private String error;
    private String message;
    private String path;
}
