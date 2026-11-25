package com.staynest.subscription.repository;

import com.staynest.subscription.entity.OwnerSubscription;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface OwnerSubscriptionRepository extends JpaRepository<OwnerSubscription, UUID> {
    Optional<OwnerSubscription> findTopByOwnerIdOrderByCreatedAtDesc(UUID ownerId);
    Optional<OwnerSubscription> findByGatewaySubscriptionId(String gatewaySubscriptionId);
    List<OwnerSubscription> findByOwnerId(UUID ownerId);
}

