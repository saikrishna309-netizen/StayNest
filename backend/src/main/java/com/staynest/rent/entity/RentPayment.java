package com.staynest.rent.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "rent_payments")
public class RentPayment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID invoiceId;

    @Column(nullable = false)
    private UUID tenantId;

    @Column(nullable = false)
    private Long amountPaidPaise = 0L;

    @Column(nullable = false)
    private LocalDate paymentDate = LocalDate.now();

    @Column(nullable = false)
    private String paymentMethod = "UPI"; // CASH, UPI, BANK_TRANSFER

    private String referenceNumber;
    private String notes;
    private UUID recordedBy;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    public RentPayment() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getInvoiceId() {
        return invoiceId;
    }

    public void setInvoiceId(UUID invoiceId) {
        this.invoiceId = invoiceId;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public Long getAmountPaidPaise() {
        return amountPaidPaise;
    }

    public void setAmountPaidPaise(Long amountPaidPaise) {
        this.amountPaidPaise = amountPaidPaise;
    }

    public LocalDate getPaymentDate() {
        return paymentDate;
    }

    public void setPaymentDate(LocalDate paymentDate) {
        this.paymentDate = paymentDate;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    public void setPaymentMethod(String paymentMethod) {
        this.paymentMethod = paymentMethod;
    }

    public String getReferenceNumber() {
        return referenceNumber;
    }

    public void setReferenceNumber(String referenceNumber) {
        this.referenceNumber = referenceNumber;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public UUID getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(UUID recordedBy) {
        this.recordedBy = recordedBy;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

