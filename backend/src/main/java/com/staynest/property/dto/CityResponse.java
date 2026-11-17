package com.staynest.property.dto;

import java.util.UUID;

public class CityResponse {
    private UUID id;
    private String name;
    private String state;

    public CityResponse() {
    }

    public CityResponse(UUID id, String name, String state) {
        this.id = id;
        this.name = name;
        this.state = state;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }
}

