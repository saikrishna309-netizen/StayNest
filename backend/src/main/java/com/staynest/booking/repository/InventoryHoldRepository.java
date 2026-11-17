package com.staynest.booking.repository;

import com.staynest.booking.entity.HoldStatus;
import com.staynest.booking.entity.InventoryHold;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface InventoryHoldRepository extends JpaRepository<InventoryHold, UUID> {

    @Query("""
        SELECT COUNT(h) FROM InventoryHold h
        WHERE h.bedId = :bedId
          AND h.status = 'ACTIVE'
          AND h.expiresAt > :now
          AND h.checkIn < :checkOut
          AND h.checkOut > :checkIn
    """)
    long countOverlappingActiveHolds(
            @Param("bedId") UUID bedId,
            @Param("checkIn") LocalDate checkIn,
            @Param("checkOut") LocalDate checkOut,
            @Param("now") Instant now
    );

    List<InventoryHold> findByStatusAndExpiresAtBefore(HoldStatus status, Instant now);
}

