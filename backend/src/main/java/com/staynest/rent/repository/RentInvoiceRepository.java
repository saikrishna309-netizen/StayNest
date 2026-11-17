package com.staynest.rent.repository;

import com.staynest.rent.entity.RentInvoice;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RentInvoiceRepository extends JpaRepository<RentInvoice, UUID> {

    @Query("SELECT i FROM RentInvoice i WHERE i.propertyId IN :propertyIds")
    Page<RentInvoice> findByPropertyIdIn(@Param("propertyIds") List<UUID> propertyIds, Pageable pageable);

    @Query("SELECT i FROM RentInvoice i WHERE i.propertyId IN :propertyIds AND i.status = :status")
    Page<RentInvoice> findByPropertyIdInAndStatus(@Param("propertyIds") List<UUID> propertyIds, @Param("status") String status, Pageable pageable);

    @Query("SELECT i FROM RentInvoice i WHERE i.propertyId IN :propertyIds AND i.billingMonth = :month")
    List<RentInvoice> findByPropertyIdInAndBillingMonth(@Param("propertyIds") List<UUID> propertyIds, @Param("month") String month);

    List<RentInvoice> findByTenantId(UUID tenantId);

    Optional<RentInvoice> findByInvoiceNumber(String invoiceNumber);
}

