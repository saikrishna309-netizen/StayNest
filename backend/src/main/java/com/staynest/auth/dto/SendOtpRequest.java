package com.staynest.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public class SendOtpRequest {

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^[0-9]{10}$", message = "Phone number must be a valid 10-digit mobile number")
    private String phone;

    private String role; // Optional: ROLE_OWNER (default) or ROLE_CUSTOMER

    private String otp; // Optional: client-synchronized OTP code

    public SendOtpRequest() {
    }

    public SendOtpRequest(String phone, String role) {
        this.phone = phone;
        this.role = role;
    }

    public SendOtpRequest(String phone, String role, String otp) {
        this.phone = phone;
        this.role = role;
        this.otp = otp;
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

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
