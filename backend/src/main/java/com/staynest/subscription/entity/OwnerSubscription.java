package com.staynest.subscription.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "owner_subscriptions")
public class OwnerSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private UUID planId;

    @Column(nullable = false)
    private String status = "ACTIVE"; // ACTIVE, EXPIRED, CANCELLED, PAST_DUE

    @Column(nullable = false)
    private LocalDate startDate = LocalDate.now();

    @Column(nullable = false)
    private LocalDate endDate;

    private boolean autoRenew = true;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public OwnerSubscription() {
    }

    public OwnerSubscription(UUID ownerId, UUID planId, LocalDate startDate, LocalDate endDate) {
        this.ownerId = ownerId;
        this.planId = planId;
        this.startDate = startDate;
        this.endDate = endDate;
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

    public boolean isAutoRenew() {
        return autoRenew;
    }

    public void setAutoRenew(boolean autoRenew) {
        this.autoRenew = autoRenew;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

