package com.staynest.property.repository;

import com.staynest.property.entity.Locality;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LocalityRepository extends JpaRepository<Locality, UUID> {
    List<Locality> findByCityIdAndActiveTrueOrderByNameAsc(UUID cityId);
}

