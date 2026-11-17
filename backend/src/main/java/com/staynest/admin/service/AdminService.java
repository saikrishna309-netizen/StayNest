package com.staynest.admin.service;

import com.staynest.admin.dto.AdminPropertyApprovalRequest;
import com.staynest.admin.dto.AdminSubscriptionResponse;
import com.staynest.admin.dto.AdminUserResponse;
import com.staynest.admin.entity.AuditLog;
import com.staynest.admin.repository.AuditLogRepository;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.response.PageResponse;
import com.staynest.property.dto.PropertyDetailResponse;
import com.staynest.property.dto.PropertySummaryResponse;
import com.staynest.property.entity.ApprovalStatus;
import com.staynest.property.entity.City;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.CityRepository;
import com.staynest.property.repository.LocalityRepository;
import com.staynest.property.repository.PropertyPhotoRepository;
import com.staynest.property.repository.PropertyRepository;
import com.staynest.subscription.entity.OwnerSubscription;
import com.staynest.subscription.entity.SubscriptionPlan;
import com.staynest.subscription.repository.OwnerSubscriptionRepository;
import com.staynest.subscription.repository.SubscriptionPlanRepository;
import com.staynest.user.entity.User;
import com.staynest.user.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AdminService {

    private final PropertyRepository propertyRepository;
    private final CityRepository cityRepository;
    private final LocalityRepository localityRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final UserRepository userRepository;
    private final OwnerSubscriptionRepository ownerSubscriptionRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final AuditLogRepository auditLogRepository;

    public AdminService(PropertyRepository propertyRepository,
                        CityRepository cityRepository,
                        LocalityRepository localityRepository,
                        PropertyPhotoRepository propertyPhotoRepository,
                        UserRepository userRepository,
                        OwnerSubscriptionRepository ownerSubscriptionRepository,
                        SubscriptionPlanRepository subscriptionPlanRepository,
                        AuditLogRepository auditLogRepository) {
        this.propertyRepository = propertyRepository;
        this.cityRepository = cityRepository;
        this.localityRepository = localityRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.userRepository = userRepository;
        this.ownerSubscriptionRepository = ownerSubscriptionRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<PropertySummaryResponse> getPendingProperties() {
        List<Property> pending = propertyRepository.findByApprovalStatus(ApprovalStatus.SUBMITTED);
        return pending.stream().map(p -> {
            String cityName = cityRepository.findById(p.getCityId()).map(City::getName).orElse(null);
            return PropertySummaryResponse.from(p, cityName, null, null);
        }).collect(Collectors.toList());
    }

    @Transactional
    public void approveProperty(UUID adminId, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        property.setApprovalStatus(ApprovalStatus.APPROVED);
        property.setPublished(true);
        property.setPublishedAt(Instant.now());
        propertyRepository.save(property);

        auditLogRepository.save(new AuditLog(adminId, "PROPERTY_APPROVED", "Property", propertyId, "Property approved and published"));
    }

    @Transactional
    public void rejectProperty(UUID adminId, UUID propertyId, AdminPropertyApprovalRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        property.setApprovalStatus(ApprovalStatus.REJECTED);
        property.setPublished(false);
        property.setRejectionReason(request != null ? request.getReason() : "Submission does not meet quality standards");
        propertyRepository.save(property);

        auditLogRepository.save(new AuditLog(adminId, "PROPERTY_REJECTED", "Property", propertyId, property.getRejectionReason()));
    }

    @Transactional(readOnly = true)
    public PageResponse<AdminUserResponse> listUsers(Pageable pageable) {
        Page<User> page = userRepository.findAll(pageable);
        List<AdminUserResponse> dtos = page.getContent().stream()
                .map(AdminUserResponse::from)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public List<AdminSubscriptionResponse> listSubscriptions() {
        List<OwnerSubscription> subs = ownerSubscriptionRepository.findAll();
        return subs.stream().map(sub -> {
            SubscriptionPlan plan = subscriptionPlanRepository.findById(sub.getPlanId()).orElse(null);
            return AdminSubscriptionResponse.from(sub, plan);
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PageResponse<AuditLog> listAuditLogs(Pageable pageable) {
        Page<AuditLog> page = auditLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return PageResponse.of(page);
    }
}

