package com.staynest.payment.dto;

import com.staynest.payment.entity.Refund;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public class RefundRequest {
    @NotNull(message = "Refund amount in paise is required")
    private Long amountPaise;
    private String reason;

    public RefundRequest() {
    }

    public Long getAmountPaise() {
        return amountPaise;
    }

    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }
}

