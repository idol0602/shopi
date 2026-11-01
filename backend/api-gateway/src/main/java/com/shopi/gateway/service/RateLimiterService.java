package com.shopi.gateway.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Slf4j
@Service
@RequiredArgsConstructor
public class RateLimiterService {

    private final StringRedisTemplate redisTemplate;

    private static final int DEFAULT_MAX_REQUESTS_PER_MINUTE = 60;
    private static final String RATE_LIMIT_PREFIX = "ratelimit:";

    /**
     * Token Bucket rate limiter per client key (IP for guests, User ID for authenticated users).
     *
     * @param clientKey identifier (IP address or user ID)
     * @return true if request is permitted, false if rate limit exceeded
     */
    public boolean allowRequest(String clientKey) {
        return allowRequest(clientKey, DEFAULT_MAX_REQUESTS_PER_MINUTE);
    }

    public boolean allowRequest(String clientKey, int maxRequestsPerMinute) {
        String key = RATE_LIMIT_PREFIX + clientKey;
        try {
            Long count = redisTemplate.opsForValue().increment(key);
            if (count != null && count == 1) {
                redisTemplate.expire(key, Duration.ofMinutes(1));
            }
            if (count != null && count > maxRequestsPerMinute) {
                log.warn("Rate limit exceeded for key={}: {}/{} reqs", clientKey, count, maxRequestsPerMinute);
                return false;
            }
            return true;
        } catch (Exception ex) {
            log.error("Redis rate limiter check failed for key {}: {}. Allowing request as fallback.", clientKey, ex.getMessage());
            return true; // Fallback gracefully if Redis is unavailable
        }
    }
}
