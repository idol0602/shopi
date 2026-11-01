package com.shopi.gateway.service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class JwtTokenService {

    private final StringRedisTemplate redisTemplate;

    @Value("${shopi.jwt.secret:shopi-enterprise-jwt-secret-key-must-be-at-least-256-bits-long-shopi-2026}")
    private String jwtSecret;

    private static final String BLACKLIST_PREFIX = "auth:blacklist:";

    private SecretKey getSigningKey() {
        return Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String extractToken(String authHeader) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7).trim();
        }
        return null;
    }

    public boolean isBlacklisted(String token) {
        if (token == null) return false;
        try {
            return Boolean.TRUE.equals(redisTemplate.hasKey(BLACKLIST_PREFIX + token));
        } catch (Exception ex) {
            log.error("Redis error checking blacklist: {}", ex.getMessage());
            return false;
        }
    }

    public void blacklistToken(String token, Duration ttl) {
        if (token == null) return;
        try {
            redisTemplate.opsForValue().set(BLACKLIST_PREFIX + token, "revoked", ttl);
            log.info("Token blacklisted with TTL: {}", ttl);
        } catch (Exception ex) {
            log.error("Failed to blacklist token in Redis: {}", ex.getMessage());
        }
    }

    public Claims parseClaims(String token) {
        return Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public String extractUserId(String token) {
        if (token == null) return null;
        try {
            Claims claims = parseClaims(token);
            return claims.getSubject();
        } catch (Exception ex) {
            log.warn("Failed to extract userId from token: {}", ex.getMessage());
            return null;
        }
    }
}
