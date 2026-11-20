package com.staynest.tenant.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class TransferTenantRequest {
    private UUID propertyId;
    private UUID roomId;

    @NotNull(message = "New bed ID is required")
    private UUID newBedId;

    private Long monthlyRentPaise;

    public TransferTenantRequest() {
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

    public UUID getNewBedId() {
        return newBedId;
    }

    public void setNewBedId(UUID newBedId) {
        this.newBedId = newBedId;
    }

    public Long getMonthlyRentPaise() {
        return monthlyRentPaise;
    }

    public void setMonthlyRentPaise(Long monthlyRentPaise) {
        this.monthlyRentPaise = monthlyRentPaise;
    }
}
