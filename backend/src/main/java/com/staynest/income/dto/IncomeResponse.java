package com.staynest.income.dto;

import com.staynest.income.entity.IncomeRecord;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class IncomeResponse {
    private UUID id;
    private UUID ownerId;
    private UUID propertyId;
    private String category;
    private Long amountPaise;
    private LocalDate transactionDate;
    private String notes;
    private Instant createdAt;

    public IncomeResponse() {
    }

    public static IncomeResponse from(IncomeRecord rec) {
        IncomeResponse res = new IncomeResponse();
        res.setId(rec.getId());
        res.setOwnerId(rec.getOwnerId());
        res.setPropertyId(rec.getPropertyId());
        res.setCategory(rec.getCategory());
        res.setAmountPaise(rec.getAmountPaise());
        res.setTransactionDate(rec.getTransactionDate());
        res.setNotes(rec.getNotes());
        res.setCreatedAt(rec.getCreatedAt());
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

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Long getAmountPaise() {
        return amountPaise;
    }

    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

