package com.staynest.tenant.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "tenant_stays")
public class TenantStay {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID propertyId;

    @Column(nullable = false)
    private UUID roomId;

    @Column(nullable = false)
    private UUID bedId;

    @Column(nullable = false)
    private LocalDate checkIn;

    private LocalDate checkOut;

    @Column(nullable = false)
    private Long monthlyRentPaise = 0L;

    private Long securityDepositPaise = 0L;

    @Column(nullable = false)
    private String status = "ACTIVE"; // ACTIVE, COMPLETED, TERMINATED

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public TenantStay() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public LocalDate getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(LocalDate checkIn) {
        this.checkIn = checkIn;
    }

    public LocalDate getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(LocalDate checkOut) {
        this.checkOut = checkOut;
    }

    public Long getMonthlyRentPaise() {
        return monthlyRentPaise;
    }

    public void setMonthlyRentPaise(Long monthlyRentPaise) {
        this.monthlyRentPaise = monthlyRentPaise;
    }

    public Long getSecurityDepositPaise() {
        return securityDepositPaise;
    }

    public void setSecurityDepositPaise(Long securityDepositPaise) {
        this.securityDepositPaise = securityDepositPaise;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

