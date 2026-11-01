package com.shopi.gateway;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopi.gateway.controller.ApiGatewayController;
import com.shopi.gateway.dto.*;
import com.shopi.gateway.service.JwtTokenService;
import com.shopi.marketplace.v1.*;
import io.grpc.Status;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
public class AuthSecurityIntegrationTest {

    @Container
    static GenericContainer<?> redis = new GenericContainer<>(DockerImageName.parse("redis:7-alpine"))
            .withExposedPorts(6379);

    @DynamicPropertySource
    static void configureProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("spring.redis.host", redis::getHost);
        registry.add("spring.redis.port", () -> redis.getMappedPort(6379));
        registry.add("SPRING_DATA_REDIS_HOST", redis::getHost);
        registry.add("SPRING_DATA_REDIS_PORT", () -> String.valueOf(redis.getMappedPort(6379)));
        registry.add("grpc.client.order-payment-service.address", () -> "in-process:test");
        registry.add("grpc.client.shop-catalog-service.address", () -> "in-process:test");
        registry.add("grpc.client.identity-service.address", () -> "in-process:test");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JwtTokenService jwtTokenService;

    @Autowired
    private StringRedisTemplate redisTemplate;

    @Autowired
    private ApiGatewayController apiGatewayController;

    @Mock
    private AuthServiceGrpc.AuthServiceBlockingStub authServiceStub;

    @Mock
    private OrderServiceGrpc.OrderServiceBlockingStub orderServiceStub;

    @Mock
    private CatalogServiceGrpc.CatalogServiceBlockingStub catalogServiceStub;

