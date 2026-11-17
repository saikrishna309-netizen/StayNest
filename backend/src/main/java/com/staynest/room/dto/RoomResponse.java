package com.staynest.room.dto;

import com.staynest.bed.dto.BedResponse;
import com.staynest.room.entity.Room;
import com.staynest.room.entity.RoomStatus;
import com.staynest.room.entity.SharingType;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class RoomResponse {
    private UUID id;
    private UUID propertyId;
    private String roomNumber;
    private SharingType sharingType;
    private int capacity;
    private int floorNumber;
    private Long rentMonthlyPaise;
    private Long depositPaise;
    private RoomStatus status;
    private List<BedResponse> beds = new ArrayList<>();

    public RoomResponse() {
    }

    public static RoomResponse from(Room room, List<BedResponse> beds) {
        RoomResponse r = new RoomResponse();
        r.setId(room.getId());
        r.setPropertyId(room.getPropertyId());
        r.setRoomNumber(room.getRoomNumber());
        r.setSharingType(room.getSharingType());
        r.setCapacity(room.getCapacity());
        r.setFloorNumber(room.getFloorNumber());
        r.setRentMonthlyPaise(room.getRentMonthlyPaise());
        r.setDepositPaise(room.getDepositPaise());
        r.setStatus(room.getStatus());
        r.setBeds(beds != null ? beds : new ArrayList<>());
        return r;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
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

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = capacity;
    }

    public int getFloorNumber() {
        return floorNumber;
    }

    public void setFloorNumber(int floorNumber) {
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

    public List<BedResponse> getBeds() {
        return beds;
    }

    public void setBeds(List<BedResponse> beds) {
        this.beds = beds;
    }
}

