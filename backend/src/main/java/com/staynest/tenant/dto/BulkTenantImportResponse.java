package com.staynest.tenant.dto;

import java.util.List;

public class BulkTenantImportResponse {

    private int totalRows;
    private int importedCount;
    private int skippedCount;
    private List<TenantResponse> importedTenants;
    private List<RowError> errors;

    public static class RowError {
        private int rowNumber;
        private String identifier;
        private String reason;

        public RowError() {}

        public RowError(int rowNumber, String identifier, String reason) {
            this.rowNumber = rowNumber;
            this.identifier = identifier;
            this.reason = reason;
        }

        public int getRowNumber() { return rowNumber; }
        public void setRowNumber(int rowNumber) { this.rowNumber = rowNumber; }

        public String getIdentifier() { return identifier; }
        public void setIdentifier(String identifier) { this.identifier = identifier; }

        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }

    public int getImportedCount() { return importedCount; }
    public void setImportedCount(int importedCount) { this.importedCount = importedCount; }

    public int getSkippedCount() { return skippedCount; }
    public void setSkippedCount(int skippedCount) { this.skippedCount = skippedCount; }

    public List<TenantResponse> getImportedTenants() { return importedTenants; }
    public void setImportedTenants(List<TenantResponse> importedTenants) { this.importedTenants = importedTenants; }

    public List<RowError> getErrors() { return errors; }
    public void setErrors(List<RowError> errors) { this.errors = errors; }
}
