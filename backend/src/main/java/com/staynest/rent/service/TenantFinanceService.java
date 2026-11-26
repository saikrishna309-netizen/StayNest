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
import com.staynest.tenant.dto.TransferTenantRequest;
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
                .orElse(null);

        if (activeStay != null) {
            res.setPropertyId(activeStay.getPropertyId());
            res.setRoomId(activeStay.getRoomId());
            res.setBedId(activeStay.getBedId());
            res.setMonthlyRentPaise(activeStay.getMonthlyRentPaise());
            res.setSecurityDepositPaise(activeStay.getSecurityDepositPaise());
            res.setCheckIn(activeStay.getCheckIn());
            res.setCheckOut(activeStay.getCheckOut());
            res.setStayStatus("ACTIVE");
            res.setActive(true);

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
        } else if (!stays.isEmpty()) {
            // Vacated / Exited resident: explicitly clear bed and room
            res.setActive(false);
            res.setStayStatus("TERMINATED");
            res.setBedId(null);
            res.setBedLabel(null);
            res.setRoomId(null);
            res.setRoomNumber(null);
            res.setFloorNumber(null);
            res.setSharingType(null);
            res.setMonthlyRentPaise(null);

            TenantStay lastStay = stays.get(stays.size() - 1);
            res.setCheckIn(lastStay.getCheckIn());
            res.setCheckOut(lastStay.getCheckOut());
            if (lastStay.getPropertyId() != null) {
                propertyRepository.findById(lastStay.getPropertyId())
                        .ifPresent(p -> res.setPropertyName(p.getName() + " (Past)"));
            }
        } else {
            // Newly onboarded tenant with no stay row yet: respect tenant.active from DB
            res.setActive(tenant.isActive());
            res.setStayStatus(tenant.isActive() ? "ACTIVE" : "TERMINATED");
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
        String digits = request.getPhone() != null ? request.getPhone().replaceAll("[^0-9]", "") : "";
        String cleanPhone = digits.length() > 10 ? digits.substring(digits.length() - 10) : digits;
        if (!cleanPhone.matches("^[6-9][0-9]{9}$")) {
            throw new BadRequestException("INVALID_PHONE", "Enter a valid 10-digit Indian mobile number (starting with 6-9).");
        }
        if (tenantRepository.existsByOwnerIdAndPhoneAndActiveTrue(ownerId, cleanPhone)) {
            throw new BadRequestException("DUPLICATE_TENANT_PHONE", "An active tenant with mobile +91 " + cleanPhone + " already exists.");
        }

        Tenant tenant = new Tenant(ownerId, request.getFullName().trim(), cleanPhone, request.getEmail());
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

        if (request.getMonthlyRentPaise() != null && request.getMonthlyRentPaise() > 0) {
            List<TenantStay> stays = tenantStayRepository.findByTenantId(tenant.getId());
            for (TenantStay stay : stays) {
                if ("ACTIVE".equalsIgnoreCase(stay.getStatus())) {
                    stay.setMonthlyRentPaise(request.getMonthlyRentPaise());
                    tenantStayRepository.save(stay);
                }
            }
        }

        tenant = tenantRepository.save(tenant);
        return enrichTenantResponse(tenant);
    }

    @Transactional
    public TenantResponse transferTenant(UUID ownerId, UUID tenantId, TransferTenantRequest request) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        Bed newBed = bedRepository.findById(request.getNewBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", request.getNewBedId()));

        Room newRoom = roomRepository.findById(newBed.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room", newBed.getRoomId()));

        Property newProperty = propertyRepository.findById(newRoom.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", newRoom.getPropertyId()));

        if (!newProperty.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this property");
        }

        // Check if new bed is already occupied by another active resident
        List<TenantStay> activeStaysOnNewBed = tenantStayRepository.findByBedId(newBed.getId()).stream()
                .filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus()) && !s.getTenantId().equals(tenant.getId()))
                .collect(Collectors.toList());
        if (!activeStaysOnNewBed.isEmpty()) {
            throw new BadRequestException("Selected bed is already occupied by another resident");
        }

        // 1. Free any current active bed(s) assigned to this tenant
        List<TenantStay> existingStays = tenantStayRepository.findByTenantId(tenant.getId());
        Long prevRent = 850000L;
        Long prevDeposit = 850000L;
        for (TenantStay stay : existingStays) {
            if ("ACTIVE".equalsIgnoreCase(stay.getStatus())) {
                prevRent = stay.getMonthlyRentPaise();
                prevDeposit = stay.getSecurityDepositPaise();
                if (stay.getBedId() != null && !stay.getBedId().equals(newBed.getId())) {
                    bedRepository.findById(stay.getBedId()).ifPresent(oldBed -> {
                        oldBed.setStatus(BedStatus.AVAILABLE);
                        bedRepository.save(oldBed);
                    });
                }
                stay.setStatus("TRANSFERRED");
                stay.setCheckOut(LocalDate.now());
                tenantStayRepository.save(stay);
            }
        }

        // 2. Mark the new bed as OCCUPIED
        newBed.setStatus(BedStatus.OCCUPIED);
        bedRepository.save(newBed);

        // 3. Determine new monthly rent
        Long effectiveRent = request.getMonthlyRentPaise() != null && request.getMonthlyRentPaise() > 0
                ? request.getMonthlyRentPaise()
                : (newRoom.getRentMonthlyPaise() != null ? newRoom.getRentMonthlyPaise() : prevRent);

        Long effectiveDeposit = newRoom.getDepositPaise() != null ? newRoom.getDepositPaise() : prevDeposit;

        // 4. Create new active stay for the tenant
        TenantStay newStay = new TenantStay();
        newStay.setTenantId(tenant.getId());
        newStay.setPropertyId(newProperty.getId());
        newStay.setRoomId(newRoom.getId());
        newStay.setBedId(newBed.getId());
        newStay.setCheckIn(LocalDate.now());
        newStay.setMonthlyRentPaise(effectiveRent);
        newStay.setSecurityDepositPaise(effectiveDeposit);
        newStay.setStatus("ACTIVE");
        tenantStayRepository.save(newStay);

        // 5. Ensure tenant is active
        tenant.setActive(true);
        tenantRepository.save(tenant);

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

    @Transactional
    public void deleteTenant(UUID ownerId, UUID tenantId) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        // 1. Free any beds currently held by active stays
        List<TenantStay> stays = tenantStayRepository.findByTenantId(tenant.getId());
        for (TenantStay stay : stays) {
            if ("ACTIVE".equalsIgnoreCase(stay.getStatus()) && stay.getBedId() != null) {
                bedRepository.findById(stay.getBedId()).ifPresent(bed -> {
                    bed.setStatus(BedStatus.AVAILABLE);
                    bedRepository.save(bed);
                });
            }
        }
        tenantStayRepository.deleteAll(stays);

        // 2. Delete payments and rent invoices for this tenant
        rentPaymentRepository.deleteAll(rentPaymentRepository.findByTenantId(tenant.getId()));
        rentInvoiceRepository.deleteAll(rentInvoiceRepository.findByTenantId(tenant.getId()));

        // 3. Delete tenant profile
        tenantRepository.delete(tenant);
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

    @Transactional
    public RentInvoiceResponse recordTenantDirectPayment(UUID ownerId, UUID tenantId, RecordRentPaymentRequest request) {
        Tenant tenant = tenantRepository.findByIdAndOwnerId(tenantId, ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("Tenant", tenantId));

        List<RentInvoice> invoices = rentInvoiceRepository.findByTenantId(tenant.getId());
        RentInvoice dueInvoice = invoices.stream()
                .filter(i -> !"PAID".equalsIgnoreCase(i.getStatus()))
                .findFirst()
                .orElse(null);

        if (dueInvoice == null) {
            List<TenantStay> stays = tenantStayRepository.findByTenantId(tenant.getId());
            TenantStay stay = stays.stream().filter(s -> "ACTIVE".equalsIgnoreCase(s.getStatus())).findFirst().orElse(null);
            UUID propertyId = stay != null ? stay.getPropertyId() : null;
            if (propertyId == null) {
                List<Property> props = propertyRepository.findByOwnerId(ownerId);
                propertyId = !props.isEmpty() ? props.get(0).getId() : null;
            }

            String currentMonth = YearMonth.now().toString();
            dueInvoice = new RentInvoice();
            dueInvoice.setTenantId(tenant.getId());
            dueInvoice.setPropertyId(propertyId);
            dueInvoice.setInvoiceNumber("INV-" + currentMonth + "-" + (1000 + new Random().nextInt(9000)));
            dueInvoice.setBillingMonth(currentMonth);
            dueInvoice.setRentAmountPaise(request.getAmountPaidPaise());
            dueInvoice.setTotalAmountPaise(request.getAmountPaidPaise());
            dueInvoice.setPaidAmountPaise(0L);
            dueInvoice.setDueDate(LocalDate.now());
            dueInvoice.setStatus("DUE");
            dueInvoice = rentInvoiceRepository.save(dueInvoice);
        }

        return recordRentPayment(ownerId, dueInvoice.getId(), request);
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
        Property property;
        if (request.getPropertyId() != null) {
            property = propertyRepository.findById(request.getPropertyId())
                    .orElseThrow(() -> new ResourceNotFoundException("Property", request.getPropertyId()));
            if (!property.getOwnerId().equals(ownerId)) {
                throw new ForbiddenException("You do not own this property");
            }
        } else {
            List<Property> ownerProps = propertyRepository.findByOwnerId(ownerId);
            if (!ownerProps.isEmpty()) {
                property = ownerProps.get(0);
            } else {
                throw new BadRequestException("No properties found for owner to associate expense with");
            }
        }

        String effectiveNotes = request.getTitle() != null && !request.getTitle().isBlank()
                ? request.getTitle().trim()
                : request.getNotes();

        ExpenseRecord exp = new ExpenseRecord();
        exp.setOwnerId(ownerId);
        exp.setPropertyId(property.getId());
        exp.setCategory(request.getCategory().toUpperCase());
        exp.setAmountPaise(request.getAmountPaise());
        exp.setTransactionDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
        exp.setNotes(effectiveNotes);
        exp.setAttachmentKey(request.getAttachmentKey());
        exp.setRecordedBy(ownerId);

        exp = expenseRecordRepository.save(exp);
        return ExpenseResponse.from(exp);
    }

    @Transactional
    public ExpenseResponse updateExpense(UUID ownerId, UUID expenseId, CreateExpenseRequest request) {
        ExpenseRecord exp = expenseRecordRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseRecord", expenseId));
        if (!exp.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this expense record");
        }
        if (request.getTitle() != null && !request.getTitle().isBlank()) {
            exp.setNotes(request.getTitle().trim());
        } else if (request.getNotes() != null) {
            exp.setNotes(request.getNotes().trim());
        }
        if (request.getAmountPaise() != null) {
            exp.setAmountPaise(request.getAmountPaise());
        }
        if (request.getCategory() != null && !request.getCategory().isBlank()) {
            exp.setCategory(request.getCategory().toUpperCase());
        }
        if (request.getTransactionDate() != null) {
            exp.setTransactionDate(request.getTransactionDate());
        }
        if (request.getAttachmentKey() != null) {
            exp.setAttachmentKey(request.getAttachmentKey());
        }
        exp = expenseRecordRepository.save(exp);
        return ExpenseResponse.from(exp);
    }

    @Transactional
    public void deleteExpense(UUID ownerId, UUID expenseId) {
        ExpenseRecord exp = expenseRecordRepository.findById(expenseId)
                .orElseThrow(() -> new ResourceNotFoundException("ExpenseRecord", expenseId));
        if (!exp.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own this expense record");
        }
        expenseRecordRepository.delete(exp);
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
