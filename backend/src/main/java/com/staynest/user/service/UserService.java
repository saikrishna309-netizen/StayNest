package com.staynest.user.service;

import com.staynest.common.exception.ConflictException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.user.dto.UpdateUserRequest;
import com.staynest.user.dto.UserProfileResponse;
import com.staynest.user.entity.User;
import com.staynest.user.entity.UserStatus;
import com.staynest.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UserProfileResponse getProfile(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        return UserProfileResponse.from(user);
    }

    @Transactional
    public UserProfileResponse updateProfile(UUID userId, UpdateUserRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));

        if (request.getFullName() != null && !request.getFullName().isBlank()) {
            user.setFullName(request.getFullName().trim());
        }

        if (request.getEmail() != null && !request.getEmail().isBlank() && !request.getEmail().equalsIgnoreCase(user.getEmail())) {
            String newEmail = request.getEmail().trim().toLowerCase();
            if (userRepository.existsByEmail(newEmail)) {
                throw new ConflictException("EMAIL_ALREADY_EXISTS", "Email address is already in use by another account");
            }
            user.setEmail(newEmail);
        }

        if (request.getPhone() != null && !request.getPhone().isBlank() && !request.getPhone().equals(user.getPhone())) {
            if (userRepository.existsByPhone(request.getPhone().trim())) {
                throw new ConflictException("PHONE_ALREADY_EXISTS", "Phone number is already registered with another account");
            }
            user.setPhone(request.getPhone().trim());
            user.setPhoneVerified(false);
        }

        if (request.getIsProfileComplete() != null) {
            user.setProfileComplete(request.getIsProfileComplete());
        } else if (user.getFullName() != null && !user.getFullName().isBlank() && !"PG Owner".equals(user.getFullName())) {
            user.setProfileComplete(true);
        }

        user = userRepository.save(user);
        return UserProfileResponse.from(user);
    }

    @Transactional
    public void deleteAccount(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User", userId));
        String shortId = userId.toString().replace("-", "").substring(0, 12);
        user.setFullName("Deleted User");
        user.setEmail("deleted_" + shortId + "@deleted.staynest.in");
        user.setPhone("del_" + shortId);
        user.setPhoneOtp(null);
        user.setEmailVerificationToken(null);
        user.setPasswordResetToken(null);
        user.setPhoneVerified(false);
        user.setEmailVerified(false);
        user.setProfileComplete(false);
        user.setStatus(UserStatus.SUSPENDED);
        userRepository.save(user);
    }
}

