package com.staynest.booking.dto;

import com.staynest.booking.entity.Booking;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class BookingResponse {
    private UUID bookingId;
    private String bookingCode;
    private UUID customerId;
    private UUID propertyId;
    private UUID roomId;
    private UUID bedId;
    private String status;
    private String paymentStatus;
    private String paymentChoice;
    private String currency;
    private Long subtotalPaise;
    private Long depositPaise;
    private Long totalPaise;
    private Long amountDuePaise;
    private LocalDate checkIn;
    private LocalDate checkOut;
    private String cancellationPolicySnapshot;
    private Instant createdAt;

    public BookingResponse() {
    }

    public static BookingResponse from(Booking b) {
        BookingResponse res = new BookingResponse();
        res.setBookingId(b.getId());
        res.setBookingCode(b.getBookingCode());
        res.setCustomerId(b.getCustomerId());
        res.setPropertyId(b.getPropertyId());
        res.setRoomId(b.getRoomId());
        res.setBedId(b.getBedId());
        res.setStatus(b.getStatus().name());
        res.setPaymentStatus(b.getPaymentStatus().name());
        res.setPaymentChoice(b.getPaymentChoice());
        res.setCurrency(b.getCurrency());
        res.setSubtotalPaise(b.getSubtotalPaise());
        res.setDepositPaise(b.getDepositPaise());
        res.setTotalPaise(b.getTotalPaise());
        res.setAmountDuePaise(b.getAmountDuePaise());
        res.setCheckIn(b.getCheckIn());
        res.setCheckOut(b.getCheckOut());
        res.setCancellationPolicySnapshot(b.getCancellationPolicySnapshot());
        res.setCreatedAt(b.getCreatedAt());
        return res;
    }

    public UUID getBookingId() {
        return bookingId;
    }

    public void setBookingId(UUID bookingId) {
        this.bookingId = bookingId;
    }

    public String getBookingCode() {
        return bookingCode;
    }

    public void setBookingCode(String bookingCode) {
        this.bookingCode = bookingCode;
    }

    public UUID getCustomerId() {
        return customerId;
    }

    public void setCustomerId(UUID customerId) {
        this.customerId = customerId;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public UUID getRoomId() {
        return roomId;
    }

    public void setRoomId(UUID roomId) {
        this.roomId = roomId;
    }

    public UUID getBedId() {
        return bedId;
    }

    public void setBedId(UUID bedId) {
        this.bedId = bedId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getPaymentStatus() {
        return paymentStatus;
    }

    public void setPaymentStatus(String paymentStatus) {
        this.paymentStatus = paymentStatus;
    }

    public String getPaymentChoice() {
        return paymentChoice;
    }

    public void setPaymentChoice(String paymentChoice) {
        this.paymentChoice = paymentChoice;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public Long getSubtotalPaise() {
        return subtotalPaise;
    }

    public void setSubtotalPaise(Long subtotalPaise) {
        this.subtotalPaise = subtotalPaise;
    }

    public Long getDepositPaise() {
        return depositPaise;
    }

    public void setDepositPaise(Long depositPaise) {
        this.depositPaise = depositPaise;
    }

    public Long getTotalPaise() {
        return totalPaise;
    }

    public void setTotalPaise(Long totalPaise) {
        this.totalPaise = totalPaise;
    }

    public Long getAmountDuePaise() {
        return amountDuePaise;
    }

    public void setAmountDuePaise(Long amountDuePaise) {
        this.amountDuePaise = amountDuePaise;
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

    public String getCancellationPolicySnapshot() {
        return cancellationPolicySnapshot;
    }

    public void setCancellationPolicySnapshot(String cancellationPolicySnapshot) {
        this.cancellationPolicySnapshot = cancellationPolicySnapshot;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

