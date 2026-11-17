package com.staynest.room.dto;

import com.staynest.room.entity.RoomStatus;
import com.staynest.room.entity.SharingType;

public class UpdateRoomRequest {
    private String roomNumber;
    private SharingType sharingType;
    private Integer capacity;
    private Integer floorNumber;
    private Long rentMonthlyPaise;
    private Long depositPaise;
    private RoomStatus status;

    public UpdateRoomRequest() {
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

    public RoomStatus getStatus() {
        return status;
    }

    public void setStatus(RoomStatus status) {
        this.status = status;
    }
}

