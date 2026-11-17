package com.staynest.owner.repository;

import com.staynest.owner.entity.OwnerProfile;
import com.staynest.owner.entity.VerificationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OwnerProfileRepository extends JpaRepository<OwnerProfile, UUID> {
    Optional<OwnerProfile> findByUserId(UUID userId);
    List<OwnerProfile> findByVerificationStatus(VerificationStatus status);
}

