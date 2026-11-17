package com.staynest.payment.dto;

import com.staynest.payment.entity.Refund;
import com.staynest.payment.entity.RefundStatus;

import java.time.Instant;
import java.util.UUID;

public class RefundResponse {
    private UUID id;
    private UUID paymentId;
    private UUID bookingId;
    private Long amountPaise;
    private String reason;
    private RefundStatus status;
    private String providerRefundId;
    private Instant createdAt;

    public RefundResponse() {
    }

    public static RefundResponse from(Refund r) {
        RefundResponse res = new RefundResponse();
        res.setId(r.getId());
        res.setPaymentId(r.getPaymentId());
        res.setBookingId(r.getBookingId());
        res.setAmountPaise(r.getAmountPaise());
        res.setReason(r.getReason());
        res.setStatus(r.getStatus());
        res.setProviderRefundId(r.getProviderRefundId());
        res.setCreatedAt(r.getCreatedAt());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public Long getAmountPaise() {
        return amountPaise;
    }

    public void setAmountPaise(Long amountPaise) {
        this.amountPaise = amountPaise;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public RefundStatus getStatus() {
        return status;
    }

    public void setStatus(RefundStatus status) {
        this.status = status;
    }

    public String getProviderRefundId() {
        return providerRefundId;
    }

    public void setProviderRefundId(String providerRefundId) {
        this.providerRefundId = providerRefundId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

