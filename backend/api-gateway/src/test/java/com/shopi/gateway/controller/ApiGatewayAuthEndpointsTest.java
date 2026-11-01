package com.shopi.gateway.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopi.gateway.dto.GoogleLoginRequestDto;
import com.shopi.gateway.dto.RegisterWithEmailRequestDto;
import com.shopi.gateway.dto.SendOtpRequestDto;
import com.shopi.gateway.dto.VerifyOtpRequestDto;
import com.shopi.gateway.service.JwtTokenService;
import com.shopi.gateway.service.RateLimiterService;
import com.shopi.marketplace.v1.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ApiGatewayAuthEndpointsTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private AuthServiceGrpc.AuthServiceBlockingStub authServiceStub;

    @Mock
    private RateLimiterService rateLimiterService;

    @Mock
    private JwtTokenService jwtTokenService;

    @InjectMocks
    private ApiGatewayController controller;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(controller, "authServiceStub", authServiceStub);
        when(rateLimiterService.allowRequest(any())).thenReturn(true);
        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    @DisplayName("SendOtp: Forward to AuthService and return success response")
    void sendOtp_Success() throws Exception {
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
    @DisplayName("VerifyOtp: Forward to AuthService and return verification token")
    void verifyOtp_Success() throws Exception {
        when(authServiceStub.verifyOtp(any(VerifyOtpRequest.class))).thenReturn(
                VerifyOtpResponse.newBuilder()
                        .setSuccess(true)
                        .setMessage("OTP verified")
                        .setVerificationToken("v-token-123456")
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
                .andExpect(jsonPath("$.verificationToken").value("v-token-123456"));
    }

    @Test
    @DisplayName("RegisterWithEmail: Forward to AuthService and return 201 Created with tokens")
    void registerWithEmail_Success() throws Exception {
        when(authServiceStub.registerWithEmail(any(RegisterWithEmailRequest.class))).thenReturn(
                LoginResponse.newBuilder()
                        .setAccessToken("jwt-acc-token")
                        .setRefreshToken("jwt-ref-token")
                        .setExpiresIn(900)
                        .setTokenType("Bearer")
                        .setUserId("user-uuid-1")
                        .setEmail("buyer@shopi.vn")
                        .setRole("BUYER")
                        .setFullName("Nguyen Van A")
                        .build()
        );

        RegisterWithEmailRequestDto dto = RegisterWithEmailRequestDto.builder()
                .email("buyer@shopi.vn")
                .password("password123")
                .fullName("Nguyen Van A")
                .verificationToken("v-token-123456")
                .build();

        mockMvc.perform(post("/api/auth/register/email")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.accessToken").value("jwt-acc-token"))
                .andExpect(jsonPath("$.userId").value("user-uuid-1"))
                .andExpect(jsonPath("$.email").value("buyer@shopi.vn"));
    }

    @Test
    @DisplayName("LoginWithGoogle: Forward Google credentials to AuthService without password")
    void loginWithGoogle_Success() throws Exception {
        when(authServiceStub.loginWithGoogle(any(LoginWithGoogleRequest.class))).thenReturn(
                LoginResponse.newBuilder()
                        .setAccessToken("google-jwt-acc")
                        .setRefreshToken("google-jwt-ref")
                        .setExpiresIn(900)
                        .setTokenType("Bearer")
                        .setUserId("google-user-uuid")
                        .setEmail("google@gmail.com")
                        .setRole("BUYER")
                        .setFullName("Google User")
                        .build()
        );

        GoogleLoginRequestDto dto = GoogleLoginRequestDto.builder()
                .email("google@gmail.com")
                .fullName("Google User")
                .idToken("mock-id-token")
                .build();

        mockMvc.perform(post("/api/auth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(dto)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("google-jwt-acc"))
                .andExpect(jsonPath("$.userId").value("google-user-uuid"))
                .andExpect(jsonPath("$.email").value("google@gmail.com"));
    }
}
