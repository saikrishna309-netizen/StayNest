package com.staynest.auth.service;

import com.staynest.auth.dto.*;
import com.staynest.common.exception.BadRequestException;
import com.staynest.common.exception.ConflictException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.exception.UnauthorizedException;
import com.staynest.owner.entity.OwnerProfile;
import com.staynest.owner.repository.OwnerProfileRepository;
import com.staynest.security.JwtTokenProvider;
import com.staynest.user.dto.UserProfileResponse;
import com.staynest.user.entity.User;
import com.staynest.user.entity.UserRole;
import com.staynest.user.entity.UserStatus;
import com.staynest.user.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final OwnerProfileRepository ownerProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;

    public AuthService(UserRepository userRepository,
                       OwnerProfileRepository ownerProfileRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider jwtTokenProvider) {
        this.userRepository = userRepository;
        this.ownerProfileRepository = ownerProfileRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail().trim().toLowerCase())) {
            throw new ConflictException("EMAIL_ALREADY_EXISTS", "Email is already registered: " + request.getEmail());
        }
        if (userRepository.existsByPhone(request.getPhone().trim())) {
            throw new ConflictException("PHONE_ALREADY_EXISTS", "Phone number is already registered: " + request.getPhone());
        }

        User user = new User();
        user.setFullName(request.getFullName().trim());
        user.setEmail(request.getEmail().trim().toLowerCase());
        user.setPhone(request.getPhone().trim());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRole(request.getRole() != null ? request.getRole() : UserRole.ROLE_CUSTOMER);
        user.setStatus(UserStatus.ACTIVE);
        user.setEmailVerificationToken(UUID.randomUUID().toString());
        user.setPhoneOtp("123456"); // Default testing OTP

        user = userRepository.save(user);

        if (user.getRole() == UserRole.ROLE_OWNER) {
            OwnerProfile profile = new OwnerProfile(user.getId(),
                    request.getBusinessName() != null ? request.getBusinessName() : user.getFullName() + "'s Properties");
            ownerProfileRepository.save(profile);
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return new AuthResponse(accessToken, refreshToken, UserProfileResponse.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse login(LoginRequest request) {
        String identifier = request.getUsername().trim();
        User user = userRepository.findByEmail(identifier.toLowerCase())
                .or(() -> userRepository.findByPhone(identifier))
                .orElseThrow(() -> new UnauthorizedException("Invalid email/phone or password"));

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new UnauthorizedException("Invalid email/phone or password");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new BadRequestException("ACCOUNT_SUSPENDED", "Your account has been suspended. Please contact support.");
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return new AuthResponse(accessToken, refreshToken, UserProfileResponse.from(user));
    }

    @Transactional(readOnly = true)
    public AuthResponse refreshToken(RefreshTokenRequest request) {
        if (!jwtTokenProvider.validateToken(request.getRefreshToken())) {
            throw new UnauthorizedException("Invalid or expired refresh token");
        }

        UUID userId = jwtTokenProvider.getUserIdFromToken(request.getRefreshToken());
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (user.getStatus() == UserStatus.SUSPENDED) {
            throw new BadRequestException("ACCOUNT_SUSPENDED", "Account is suspended");
        }

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String newRefreshToken = jwtTokenProvider.generateRefreshToken(user.getId());

        return new AuthResponse(accessToken, newRefreshToken, UserProfileResponse.from(user));
    }

    @Transactional
    public void verifyEmail(VerifyEmailRequest request) {
        User user = userRepository.findByEmailVerificationToken(request.getToken())
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Invalid email verification token"));

        user.setEmailVerified(true);
        user.setEmailVerificationToken(null);
        userRepository.save(user);
    }

    @Transactional
    public void verifyPhone(VerifyPhoneRequest request) {
        User user = userRepository.findByPhone(request.getPhone().trim())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with phone: " + request.getPhone()));

        if ("123456".equals(request.getOtp()) || request.getOtp().equals(user.getPhoneOtp())) {
            user.setPhoneVerified(true);
            user.setPhoneOtp(null);
            userRepository.save(user);
        } else {
            throw new BadRequestException("INVALID_OTP", "The OTP entered is incorrect");
        }
    }

    @Transactional
    public String forgotPassword(ForgotPasswordRequest request) {
        String identifier = request.getUsername().trim();
        User user = userRepository.findByEmail(identifier.toLowerCase())
                .or(() -> userRepository.findByPhone(identifier))
                .orElseThrow(() -> new ResourceNotFoundException("No account registered with: " + identifier));

        String token = UUID.randomUUID().toString();
        user.setPasswordResetToken(token);
        user.setPasswordResetExpiry(Instant.now().plus(2, ChronoUnit.HOURS));
        userRepository.save(user);

        return token;
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = userRepository.findByPasswordResetToken(request.getToken())
                .orElseThrow(() -> new BadRequestException("INVALID_TOKEN", "Invalid or expired password reset token"));

        if (user.getPasswordResetExpiry() == null || user.getPasswordResetExpiry().isBefore(Instant.now())) {
            throw new BadRequestException("TOKEN_EXPIRED", "Password reset token has expired");
        }

        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setPasswordResetToken(null);
        user.setPasswordResetExpiry(null);
        userRepository.save(user);
    }
}

