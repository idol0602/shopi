package com.shopi.identity.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

@Slf4j
@Service
public class JwtTokenProvider {

    private final SecretKey secretKey;
    private final StringRedisTemplate redisTemplate;
    private final SecureRandom secureRandom = new SecureRandom();

    public JwtTokenProvider(
            @Value("${shopi.jwt.secret:ShopiSuperSecureEnterpriseKey2026MustBeAtLeast256BitsLong}") String secret,
            StringRedisTemplate redisTemplate) {
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.redisTemplate = redisTemplate;
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        Instant now = Instant.now();
        Instant expiry = now.plus(Duration.ofMinutes(15)); // 15 mins

        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(expiry))
                .signWith(secretKey)
                .compact();
    }

    public String generateRefreshToken(UUID userId) {
        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);
        String refreshToken = Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes);

        // Store in Redis with 14 days TTL
        String key = "auth:refresh:" + refreshToken;
        redisTemplate.opsForValue().set(key, userId.toString(), Duration.ofDays(14));

        return refreshToken;
    }

    public String validateAndRotateRefreshToken(String oldRefreshToken) {
        String key = "auth:refresh:" + oldRefreshToken;
        String userId = redisTemplate.opsForValue().get(key);

        if (userId == null) {
            log.warn("Invalid or expired refresh token: {}", oldRefreshToken);
            return null;
        }

        // Token Family Rotation: Remove old token immediately
        redisTemplate.delete(key);

        // Issue new token
        return generateRefreshToken(UUID.fromString(userId));
    }

    public String getUserIdFromRefreshToken(String refreshToken) {
        return redisTemplate.opsForValue().get("auth:refresh:" + refreshToken);
    }

    public void revokeToken(String refreshToken, String accessToken) {
        if (refreshToken != null && !refreshToken.isBlank()) {
            redisTemplate.delete("auth:refresh:" + refreshToken);
        }
        if (accessToken != null && !accessToken.isBlank()) {
            // Blacklist access token until its natural expiration
            redisTemplate.opsForValue().set("auth:blacklist:" + accessToken, "revoked", Duration.ofMinutes(15));
        }
    }
}
