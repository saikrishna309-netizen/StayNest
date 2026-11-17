package com.staynest.subscription.dto;

import com.staynest.subscription.entity.SubscriptionPlan;

import java.util.UUID;

public class SubscriptionPlanResponse {
    private UUID id;
    private String planCode;
    private String name;
    private Long priceMonthlyPaise;
    private int maxProperties;
    private int maxRooms;
    private int maxStaffSeats;
    private boolean reportsAccess;
    private boolean exportAccess;

    public SubscriptionPlanResponse() {
    }

    public static SubscriptionPlanResponse from(SubscriptionPlan plan) {
        SubscriptionPlanResponse res = new SubscriptionPlanResponse();
        res.setId(plan.getId());
        res.setPlanCode(plan.getPlanCode());
        res.setName(plan.getName());
        res.setPriceMonthlyPaise(plan.getPriceMonthlyPaise());
        res.setMaxProperties(plan.getMaxProperties());
        res.setMaxRooms(plan.getMaxRooms());
        res.setMaxStaffSeats(plan.getMaxStaffSeats());
        res.setReportsAccess(plan.isReportsAccess());
        res.setExportAccess(plan.isExportAccess());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getPlanCode() {
        return planCode;
    }

    public void setPlanCode(String planCode) {
        this.planCode = planCode;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Long getPriceMonthlyPaise() {
        return priceMonthlyPaise;
    }

    public void setPriceMonthlyPaise(Long priceMonthlyPaise) {
        this.priceMonthlyPaise = priceMonthlyPaise;
    }

    public int getMaxProperties() {
        return maxProperties;
    }

    public void setMaxProperties(int maxProperties) {
        this.maxProperties = maxProperties;
    }

    public int getMaxRooms() {
        return maxRooms;
    }

    public void setMaxRooms(int maxRooms) {
        this.maxRooms = maxRooms;
    }

    public int getMaxStaffSeats() {
        return maxStaffSeats;
    }

    public void setMaxStaffSeats(int maxStaffSeats) {
        this.maxStaffSeats = maxStaffSeats;
    }

    public boolean isReportsAccess() {
        return reportsAccess;
    }

    public void setReportsAccess(boolean reportsAccess) {
        this.reportsAccess = reportsAccess;
    }

    public boolean isExportAccess() {
        return exportAccess;
    }

    public void setExportAccess(boolean exportAccess) {
        this.exportAccess = exportAccess;
    }
}

