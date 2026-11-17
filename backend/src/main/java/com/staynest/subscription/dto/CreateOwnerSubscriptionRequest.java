package com.staynest.subscription.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class CreateOwnerSubscriptionRequest {

    @NotNull(message = "Plan ID is required")
    private UUID planId;

    private boolean autoRenew = true;

    public CreateOwnerSubscriptionRequest() {
    }

    public UUID getPlanId() {
        return planId;
    }

    public void setPlanId(UUID planId) {
        this.planId = planId;
    }

    public boolean isAutoRenew() {
        return autoRenew;
    }

    public void setAutoRenew(boolean autoRenew) {
        this.autoRenew = autoRenew;
    }
}

