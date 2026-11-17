package com.staynest.payment.repository;

import com.staynest.payment.entity.Payment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PaymentRepository extends JpaRepository<Payment, UUID> {
    Optional<Payment> findByBookingId(UUID bookingId);
    Optional<Payment> findByProviderOrderId(String providerOrderId);
    Optional<Payment> findByIdempotencyKey(String idempotencyKey);
    List<Payment> findByBookingIdIn(List<UUID> bookingIds);
    Page<Payment> findByBookingIdIn(List<UUID> bookingIds, Pageable pageable);
}

