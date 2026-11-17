package com.staynest.bed.repository;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.entity.BedStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface BedRepository extends JpaRepository<Bed, UUID> {

    List<Bed> findByRoomId(UUID roomId);

    List<Bed> findByPropertyId(UUID propertyId);

    List<Bed> findByPropertyIdAndStatusAndActiveTrue(UUID propertyId, BedStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT b FROM Bed b WHERE b.id = :id")
    Optional<Bed> findByIdForUpdate(@Param("id") UUID id);
}

