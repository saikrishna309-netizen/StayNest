package com.staynest.payment.dto;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

public class CreateOrderRequest {

    @NotNull(message = "Booking ID is required")
    private UUID bookingId;

    public CreateOrderRequest() {
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public void setBookingId(UUID bookingId) {
        this.bookingId = bookingId;
    }
}

