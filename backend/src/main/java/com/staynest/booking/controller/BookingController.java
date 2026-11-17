package com.staynest.booking.controller;

import com.staynest.booking.dto.BookingResponse;
import com.staynest.booking.dto.CancelBookingRequest;
import com.staynest.booking.dto.CreateBookingRequest;
import com.staynest.booking.dto.CreateHoldRequest;
import com.staynest.booking.dto.HoldResponse;
import com.staynest.booking.service.BookingService;
import com.staynest.common.response.PageResponse;
import com.staynest.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Bookings", description = "Instant booking creation, temporary holds, cancellations, check-in and check-out")
@SecurityRequirement(name = "bearerAuth")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping("/bookings/holds")
    @Operation(summary = "Create short-lived 15-minute inventory hold on a bed")
    public ResponseEntity<HoldResponse> createHold(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateHoldRequest request) {
        return new ResponseEntity<>(bookingService.createHold(user.getId(), request), HttpStatus.CREATED);
    }

    @PostMapping("/bookings")
    @Operation(summary = "Create booking / confirm pay-at-property per policy (supports Idempotency-Key)")
    public ResponseEntity<BookingResponse> createBooking(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody CreateBookingRequest request) {
        return new ResponseEntity<>(bookingService.createBooking(user.getId(), request, idempotencyKey), HttpStatus.CREATED);
    }

    @GetMapping("/bookings/{id}")
    @Operation(summary = "Read booking details (customer or property owner)")
    public ResponseEntity<BookingResponse> getBooking(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.getBooking(user.getId(), id));
    }

    @GetMapping("/customer/bookings")
    @Operation(summary = "List current customer's bookings")
    public ResponseEntity<PageResponse<BookingResponse>> listCustomerBookings(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(bookingService.listCustomerBookings(user.getId(), pageable));
    }

    @GetMapping("/owner/bookings")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "List bookings across all properties owned by current user")
    public ResponseEntity<PageResponse<BookingResponse>> listOwnerBookings(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(bookingService.listOwnerBookings(user.getId(), pageable));
    }

    @PostMapping("/bookings/{id}/cancel")
    @Operation(summary = "Request / execute cancellation per cancellation policy")
    public ResponseEntity<BookingResponse> cancelBooking(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @RequestBody(required = false) CancelBookingRequest request) {
        return ResponseEntity.ok(bookingService.cancelBooking(user.getId(), id, request));
    }

    @PostMapping("/owner/bookings/{id}/check-in")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Record tenant / customer check-in")
    public ResponseEntity<BookingResponse> recordCheckIn(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.recordCheckIn(user.getId(), id));
    }

    @PostMapping("/owner/bookings/{id}/check-out")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Record tenant check-out / stay completion")
    public ResponseEntity<BookingResponse> recordCheckOut(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(bookingService.recordCheckOut(user.getId(), id));
    }
}

