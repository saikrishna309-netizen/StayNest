package com.staynest.payment.dto;

import java.util.UUID;

public class OrderResponse {
    private UUID paymentId;
    private UUID bookingId;
    private String orderId;
    private Long amountPaise;
    private String currency;
    private String keyId;

    public OrderResponse() {
    }

    public OrderResponse(UUID paymentId, UUID bookingId, String orderId, Long amountPaise, String currency, String keyId) {
        this.paymentId = paymentId;
        this.bookingId = bookingId;
        this.orderId = orderId;
        this.amountPaise = amountPaise;
        this.currency = currency;
        this.keyId = keyId;
    }

    public UUID getPaymentId() {
        return paymentId;
    }

    public void setPaymentId(UUID paymentId) {
        this.paymentId = paymentId;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public void setBookingId(UUID bookingId) {
        this.bookingId = bookingId;
    }

    public String getOrderId() {
        return orderId;
    }

    public void setOrderId(String orderId) {
        this.orderId = orderId;
    }

    public Long getAmountPaise() {
        return amountPaise;
    }

    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getKeyId() {
        return keyId;
    }

    public void setKeyId(String keyId) {
        this.keyId = keyId;
    }
}

