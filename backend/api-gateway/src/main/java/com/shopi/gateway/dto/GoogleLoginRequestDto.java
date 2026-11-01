package com.shopi.gateway.dto;

import lombok.*;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GoogleLoginRequestDto {
    private String idToken;
    private String email;
    private String fullName;
    private String avatarUrl;
}
