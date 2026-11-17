package com.staynest.rent.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rent_invoices")
public class RentInvoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private UUID propertyId;

    @Column(nullable = false, unique = true)
    private String invoiceNumber;

    @Column(nullable = false)
    private String billingMonth; // e.g. "2026-11"

    @Column(nullable = false)
    private Long rentAmountPaise = 0L;

    private Long utilityAmountPaise = 0L;
    private Long otherChargesPaise = 0L;

    @Column(nullable = false)
    private Long totalAmountPaise = 0L;

    @Column(nullable = false)
    private Long paidAmountPaise = 0L;

    @Column(nullable = false)
    private LocalDate dueDate;

    @Column(nullable = false)
    private String status = "DUE"; // DUE, PAID, OVERDUE, PARTIALLY_PAID

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public RentInvoice() {
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

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getBillingMonth() {
        return billingMonth;
    }

    public void setBillingMonth(String billingMonth) {
        this.billingMonth = billingMonth;
    }

    public Long getRentAmountPaise() {
        return rentAmountPaise;
    }

    public void setRentAmountPaise(Long rentAmountPaise) {
        this.rentAmountPaise = rentAmountPaise;
    }

    public Long getUtilityAmountPaise() {
        return utilityAmountPaise;
    }

    public void setUtilityAmountPaise(Long utilityAmountPaise) {
        this.utilityAmountPaise = utilityAmountPaise;
    }

    public Long getOtherChargesPaise() {
        return otherChargesPaise;
    }

    public void setOtherChargesPaise(Long otherChargesPaise) {
        this.otherChargesPaise = otherChargesPaise;
    }

    public Long getTotalAmountPaise() {
        return totalAmountPaise;
    }

    public void setTotalAmountPaise(Long totalAmountPaise) {
        this.totalAmountPaise = totalAmountPaise;
    }

    public Long getPaidAmountPaise() {
        return paidAmountPaise;
    }

    public void setPaidAmountPaise(Long paidAmountPaise) {
        this.paidAmountPaise = paidAmountPaise;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
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

