package com.staynest.subscription.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "subscription_plans")
public class SubscriptionPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String planCode; // STARTER, GROWTH, BUSINESS

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Long priceMonthlyPaise = 0L;

    @Column(nullable = false)
    private int maxProperties = 1;

    @Column(nullable = false)
    private int maxRooms = 10;

    @Column(nullable = false)
    private int maxStaffSeats = 1;

    private boolean reportsAccess = true;
    private boolean exportAccess = false;
    private boolean active = true;

    public SubscriptionPlan() {
    }

    public SubscriptionPlan(String planCode, String name, Long priceMonthlyPaise, int maxProperties, int maxRooms, int maxStaffSeats, boolean exportAccess) {
        this.planCode = planCode;
        this.name = name;
        this.priceMonthlyPaise = priceMonthlyPaise;
        this.maxProperties = maxProperties;
        this.maxRooms = maxRooms;
        this.maxStaffSeats = maxStaffSeats;
        this.exportAccess = exportAccess;
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

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}

