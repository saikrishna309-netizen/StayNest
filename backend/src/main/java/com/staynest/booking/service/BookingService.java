package com.staynest.booking.service;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.repository.BedRepository;
import com.staynest.booking.dto.BookingResponse;
import com.staynest.booking.dto.CancelBookingRequest;
import com.staynest.booking.dto.CreateBookingRequest;
import com.staynest.booking.dto.CreateHoldRequest;
import com.staynest.booking.dto.HoldResponse;
import com.staynest.booking.entity.*;
import com.staynest.booking.repository.BookingRepository;
import com.staynest.booking.repository.InventoryHoldRepository;
import com.staynest.common.exception.BadRequestException;
import com.staynest.common.exception.ConflictException;
import com.staynest.common.exception.ForbiddenException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.response.PageResponse;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.PropertyRepository;
import com.staynest.room.entity.Room;
import com.staynest.room.repository.RoomRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class BookingService {

    private static final Logger log = LoggerFactory.getLogger(BookingService.class);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final BookingRepository bookingRepository;
    private final InventoryHoldRepository inventoryHoldRepository;
    private final BedRepository bedRepository;
    private final RoomRepository roomRepository;
    private final PropertyRepository propertyRepository;

    public BookingService(BookingRepository bookingRepository,
                          InventoryHoldRepository inventoryHoldRepository,
                          BedRepository bedRepository,
                          RoomRepository roomRepository,
                          PropertyRepository propertyRepository) {
        this.bookingRepository = bookingRepository;
        this.inventoryHoldRepository = inventoryHoldRepository;
        this.bedRepository = bedRepository;
        this.roomRepository = roomRepository;
        this.propertyRepository = propertyRepository;
    }

    @Transactional
    public HoldResponse createHold(UUID customerId, CreateHoldRequest request) {
        if (!request.getCheckOut().isAfter(request.getCheckIn())) {
            throw new BadRequestException("INVALID_DATES", "Check-out date must be after check-in date");
        }

        Bed bed = bedRepository.findByIdForUpdate(request.getBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", request.getBedId()));

        if (!bed.isActive()) {
            throw new BadRequestException("BED_INACTIVE", "The selected bed is currently inactive");
        }

        Instant now = Instant.now();
        long activeBookings = bookingRepository.countOverlappingActiveBookings(bed.getId(), request.getCheckIn(), request.getCheckOut());
        if (activeBookings > 0) {
            throw new ConflictException("BED_NOT_AVAILABLE", "The selected bed is no longer available for these dates");
        }

        long activeHolds = inventoryHoldRepository.countOverlappingActiveHolds(bed.getId(), request.getCheckIn(), request.getCheckOut(), now);
        if (activeHolds > 0) {
            throw new ConflictException("BED_HELD", "The selected bed is currently temporarily held by another customer");
        }

        Instant expiresAt = now.plus(15, ChronoUnit.MINUTES);
        InventoryHold hold = new InventoryHold(bed.getId(), customerId, request.getCheckIn(), request.getCheckOut(), expiresAt);
        hold = inventoryHoldRepository.save(hold);

        return new HoldResponse(hold.getId(), hold.getBedId(), hold.getCheckIn(), hold.getCheckOut(), hold.getExpiresAt(), hold.getStatus().name());
    }

    @Transactional
    public BookingResponse createBooking(UUID customerId, CreateBookingRequest request, String idempotencyKey) {
        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            Optional<Booking> existing = bookingRepository.findByIdempotencyKey(idempotencyKey);
            if (existing.isPresent()) {
                return BookingResponse.from(existing.get());
            }
        }

        if (!request.getCheckOut().isAfter(request.getCheckIn())) {
            throw new BadRequestException("INVALID_DATES", "Check-out date must be strictly after check-in date");
        }

        // 1. Pessimistic lock bed row to prevent concurrent race conditions
        Bed bed = bedRepository.findByIdForUpdate(request.getBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", request.getBedId()));

        if (!bed.isActive()) {
            throw new BadRequestException("BED_INACTIVE", "The selected bed is not available for booking");
        }

        // 2. Check for overlapping bookings
        long overlapping = bookingRepository.countOverlappingActiveBookings(bed.getId(), request.getCheckIn(), request.getCheckOut());
        if (overlapping > 0) {
            throw new ConflictException("BED_NOT_AVAILABLE", "The selected bed is no longer available for these dates.");
        }

        Room room = roomRepository.findById(bed.getRoomId())
                .orElseThrow(() -> new ResourceNotFoundException("Room", bed.getRoomId()));

        Property property = propertyRepository.findById(bed.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", bed.getPropertyId()));

        if (!property.isPublished()) {
            throw new BadRequestException("PROPERTY_NOT_AVAILABLE", "Property is not available for bookings");
        }

        // 3. Server-authoritative price calculation
        long days = ChronoUnit.DAYS.between(request.getCheckIn(), request.getCheckOut());
        double months = Math.max(1.0, days / 30.0);
        long subtotalPaise = Math.round(room.getRentMonthlyPaise() * months);
        long depositPaise = room.getDepositPaise() != null && room.getDepositPaise() > 0
                ? room.getDepositPaise()
                : (room.getRentMonthlyPaise() * property.getDepositMonths());
        long totalPaise = subtotalPaise + depositPaise;

        Booking booking = new Booking();
        booking.setBookingCode("SN-" + (100000 + RANDOM.nextInt(900000)));
        booking.setCustomerId(customerId);
        booking.setPropertyId(property.getId());
        booking.setRoomId(room.getId());
        booking.setBedId(bed.getId());
        booking.setCheckIn(request.getCheckIn());
        booking.setCheckOut(request.getCheckOut());
        booking.setCurrency("INR");
        booking.setSubtotalPaise(subtotalPaise);
        booking.setDepositPaise(depositPaise);
        booking.setTotalPaise(totalPaise);
        booking.setCancellationPolicySnapshot(property.getCancellationPolicy());
        booking.setIdempotencyKey(idempotencyKey);

        boolean payAtProperty = "PAY_AT_PROPERTY".equalsIgnoreCase(request.getPaymentChoice());
        if (payAtProperty) {
            if (!property.isPayAtPropertyAllowed()) {
                throw new BadRequestException("PAYMENT_CHOICE_NOT_ALLOWED", "Pay-at-property is not allowed for this PG");
            }
            booking.setPaymentChoice("PAY_AT_PROPERTY");
            booking.setStatus(BookingStatus.CONFIRMED);
            booking.setPaymentStatus(PaymentStatus.DUE_AT_PROPERTY);
            booking.setAmountDuePaise(totalPaise);
        } else {
            booking.setPaymentChoice("ONLINE");
            booking.setStatus(BookingStatus.PENDING_PAYMENT);
            booking.setPaymentStatus(PaymentStatus.PENDING);
            booking.setAmountDuePaise(totalPaise);
        }

        booking = bookingRepository.save(booking);
        return BookingResponse.from(booking);
    }

    @Transactional(readOnly = true)
    public BookingResponse getBooking(UUID userId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        Property property = propertyRepository.findById(booking.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", booking.getPropertyId()));

        if (!booking.getCustomerId().equals(userId) && !property.getOwnerId().equals(userId)) {
            throw new ForbiddenException("You do not have access to view this booking");
        }

        return BookingResponse.from(booking);
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> listCustomerBookings(UUID customerId, Pageable pageable) {
        Page<Booking> page = bookingRepository.findByCustomerIdOrderByCreatedAtDesc(customerId, pageable);
        List<BookingResponse> dtos = page.getContent().stream()
                .map(BookingResponse::from)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public PageResponse<BookingResponse> listOwnerBookings(UUID ownerId, Pageable pageable) {
        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        List<UUID> propertyIds = properties.stream().map(Property::getId).collect(Collectors.toList());

        if (propertyIds.isEmpty()) {
            return new PageResponse<>(List.of(), 0, pageable.getPageSize(), 0, 0, true);
        }

        Page<Booking> page = bookingRepository.findByPropertyIdIn(propertyIds, pageable);
        List<BookingResponse> dtos = page.getContent().stream()
                .map(BookingResponse::from)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional
    public BookingResponse cancelBooking(UUID userId, UUID bookingId, CancelBookingRequest request) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        UUID propertyId = booking.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!booking.getCustomerId().equals(userId) && !property.getOwnerId().equals(userId)) {
            throw new ForbiddenException("You do not have permission to cancel this booking");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.CHECKED_OUT) {
            throw new BadRequestException("INVALID_STATE", "Booking cannot be cancelled in its current state: " + booking.getStatus());
        }

        booking.setStatus(BookingStatus.CANCELLED);
        booking.setCancelledAt(Instant.now());
        if (request != null && request.getReason() != null) {
            booking.setCancellationReason(request.getReason());
        }

        Booking saved = bookingRepository.save(booking);
        return BookingResponse.from(saved);
    }

    @Transactional
    public BookingResponse recordCheckIn(UUID ownerId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        UUID propertyId = booking.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own the property for this booking");
        }

        booking.setStatus(BookingStatus.CHECKED_IN);
        booking.setCheckedInAt(Instant.now());
        Booking saved = bookingRepository.save(booking);
        return BookingResponse.from(saved);
    }

    @Transactional
    public BookingResponse recordCheckOut(UUID ownerId, UUID bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking", bookingId));

        UUID propertyId = booking.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not own the property for this booking");
        }

        booking.setStatus(BookingStatus.CHECKED_OUT);
        booking.setCheckedOutAt(Instant.now());
        Booking saved = bookingRepository.save(booking);
        return BookingResponse.from(saved);
    }

    // Background job to expire holds (every minute)
    @Scheduled(fixedRate = 60000)
    @Transactional
    public void cleanupExpiredHolds() {
        Instant now = Instant.now();
        List<InventoryHold> expired = inventoryHoldRepository.findByStatusAndExpiresAtBefore(HoldStatus.ACTIVE, now);
        for (InventoryHold hold : expired) {
            hold.setStatus(HoldStatus.EXPIRED);
        }
        if (!expired.isEmpty()) {
            inventoryHoldRepository.saveAll(expired);
            log.info("Cleaned up {} expired inventory holds", expired.size());
        }
    }
}
