package com.staynest.tenant.dto;

import com.staynest.tenant.entity.Tenant;

import java.time.Instant;
import java.time.LocalDate;
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
    private boolean active = true;
    private Instant createdAt;

    // Stay & Allocation details
    private UUID propertyId;
    private String propertyName;
    private Integer floorNumber;
    private UUID roomId;
    private String roomNumber;
    private String sharingType;
    private UUID bedId;
    private String bedLabel;
    private Long monthlyRentPaise;
    private Long securityDepositPaise;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private String stayStatus; // "ACTIVE", "COMPLETED", "TERMINATED"

    // Rent & Invoice details
    private String rentStatus; // "PAID", "DUE", "OVERDUE", "PARTIALLY_PAID"
    private LocalDate rentDueDate;
    private Long outstandingPaise;

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

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getPropertyName() {
        return propertyName;
    }

    public void setPropertyName(String propertyName) {
        this.propertyName = propertyName;
    }

    public Integer getFloorNumber() {
        return floorNumber;
    }

    public void setFloorNumber(Integer floorNumber) {
        this.floorNumber = floorNumber;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public String getRoomNumber() {
        return roomNumber;
    }

    public void setRoomNumber(String roomNumber) {
        this.roomNumber = roomNumber;
    }

    public String getSharingType() {
        return sharingType;
    }

    public void setSharingType(String sharingType) {
        this.sharingType = sharingType;
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public String getBedLabel() {
        return bedLabel;
    }

    public void setBedLabel(String bedLabel) {
        this.bedLabel = bedLabel;
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

    public String getStayStatus() {
        return stayStatus;
    }

    public void setStayStatus(String stayStatus) {
        this.stayStatus = stayStatus;
    }

    public String getRentStatus() {
        return rentStatus;
    }

    public void setRentStatus(String rentStatus) {
        this.rentStatus = rentStatus;
    }

    public LocalDate getRentDueDate() {
        return rentDueDate;
    }

    public void setRentDueDate(LocalDate rentDueDate) {
        this.rentDueDate = rentDueDate;
    }

    public Long getOutstandingPaise() {
        return outstandingPaise;
    }

    public void setOutstandingPaise(Long outstandingPaise) {
        this.outstandingPaise = outstandingPaise;
    }
}
