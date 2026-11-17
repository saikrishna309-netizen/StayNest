package com.staynest.property.repository;

import com.staynest.property.entity.ApprovalStatus;
import com.staynest.property.entity.GenderPolicy;
import com.staynest.property.entity.Property;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PropertyRepository extends JpaRepository<Property, UUID> {

    List<Property> findByOwnerId(UUID ownerId);

    Page<Property> findByOwnerId(UUID ownerId, Pageable pageable);

    List<Property> findByApprovalStatus(ApprovalStatus approvalStatus);

    @Query("""
        SELECT p FROM Property p
        WHERE (p.published = true OR p.approvalStatus = 'APPROVED' OR p.approvalStatus = 'DRAFT')
          AND (:cityId IS NULL OR p.cityId = :cityId)
          AND (:localityId IS NULL OR p.localityId = :localityId)
          AND (:genderPolicy IS NULL OR p.genderPolicy = :genderPolicy)
          AND (:minRent IS NULL OR p.startingPricePaise >= :minRent)
          AND (:maxRent IS NULL OR p.startingPricePaise <= :maxRent)
          AND (:foodIncluded IS NULL OR p.foodIncluded = :foodIncluded)
          AND (:search IS NULL OR LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.description) LIKE LOWER(CONCAT('%', :search, '%'))
               OR LOWER(p.addressLine) LIKE LOWER(CONCAT('%', :search, '%')))
    """)
    Page<Property> searchProperties(
            @Param("cityId") UUID cityId,
            @Param("localityId") UUID localityId,
            @Param("genderPolicy") GenderPolicy genderPolicy,
            @Param("minRent") Long minRent,
            @Param("maxRent") Long maxRent,
            @Param("foodIncluded") Boolean foodIncluded,
            @Param("search") String search,
            Pageable pageable
    );
}

