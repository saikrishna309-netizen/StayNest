package com.staynest.tenant.repository;

import com.staynest.tenant.entity.Tenant;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, UUID> {

    Page<Tenant> findByOwnerId(UUID ownerId, Pageable pageable);

    Optional<Tenant> findByIdAndOwnerId(UUID id, UUID ownerId);

    boolean existsByOwnerIdAndPhoneAndActiveTrue(UUID ownerId, String phone);

    @Query("""
        SELECT t FROM Tenant t
        WHERE t.ownerId = :ownerId
          AND (:query IS NULL OR LOWER(t.fullName) LIKE LOWER(CONCAT('%', :query, '%'))
               OR t.phone LIKE CONCAT('%', :query, '%')
               OR LOWER(t.email) LIKE LOWER(CONCAT('%', :query, '%')))
    """)
    Page<Tenant> searchTenants(@Param("ownerId") UUID ownerId, @Param("query") String query, Pageable pageable);
}

