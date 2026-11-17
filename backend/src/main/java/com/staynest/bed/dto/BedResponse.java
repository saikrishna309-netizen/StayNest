package com.staynest.bed.dto;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.entity.BedStatus;

import java.util.UUID;

public class BedResponse {
    private UUID id;
    private UUID roomId;
    private UUID propertyId;
    private String bedLabel;
    private boolean active;
    private BedStatus status;

    public BedResponse() {
    }

    public static BedResponse from(Bed bed) {
        BedResponse r = new BedResponse();
        r.setId(bed.getId());
        r.setRoomId(bed.getRoomId());
        r.setPropertyId(bed.getPropertyId());
        r.setBedLabel(bed.getBedLabel());
        r.setActive(bed.isActive());
        r.setStatus(bed.getStatus());
        return r;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getBedLabel() {
        return bedLabel;
    }

    public void setBedLabel(String bedLabel) {
        this.bedLabel = bedLabel;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public BedStatus getStatus() {
        return status;
    }

    public void setStatus(BedStatus status) {
        this.status = status;
    }
}