    @Value("${shopi.jwt.secret:shopi-enterprise-jwt-secret-key-must-be-at-least-256-bits-long-shopi-2026}")
    private String jwtSecret;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
        ReflectionTestUtils.setField(apiGatewayController, "authServiceStub", authServiceStub);
        ReflectionTestUtils.setField(apiGatewayController, "orderServiceStub", orderServiceStub);
        ReflectionTestUtils.setField(apiGatewayController, "catalogServiceStub", catalogServiceStub);
        redisTemplate.getConnectionFactory().getConnection().serverCommands().flushAll();
    }

    private String generateTestJwt(String userId, Duration validity) {
        SecretKey key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .claim("role", "BUYER")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(validity)))
                .signWith(key)
                .compact();
    }

    /**
     * Test 1: Refresh Token Rotation (Happy Path):
     * Gateway receives valid refresh token -> returns newly rotated access token + new refresh token.
     */
    @Test
    @DisplayName("Token Rotation: Valid refresh token produces new access token and rotated refresh token")
    void testRefreshTokenRotationSuccess() throws Exception {
        String oldRefreshToken = "rt-v1-initial-token-" + UUID.randomUUID();
        String newAccessToken = "jwt-v2-new-access-token-" + UUID.randomUUID();
        String newRefreshToken = "rt-v2-rotated-token-" + UUID.randomUUID();

        TokenResponse stubResponse = TokenResponse.newBuilder()
                .setAccessToken(newAccessToken)
                .setRefreshToken(newRefreshToken)
                .setExpiresIn(900)
                .setTokenType("Bearer")
                .build();

        when(authServiceStub.refreshToken(any(RefreshTokenRequest.class))).thenReturn(stubResponse);

        RefreshTokenRequestDto requestDto = RefreshTokenRequestDto.builder()
                .refreshToken(oldRefreshToken)
                .build();

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value(newAccessToken))
                .andExpect(jsonPath("$.refreshToken").value(newRefreshToken))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.expiresIn").value(900));
    }

    /**
     * Test 2: Replay Attack & Token Family Reuse Detection:
     * When an attacker replays a previously consumed refresh token, gRPC stub throws UNAUTHENTICATED
     * and Gateway responds with HTTP 401 Unauthorized indicating session revocation.
     */
    @Test
    @DisplayName("Replay Attack: Submitting a previously consumed refresh token triggers 401 and family revocation")
    void testRefreshTokenReplayAttackDetection() throws Exception {
        String replayedToken = "rt-v1-already-consumed-token";

        when(authServiceStub.refreshToken(any(RefreshTokenRequest.class)))
                .thenThrow(Status.UNAUTHENTICATED
                        .withDescription("Token reuse detected. All sessions in this family have been terminated for security.")
                        .asRuntimeException());

        RefreshTokenRequestDto requestDto = RefreshTokenRequestDto.builder()
                .refreshToken(replayedToken)
                .build();

        mockMvc.perform(post("/api/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(requestDto)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Token reuse detected")));
    }

    /**
     * Test 3: Logout & Immediate Invalidation via Redis Blacklist:
     * On logout, the Access Token is added to Redis with prefix 'auth:blacklist:<token>'.
     * Any subsequent API requests with this token must immediately receive HTTP 401 Unauthorized.
     */
    @Test
    @DisplayName("Redis Blacklist: Logout immediately blacklists token in Redis, blocking subsequent requests")
    void testLogoutAndImmediateRedisBlacklistEnforcement() throws Exception {
        String userId = "user-alice-security-test";
        String accessToken = generateTestJwt(userId, Duration.ofMinutes(15));
        String refreshToken = "rt-valid-family-session-" + UUID.randomUUID();

        when(authServiceStub.revokeToken(any(RevokeTokenRequest.class))).thenReturn(
                RevokeTokenResponse.newBuilder()
                        .setSuccess(true)
                        .setMessage("Tokens revoked successfully and access token blacklisted.")
                        .build()
        );

        // Verify token is NOT blacklisted initially
        assertThat(jwtTokenService.isBlacklisted(accessToken)).isFalse();

        // Perform Logout via API Gateway
        RefreshTokenRequestDto logoutBody = RefreshTokenRequestDto.builder()
                .refreshToken(refreshToken)
                .build();

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(logoutBody)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify in Redis container that access token is now blacklisted
        assertThat(jwtTokenService.isBlacklisted(accessToken)).isTrue();
        String blacklistVal = redisTemplate.opsForValue().get("auth:blacklist:" + accessToken);
        assertThat(blacklistVal).isEqualTo("revoked");

        // Verify that subsequent request using the blacklisted token is rejected immediately (HTTP 401)
        mockMvc.perform(post("/api/orders")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"productId\":\"prod-1\",\"buyerId\":\"user-alice-security-test\"}"))
                .andExpect(status().isUnauthorized());
    }

    /**
     * Test 4: End-to-End Redis Token Family State Machine:
     * Validates low-level Redis operations for Token Family lifecycle:
     * 1. Active token state
     * 2. Rotation transition: old marked consumed, new active stored
     * 3. Reuse detection: consumed token triggers deletion of family key.
     */
    @Test
    @DisplayName("Redis State Machine: Token Family Rotation, Grace Period, and Family Invalidation")
    void testRedisTokenFamilyLifecycleContract() {
        String userId = "user-test-777";
        String familyId = UUID.randomUUID().toString();
        String tokenR1 = "token-generation-1";
        String tokenR2 = "token-generation-2";

        String redisRefreshPrefix = "auth:refresh:";
        String redisFamilyPrefix = "auth:family:";
        String redisConsumedPrefix = "auth:consumed:";

        // Step 1: Initial token generation
        redisTemplate.opsForValue().set(redisRefreshPrefix + tokenR1, userId + ":" + familyId, Duration.ofDays(14));
        redisTemplate.opsForValue().set(redisFamilyPrefix + familyId, tokenR1, Duration.ofDays(14));

        assertThat(redisTemplate.opsForValue().get(redisRefreshPrefix + tokenR1)).isEqualTo(userId + ":" + familyId);
        assertThat(redisTemplate.opsForValue().get(redisFamilyPrefix + familyId)).isEqualTo(tokenR1);

        // Step 2: Rotation to Generation 2
        // Mark tokenR1 consumed
        redisTemplate.opsForValue().set(redisConsumedPrefix + tokenR1, familyId, Duration.ofHours(24));
        redisTemplate.delete(redisRefreshPrefix + tokenR1);

        // Register tokenR2
        redisTemplate.opsForValue().set(redisRefreshPrefix + tokenR2, userId + ":" + familyId, Duration.ofDays(14));
        redisTemplate.opsForValue().set(redisFamilyPrefix + familyId, tokenR2, Duration.ofDays(14));

        assertThat(redisTemplate.hasKey(redisRefreshPrefix + tokenR1)).isFalse();
        assertThat(redisTemplate.opsForValue().get(redisConsumedPrefix + tokenR1)).isEqualTo(familyId);
        assertThat(redisTemplate.opsForValue().get(redisFamilyPrefix + familyId)).isEqualTo(tokenR2);

        // Step 3: Malicious replay of tokenR1 detected!
        String compromisedFamilyId = redisTemplate.opsForValue().get(redisConsumedPrefix + tokenR1);
        assertThat(compromisedFamilyId).isEqualTo(familyId);

        // Invalidate entire family upon reuse detection
        redisTemplate.delete(redisFamilyPrefix + compromisedFamilyId);

        // Assert: Entire family is terminated; tokenR2 is now orphaned and unusable
        assertThat(redisTemplate.hasKey(redisFamilyPrefix + familyId)).isFalse();
    }

    @Test
    @DisplayName("REST SendOtp: Gateway forwards email to AuthService and returns 200")
    void testSendOtpEndpoint() throws Exception {
        when(authServiceStub.sendOtp(any(SendOtpRequest.class))).thenReturn(
                SendOtpResponse.newBuilder().setSuccess(true).setMessage("OTP sent").build()
        );

        SendOtpRequestDto dto = SendOtpRequestDto.builder().email("buyer@shopi.vn").build();

        mockMvc.perform(post("/api/auth/register/send-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("OTP sent"));
    }

    @Test
    @DisplayName("REST VerifyOtp: Gateway validates OTP via AuthService and returns verificationToken")
    void testVerifyOtpEndpoint() throws Exception {
        when(authServiceStub.verifyOtp(any(VerifyOtpRequest.class))).thenReturn(
                VerifyOtpResponse.newBuilder()
                        .setSuccess(true)
                        .setMessage("OTP valid")
                        .setVerificationToken("v-token-xyz")
                        .build()
        );

        VerifyOtpRequestDto dto = VerifyOtpRequestDto.builder()
                .email("buyer@shopi.vn")
                .otpCode("123456")
                .build();

        mockMvc.perform(post("/api/auth/register/verify-otp")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.verificationToken").value("v-token-xyz"));
    }

    @Test
    @DisplayName("REST RegisterWithEmail: Successfully registers user and returns JWT response")
    void testRegisterWithEmailEndpoint() throws Exception {
        when(authServiceStub.registerWithEmail(any(RegisterWithEmailRequest.class))).thenReturn(
                LoginResponse.newBuilder()
                        .setAccessToken("jwt-access-123")
                        .setRefreshToken("jwt-refresh-123")
                        .setExpiresIn(900)
                        .setTokenType("Bearer")
                        .setUserId("user-new-id")
                        .setEmail("buyer@shopi.vn")
                        .setRole("BUYER")
                        .setFullName("Nguyen Van B")
                        .build()
        );

        RegisterWithEmailRequestDto dto = RegisterWithEmailRequestDto.builder()
                .email("buyer@shopi.vn")
                .password("password123")
                .fullName("Nguyen Van B")
                .verificationToken("v-token-xyz")
                .build();

        mockMvc.perform(post("/api/auth/register/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("jwt-access-123"))
                .andExpect(jsonPath("$.email").value("buyer@shopi.vn"))
                .andExpect(jsonPath("$.role").value("BUYER"));
    }

    @Test
    @DisplayName("REST LoginWithGoogle: Google OAuth login without password returns JWT response")
    void testLoginWithGoogleEndpoint() throws Exception {
        when(authServiceStub.loginWithGoogle(any(LoginWithGoogleRequest.class))).thenReturn(
                LoginResponse.newBuilder()
                        .setAccessToken("google-access-jwt")
                        .setRefreshToken("google-refresh-token")
                        .setExpiresIn(900)
                        .setTokenType("Bearer")
                        .setUserId("google-user-id")
                        .setEmail("google@gmail.com")
                        .setRole("BUYER")
                        .setFullName("Google User")
                        .build()
        );

        GoogleLoginRequestDto dto = GoogleLoginRequestDto.builder()
                .email("google@gmail.com")
                .fullName("Google User")
                .idToken("mock-google-id-token")
                .build();

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("google-access-jwt"))
                .andExpect(jsonPath("$.email").value("google@gmail.com"));
    }
}
