package com.staynest.rent.dto;

import com.staynest.rent.entity.RentInvoice;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public class RentInvoiceResponse {
    private UUID id;
    private UUID tenantId;
    private UUID propertyId;
    private String invoiceNumber;
    private String billingMonth;
    private Long rentAmountPaise;
    private Long utilityAmountPaise;
    private Long otherChargesPaise;
    private Long totalAmountPaise;
    private Long paidAmountPaise;
    private LocalDate dueDate;
    private String status;
    private Instant createdAt;

    public RentInvoiceResponse() {
    }

    public static RentInvoiceResponse from(RentInvoice inv) {
        RentInvoiceResponse res = new RentInvoiceResponse();
        res.setId(inv.getId());
        res.setTenantId(inv.getTenantId());
        res.setPropertyId(inv.getPropertyId());
        res.setInvoiceNumber(inv.getInvoiceNumber());
        res.setBillingMonth(inv.getBillingMonth());
        res.setRentAmountPaise(inv.getRentAmountPaise());
        res.setUtilityAmountPaise(inv.getUtilityAmountPaise());
        res.setOtherChargesPaise(inv.getOtherChargesPaise());
        res.setTotalAmountPaise(inv.getTotalAmountPaise());
        res.setPaidAmountPaise(inv.getPaidAmountPaise());
        res.setDueDate(inv.getDueDate());
        res.setStatus(inv.getStatus());
        res.setCreatedAt(inv.getCreatedAt());
        return res;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getInvoiceNumber() {
        return invoiceNumber;
    }

    public void setInvoiceNumber(String invoiceNumber) {
        this.invoiceNumber = invoiceNumber;
    }

    public String getBillingMonth() {
        return billingMonth;
    }

    public void setBillingMonth(String billingMonth) {
        this.billingMonth = billingMonth;
    }

    public Long getRentAmountPaise() {
        return rentAmountPaise;
    }

    public void setRentAmountPaise(Long rentAmountPaise) {
        this.rentAmountPaise = rentAmountPaise;
    }

    public Long getUtilityAmountPaise() {
        return utilityAmountPaise;
    }

    public void setUtilityAmountPaise(Long utilityAmountPaise) {
        this.utilityAmountPaise = utilityAmountPaise;
    }

    public Long getOtherChargesPaise() {
        return otherChargesPaise;
    }

    public void setOtherChargesPaise(Long otherChargesPaise) {
        this.otherChargesPaise = otherChargesPaise;
    }

    public Long getTotalAmountPaise() {
        return totalAmountPaise;
    }

    public void setTotalAmountPaise(Long totalAmountPaise) {
        this.totalAmountPaise = totalAmountPaise;
    }

    public Long getPaidAmountPaise() {
        return paidAmountPaise;
    }

    public void setPaidAmountPaise(Long paidAmountPaise) {
        this.paidAmountPaise = paidAmountPaise;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

