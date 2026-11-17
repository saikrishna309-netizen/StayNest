package com.staynest.property.dto;

import java.time.LocalDate;
import java.util.UUID;

public class BedAvailabilityResponse {
    private UUID bedId;
    private String bedLabel;
    private UUID roomId;
    private String roomNumber;
    private String sharingType;
    private Long rentMonthlyPaise;
    private boolean available;
    private LocalDate checkIn;
    private LocalDate checkOut;

    public BedAvailabilityResponse() {
    }

    public BedAvailabilityResponse(UUID bedId, String bedLabel, UUID roomId, String roomNumber, String sharingType, Long rentMonthlyPaise, boolean available, LocalDate checkIn, LocalDate checkOut) {
        this.bedId = bedId;
        this.bedLabel = bedLabel;
        this.roomId = roomId;
        this.roomNumber = roomNumber;
        this.sharingType = sharingType;
        this.rentMonthlyPaise = rentMonthlyPaise;
        this.available = available;
        this.checkIn = checkIn;
        this.checkOut = checkOut;
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public String getBedLabel() {
        return bedLabel;
    }

    public void setBedLabel(String bedLabel) {
        this.bedLabel = bedLabel;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getSharingType() {
        return sharingType;
    }

    public void setSharingType(String sharingType) {
        this.sharingType = sharingType;
    }

    public Long getRentMonthlyPaise() {
        return rentMonthlyPaise;
    }

    public void setRentMonthlyPaise(Long rentMonthlyPaise) {
        this.rentMonthlyPaise = rentMonthlyPaise;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
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
}

