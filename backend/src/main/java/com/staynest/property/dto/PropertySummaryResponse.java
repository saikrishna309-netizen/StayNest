package com.staynest.property.dto;

import com.staynest.property.entity.ApprovalStatus;
import com.staynest.property.entity.GenderPolicy;
import com.staynest.property.entity.Property;
import com.staynest.property.entity.PropertyType;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class PropertySummaryResponse {
    private UUID id;
    private UUID ownerId;
    private String name;
    private PropertyType propertyType;
    private GenderPolicy genderPolicy;
    private UUID cityId;
    private String cityName;
    private UUID localityId;
    private String localityName;
    private String addressLine;
    private String primaryPhotoUrl;
    private Long startingPricePaise;
    private boolean foodIncluded;
    private ApprovalStatus approvalStatus;
    private boolean published;
    private List<String> amenities;
    private Instant createdAt;

    public PropertySummaryResponse() {
    }

    public static PropertySummaryResponse from(Property p, String cityName, String localityName, String primaryPhotoUrl) {
        PropertySummaryResponse res = new PropertySummaryResponse();
        res.setId(p.getId());
        res.setOwnerId(p.getOwnerId());
        res.setName(p.getName());
        res.setPropertyType(p.getPropertyType());
        res.setGenderPolicy(p.getGenderPolicy());
        res.setCityId(p.getCityId());
        res.setCityName(cityName);
        res.setLocalityId(p.getLocalityId());
        res.setLocalityName(localityName);
        res.setAddressLine(p.getAddressLine());
        res.setPrimaryPhotoUrl(primaryPhotoUrl);
        res.setStartingPricePaise(p.getStartingPricePaise());
        res.setFoodIncluded(p.isFoodIncluded());
        res.setApprovalStatus(p.getApprovalStatus());
        res.setPublished(p.isPublished());
        res.setAmenities(p.getAmenities());
        res.setCreatedAt(p.getCreatedAt());
        return res;
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

    public UUID getCityId() {
        return cityId;
    }

    public void setCityId(UUID cityId) {
        this.cityId = cityId;
    }

    public String getCityName() {
        return cityName;
    }

    public void setCityName(String cityName) {
        this.cityName = cityName;
    }

    public UUID getLocalityId() {
        return localityId;
    }

    public void setLocalityId(UUID localityId) {
        this.localityId = localityId;
    }

    public String getLocalityName() {
        return localityName;
    }

    public void setLocalityName(String localityName) {
        this.localityName = localityName;
    }

    public String getAddressLine() {
        return addressLine;
    }

    public void setAddressLine(String addressLine) {
        this.addressLine = addressLine;
    }

    public String getPrimaryPhotoUrl() {
        return primaryPhotoUrl;
    }

    public void setPrimaryPhotoUrl(String primaryPhotoUrl) {
        this.primaryPhotoUrl = primaryPhotoUrl;
    }

    public Long getStartingPricePaise() {
        return startingPricePaise;
    }

    public void setStartingPricePaise(Long startingPricePaise) {
        this.startingPricePaise = startingPricePaise;
    }

    public boolean isFoodIncluded() {
        return foodIncluded;
    }

    public void setFoodIncluded(boolean foodIncluded) {
        this.foodIncluded = foodIncluded;
    }

    public ApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(ApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public boolean isPublished() {
        return published;
    }

    public void setPublished(boolean published) {
        this.published = published;
    }

    public List<String> getAmenities() {
        return amenities;
    }

    public void setAmenities(List<String> amenities) {
        this.amenities = amenities;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

