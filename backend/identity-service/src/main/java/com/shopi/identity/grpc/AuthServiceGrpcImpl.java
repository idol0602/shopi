package com.shopi.identity.grpc;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.shopi.identity.domain.UserEntity;
import com.shopi.identity.domain.UserRole;
import com.shopi.identity.repository.UserRepository;
import com.shopi.identity.service.JwtTokenProvider;
import com.shopi.marketplace.v1.*;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.devh.boot.grpc.server.service.GrpcService;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@GrpcService
@RequiredArgsConstructor
public class AuthServiceGrpcImpl extends AuthServiceGrpc.AuthServiceImplBase {

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final StringRedisTemplate redisTemplate;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public void login(LoginRequest request, StreamObserver<LoginResponse> responseObserver) {
        String email = request.getEmail();
        String password = request.getPassword();

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Email và mật khẩu không được để trống")
                    .asRuntimeException());
            return;
        }

        Optional<UserEntity> userOpt = userRepository.findByEmail(email.trim().toLowerCase());
        if (userOpt.isEmpty()) {
            log.warn("Login failed: User not found for email {}", email);
            responseObserver.onError(Status.UNAUTHENTICATED
                    .withDescription("Email hoặc mật khẩu không chính xác")
                    .asRuntimeException());
            return;
        }

        UserEntity user = userOpt.get();

        // If user was created via Google OAuth without password
        if (user.getPasswordHash() == null || user.getPasswordHash().isBlank()) {
            log.warn("Login failed: User {} registered via Google OAuth has no local password", email);
            responseObserver.onError(Status.FAILED_PRECONDITION
                    .withDescription("Tài khoản này được đăng ký bằng Google. Vui lòng chọn 'Đăng nhập bằng Google'.")
                    .asRuntimeException());
            return;
        }

        if (!passwordEncoder.matches(password, user.getPasswordHash())) {
            log.warn("Login failed: Password mismatch for user {}", email);
            responseObserver.onError(Status.UNAUTHENTICATED
                    .withDescription("Email hoặc mật khẩu không chính xác")
                    .asRuntimeException());
            return;
        }

        if (!user.isActive()) {
            log.warn("Login rejected: Account is inactive for user {}", email);
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("Tài khoản người dùng đã bị khóa")
                    .asRuntimeException());
            return;
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        LoginResponse response = LoginResponse.newBuilder()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken)
                .setExpiresIn(900)
                .setTokenType("Bearer")
                .setUserId(user.getId().toString())
                .setEmail(user.getEmail())
                .setRole(user.getRole().name())
                .setFullName(user.getFullName() != null ? user.getFullName() : "")
                .build();

        log.info("User {} logged in successfully with role {}", user.getEmail(), user.getRole());
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void refreshToken(RefreshTokenRequest request, StreamObserver<TokenResponse> responseObserver) {
        String oldRefreshToken = request.getRefreshToken();
        if (oldRefreshToken == null || oldRefreshToken.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Refresh token must not be empty")
                    .asRuntimeException());
            return;
        }

        String userIdStr = jwtTokenProvider.getUserIdFromRefreshToken(oldRefreshToken);
        if (userIdStr == null) {
            responseObserver.onError(Status.UNAUTHENTICATED
                    .withDescription("Refresh token is invalid, expired, or has been revoked")
                    .asRuntimeException());
            return;
        }

        UUID userId = UUID.fromString(userIdStr);
        Optional<UserEntity> userOpt = userRepository.findById(userId);

        if (userOpt.isEmpty() || !userOpt.get().isActive()) {
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("User account is inactive or not found")
                    .asRuntimeException());
            return;
        }

        UserEntity user = userOpt.get();

        // Rotate token
        String newRefreshToken = jwtTokenProvider.validateAndRotateRefreshToken(oldRefreshToken);
        String newAccessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());

        TokenResponse response = TokenResponse.newBuilder()
                .setAccessToken(newAccessToken)
                .setRefreshToken(newRefreshToken)
                .setExpiresIn(900) // 15 mins
                .setTokenType("Bearer")
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void revokeToken(RevokeTokenRequest request, StreamObserver<RevokeTokenResponse> responseObserver) {
        jwtTokenProvider.revokeToken(request.getRefreshToken(), request.getAccessToken());

        RevokeTokenResponse response = RevokeTokenResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Tokens successfully revoked")
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void sendOtp(SendOtpRequest request, StreamObserver<SendOtpResponse> responseObserver) {
        String email = request.getEmail();
        if (email == null || email.isBlank() || !email.contains("@")) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Email không hợp lệ")
                    .asRuntimeException());
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();

        if (userRepository.existsByEmail(normalizedEmail)) {
            responseObserver.onError(Status.ALREADY_EXISTS
                    .withDescription("Email đã được đăng ký trong hệ thống")
                    .asRuntimeException());
            return;
        }

        // Generate 6-digit random OTP (100000 - 999999)
        int otpNumber = secureRandom.nextInt(900000) + 100000;
        String otp = String.valueOf(otpNumber);

        // Store OTP in Redis with 5 minutes TTL
        String redisKey = "otp:register:" + normalizedEmail;
        redisTemplate.opsForValue().set(redisKey, otp, Duration.ofMinutes(5));

        log.info("========== [Shopi OTP Verification] ==========");
        log.info("Email: {}", normalizedEmail);
        log.info("Mã OTP đăng ký (TTL 5m): {}", otp);
        log.info("===============================================");

        SendOtpResponse response = SendOtpResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Mã xác thực OTP đã được gửi đến " + normalizedEmail)
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void verifyOtp(VerifyOtpRequest request, StreamObserver<VerifyOtpResponse> responseObserver) {
        String email = request.getEmail();
        String otpCode = request.getOtpCode();

        if (email == null || email.isBlank() || otpCode == null || otpCode.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Email và mã OTP không được để trống")
                    .asRuntimeException());
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();
        String redisKey = "otp:register:" + normalizedEmail;
        String storedOtp = redisTemplate.opsForValue().get(redisKey);

        if (storedOtp == null || !storedOtp.equals(otpCode.trim())) {
            log.warn("OTP verification failed for email {}: invalid or expired", normalizedEmail);
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Mã OTP không đúng hoặc đã hết hạn")
                    .asRuntimeException());
            return;
        }

        // OTP verified successfully: remove OTP and generate verification token
        redisTemplate.delete(redisKey);

        String verificationToken = UUID.randomUUID().toString().replace("-", "");
        String verifiedKey = "otp:verified:" + normalizedEmail;
        redisTemplate.opsForValue().set(verifiedKey, verificationToken, Duration.ofMinutes(15));

        VerifyOtpResponse response = VerifyOtpResponse.newBuilder()
                .setSuccess(true)
                .setMessage("Xác thực OTP thành công")
                .setVerificationToken(verificationToken)
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void registerWithEmail(RegisterWithEmailRequest request, StreamObserver<LoginResponse> responseObserver) {
        String email = request.getEmail();
        String password = request.getPassword();
        String fullName = request.getFullName();
        String verificationToken = request.getVerificationToken();

        if (email == null || email.isBlank() || password == null || password.isBlank() ||
                fullName == null || fullName.isBlank() || verificationToken == null || verificationToken.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Thông tin đăng ký không được để trống")
                    .asRuntimeException());
            return;
        }

        if (password.length() < 6) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Mật khẩu phải có ít nhất 6 ký tự")
                    .asRuntimeException());
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();
        String verifiedKey = "otp:verified:" + normalizedEmail;
        String storedToken = redisTemplate.opsForValue().get(verifiedKey);

        if (storedToken == null || !storedToken.equals(verificationToken.trim())) {
            log.warn("Registration rejected for {}: invalid verification token", normalizedEmail);
            responseObserver.onError(Status.PERMISSION_DENIED
                    .withDescription("Mã xác thực không hợp lệ hoặc đã hết hạn. Vui lòng xác thực lại OTP.")
                    .asRuntimeException());
            return;
        }

        if (userRepository.existsByEmail(normalizedEmail)) {
            responseObserver.onError(Status.ALREADY_EXISTS
                    .withDescription("Email đã được đăng ký trong hệ thống")
                    .asRuntimeException());
            return;
        }

        // Clean up verified token from Redis
        redisTemplate.delete(verifiedKey);

        UserEntity newUser = UserEntity.builder()
                .id(UUID.randomUUID())
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(password))
                .fullName(fullName.trim())
                .role(UserRole.BUYER)
                .authProvider("LOCAL")
                .emailVerified(true)
                .active(true)
                .build();

        UserEntity savedUser = userRepository.save(newUser);
        log.info("User registered successfully via email: id={}, email={}", savedUser.getId(), savedUser.getEmail());

        String accessToken = jwtTokenProvider.generateAccessToken(savedUser.getId(), savedUser.getEmail(), savedUser.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(savedUser.getId());

        LoginResponse response = LoginResponse.newBuilder()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken)
                .setExpiresIn(900)
                .setTokenType("Bearer")
                .setUserId(savedUser.getId().toString())
                .setEmail(savedUser.getEmail())
                .setRole(savedUser.getRole().name())
                .setFullName(savedUser.getFullName())
                .build();

        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }

    @Override
    public void loginWithGoogle(LoginWithGoogleRequest request, StreamObserver<LoginResponse> responseObserver) {
        String email = request.getEmail();
        String fullName = request.getFullName();
        String idToken = request.getIdToken();

        // Attempt to extract email and name from idToken if email was not supplied directly
        if ((email == null || email.isBlank()) && (idToken != null && !idToken.isBlank())) {
            try {
                String[] parts = idToken.split("\\.");
                if (parts.length >= 2) {
                    byte[] payloadBytes = Base64.getUrlDecoder().decode(parts[1]);
                    JsonNode jsonNode = objectMapper.readTree(payloadBytes);
                    if (jsonNode.has("email")) {
                        email = jsonNode.get("email").asText();
                    }
                    if ((fullName == null || fullName.isBlank()) && jsonNode.has("name")) {
                        fullName = jsonNode.get("name").asText();
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to parse Google idToken payload: {}", e.getMessage());
            }
        }

        if (email == null || email.isBlank()) {
            responseObserver.onError(Status.INVALID_ARGUMENT
                    .withDescription("Không tìm thấy thông tin email từ Google OAuth")
                    .asRuntimeException());
            return;
        }

        String normalizedEmail = email.trim().toLowerCase();
        Optional<UserEntity> userOpt = userRepository.findByEmail(normalizedEmail);
        UserEntity user;

        if (userOpt.isPresent()) {
            user = userOpt.get();
            if (!user.isActive()) {
                responseObserver.onError(Status.PERMISSION_DENIED
                        .withDescription("Tài khoản người dùng đã bị vô hiệu hóa")
                        .asRuntimeException());
                return;
            }
            if ((user.getFullName() == null || user.getFullName().isBlank()) && fullName != null && !fullName.isBlank()) {
                user.setFullName(fullName.trim());
                user = userRepository.save(user);
            }
        } else {
            // Auto-create new user with GOOGLE provider - NO password required!
            String displayName = (fullName != null && !fullName.isBlank()) ? fullName.trim() : normalizedEmail.split("@")[0];
            user = UserEntity.builder()
                    .id(UUID.randomUUID())
                    .email(normalizedEmail)
                    .passwordHash(null)
                    .fullName(displayName)
                    .role(UserRole.BUYER)
                    .authProvider("GOOGLE")
                    .emailVerified(true)
                    .active(true)
                    .build();
            user = userRepository.save(user);
            log.info("Auto-registered new user via Google OAuth: id={}, email={}", user.getId(), user.getEmail());
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        LoginResponse response = LoginResponse.newBuilder()
                .setAccessToken(accessToken)
                .setRefreshToken(refreshToken)
                .setExpiresIn(900)
                .setTokenType("Bearer")
                .setUserId(user.getId().toString())
                .setEmail(user.getEmail())
                .setRole(user.getRole().name())
                .setFullName(user.getFullName() != null ? user.getFullName() : "")
                .build();

        log.info("User {} logged in successfully via Google OAuth", user.getEmail());
        responseObserver.onNext(response);
        responseObserver.onCompleted();
    }
}
