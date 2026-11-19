package com.staynest.tenant.dto;

import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public class RecordStayRequest {

    @NotNull(message = "Property ID is required")
    private UUID propertyId;

    private UUID roomId;

    @NotNull(message = "Bed ID is required")
    private UUID bedId;

    @NotNull(message = "Check-in date is required")
    private LocalDate checkIn;

    private LocalDate checkOut;

    @NotNull(message = "Monthly rent in paise is required")
    private Long monthlyRentPaise;

    private Long securityDepositPaise = 0L;

    public RecordStayRequest() {
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
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

    public Long getMonthlyRentPaise() {
        return monthlyRentPaise;
    }

    public void setMonthlyRentPaise(Long monthlyRentPaise) {
        this.monthlyRentPaise = monthlyRentPaise;
    }

    public Long getSecurityDepositPaise() {
        return securityDepositPaise;
    }

    public void setSecurityDepositPaise(Long securityDepositPaise) {
        this.securityDepositPaise = securityDepositPaise;
    }
}

