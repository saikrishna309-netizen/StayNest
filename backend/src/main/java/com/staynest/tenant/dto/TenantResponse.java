package com.staynest.tenant.dto;

import com.staynest.tenant.entity.Tenant;

import java.time.Instant;
import java.util.UUID;

public class TenantResponse {
    private UUID id;
    private UUID ownerId;
    private String fullName;
    private String phone;
    private String email;
    private String emergencyContact;
    private String idProofType;
    private String idProofNumber;
    private boolean active;
    private Instant createdAt;

    public TenantResponse() {
    }

    public static TenantResponse from(Tenant t) {
        TenantResponse res = new TenantResponse();
        res.setId(t.getId());
        res.setOwnerId(t.getOwnerId());
        res.setFullName(t.getFullName());
        res.setPhone(t.getPhone());
        res.setEmail(t.getEmail());
        res.setEmergencyContact(t.getEmergencyContact());
        res.setIdProofType(t.getIdProofType());
        res.setIdProofNumber(t.getIdProofNumber());
        res.setActive(t.isActive());
        res.setCreatedAt(t.getCreatedAt());
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

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getEmergencyContact() {
        return emergencyContact;
    }

    public void setEmergencyContact(String emergencyContact) {
        this.emergencyContact = emergencyContact;
    }

    public String getIdProofType() {
        return idProofType;
    }

    public void setIdProofType(String idProofType) {
        this.idProofType = idProofType;
    }

    public String getIdProofNumber() {
        return idProofNumber;
    }

    public void setIdProofNumber(String idProofNumber) {
        this.idProofNumber = idProofNumber;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

