package com.staynest.booking.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.UUID;

public class CreateBookingRequest {

    @NotNull(message = "Bed ID is required")
    private UUID bedId;

    @NotNull(message = "Check-in date is required")
    @FutureOrPresent(message = "Check-in date must be today or in the future")
    private LocalDate checkIn;

    @NotNull(message = "Check-out date is required")
    private LocalDate checkOut;

    @NotBlank(message = "Payment choice is required (ONLINE or PAY_AT_PROPERTY)")
    private String paymentChoice = "ONLINE";

    public CreateBookingRequest() {
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

    public String getPaymentChoice() {
        return paymentChoice;
    }

    public void setPaymentChoice(String paymentChoice) {
        this.paymentChoice = paymentChoice;
    }
}

