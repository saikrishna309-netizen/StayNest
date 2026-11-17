package com.staynest.subscription.service;

import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.subscription.dto.CreateOwnerSubscriptionRequest;
import com.staynest.subscription.dto.OwnerSubscriptionResponse;
import com.staynest.subscription.dto.SubscriptionPlanResponse;
import com.staynest.subscription.entity.OwnerSubscription;
import com.staynest.subscription.entity.SubscriptionPlan;
import com.staynest.subscription.repository.OwnerSubscriptionRepository;
import com.staynest.subscription.repository.SubscriptionPlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final OwnerSubscriptionRepository ownerSubscriptionRepository;

    public SubscriptionService(SubscriptionPlanRepository subscriptionPlanRepository,
                               OwnerSubscriptionRepository ownerSubscriptionRepository) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.ownerSubscriptionRepository = ownerSubscriptionRepository;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> listPlans() {
        return subscriptionPlanRepository.findByActiveTrue().stream()
                .map(SubscriptionPlanResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public OwnerSubscriptionResponse createOrChangeSubscription(UUID ownerId, CreateOwnerSubscriptionRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findById(request.getPlanId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription Plan", request.getPlanId()));

        LocalDate start = LocalDate.now();
        LocalDate end = start.plusMonths(1);

        OwnerSubscription sub = new OwnerSubscription(ownerId, plan.getId(), start, end);
        sub.setAutoRenew(request.isAutoRenew());
        sub.setStatus("ACTIVE");

        sub = ownerSubscriptionRepository.save(sub);
        return OwnerSubscriptionResponse.from(sub, plan);
    }

    @Transactional(readOnly = true)
    public OwnerSubscriptionResponse getCurrentSubscription(UUID ownerId) {
        OwnerSubscription sub = ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("No active subscription found for owner: " + ownerId));

        SubscriptionPlan plan = subscriptionPlanRepository.findById(sub.getPlanId()).orElse(null);
        return OwnerSubscriptionResponse.from(sub, plan);
    }

    @Transactional
    public void handleSubscriptionWebhook(String provider, Map<String, Object> payload) {
        log.info("Processing subscription webhook from provider: {}", provider);
        // Process subscription charge/renewal event
    }
}

