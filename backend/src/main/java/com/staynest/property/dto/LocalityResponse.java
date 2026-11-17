package com.staynest.property.dto;

import java.util.UUID;

public class LocalityResponse {
    private UUID id;
    private UUID cityId;
    private String name;
    private String pincode;

    public LocalityResponse() {
    }

    public LocalityResponse(UUID id, UUID cityId, String name, String pincode) {
        this.id = id;
        this.cityId = cityId;
        this.name = name;
        this.pincode = pincode;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getCityId() {
        return cityId;
    }

    public void setCityId(UUID cityId) {
        this.cityId = cityId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getPincode() {
        return pincode;
    }

    public void setPincode(String pincode) {
        this.pincode = pincode;
    }
}

