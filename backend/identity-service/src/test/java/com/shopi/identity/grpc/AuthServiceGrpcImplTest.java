package com.shopi.identity.grpc;

import com.shopi.identity.domain.UserEntity;
import com.shopi.identity.domain.UserRole;
import com.shopi.identity.repository.UserRepository;
import com.shopi.identity.service.JwtTokenProvider;
import com.shopi.marketplace.v1.*;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceGrpcImplTest {

    @Mock
    private JwtTokenProvider jwtTokenProvider;

    @Mock
    private UserRepository userRepository;

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    @InjectMocks
    private AuthServiceGrpcImpl authService;

    @BeforeEach
    void setUp() {
        lenient().when(redisTemplate.opsForValue()).thenReturn(valueOperations);
    }

    @Test
    @DisplayName("SendOtp: Should succeed and store OTP in Redis for new email")
    void sendOtp_Success() {
        when(userRepository.existsByEmail("test@shopi.vn")).thenReturn(false);

        StreamObserver<SendOtpResponse> observer = mock(StreamObserver.class);
        SendOtpRequest request = SendOtpRequest.newBuilder().setEmail("test@shopi.vn").build();

        authService.sendOtp(request, observer);

        verify(valueOperations).set(eq("otp:register:test@shopi.vn"), anyString(), eq(Duration.ofMinutes(5)));
        ArgumentCaptor<SendOtpResponse> captor = ArgumentCaptor.forClass(SendOtpResponse.class);
        verify(observer).onNext(captor.capture());
        verify(observer).onCompleted();

        assertThat(captor.getValue().getSuccess()).isTrue();
    }

    @Test
    @DisplayName("SendOtp: Should fail when email already registered")
    void sendOtp_EmailAlreadyExists() {
        when(userRepository.existsByEmail("existing@shopi.vn")).thenReturn(true);

        StreamObserver<SendOtpResponse> observer = mock(StreamObserver.class);
        SendOtpRequest request = SendOtpRequest.newBuilder().setEmail("existing@shopi.vn").build();

        authService.sendOtp(request, observer);

        ArgumentCaptor<Throwable> captor = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(captor.capture());
        assertThat(captor.getValue()).isInstanceOf(StatusRuntimeException.class);
        StatusRuntimeException ex = (StatusRuntimeException) captor.getValue();
        assertThat(ex.getStatus().getCode()).isEqualTo(Status.Code.ALREADY_EXISTS);
    }

    @Test
    @DisplayName("VerifyOtp: Should succeed and store verificationToken when OTP matches")
    void verifyOtp_Success() {
        when(valueOperations.get("otp:register:test@shopi.vn")).thenReturn("123456");

        StreamObserver<VerifyOtpResponse> observer = mock(StreamObserver.class);
        VerifyOtpRequest request = VerifyOtpRequest.newBuilder()
                .setEmail("test@shopi.vn")
                .setOtpCode("123456")
                .build();

        authService.verifyOtp(request, observer);

        verify(redisTemplate).delete("otp:register:test@shopi.vn");
        verify(valueOperations).set(eq("otp:verified:test@shopi.vn"), anyString(), eq(Duration.ofMinutes(15)));

        ArgumentCaptor<VerifyOtpResponse> captor = ArgumentCaptor.forClass(VerifyOtpResponse.class);
        verify(observer).onNext(captor.capture());
        verify(observer).onCompleted();

        assertThat(captor.getValue().getSuccess()).isTrue();
        assertThat(captor.getValue().getVerificationToken()).isNotBlank();
    }

    @Test
    @DisplayName("VerifyOtp: Should fail when OTP does not match")
    void verifyOtp_Mismatch() {
        when(valueOperations.get("otp:register:test@shopi.vn")).thenReturn("123456");

        StreamObserver<VerifyOtpResponse> observer = mock(StreamObserver.class);
        VerifyOtpRequest request = VerifyOtpRequest.newBuilder()
                .setEmail("test@shopi.vn")
                .setOtpCode("999999")
                .build();

        authService.verifyOtp(request, observer);

        ArgumentCaptor<Throwable> captor = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(captor.capture());
        StatusRuntimeException ex = (StatusRuntimeException) captor.getValue();
        assertThat(ex.getStatus().getCode()).isEqualTo(Status.Code.INVALID_ARGUMENT);
    }

    @Test
    @DisplayName("RegisterWithEmail: Should create user and issue JWT when verification token is valid")
    void registerWithEmail_Success() {
        String token = "valid-token-123";
        when(valueOperations.get("otp:verified:newuser@shopi.vn")).thenReturn(token);
        when(userRepository.existsByEmail("newuser@shopi.vn")).thenReturn(false);

        UUID newUserId = UUID.randomUUID();
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity u = invocation.getArgument(0);
            return u;
        });
        when(jwtTokenProvider.generateAccessToken(any(), eq("newuser@shopi.vn"), eq("BUYER"))).thenReturn("jwt-access-token");
        when(jwtTokenProvider.generateRefreshToken(any())).thenReturn("jwt-refresh-token");

        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);
        RegisterWithEmailRequest request = RegisterWithEmailRequest.newBuilder()
                .setEmail("newuser@shopi.vn")
                .setPassword("secret123")
                .setFullName("Nguyen Van A")
                .setVerificationToken(token)
                .build();

        authService.registerWithEmail(request, observer);

        verify(redisTemplate).delete("otp:verified:newuser@shopi.vn");
        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        UserEntity createdUser = userCaptor.getValue();
        assertThat(createdUser.getEmail()).isEqualTo("newuser@shopi.vn");
        assertThat(createdUser.getFullName()).isEqualTo("Nguyen Van A");
        assertThat(createdUser.getAuthProvider()).isEqualTo("LOCAL");
        assertThat(createdUser.isEmailVerified()).isTrue();
        assertThat(new BCryptPasswordEncoder().matches("secret123", createdUser.getPasswordHash())).isTrue();

        ArgumentCaptor<LoginResponse> respCaptor = ArgumentCaptor.forClass(LoginResponse.class);
        verify(observer).onNext(respCaptor.capture());
        verify(observer).onCompleted();
        assertThat(respCaptor.getValue().getAccessToken()).isEqualTo("jwt-access-token");
    }

    @Test
    @DisplayName("LoginWithGoogle: Should auto-register user without password and issue JWT")
    void loginWithGoogle_AutoRegisterNewUser() {
        when(userRepository.findByEmail("googleuser@gmail.com")).thenReturn(Optional.empty());
        when(userRepository.save(any(UserEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(jwtTokenProvider.generateAccessToken(any(), eq("googleuser@gmail.com"), eq("BUYER"))).thenReturn("google-access-token");
        when(jwtTokenProvider.generateRefreshToken(any())).thenReturn("google-refresh-token");

        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);
        LoginWithGoogleRequest request = LoginWithGoogleRequest.newBuilder()
                .setEmail("googleuser@gmail.com")
                .setFullName("Google Tester")
                .build();

        authService.loginWithGoogle(request, observer);

        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(userRepository).save(userCaptor.capture());
        UserEntity createdUser = userCaptor.getValue();
        assertThat(createdUser.getEmail()).isEqualTo("googleuser@gmail.com");
        assertThat(createdUser.getFullName()).isEqualTo("Google Tester");
        assertThat(createdUser.getPasswordHash()).isNull(); // No password required!
        assertThat(createdUser.getAuthProvider()).isEqualTo("GOOGLE");
        assertThat(createdUser.isEmailVerified()).isTrue();

        ArgumentCaptor<LoginResponse> respCaptor = ArgumentCaptor.forClass(LoginResponse.class);
        verify(observer).onNext(respCaptor.capture());
        verify(observer).onCompleted();
        assertThat(respCaptor.getValue().getAccessToken()).isEqualTo("google-access-token");
    }

    @Test
    @DisplayName("Login: Should reject password login for Google OAuth account with null passwordHash")
    void login_RejectGoogleUserWithoutPassword() {
        UserEntity googleUser = UserEntity.builder()
                .id(UUID.randomUUID())
                .email("googleonly@gmail.com")
                .passwordHash(null)
                .fullName("Google Only User")
                .role(UserRole.BUYER)
                .authProvider("GOOGLE")
                .active(true)
                .build();

        when(userRepository.findByEmail("googleonly@gmail.com")).thenReturn(Optional.of(googleUser));

        StreamObserver<LoginResponse> observer = mock(StreamObserver.class);
        LoginRequest request = LoginRequest.newBuilder()
                .setEmail("googleonly@gmail.com")
                .setPassword("somePassword")
                .build();

        authService.login(request, observer);

        ArgumentCaptor<Throwable> captor = ArgumentCaptor.forClass(Throwable.class);
        verify(observer).onError(captor.capture());
        StatusRuntimeException ex = (StatusRuntimeException) captor.getValue();
        assertThat(ex.getStatus().getCode()).isEqualTo(Status.Code.FAILED_PRECONDITION);
        assertThat(ex.getStatus().getDescription()).contains("Google");
    }
}
