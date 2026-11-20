package com.staynest.rent.controller;

import com.staynest.common.response.PageResponse;
import com.staynest.expense.dto.CreateExpenseRequest;
import com.staynest.expense.dto.ExpenseResponse;
import com.staynest.income.dto.CreateIncomeRequest;
import com.staynest.income.dto.IncomeResponse;
import com.staynest.rent.dto.CreateRentInvoiceRequest;
import com.staynest.rent.dto.MonthlyReportResponse;
import com.staynest.rent.dto.OccupancyReportResponse;
import com.staynest.rent.dto.RecordRentPaymentRequest;
import com.staynest.rent.dto.RentInvoiceResponse;
import com.staynest.rent.service.TenantFinanceService;
import com.staynest.security.UserPrincipal;
import com.staynest.tenant.dto.CreateTenantRequest;
import com.staynest.tenant.dto.RecordStayRequest;
import com.staynest.tenant.dto.TenantResponse;
import com.staynest.tenant.dto.TransferTenantRequest;
import com.staynest.tenant.dto.UpdateTenantRequest;
import com.staynest.tenant.entity.TenantStay;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/owner")
@Tag(name = "Owner Tenants & Accounting", description = "Tenant roster, stays, rent invoicing, offline collections, income/expenses, and financial reports")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class OwnerTenantFinanceController {

    private final TenantFinanceService tenantFinanceService;

    public OwnerTenantFinanceController(TenantFinanceService tenantFinanceService) {
        this.tenantFinanceService = tenantFinanceService;
    }

    // --- Tenants ---

    @PostMapping("/tenants")
    @Operation(summary = "Create tenant profile record")
    public ResponseEntity<TenantResponse> createTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateTenantRequest request) {
        return new ResponseEntity<>(tenantFinanceService.createTenant(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/tenants")
    @Operation(summary = "Search and list tenants owned by current user")
    public ResponseEntity<PageResponse<TenantResponse>> listTenants(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(tenantFinanceService.listTenants(user.getId(), q, pageable));
    }

    @GetMapping("/tenants/{id}")
    @Operation(summary = "Read single tenant record in owner's scope")
    public ResponseEntity<TenantResponse> getTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(tenantFinanceService.getTenant(user.getId(), id));
    }

    @PatchMapping("/tenants/{id}")
    @Operation(summary = "Update permitted tenant profile fields")
    public ResponseEntity<TenantResponse> updateTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTenantRequest request) {
        return ResponseEntity.ok(tenantFinanceService.updateTenant(user.getId(), id, request));
    }

    @DeleteMapping("/tenants/{id}")
    @Operation(summary = "Delete tenant profile, delete stay/invoices, and release any assigned bed")
    public ResponseEntity<Void> deleteTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        tenantFinanceService.deleteTenant(user.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tenants/{id}/stays")
    @Operation(summary = "Record tenant stay in property room/bed")
    public ResponseEntity<TenantStay> recordStay(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody RecordStayRequest request) {
        return new ResponseEntity<>(tenantFinanceService.recordStay(user.getId(), id, request), HttpStatus.CREATED);
    }

    @GetMapping("/tenants/{id}/stays")
    @Operation(summary = "Get stay records for tenant")
    public ResponseEntity<java.util.List<TenantStay>> getTenantStays(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(tenantFinanceService.getTenantStays(user.getId(), id));
    }

    @PostMapping("/tenants/{id}/checkout")
    @Operation(summary = "Check out a tenant, free up their bed, and mark stay terminated")
    public ResponseEntity<TenantResponse> checkoutTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(tenantFinanceService.checkoutTenant(user.getId(), id));
    }

    @PostMapping("/tenants/{id}/transfer")
    @Operation(summary = "Transfer or shift tenant to another room and bed, and update monthly rent")
    public ResponseEntity<TenantResponse> transferTenant(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody TransferTenantRequest request) {
        return ResponseEntity.ok(tenantFinanceService.transferTenant(user.getId(), id, request));
    }

    @PostMapping("/tenants/{id}/payments")
    @Operation(summary = "Record rent collection directly for a tenant (Cash, UPI, Bank Transfer)")
    public ResponseEntity<RentInvoiceResponse> recordTenantDirectPayment(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody RecordRentPaymentRequest request) {
        return ResponseEntity.ok(tenantFinanceService.recordTenantDirectPayment(user.getId(), id, request));
    }

    // --- Rent Invoices & Collections ---

    @PostMapping("/rent-invoices")
    @Operation(summary = "Create monthly rent invoice for tenant")
    public ResponseEntity<RentInvoiceResponse> createRentInvoice(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateRentInvoiceRequest request) {
        return new ResponseEntity<>(tenantFinanceService.createRentInvoice(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/rent-invoices")
    @Operation(summary = "List rent invoices and payment status")
    public ResponseEntity<PageResponse<RentInvoiceResponse>> listRentInvoices(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(tenantFinanceService.listRentInvoices(user.getId(), status, pageable));
    }

    @PostMapping("/rent-invoices/{id}/payments")
    @Operation(summary = "Record rent collection (cash, UPI, bank transfer)")
    public ResponseEntity<RentInvoiceResponse> recordRentPayment(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody RecordRentPaymentRequest request) {
        return ResponseEntity.ok(tenantFinanceService.recordRentPayment(user.getId(), id, request));
    }

    // --- Income & Expenses ---

    @PostMapping("/income")
    @Operation(summary = "Record other income (food, laundry, etc.)")
    public ResponseEntity<IncomeResponse> createIncome(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateIncomeRequest request) {
        return new ResponseEntity<>(tenantFinanceService.recordIncome(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/income")
    @Operation(summary = "List recorded income entries")
    public ResponseEntity<PageResponse<IncomeResponse>> listIncome(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(tenantFinanceService.listIncome(user.getId(), pageable));
    }

    @PostMapping("/expenses")
    @Operation(summary = "Record property expense (electricity, maintenance, groceries, salaries)")
    public ResponseEntity<ExpenseResponse> createExpense(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateExpenseRequest request) {
        return new ResponseEntity<>(tenantFinanceService.recordExpense(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/expenses")
    @Operation(summary = "List recorded expense entries")
    public ResponseEntity<PageResponse<ExpenseResponse>> listExpenses(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(tenantFinanceService.listExpenses(user.getId(), pageable));
    }

    // --- Reports ---

    @GetMapping("/reports/monthly")
    @Operation(summary = "Monthly financial report: billed vs collected rent, expenses, and operating surplus")
    public ResponseEntity<MonthlyReportResponse> getMonthlyReport(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) String month) {
        return ResponseEntity.ok(tenantFinanceService.getMonthlyReport(user.getId(), month));
    }

    @GetMapping("/reports/occupancy")
    @Operation(summary = "Current occupancy report across all rooms and beds")
    public ResponseEntity<OccupancyReportResponse> getOccupancyReport(
            @AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(tenantFinanceService.getOccupancyReport(user.getId()));
    }

    @GetMapping("/reports/export")
    @Operation(summary = "Export financial report as CSV")
    public ResponseEntity<String> exportReport(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "csv") String format) {
        String csvData = tenantFinanceService.exportReportCsv(user.getId());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"staynest-report.csv\"")
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csvData);
    }
}

