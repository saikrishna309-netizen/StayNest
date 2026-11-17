package com.staynest.property.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class UpdateAvailabilityRequest {
    @NotNull(message = "Bed ID is required")
    private UUID bedId;
    @NotNull(message = "Active status is required")
    private Boolean active;

    public UpdateAvailabilityRequest() {
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }
}

