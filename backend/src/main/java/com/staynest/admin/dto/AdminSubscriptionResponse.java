package com.staynest.admin.dto;

import com.staynest.subscription.entity.OwnerSubscription;
import com.staynest.subscription.entity.SubscriptionPlan;

import java.time.LocalDate;
import java.util.UUID;

public class AdminSubscriptionResponse {
    private UUID id;
    private UUID ownerId;
    private UUID planId;
    private String planName;
    private String planCode;
    private Long priceMonthlyPaise;
    private String status;
    private LocalDate startDate;
    private LocalDate endDate;

    public AdminSubscriptionResponse() {
    }

    public static AdminSubscriptionResponse from(OwnerSubscription sub, SubscriptionPlan plan) {
        AdminSubscriptionResponse res = new AdminSubscriptionResponse();
        res.setId(sub.getId());
        res.setOwnerId(sub.getOwnerId());
        res.setPlanId(sub.getPlanId());
        if (plan != null) {
            res.setPlanName(plan.getName());
            res.setPlanCode(plan.getPlanCode());
            res.setPriceMonthlyPaise(plan.getPriceMonthlyPaise());
        }
        res.setStatus(sub.getStatus());
        res.setStartDate(sub.getStartDate());
        res.setEndDate(sub.getEndDate());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public UUID getPlanId() {
        return planId;
    }

    public void setPlanId(UUID planId) {
        this.planId = planId;
    }

    public String getPlanName() {
        return planName;
    }

    public void setPlanName(String planName) {
        this.planName = planName;
    }

    public String getPlanCode() {
        return planCode;
    }

    public void setPlanCode(String planCode) {
        this.planCode = planCode;
    }

    public Long getPriceMonthlyPaise() {
        return priceMonthlyPaise;
    }

    public void setPriceMonthlyPaise(Long priceMonthlyPaise) {
        this.priceMonthlyPaise = priceMonthlyPaise;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }
}

