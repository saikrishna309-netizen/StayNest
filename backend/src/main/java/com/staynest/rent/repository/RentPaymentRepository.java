package com.staynest.rent.repository;

import com.staynest.rent.entity.RentPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface RentPaymentRepository extends JpaRepository<RentPayment, UUID> {
    List<RentPayment> findByInvoiceId(UUID invoiceId);
    List<RentPayment> findByTenantId(UUID tenantId);
}

