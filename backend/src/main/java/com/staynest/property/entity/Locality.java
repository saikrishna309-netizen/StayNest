package com.staynest.property.entity;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "localities")
public class Locality {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private UUID cityId;

    @Column(nullable = false)
    private String name;

    private String pincode;

    @Column(nullable = false)
    private boolean active = true;

    public Locality() {
    }

    public Locality(UUID cityId, String name, String pincode) {
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

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }
}

