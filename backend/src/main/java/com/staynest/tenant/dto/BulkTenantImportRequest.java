package com.staynest.tenant.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public class BulkTenantImportRequest {

    @NotNull(message = "Property ID is required")
    private UUID propertyId;

    @NotEmpty(message = "At least one tenant row is required")
    @Valid
    private List<Row> rows;

    public static class Row {
        private Integer rowNumber;
        private String fullName;
        private String phone;
        private String email;
        private String idProofType;
        private String idProofNumber;
        private String roomNumber;
        private String bedLabel;
        private Long monthlyRentPaise;
        private Long securityDepositPaise;
        private LocalDate checkIn;
        private Long rentPaidNowPaise;
        private String paymentMethod;

        public Integer getRowNumber() { return rowNumber; }
        public void setRowNumber(Integer rowNumber) { this.rowNumber = rowNumber; }

        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }

        public String getPhone() { return phone; }
        public void setPhone(String phone) { this.phone = phone; }

        public String getEmail() { return email; }
        public void setEmail(String email) { this.email = email; }

        public String getIdProofType() { return idProofType; }
        public void setIdProofType(String idProofType) { this.idProofType = idProofType; }

        public String getIdProofNumber() { return idProofNumber; }
        public void setIdProofNumber(String idProofNumber) { this.idProofNumber = idProofNumber; }

        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }

        public String getBedLabel() { return bedLabel; }
        public void setBedLabel(String bedLabel) { this.bedLabel = bedLabel; }

        public Long getMonthlyRentPaise() { return monthlyRentPaise; }
        public void setMonthlyRentPaise(Long monthlyRentPaise) { this.monthlyRentPaise = monthlyRentPaise; }

        public Long getSecurityDepositPaise() { return securityDepositPaise; }
        public void setSecurityDepositPaise(Long securityDepositPaise) { this.securityDepositPaise = securityDepositPaise; }

        public LocalDate getCheckIn() { return checkIn; }
        public void setCheckIn(LocalDate checkIn) { this.checkIn = checkIn; }

        public Long getRentPaidNowPaise() { return rentPaidNowPaise; }
        public void setRentPaidNowPaise(Long rentPaidNowPaise) { this.rentPaidNowPaise = rentPaidNowPaise; }

        public String getPaymentMethod() { return paymentMethod; }
        public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    }

    public UUID getPropertyId() { return propertyId; }
    public void setPropertyId(UUID propertyId) { this.propertyId = propertyId; }

    public List<Row> getRows() { return rows; }
    public void setRows(List<Row> rows) { this.rows = rows; }
}
