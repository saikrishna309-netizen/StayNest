package com.staynest.user.controller;

import com.staynest.security.UserPrincipal;
import com.staynest.user.dto.UpdateUserRequest;
import com.staynest.user.dto.UserProfileResponse;
import com.staynest.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "Current authenticated user profile APIs")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/me")
    @Operation(summary = "Get current authenticated user profile")
    public ResponseEntity<UserProfileResponse> getCurrentProfile(@AuthenticationPrincipal UserPrincipal currentUser) {
        return ResponseEntity.ok(userService.getProfile(currentUser.getId()));
    }

    @PatchMapping("/me")
    @Operation(summary = "Update permitted profile fields")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal currentUser,
            @Valid @RequestBody UpdateUserRequest request) {
        return ResponseEntity.ok(userService.updateProfile(currentUser.getId(), request));
    }

    @DeleteMapping("/me")
    @Operation(summary = "Permanently delete/anonymize current user account and personal data")
    public ResponseEntity<java.util.Map<String, String>> deleteCurrentAccount(
            @AuthenticationPrincipal UserPrincipal currentUser) {
        userService.deleteAccount(currentUser.getId());
        return ResponseEntity.ok(java.util.Map.of("status", "deleted", "message", "Your StayNest account and personal data have been deleted."));
    }
}

