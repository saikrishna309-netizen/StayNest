package com.staynest.property.dto;

import jakarta.validation.constraints.NotBlank;

public class PhotoUploadRequest {
    @NotBlank(message = "Photo URL is required")
    private String photoUrl;
    private String caption;
    private boolean isPrimary = false;
    private int displayOrder = 0;

    public PhotoUploadRequest() {
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

