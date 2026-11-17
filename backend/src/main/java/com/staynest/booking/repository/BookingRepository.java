package com.staynest.booking.repository;

import com.staynest.booking.entity.Booking;
import com.staynest.booking.entity.BookingStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BookingRepository extends JpaRepository<Booking, UUID> {

    Optional<Booking> findByBookingCode(String bookingCode);

    Optional<Booking> findByIdempotencyKey(String idempotencyKey);

    Page<Booking> findByCustomerIdOrderByCreatedAtDesc(UUID customerId, Pageable pageable);

    @Query("SELECT b FROM Booking b WHERE b.propertyId IN :propertyIds ORDER BY b.createdAt DESC")
    Page<Booking> findByPropertyIdIn(@Param("propertyIds") List<UUID> propertyIds, Pageable pageable);

    @Query("""
        SELECT COUNT(b) FROM Booking b
        WHERE b.bedId = :bedId
          AND b.status NOT IN ('CANCELLED', 'EXPIRED')
          AND b.checkIn < :checkOut
          AND b.checkOut > :checkIn
    """)
    long countOverlappingActiveBookings(
            @Param("bedId") UUID bedId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut
    );

    List<Booking> findByStatus(BookingStatus status);
}

