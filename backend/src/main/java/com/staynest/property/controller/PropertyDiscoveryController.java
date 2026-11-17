package com.staynest.property.controller;

import com.staynest.common.response.PageResponse;
import com.staynest.property.dto.*;
import com.staynest.property.entity.GenderPolicy;
import com.staynest.property.service.PropertyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Property Discovery", description = "Public endpoints for exploring cities, localities, PG listings, availability, and reviews")
public class PropertyDiscoveryController {

    private final PropertyService propertyService;

    public PropertyDiscoveryController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @GetMapping("/cities")
    @Operation(summary = "List supported cities in India")
    public ResponseEntity<List<CityResponse>> getCities() {
        return ResponseEntity.ok(propertyService.getCities());
    }

    @GetMapping("/localities")
    @Operation(summary = "List localities for a city")
    public ResponseEntity<List<LocalityResponse>> getLocalities(@RequestParam UUID cityId) {
        return ResponseEntity.ok(propertyService.getLocalities(cityId));
    }

    @GetMapping("/properties")
    @Operation(summary = "Search and filter published PG/Hostel properties")
    public ResponseEntity<PageResponse<PropertySummaryResponse>> searchProperties(
            @RequestParam(required = false) UUID cityId,
            @RequestParam(required = false) UUID localityId,
            @RequestParam(required = false) GenderPolicy genderPolicy,
            @RequestParam(required = false) Long minRent,
            @RequestParam(required = false) Long maxRent,
            @RequestParam(required = false) Boolean foodIncluded,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {

        return ResponseEntity.ok(propertyService.searchProperties(
                cityId, localityId, genderPolicy, minRent, maxRent, foodIncluded, q, pageable));
    }

    @GetMapping("/properties/{propertyId}")
    @Operation(summary = "Get published property details by ID")
    public ResponseEntity<PropertyDetailResponse> getProperty(@PathVariable UUID propertyId) {
        return ResponseEntity.ok(propertyService.getPublishedProperty(propertyId));
    }

    @GetMapping("/properties/{propertyId}/availability")
    @Operation(summary = "Check bed availability for date range")
    public ResponseEntity<List<BedAvailabilityResponse>> checkAvailability(
            @PathVariable UUID propertyId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkIn,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate checkOut) {

        return ResponseEntity.ok(propertyService.checkAvailability(propertyId, checkIn, checkOut));
    }

    @GetMapping("/properties/{propertyId}/reviews")
    @Operation(summary = "Get verified reviews for property")
    public ResponseEntity<List<ReviewResponse>> getReviews(@PathVariable UUID propertyId) {
        return ResponseEntity.ok(propertyService.getReviews(propertyId));
    }
}

