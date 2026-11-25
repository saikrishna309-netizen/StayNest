package com.staynest.owner.controller;

import com.staynest.expense.entity.ExpenseRecord;
import com.staynest.expense.repository.ExpenseRecordRepository;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.PropertyRepository;
import com.staynest.rent.entity.RentInvoice;
import com.staynest.rent.repository.RentInvoiceRepository;
import com.staynest.security.UserPrincipal;
import com.staynest.tenant.entity.TenantStay;
import com.staynest.tenant.repository.TenantStayRepository;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

@RestController
@RequestMapping("/api/v1/owner/activities")
@Tag(name = "Owner Activities", description = "Recent activity feed for PG & Rental Building owners")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class OwnerActivityController {

    private final PropertyRepository propertyRepository;
    private final ExpenseRecordRepository expenseRecordRepository;
    private final RentInvoiceRepository rentInvoiceRepository;
    private final TenantStayRepository tenantStayRepository;

    public OwnerActivityController(
            PropertyRepository propertyRepository,
            ExpenseRecordRepository expenseRecordRepository,
            RentInvoiceRepository rentInvoiceRepository,
            TenantStayRepository tenantStayRepository) {
        this.propertyRepository = propertyRepository;
        this.expenseRecordRepository = expenseRecordRepository;
        this.rentInvoiceRepository = rentInvoiceRepository;
        this.tenantStayRepository = tenantStayRepository;
    }

    @GetMapping
    @Operation(summary = "Get recent owner activities across properties or for a specific property")
    public ResponseEntity<List<Map<String, Object>>> getRecentActivities(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(required = false) UUID propertyId,
            @RequestParam(defaultValue = "5") int limit) {

        List<Property> ownedProps = propertyRepository.findByOwnerId(user.getId());
        List<UUID> targetPropIds = new ArrayList<>();
        for (Property p : ownedProps) {
            if (propertyId == null || p.getId().equals(propertyId)) {
                targetPropIds.add(p.getId());
            }
        }

        List<Map<String, Object>> events = new ArrayList<>();
        if (targetPropIds.isEmpty()) {
            return ResponseEntity.ok(events);
        }

        // 1. Recent Paid Rent Invoices
        List<RentInvoice> paidInvoices = rentInvoiceRepository
                .findByPropertyIdInAndStatus(targetPropIds, "PAID", PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent();
        for (RentInvoice inv : paidInvoices) {
            long rupees = (inv.getPaidAmountPaise() != null ? inv.getPaidAmountPaise()
                    : (inv.getTotalAmountPaise() != null ? inv.getTotalAmountPaise() : 0L)) / 100L;
            Instant ts = inv.getCreatedAt() != null ? inv.getCreatedAt() : Instant.now();
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "inv-" + inv.getId());
            item.put("propertyId", inv.getPropertyId() != null ? inv.getPropertyId().toString() : null);
            item.put("type", "RENT_PAID");
            item.put("title", "Rent Payment Received");
            item.put("subtitle", "Invoice " + (inv.getInvoiceNumber() != null ? inv.getInvoiceNumber() : inv.getBillingMonth()));
            item.put("amountRupees", rupees);
            item.put("timestamp", ts.toString());
            events.add(item);
        }

        // 2. Recent Expenses
        List<ExpenseRecord> expenses = expenseRecordRepository
                .findByOwnerId(user.getId(), PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt")))
                .getContent();
        for (ExpenseRecord exp : expenses) {
            if (propertyId != null && exp.getPropertyId() != null && !exp.getPropertyId().equals(propertyId)) {
                continue;
            }
            long rupees = (exp.getAmountPaise() != null ? exp.getAmountPaise() : 0L) / 100L;
            Instant ts = exp.getCreatedAt() != null ? exp.getCreatedAt()
                    : (exp.getTransactionDate() != null ? exp.getTransactionDate().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.now());
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", "exp-" + exp.getId());
            item.put("propertyId", exp.getPropertyId() != null ? exp.getPropertyId().toString() : null);
            item.put("type", "EXPENSE_LOGGED");
            item.put("title", exp.getNotes() != null && !exp.getNotes().isBlank() ? exp.getNotes() : exp.getCategory());
            item.put("subtitle", exp.getCategory() != null ? exp.getCategory() : "OPERATIONAL");
            item.put("amountRupees", rupees);
            item.put("timestamp", ts.toString());
            events.add(item);
        }

        // 3. Recent Tenant Check-Ins
        for (UUID propId : targetPropIds) {
            List<TenantStay> stays = tenantStayRepository.findByPropertyId(propId);
            for (TenantStay stay : stays) {
                Instant ts = stay.getCreatedAt() != null ? stay.getCreatedAt()
                        : (stay.getCheckIn() != null ? stay.getCheckIn().atStartOfDay().toInstant(ZoneOffset.UTC) : Instant.now());
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("id", "stay-" + stay.getId());
                item.put("propertyId", propId.toString());
                item.put("type", "TENANT_ADDED");
                item.put("title", "Resident Stay " + (stay.getStatus() != null ? stay.getStatus() : "ACTIVE"));
                item.put("subtitle", "Monthly rent ₹" + ((stay.getMonthlyRentPaise() != null ? stay.getMonthlyRentPaise() : 0L) / 100L));
                item.put("timestamp", ts.toString());
                events.add(item);
            }
        }

        events.sort((a, b) -> String.valueOf(b.get("timestamp")).compareTo(String.valueOf(a.get("timestamp"))));
        int max = Math.max(1, Math.min(limit, 20));
        return ResponseEntity.ok(events.size() > max ? events.subList(0, max) : events);
    }
}
