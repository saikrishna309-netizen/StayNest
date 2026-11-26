package com.staynest.property.dto;

import com.staynest.property.entity.GenderPolicy;
import com.staynest.property.entity.PropertyType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public class CreatePropertyRequest {

    @NotBlank(message = "Property name is required")
    @Size(min = 3, max = 150)
    private String name;

    @NotNull(message = "Property type is required")
    private PropertyType propertyType = PropertyType.PG;

    @NotNull(message = "Gender policy is required")
    private GenderPolicy genderPolicy = GenderPolicy.CO_ED;

    private String description;

    @NotNull(message = "City ID is required")
    private UUID cityId;

    private UUID localityId;
    private String addressLine;
    private String pincode;
    private Double latitude;
    private Double longitude;

    private Long startingPricePaise = 0L;
    private int noticePeriodDays = 30;
    private int depositMonths = 1;
    private boolean foodIncluded = false;
    private boolean payAtPropertyAllowed = true;
    private String rules;
    private String cancellationPolicy;
    private List<String> amenities;
    private List<FloorInput> floors;

    public static class FloorInput {
        private Integer floorNumber;
        private List<RoomInput> rooms;

        public Integer getFloorNumber() { return floorNumber; }
        public void setFloorNumber(Integer floorNumber) { this.floorNumber = floorNumber; }
        public List<RoomInput> getRooms() { return rooms; }
        public void setRooms(List<RoomInput> rooms) { this.rooms = rooms; }
    }

    public static class RoomInput {
        private String roomNumber;
        private String sharingType;
        private Integer capacity;
        private Long rentRupees;
        private Long depositRupees;
        private Long rentMonthlyPaise;
        private Long depositPaise;
        private List<BedInput> beds;

        public String getRoomNumber() { return roomNumber; }
        public void setRoomNumber(String roomNumber) { this.roomNumber = roomNumber; }
        public String getSharingType() { return sharingType; }
        public void setSharingType(String sharingType) { this.sharingType = sharingType; }
        public Integer getCapacity() { return capacity; }
        public void setCapacity(Integer capacity) { this.capacity = capacity; }
        public Long getRentRupees() { return rentRupees; }
        public void setRentRupees(Long rentRupees) { this.rentRupees = rentRupees; }
        public Long getDepositRupees() { return depositRupees; }
        public void setDepositRupees(Long depositRupees) { this.depositRupees = depositRupees; }
        public Long getRentMonthlyPaise() { return rentMonthlyPaise; }
        public void setRentMonthlyPaise(Long rentMonthlyPaise) { this.rentMonthlyPaise = rentMonthlyPaise; }
        public Long getDepositPaise() { return depositPaise; }
        public void setDepositPaise(Long depositPaise) { this.depositPaise = depositPaise; }
        public List<BedInput> getBeds() { return beds; }
        public void setBeds(List<BedInput> beds) { this.beds = beds; }
    }

    public static class BedInput {
        private String bedLabel;
        public String getBedLabel() { return bedLabel; }
        public void setBedLabel(String bedLabel) { this.bedLabel = bedLabel; }
    }

    public CreatePropertyRequest() {
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

    public List<FloorInput> getFloors() {
        return floors;
    }

    public void setFloors(List<FloorInput> floors) {
        this.floors = floors;
    }
}

