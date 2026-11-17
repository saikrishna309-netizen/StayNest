package com.staynest.property.dto;

import com.staynest.property.entity.PropertyPhoto;

import java.util.UUID;

public class PropertyPhotoResponse {
    private UUID id;
    private UUID propertyId;
    private String photoUrl;
    private String caption;
    private boolean isPrimary;
    private int displayOrder;

    public PropertyPhotoResponse() {
    }

    public static PropertyPhotoResponse from(PropertyPhoto photo) {
        PropertyPhotoResponse r = new PropertyPhotoResponse();
        r.setId(photo.getId());
        r.setPropertyId(photo.getPropertyId());
        r.setPhotoUrl(photo.getPhotoUrl());
        r.setCaption(photo.getCaption());
        r.setPrimary(photo.isPrimary());
        r.setDisplayOrder(photo.getDisplayOrder());
        return r;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getPropertyId() {
        return propertyId;
    }

    public void setPropertyId(UUID propertyId) {
        this.propertyId = propertyId;
    }

    public String getPhotoUrl() {
        return photoUrl;
    }

    public void setPhotoUrl(String photoUrl) {
        this.photoUrl = photoUrl;
    }

    public String getCaption() {
        return caption;
    }

    public void setCaption(String caption) {
        this.caption = caption;
    }

    public boolean isPrimary() {
        return isPrimary;
    }

    public void setPrimary(boolean primary) {
        isPrimary = primary;
    }

    public int getDisplayOrder() {
        return displayOrder;
    }

    public void setDisplayOrder(int displayOrder) {
        this.displayOrder = displayOrder;
    }
}

