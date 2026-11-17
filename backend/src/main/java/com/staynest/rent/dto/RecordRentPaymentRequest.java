package com.staynest.rent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public class RecordRentPaymentRequest {

    @NotNull(message = "Amount paid in paise is required")
    private Long amountPaidPaise;

    private LocalDate paymentDate;

    @NotBlank(message = "Payment method is required (CASH, UPI, BANK_TRANSFER)")
    private String paymentMethod = "UPI";

    private String referenceNumber;
    private String notes;

    public RecordRentPaymentRequest() {
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
}

