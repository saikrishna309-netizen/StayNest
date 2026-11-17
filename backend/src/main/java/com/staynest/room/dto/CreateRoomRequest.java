package com.staynest.room.dto;

import com.staynest.room.entity.SharingType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CreateRoomRequest {

    @NotBlank(message = "Room number or label is required")
    private String roomNumber;

    @NotNull(message = "Sharing type is required")
    private SharingType sharingType = SharingType.DOUBLE;

    @NotNull(message = "Capacity is required")
    private Integer capacity = 2;

    private Integer floorNumber = 1;

    @NotNull(message = "Monthly rent in paise is required")
    private Long rentMonthlyPaise = 0L;

    private Long depositPaise = 0L;

    public CreateRoomRequest() {
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public SharingType getSharingType() {
        return sharingType;
    }

    public void setSharingType(SharingType sharingType) {
        this.sharingType = sharingType;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public Long getRentMonthlyPaise() {
        return rentMonthlyPaise;
    }

    public void setRentMonthlyPaise(Long rentMonthlyPaise) {
        this.rentMonthlyPaise = rentMonthlyPaise;
    }

    public Long getDepositPaise() {
        return depositPaise;
    }

    public void setDepositPaise(Long depositPaise) {
        this.depositPaise = depositPaise;
    }
}

