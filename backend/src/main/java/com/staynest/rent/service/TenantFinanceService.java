package com.staynest.rent.service;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.entity.BedStatus;
import com.staynest.bed.repository.BedRepository;
import com.staynest.common.exception.BadRequestException;
import com.staynest.common.exception.ForbiddenException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.response.PageResponse;
import com.staynest.expense.dto.CreateExpenseRequest;
import com.staynest.expense.dto.ExpenseResponse;
import com.staynest.expense.entity.ExpenseRecord;
import com.staynest.expense.repository.ExpenseRecordRepository;
import com.staynest.income.dto.CreateIncomeRequest;
import com.staynest.income.dto.IncomeResponse;
import com.staynest.income.entity.IncomeRecord;
import com.staynest.income.repository.IncomeRecordRepository;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.PropertyRepository;
import com.staynest.rent.dto.*;
import com.staynest.rent.entity.RentInvoice;
import com.staynest.rent.entity.RentPayment;
import com.staynest.rent.repository.RentInvoiceRepository;
import com.staynest.rent.repository.RentPaymentRepository;
import com.staynest.room.entity.Room;
import com.staynest.room.repository.RoomRepository;
import com.staynest.tenant.dto.CreateTenantRequest;
import com.staynest.tenant.dto.RecordStayRequest;
import com.staynest.tenant.dto.TenantResponse;
import com.staynest.tenant.dto.UpdateTenantRequest;
import com.staynest.tenant.entity.Tenant;
import com.staynest.tenant.entity.TenantStay;
import com.staynest.tenant.repository.TenantRepository;
import com.staynest.tenant.repository.TenantStayRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TenantFinanceService {

    private final TenantRepository tenantRepository;
    private final TenantStayRepository tenantStayRepository;
    private final RentInvoiceRepository rentInvoiceRepository;
    private final RentPaymentRepository rentPaymentRepository;
    private final IncomeRecordRepository incomeRecordRepository;
    private final ExpenseRecordRepository expenseRecordRepository;
    private final PropertyRepository propertyRepository;
    private final RoomRepository roomRepository;
    private final BedRepository bedRepository;

    public TenantFinanceService(TenantRepository tenantRepository,
                                TenantStayRepository tenantStayRepository,
                                RentInvoiceRepository rentInvoiceRepository,
                                RentPaymentRepository rentPaymentRepository,
                                IncomeRecordRepository incomeRecordRepository,
                                ExpenseRecordRepository expenseRecordRepository,
                                PropertyRepository propertyRepository,
                                RoomRepository roomRepository,
                                BedRepository bedRepository) {
        this.tenantRepository = tenantRepository;
        this.tenantStayRepository = tenantStayRepository;
        this.rentInvoiceRepository = rentInvoiceRepository;
        this.rentPaymentRepository = rentPaymentRepository;
        this.incomeRecordRepository = incomeRecordRepository;
        this.expenseRecordRepository = expenseRecordRepository;
        this.propertyRepository = propertyRepository;
        this.roomRepository = roomRepository;
        this.bedRepository = bedRepository;
    }

    // --- Tenant Operations ---

    public TenantResponse enrichTenantResponse(Tenant tenant) {
        TenantResponse res = TenantResponse.from(tenant);

        // Find stays for this tenant
        List<TenantStay> stays = tenantStayRepository.findByTenantId(tenant.getId());
        TenantStay activeStay = stays.stream()
                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()))
                .findFirst()
                .orElse(stays.isEmpty() ? null : stays.get(stays.size() - 1));

        if (activeStay != null) {
            res.setPropertyId(activeStay.getPropertyId());
            res.setRoomId(activeStay.getRoomId());
            res.setBedId(activeStay.getBedId());
            res.setMonthlyRentPaise(activeStay.getMonthlyRentPaise());
            res.setSecurityDepositPaise(activeStay.getSecurityDepositPaise());
            res.setCheckIn(activeStay.getCheckIn());
            res.setCheckOut(activeStay.getCheckOut());
            res.setStayStatus(activeStay.getStatus());

            if (activeStay.getPropertyId() != null) {
                propertyRepository.findById(activeStay.getPropertyId()).ifPresent(p -> res.setPropertyName(p.getName()));
            }

            if (activeStay.getRoomId() != null) {
                roomRepository.findById(activeStay.getRoomId()).ifPresent(r -> {
                    res.setRoomNumber(r.getRoomNumber());
                    res.setFloorNumber(r.getFloorNumber());
                    res.setSharingType(r.getSharingType() != null ? r.getSharingType().name() : null);
                });
            }

            if (activeStay.getBedId() != null) {
                bedRepository.findById(activeStay.getBedId()).ifPresent(b -> res.setBedLabel(b.getBedLabel()));
            }
        }

        // Rent payment status
        List<RentInvoice> invoices = rentInvoiceRepository.findByTenantId(tenant.getId());
        if (!invoices.isEmpty()) {
            RentInvoice latest = invoices.get(invoices.size() - 1);
            res.setRentStatus(latest.getStatus());
            res.setRentDueDate(latest.getDueDate());
            long outstanding = Math.max(0, latest.getTotalAmountPaise() - latest.getPaidAmountPaise());
            res.setOutstandingPaise(outstanding);
        } else {
            res.setRentStatus("PAID");
            res.setOutstandingPaise(0L);
        }

        return res;
    }

    @Transactional
    public TenantResponse createTenant(UUID ownerId, CreateTenantRequest request) {
        Tenant tenant = new Tenant(ownerId, request.getFullName().trim(), request.getPhone().trim(), request.getEmail());
        tenant.setEmergencyContact(request.getEmergencyContact());
        tenant.setIdProofType(request.getIdProofType());
        tenant.setIdProofNumber(request.getIdProofNumber());

        tenant = tenantRepository.save(tenant);
        return enrichTenantResponse(tenant);
    }

    @Transactional(readOnly = true)
    public PageResponse<TenantResponse> listTenants(UUID ownerId, String query, Pageable pageable) {
        Page<Tenant> page = (query != null && !query.isBlank())
                ? tenantRepository.searchTenants(ownerId, query.trim(), pageable)
                : tenantRepository.findByOwnerId(ownerId, pageable);

        List<TenantResponse> dtos = page.getContent().stream()
                .map(this::enrichTenantResponse)
                .collect(Collectors.toList());

        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public TenantResponse getTenant(UUID ownerId, UUID tenantId) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
        return enrichTenantResponse(tenant);
    }

    @Transactional
    public TenantResponse updateTenant(UUID ownerId, UUID tenantId, UpdateTenantRequest request) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        if (request.getFullName() != null) tenant.setFullName(request.getFullName().trim());
        if (request.getPhone() != null) tenant.setPhone(request.getPhone().trim());
        if (request.getEmail() != null) tenant.setEmail(request.getEmail().trim());
        if (request.getEmergencyContact() != null) tenant.setEmergencyContact(request.getEmergencyContact());
        if (request.getIdProofType() != null) tenant.setIdProofType(request.getIdProofType());
        if (request.getIdProofNumber() != null) tenant.setIdProofNumber(request.getIdProofNumber());
        if (request.getActive() != null) tenant.setActive(request.getActive());

        tenant = tenantRepository.save(tenant);
        return enrichTenantResponse(tenant);
    }

    @Transactional
    public TenantResponse checkoutTenant(UUID ownerId, UUID tenantId) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        List<TenantStay> stays = tenantStayRepository.findByTenantId(tenant.getId());
        for (TenantStay stay : stays) {
            if ("ACTIVE".equalsIgnoreCase(stay.getStatus())) {
                stay.setStatus("TERMINATED");
                stay.setCheckOut(LocalDate.now());
                tenantStayRepository.save(stay);

                if (stay.getBedId() != null) {
                    bedRepository.findById(stay.getBedId()).ifPresent(bed -> {
                        bed.setStatus(BedStatus.AVAILABLE);
                        bedRepository.save(bed);
                    });
                }
            }
        }

        tenant.setActive(false);
        tenantRepository.save(tenant);

        return enrichTenantResponse(tenant);
    }

    @Transactional
    public TenantStay recordStay(UUID ownerId, UUID tenantId, RecordStayRequest request) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", request.getPropertyId()));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this property");
        }

        Bed bed = bedRepository.findById(request.getBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", request.getBedId()));

        // Enforce 1 Person = 1 Bed: verify bed is not already occupied
        List<TenantStay> activeStays = tenantStayRepository.findByPropertyIdAndStatus(property.getId(), "ACTIVE");
        boolean bedOccupiedByStay = activeStays.stream().anyMatch(s -> bed.getId().equals(s.getBedId()));
        if (bedOccupiedByStay || bed.getStatus() == BedStatus.OCCUPIED) {
            throw new BadRequestException("Bed " + bed.getBedLabel() + " is already occupied. Only one person per bed is allowed.");
        }

        UUID effectiveRoomId = request.getRoomId() != null ? request.getRoomId() : bed.getRoomId();

        TenantStay stay = new TenantStay();
        stay.setTenantId(tenant.getId());
        stay.setPropertyId(property.getId());
        stay.setRoomId(effectiveRoomId);
        stay.setBedId(bed.getId());
        stay.setCheckIn(request.getCheckIn());
        stay.setCheckOut(request.getCheckOut());
        stay.setMonthlyRentPaise(request.getMonthlyRentPaise());
        stay.setSecurityDepositPaise(request.getSecurityDepositPaise());
        stay.setStatus("ACTIVE");

        bed.setStatus(BedStatus.OCCUPIED);
        bedRepository.save(bed);

        return tenantStayRepository.save(stay);
    }

    @Transactional(readOnly = true)
    public List<TenantStay> getTenantStays(UUID ownerId, UUID tenantId) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));
        return tenantStayRepository.findByTenantId(tenant.getId());
    }

    // --- Rent Invoices & Collections ---

    @Transactional
    public RentInvoiceResponse createRentInvoice(UUID ownerId, CreateRentInvoiceRequest request) {
        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", request.getPropertyId()));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this property");
        }

        Tenant tenant = tenantRepository.findByIdAndOwnerId(request.getTenantId(), ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", request.getTenantId()));

        RentInvoice invoice = new RentInvoice();
        invoice.setTenantId(tenant.getId());
        invoice.setPropertyId(property.getId());
        invoice.setInvoiceNumber("INV-" + request.getBillingMonth() + "-" + (1000 + new Random().nextInt(9000)));
        invoice.setBillingMonth(request.getBillingMonth());
        invoice.setRentAmountPaise(request.getRentAmountPaise());
        invoice.setUtilityAmountPaise(request.getUtilityAmountPaise() != null ? request.getUtilityAmountPaise() : 0L);
        invoice.setOtherChargesPaise(request.getOtherChargesPaise() != null ? request.getOtherChargesPaise() : 0L);
        long total = invoice.getRentAmountPaise() + invoice.getUtilityAmountPaise() + invoice.getOtherChargesPaise();
        invoice.setTotalAmountPaise(total);
        invoice.setPaidAmountPaise(0L);
        invoice.setDueDate(request.getDueDate());
        invoice.setStatus("DUE");

        invoice = rentInvoiceRepository.save(invoice);
        return RentInvoiceResponse.from(invoice);
    }

    @Transactional(readOnly = true)
    public PageResponse<RentInvoiceResponse> listRentInvoices(UUID ownerId, String status, Pageable pageable) {
        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        List<UUID> propertyIds = properties.stream().map(Property::getId).collect(Collectors.toList());

        if (propertyIds.isEmpty()) {
            return new PageResponse<>(List.of(), 0, pageable.getPageSize(), 0, 0, true);
        }

        Page<RentInvoice> page = (status != null && !status.isBlank())
                ? rentInvoiceRepository.findByPropertyIdInAndStatus(propertyIds, status.toUpperCase(), pageable)
                : rentInvoiceRepository.findByPropertyIdIn(propertyIds, pageable);

        List<RentInvoiceResponse> dtos = page.getContent().stream()
                .map(RentInvoiceResponse::from)
                .collect(Collectors.toList());

        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional
    public RentInvoiceResponse recordRentPayment(UUID ownerId, UUID invoiceId, RecordRentPaymentRequest request) {
        RentInvoice invoice = rentInvoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Rent Invoice", invoiceId));

        UUID propertyId = invoice.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own the property for this invoice");
        }

        RentPayment payment = new RentPayment();
        payment.setInvoiceId(invoice.getId());
        payment.setTenantId(invoice.getTenantId());
        payment.setAmountPaidPaise(request.getAmountPaidPaise());
        payment.setPaymentDate(request.getPaymentDate() != null ? request.getPaymentDate() : LocalDate.now());
        payment.setPaymentMethod(request.getPaymentMethod());
        payment.setReferenceNumber(request.getReferenceNumber());
        payment.setNotes(request.getNotes());
        payment.setRecordedBy(ownerId);

        rentPaymentRepository.save(payment);

        invoice.setPaidAmountPaise(invoice.getPaidAmountPaise() + request.getAmountPaidPaise());
        if (invoice.getPaidAmountPaise() >= invoice.getTotalAmountPaise()) {
            invoice.setStatus("PAID");
        } else {
            invoice.setStatus("PARTIALLY_PAID");
        }
        RentInvoice saved = rentInvoiceRepository.save(invoice);

        return RentInvoiceResponse.from(saved);
    }

    // --- Income & Expense Operations ---

    @Transactional
    public IncomeResponse recordIncome(UUID ownerId, CreateIncomeRequest request) {
        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", request.getPropertyId()));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this property");
        }

        IncomeRecord rec = new IncomeRecord();
        rec.setOwnerId(ownerId);
        rec.setPropertyId(property.getId());
        rec.setCategory(request.getCategory().toUpperCase());
        rec.setAmountPaise(request.getAmountPaise());
        rec.setTransactionDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
        rec.setNotes(request.getNotes());
        rec.setRecordedBy(ownerId);

        rec = incomeRecordRepository.save(rec);
        return IncomeResponse.from(rec);
    }

    @Transactional(readOnly = true)
    public PageResponse<IncomeResponse> listIncome(UUID ownerId, Pageable pageable) {
        Page<IncomeRecord> page = incomeRecordRepository.findByOwnerId(ownerId, pageable);
        List<IncomeResponse> dtos = page.getContent().stream()
                .map(IncomeResponse::from)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional
    public ExpenseResponse recordExpense(UUID ownerId, CreateExpenseRequest request) {
        Property property = propertyRepository.findById(request.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", request.getPropertyId()));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this property");
        }

        ExpenseRecord exp = new ExpenseRecord();
        exp.setOwnerId(ownerId);
        exp.setPropertyId(property.getId());
        exp.setCategory(request.getCategory().toUpperCase());
        exp.setAmountPaise(request.getAmountPaise());
        exp.setTransactionDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
        exp.setNotes(request.getNotes());
        exp.setAttachmentKey(request.getAttachmentKey());
        exp.setRecordedBy(ownerId);

        exp = expenseRecordRepository.save(exp);
        return ExpenseResponse.from(exp);
    }

    @Transactional(readOnly = true)
    public PageResponse<ExpenseResponse> listExpenses(UUID ownerId, Pageable pageable) {
        Page<ExpenseRecord> page = expenseRecordRepository.findByOwnerId(ownerId, pageable);
        List<ExpenseResponse> dtos = page.getContent().stream()
                .map(ExpenseResponse::from)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    // --- Reports ---

    @Transactional(readOnly = true)
    public MonthlyReportResponse getMonthlyReport(UUID ownerId, String month) {
        if (month == null || month.isBlank()) {
            month = YearMonth.now().toString(); // "YYYY-MM"
        }

        YearMonth ym = YearMonth.parse(month);
        LocalDate start = ym.atDay(1);
        LocalDate end = ym.atEndOfMonth();

        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        List<UUID> propertyIds = properties.stream().map(Property::getId).collect(Collectors.toList());

        long rentBilled = 0L;
        long rentCollected = 0L;
        long securityDeposits = 0L;

        if (!propertyIds.isEmpty()) {
            List<RentInvoice> invoices = rentInvoiceRepository.findByPropertyIdInAndBillingMonth(propertyIds, month);
            for (RentInvoice inv : invoices) {
                rentBilled += inv.getTotalAmountPaise();
                rentCollected += inv.getPaidAmountPaise();
            }

            for (Property p : properties) {
                List<TenantStay> stays = tenantStayRepository.findByPropertyId(p.getId());
                for (TenantStay stay : stays) {
                    if (stay.getSecurityDepositPaise() != null) {
                        securityDeposits += stay.getSecurityDepositPaise();
                    }
                }
            }
        }

        long otherIncome = 0L;
        List<IncomeRecord> incomes = incomeRecordRepository.findByOwnerIdAndTransactionDateBetween(ownerId, start, end);
        for (IncomeRecord inc : incomes) {
            otherIncome += inc.getAmountPaise();
        }

        long totalExpenses = 0L;
        Map<String, Long> expenseBreakdown = new HashMap<>();
        List<ExpenseRecord> expenses = expenseRecordRepository.findByOwnerIdAndTransactionDateBetween(ownerId, start, end);
        for (ExpenseRecord exp : expenses) {
            totalExpenses += exp.getAmountPaise();
            expenseBreakdown.put(exp.getCategory(), expenseBreakdown.getOrDefault(exp.getCategory(), 0L) + exp.getAmountPaise());
        }

        long totalIncomeCollected = rentCollected + otherIncome;
        long outstandingRent = Math.max(0L, rentBilled - rentCollected);
        long operatingSurplus = totalIncomeCollected - totalExpenses;

        MonthlyReportResponse report = new MonthlyReportResponse();
        report.setMonth(month);
        report.setRentBilledPaise(rentBilled);
        report.setRentCollectedPaise(rentCollected);
        report.setOtherIncomePaise(otherIncome);
        report.setTotalIncomeCollectedPaise(totalIncomeCollected);
        report.setTotalExpensesPaise(totalExpenses);
        report.setOutstandingRentPaise(outstandingRent);
        report.setOperatingSurplusPaise(operatingSurplus);
        report.setSecurityDepositsLiabilitiesPaise(securityDeposits);
        report.setExpenseBreakdownPaise(expenseBreakdown);

        return report;
    }

    @Transactional(readOnly = true)
    public OccupancyReportResponse getOccupancyReport(UUID ownerId) {
        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        int totalProperties = properties.size();
        int totalRooms = 0;
        int totalBeds = 0;
        int occupiedBeds = 0;

        for (Property p : properties) {
            List<Room> rooms = roomRepository.findByPropertyId(p.getId());
            totalRooms += rooms.size();

            List<Bed> beds = bedRepository.findByPropertyId(p.getId());
            totalBeds += beds.size();
            for (Bed b : beds) {
                if (b.getStatus() == BedStatus.OCCUPIED) {
                    occupiedBeds++;
                }
            }
        }

        int availableBeds = Math.max(0, totalBeds - occupiedBeds);
        double percentage = totalBeds > 0 ? ((double) occupiedBeds / totalBeds) * 100.0 : 0.0;

        return new OccupancyReportResponse(totalProperties, totalRooms, totalBeds, occupiedBeds, availableBeds, percentage);
    }

    @Transactional(readOnly = true)
    public String exportReportCsv(UUID ownerId) {
        MonthlyReportResponse report = getMonthlyReport(ownerId, YearMonth.now().toString());
        StringBuilder csv = new StringBuilder();
        csv.append("Metric,Amount (INR)\n");
        csv.append("Rent Billed,").append(report.getRentBilledPaise() / 100.0).append("\n");
        csv.append("Rent Collected,").append(report.getRentCollectedPaise() / 100.0).append("\n");
        csv.append("Other Income,").append(report.getOtherIncomePaise() / 100.0).append("\n");
        csv.append("Total Income Collected,").append(report.getTotalIncomeCollectedPaise() / 100.0).append("\n");
        csv.append("Total Expenses,").append(report.getTotalExpensesPaise() / 100.0).append("\n");
        csv.append("Outstanding Rent,").append(report.getOutstandingRentPaise() / 100.0).append("\n");
        csv.append("Operating Surplus,").append(report.getOperatingSurplusPaise() / 100.0).append("\n");
        csv.append("Security Deposits Liability,").append(report.getSecurityDepositsLiabilitiesPaise() / 100.0).append("\n");
        return csv.toString();
    }
}
