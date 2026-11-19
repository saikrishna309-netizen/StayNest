package com.staynest.expense.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public class CreateExpenseRequest {

    private UUID propertyId;

    @NotBlank(message = "Category is required")
    private String category;

    @NotNull(message = "Amount in paise is required")
    private Long amountPaise;

    private LocalDate transactionDate;
    private String title;
    private String notes;
    private String attachmentKey;

    public CreateExpenseRequest() {
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
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
}

