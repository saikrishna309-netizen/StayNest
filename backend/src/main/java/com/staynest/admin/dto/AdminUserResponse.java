package com.staynest.admin.dto;

import com.staynest.user.entity.User;

import java.time.Instant;
import java.util.UUID;

public class AdminUserResponse {
    private UUID id;
    private String fullName;
    private String email;
    private String phone;
    private String role;
    private String status;
    private boolean emailVerified;
    private boolean phoneVerified;
    private Instant createdAt;

    public AdminUserResponse() {
    }

    public static AdminUserResponse from(User user) {
        AdminUserResponse res = new AdminUserResponse();
        res.setId(user.getId());
        res.setFullName(user.getFullName());
        res.setEmail(user.getEmail());
        res.setPhone(user.getPhone());
        res.setRole(user.getRole().name());
        res.setStatus(user.getStatus().name());
        res.setEmailVerified(user.isEmailVerified());
        res.setPhoneVerified(user.isPhoneVerified());
        res.setCreatedAt(user.getCreatedAt());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isEmailVerified() {
        return emailVerified;
    }

    public void setEmailVerified(boolean emailVerified) {
        this.emailVerified = emailVerified;
    }

    public boolean isPhoneVerified() {
        return phoneVerified;
    }

    public void setPhoneVerified(boolean phoneVerified) {
        this.phoneVerified = phoneVerified;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

