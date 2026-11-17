package com.staynest.rent.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;
import java.util.UUID;

public class CreateRentInvoiceRequest {

    @NotNull(message = "Tenant ID is required")
    private UUID tenantId;

    @NotNull(message = "Property ID is required")
    private UUID propertyId;

    @NotBlank(message = "Billing month is required (YYYY-MM)")
    private String billingMonth;

    @NotNull(message = "Rent amount in paise is required")
    private Long rentAmountPaise;

    private Long utilityAmountPaise = 0L;
    private Long otherChargesPaise = 0L;

    @NotNull(message = "Due date is required")
    private LocalDate dueDate;

    public CreateRentInvoiceRequest() {
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

    public LocalDate getDueDate() {
        return dueDate;
    }

    public void setDueDate(LocalDate dueDate) {
        this.dueDate = dueDate;
    }
}

