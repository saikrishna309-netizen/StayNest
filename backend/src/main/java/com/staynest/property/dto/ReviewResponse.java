package com.staynest.property.dto;

import com.staynest.property.entity.Review;

import java.time.Instant;
import java.util.UUID;

public class ReviewResponse {
    private UUID id;
    private UUID propertyId;
    private UUID customerId;
    private int rating;
    private String comment;
    private Instant createdAt;

    public ReviewResponse() {
    }

    public static ReviewResponse from(Review r) {
        ReviewResponse res = new ReviewResponse();
        res.setId(r.getId());
        res.setPropertyId(r.getPropertyId());
        res.setCustomerId(r.getCustomerId());
        res.setRating(r.getRating());
        res.setComment(r.getComment());
        res.setCreatedAt(r.getCreatedAt());
        return res;
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

    public UUID getCustomerId() {
        return customerId;
    }

    public void setCustomerId(UUID customerId) {
        this.customerId = customerId;
    }

    public int getRating() {
        return rating;
    }

    public void setRating(int rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}

