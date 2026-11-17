package com.staynest.expense.repository;

import com.staynest.expense.entity.ExpenseRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface ExpenseRecordRepository extends JpaRepository<ExpenseRecord, UUID> {

    Page<ExpenseRecord> findByOwnerId(UUID ownerId, Pageable pageable);

    List<ExpenseRecord> findByOwnerIdAndTransactionDateBetween(UUID ownerId, LocalDate startDate, LocalDate endDate);

    @Query("SELECT e FROM ExpenseRecord e WHERE e.propertyId IN :propertyIds AND e.transactionDate BETWEEN :startDate AND :endDate")
    List<ExpenseRecord> findByPropertyIdsAndDateRange(@Param("propertyIds") List<UUID> propertyIds,
                                                     @Param("startDate") LocalDate startDate,
                                                     @Param("endDate") LocalDate endDate);
}

