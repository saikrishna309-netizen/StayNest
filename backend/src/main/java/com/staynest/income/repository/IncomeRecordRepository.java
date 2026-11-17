package com.staynest.income.repository;

import com.staynest.income.entity.IncomeRecord;
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
public interface IncomeRecordRepository extends JpaRepository<IncomeRecord, UUID> {

    Page<IncomeRecord> findByOwnerId(UUID ownerId, Pageable pageable);

    List<IncomeRecord> findByOwnerIdAndTransactionDateBetween(UUID ownerId, LocalDate startDate, LocalDate endDate);

    @Query("SELECT i FROM IncomeRecord i WHERE i.propertyId IN :propertyIds AND i.transactionDate BETWEEN :startDate AND :endDate")
    List<IncomeRecord> findByPropertyIdsAndDateRange(@Param("propertyIds") List<UUID> propertyIds,
                                                    @Param("startDate") LocalDate startDate,
                                                    @Param("endDate") LocalDate endDate);
}

