package com.staynest.property.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class RateRuleRequest {
    private UUID roomId;
    @NotNull(message = "Monthly rent in paise is required")
    private Long monthlyRentPaise;
    private Long depositPaise;

    public RateRuleRequest() {
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public Long getMonthlyRentPaise() {
        return monthlyRentPaise;
    }

    public void setMonthlyRentPaise(Long monthlyRentPaise) {
        this.monthlyRentPaise = monthlyRentPaise;
    }

    public Long getDepositPaise() {
        return depositPaise;
    }

    public void setDepositPaise(Long depositPaise) {
        this.depositPaise = depositPaise;
    }
}

