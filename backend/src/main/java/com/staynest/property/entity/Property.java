package com.staynest.property.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "properties")
public class Property {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private PropertyType propertyType = PropertyType.PG;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private GenderPolicy genderPolicy = GenderPolicy.CO_ED;

    @Column(length = 2000)
    private String description;

    // Address & Location fields
    @Column(nullable = false)
    private UUID cityId;

    private UUID localityId;
    private String addressLine;
    private String pincode;
    private Double latitude;
    private Double longitude;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ApprovalStatus approvalStatus = ApprovalStatus.DRAFT;

    private String rejectionReason;

    @Column(nullable = false)
    private boolean published = false;

    // Pricing & Policies (all money in paise)
    private Long startingPricePaise = 0L;
    private int noticePeriodDays = 30;
    private int depositMonths = 1;
    private boolean foodIncluded = false;
    private boolean payAtPropertyAllowed = true;

    @Column(length = 2000)
    private String rules;

    @Column(length = 2000)
    private String cancellationPolicy = "Standard 15-day prior notice cancellation policy";

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "property_amenities", joinColumns = @JoinColumn(name = "property_id"))
    @Column(name = "amenity_code")
    private List<String> amenities = new ArrayList<>();

    private Instant publishedAt;

    @Column(nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(nullable = false)
    private Instant updatedAt = Instant.now();

    public Property() {
    }

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(UUID ownerId) {
        this.ownerId = ownerId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public PropertyType getPropertyType() {
        return propertyType;
    }

    public void setPropertyType(PropertyType propertyType) {
        this.propertyType = propertyType;
    }

    public GenderPolicy getGenderPolicy() {
        return genderPolicy;
    }

    public void setGenderPolicy(GenderPolicy genderPolicy) {
        this.genderPolicy = genderPolicy;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public UUID getCityId() {
        return cityId;
    }

    public void setCityId(UUID cityId) {
        this.cityId = cityId;
    }

    public UUID getLocalityId() {
        return localityId;
    }

    public void setLocalityId(UUID localityId) {
        this.localityId = localityId;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getPincode() {
        return pincode;
    }

    public void setPincode(String pincode) {
        this.pincode = pincode;
    }

    public Double getLatitude() {
        return latitude;
    }

    public void setLatitude(Double latitude) {
        this.latitude = latitude;
    }

    public Double getLongitude() {
        return longitude;
    }

    public void setLongitude(Double longitude) {
        this.longitude = longitude;
    }

    public ApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(ApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }

    public boolean isPublished() {
        return published;
    }

    public void setPublished(boolean published) {
        this.published = published;
    }

    public Long getStartingPricePaise() {
        return startingPricePaise;
    }

    public void setStartingPricePaise(Long startingPricePaise) {
        this.startingPricePaise = startingPricePaise;
    }

    public int getNoticePeriodDays() {
        return noticePeriodDays;
    }

    public void setNoticePeriodDays(int noticePeriodDays) {
        this.noticePeriodDays = noticePeriodDays;
    }

    public int getDepositMonths() {
        return depositMonths;
    }

    public void setDepositMonths(int depositMonths) {
        this.depositMonths = depositMonths;
    }

    public boolean isFoodIncluded() {
        return foodIncluded;
    }

    public void setFoodIncluded(boolean foodIncluded) {
        this.foodIncluded = foodIncluded;
    }

    public boolean isPayAtPropertyAllowed() {
        return payAtPropertyAllowed;
    }

    public void setPayAtPropertyAllowed(boolean payAtPropertyAllowed) {
        this.payAtPropertyAllowed = payAtPropertyAllowed;
    }

    public String getRules() {
        return rules;
    }

    public void setRules(String rules) {
        this.rules = rules;
    }

    public String getCancellationPolicy() {
        return cancellationPolicy;
    }

    public void setCancellationPolicy(String cancellationPolicy) {
        this.cancellationPolicy = cancellationPolicy;
    }

    public List<String> getAmenities() {
        return amenities;
    }

    public void setAmenities(List<String> amenities) {
        this.amenities = amenities;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}

