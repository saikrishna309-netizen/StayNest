package com.staynest.booking.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class HoldResponse {
    private UUID holdId;
    private UUID bedId;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private Instant expiresAt;
    private String status;

    public HoldResponse() {
    }

    public HoldResponse(UUID holdId, UUID bedId, LocalDate checkIn, LocalDate checkOut, Instant expiresAt, String status) {
        this.holdId = holdId;
        this.bedId = bedId;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
        this.expiresAt = expiresAt;
        this.status = status;
    }

    public UUID getHoldId() {
        return holdId;
    }

    public void setHoldId(UUID holdId) {
        this.holdId = holdId;
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public LocalDate getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(LocalDate checkIn) {
        this.checkIn = checkIn;
    }

    public LocalDate getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(LocalDate checkOut) {
        this.checkOut = checkOut;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }
}

