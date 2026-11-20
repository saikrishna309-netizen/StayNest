package com.staynest.tenant.repository;

import com.staynest.tenant.entity.TenantStay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface TenantStayRepository extends JpaRepository<TenantStay, UUID> {
    List<TenantStay> findByTenantId(UUID tenantId);
    List<TenantStay> findByPropertyIdAndStatus(UUID propertyId, String status);
    List<TenantStay> findByPropertyId(UUID propertyId);
    List<TenantStay> findByBedId(UUID bedId);
    List<TenantStay> findByBedIdAndStatus(UUID bedId, String status);
}

