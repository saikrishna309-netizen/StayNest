package com.staynest.payment.service;

import com.staynest.booking.entity.Booking;
import com.staynest.booking.entity.BookingStatus;
import com.staynest.booking.repository.BookingRepository;
import com.staynest.common.exception.BadRequestException;
import com.staynest.common.exception.ForbiddenException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.response.PageResponse;
import com.staynest.payment.dto.*;
import com.staynest.payment.entity.*;
import com.staynest.payment.repository.PaymentRepository;
import com.staynest.payment.repository.RefundRepository;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.PropertyRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final RefundRepository refundRepository;
    private final BookingRepository bookingRepository;
    private final PropertyRepository propertyRepository;

    public PaymentService(PaymentRepository paymentRepository,
                          RefundRepository refundRepository,
                          BookingRepository bookingRepository,
                          PropertyRepository propertyRepository) {
        this.paymentRepository = paymentRepository;
        this.refundRepository = refundRepository;
        this.bookingRepository = bookingRepository;
        this.propertyRepository = propertyRepository;
    }

    @Transactional
    public OrderResponse createOrder(UUID customerId, CreateOrderRequest request) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", request.getBookingId()));

        if (!booking.getCustomerId().equals(customerId)) {
            throw new ForbiddenException("You do not own this booking");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.EXPIRED) {
            throw new BadRequestException("INVALID_BOOKING_STATUS", "Cannot pay for a booking in status: " + booking.getStatus());
        }

        String orderId = "order_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);

        Payment payment = new Payment();
        payment.setBookingId(booking.getId());
        payment.setCustomerId(customerId);
        payment.setMethod(PaymentMethod.ONLINE);
        payment.setProvider("RAZORPAY");
        payment.setProviderOrderId(orderId);
        payment.setAmountPaise(booking.getAmountDuePaise());
        payment.setStatus(PaymentState.CREATED);

        payment = paymentRepository.save(payment);

        return new OrderResponse(
                payment.getId(),
                booking.getId(),
                orderId,
                payment.getAmountPaise(),
                booking.getCurrency(),
                "rzp_test_staynest_key"
        );
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPayment(UUID userId, UUID paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        Booking booking = bookingRepository.findById(payment.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", payment.getBookingId()));

        Property property = propertyRepository.findById(booking.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", booking.getPropertyId()));

        if (!payment.getCustomerId().equals(userId) && !property.getOwnerId().equals(userId)) {
            throw new ForbiddenException("You do not have access to view this payment");
        }

        return PaymentResponse.from(payment);
    }

    @Transactional
    public void processWebhook(String provider, String signature, Map<String, Object> payload) {
        log.info("Processing webhook for provider: {}, signature: {}", provider, signature);

        // Extract order or payment ID from webhook payload
        String orderId = (String) payload.get("order_id");
        if (orderId == null && payload.containsKey("payload")) {
            // Support nested structure if present
            orderId = (String) payload.get("provider_order_id");
        }

        if (orderId != null) {
            paymentRepository.findByProviderOrderId(orderId).ifPresent(payment -> {
                if (payment.getStatus() != PaymentState.PAID) {
                    payment.setStatus(PaymentState.PAID);
                    payment.setProviderPaymentId((String) payload.getOrDefault("payment_id", "pay_" + UUID.randomUUID()));
                    paymentRepository.save(payment);

                    // Reconcile and confirm booking
                    bookingRepository.findById(payment.getBookingId()).ifPresent(booking -> {
                        booking.setStatus(BookingStatus.CONFIRMED);
                        booking.setPaymentStatus(com.staynest.booking.entity.PaymentStatus.PAID);
                        booking.setAmountDuePaise(0L);
                        bookingRepository.save(booking);
                        log.info("Confirmed booking {} via payment webhook", booking.getBookingCode());
                    });
                }
            });
        }
    }

    @Transactional
    public RefundResponse initiateRefund(UUID userId, UUID paymentId, RefundRequest request) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment", paymentId));

        Booking booking = bookingRepository.findById(payment.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking", payment.getBookingId()));

        Property property = propertyRepository.findById(booking.getPropertyId())
                .orElseThrow(() -> new ResourceNotFoundException("Property", booking.getPropertyId()));

        if (!property.getOwnerId().equals(userId)) {
            throw new ForbiddenException("Only the property owner or administrator can initiate refunds");
        }

        if (payment.getStatus() != PaymentState.PAID) {
            throw new BadRequestException("INVALID_PAYMENT_STATE", "Only completed payments can be refunded");
        }

        if (request.getAmountPaise() > payment.getAmountPaise()) {
            throw new BadRequestException("AMOUNT_EXCEEDED", "Refund amount cannot exceed original payment amount");
        }

        Refund refund = new Refund(payment.getId(), booking.getId(), request.getAmountPaise(), request.getReason());
        refund.setStatus(RefundStatus.COMPLETED);
        refund.setProviderRefundId("rfnd_" + UUID.randomUUID().toString().substring(0, 12));
        refund = refundRepository.save(refund);

        payment.setStatus(PaymentState.REFUNDED);
        paymentRepository.save(payment);

        booking.setStatus(BookingStatus.REFUNDED);
        booking.setPaymentStatus(com.staynest.booking.entity.PaymentStatus.REFUNDED);
        bookingRepository.save(booking);

        return RefundResponse.from(refund);
    }

    @Transactional(readOnly = true)
    public PageResponse<PaymentResponse> listOwnerPayments(UUID ownerId, Pageable pageable) {
        List<Property> properties = propertyRepository.findByOwnerId(ownerId);
        List<UUID> propertyIds = properties.stream().map(Property::getId).collect(Collectors.toList());

        if (propertyIds.isEmpty()) {
            return new PageResponse<>(List.of(), 0, pageable.getPageSize(), 0, 0, true);
        }

        List<Booking> bookings = bookingRepository.findByPropertyIdIn(propertyIds, Pageable.unpaged()).getContent();
        List<UUID> bookingIds = bookings.stream().map(Booking::getId).collect(Collectors.toList());

        if (bookingIds.isEmpty()) {
            return new PageResponse<>(List.of(), 0, pageable.getPageSize(), 0, 0, true);
        }

        Page<Payment> page = paymentRepository.findByBookingIdIn(bookingIds, pageable);
        List<PaymentResponse> dtos = page.getContent().stream()
                .map(PaymentResponse::from)
                .collect(Collectors.toList());

        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }
}

