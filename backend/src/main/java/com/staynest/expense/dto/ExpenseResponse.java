package com.staynest.expense.dto;

import com.staynest.expense.entity.ExpenseRecord;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class ExpenseResponse {
    private UUID id;
    private UUID ownerId;
    private UUID propertyId;
    private String category;
    private Long amountPaise;
    private LocalDate transactionDate;
    private String notes;
    private String title;
    private String attachmentKey;
    private Instant createdAt;

    public ExpenseResponse() {
    }

    public static ExpenseResponse from(ExpenseRecord e) {
        ExpenseResponse res = new ExpenseResponse();
        res.setId(e.getId());
        res.setOwnerId(e.getOwnerId());
        res.setPropertyId(e.getPropertyId());
        res.setCategory(e.getCategory());
        res.setAmountPaise(e.getAmountPaise());
        res.setTransactionDate(e.getTransactionDate());
        res.setNotes(e.getNotes());
        res.setTitle(e.getNotes());
        res.setAttachmentKey(e.getAttachmentKey());
        res.setCreatedAt(e.getCreatedAt());
        return res;
    }

    public String getTitle() {
        return title != null ? title : notes;
    }

    public void setTitle(String title) {
        this.title = title;
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

    public String getAttachmentKey() {
        return attachmentKey;
    }

    public void setAttachmentKey(String attachmentKey) {
        this.attachmentKey = attachmentKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

