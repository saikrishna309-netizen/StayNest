package com.staynest.payment.dto;

import com.staynest.payment.entity.Payment;
import com.staynest.payment.entity.PaymentMethod;
import com.staynest.payment.entity.PaymentState;

import java.time.Instant;
import java.util.UUID;

public class PaymentResponse {
    private UUID id;
    private UUID bookingId;
    private UUID customerId;
    private PaymentMethod method;
    private String provider;
    private String providerOrderId;
    private String providerPaymentId;
    private Long amountPaise;
    private PaymentState status;
    private Instant createdAt;

    public PaymentResponse() {
    }

    public static PaymentResponse from(Payment p) {
        PaymentResponse res = new PaymentResponse();
        res.setId(p.getId());
        res.setBookingId(p.getBookingId());
        res.setCustomerId(p.getCustomerId());
        res.setMethod(p.getMethod());
        res.setProvider(p.getProvider());
        res.setProviderOrderId(p.getProviderOrderId());
        res.setProviderPaymentId(p.getProviderPaymentId());
        res.setAmountPaise(p.getAmountPaise());
        res.setStatus(p.getStatus());
        res.setCreatedAt(p.getCreatedAt());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public void setBookingId(UUID bookingId) {
        this.bookingId = bookingId;
    }

    public UUID getCustomerId() {
        return customerId;
    }

    public void setCustomerId(UUID customerId) {
        this.customerId = customerId;
    }

    public PaymentMethod getMethod() {
        return method;
    }

    public void setMethod(PaymentMethod method) {
        this.method = method;
    }

    public String getProvider() {
        return provider;
    }

    public void setProvider(String provider) {
        this.provider = provider;
    }

    public String getProviderOrderId() {
        return providerOrderId;
    }

    public void setProviderOrderId(String providerOrderId) {
        this.providerOrderId = providerOrderId;
    }

    public String getProviderPaymentId() {
        return providerPaymentId;
    }

    public void setProviderPaymentId(String providerPaymentId) {
        this.providerPaymentId = providerPaymentId;
    }

    public Long getAmountPaise() {
        return amountPaise;
    }

    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
    }

    public PaymentState getStatus() {
        return status;
    }

    public void setStatus(PaymentState status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

