package com.staynest.property.dto;

import com.staynest.property.entity.ApprovalStatus;
import com.staynest.property.entity.GenderPolicy;
import com.staynest.property.entity.Property;
import com.staynest.property.entity.PropertyType;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PropertyDetailResponse {
    private UUID id;
    private UUID ownerId;
    private String name;
    private PropertyType propertyType;
    private GenderPolicy genderPolicy;
    private String description;
    private UUID cityId;
    private String cityName;
    private UUID localityId;
    private String localityName;
    private String addressLine;
    private String pincode;
    private Double latitude;
    private Double longitude;
    private ApprovalStatus approvalStatus;
    private boolean published;
    private Long startingPricePaise;
    private int noticePeriodDays;
    private int depositMonths;
    private boolean foodIncluded;
    private boolean payAtPropertyAllowed;
    private String rules;
    private String cancellationPolicy;
    private List<String> amenities = new ArrayList<>();
    private List<PropertyPhotoResponse> photos = new ArrayList<>();
    private List<RoomDetailDto> rooms = new ArrayList<>();
    private Instant publishedAt;
    private Instant createdAt;

    public PropertyDetailResponse() {
    }

    public static class RoomDetailDto {
        private UUID id;
        private String roomNumber;
        private String sharingType;
        private int capacity;
        private int floorNumber;
        private Long rentMonthlyPaise;
        private Long depositPaise;
        private String status;
        private List<BedDetailDto> beds = new ArrayList<>();

        public RoomDetailDto() {
        }

        public UUID getId() {
            return id;
        }

        public void setId(UUID id) {
            this.id = id;
        }

        public String getRoomNumber() {
            return roomNumber;
        }

        public void setRoomNumber(String roomNumber) {
            this.roomNumber = roomNumber;
        }

        public String getSharingType() {
            return sharingType;
        }

        public void setSharingType(String sharingType) {
            this.sharingType = sharingType;
        }

        public int getCapacity() {
            return capacity;
        }

        public void setCapacity(int capacity) {
            this.capacity = capacity;
        }

        public int getFloorNumber() {
            return floorNumber;
        }

        public void setFloorNumber(int floorNumber) {
            this.floorNumber = floorNumber;
        }

        public Long getRentMonthlyPaise() {
            return rentMonthlyPaise;
        }

        public void setRentMonthlyPaise(Long rentMonthlyPaise) {
            this.rentMonthlyPaise = rentMonthlyPaise;
        }

        public Long getDepositPaise() {
            return depositPaise;
        }

        public void setDepositPaise(Long depositPaise) {
            this.depositPaise = depositPaise;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public List<BedDetailDto> getBeds() {
            return beds;
        }

        public void setBeds(List<BedDetailDto> beds) {
            this.beds = beds;
        }
    }

    public static class BedDetailDto {
        private UUID id;
        private String bedLabel;
        private boolean active;
        private String status;

        public BedDetailDto() {
        }

        public BedDetailDto(UUID id, String bedLabel, boolean active, String status) {
            this.id = id;
            this.bedLabel = bedLabel;
            this.active = active;
            this.status = status;
        }

        public UUID getId() {
            return id;
        }

        public void setId(UUID id) {
            this.id = id;
        }

        public String getBedLabel() {
            return bedLabel;
        }

        public void setBedLabel(String bedLabel) {
            this.bedLabel = bedLabel;
        }

        public boolean isActive() {
            return active;
        }

        public void setActive(boolean active) {
            this.active = active;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
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

    public List<PropertyPhotoResponse> getPhotos() {
        return photos;
    }

    public void setPhotos(List<PropertyPhotoResponse> photos) {
        this.photos = photos;
    }

    public List<RoomDetailDto> getRooms() {
        return rooms;
    }

    public void setRooms(List<RoomDetailDto> rooms) {
        this.rooms = rooms;
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
}

