package com.staynest.bed.dto;

import com.staynest.bed.entity.BedStatus;

public class UpdateBedRequest {
    private String bedLabel;
    private Boolean active;
    private BedStatus status;

    public UpdateBedRequest() {
    }

    public String getBedLabel() {
        return bedLabel;
    }

    public void setBedLabel(String bedLabel) {
        this.bedLabel = bedLabel;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public BedStatus getStatus() {
        return status;
    }

    public void setStatus(BedStatus status) {
        this.status = status;
    }
}

