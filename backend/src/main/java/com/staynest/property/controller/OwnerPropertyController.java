package com.staynest.property.controller;

import com.staynest.common.response.PageResponse;
import com.staynest.property.dto.*;
import com.staynest.property.service.PropertyService;
import com.staynest.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/owner/properties")
@Tag(name = "Owner Properties", description = "Property onboarding, editing, submission, photos, and rate management for PG owners")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class OwnerPropertyController {

    private final PropertyService propertyService;

    public OwnerPropertyController(PropertyService propertyService) {
        this.propertyService = propertyService;
    }

    @PostMapping
    @Operation(summary = "Create draft property listing")
    public ResponseEntity<PropertyDetailResponse> createProperty(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreatePropertyRequest request) {
        return new ResponseEntity<>(propertyService.createDraftProperty(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping
    @Operation(summary = "List all properties owned by current user")
    public ResponseEntity<PageResponse<PropertySummaryResponse>> listMyProperties(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(propertyService.listOwnerProperties(user.getId(), pageable));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get detailed property record owned by current user")
    public ResponseEntity<PropertyDetailResponse> getMyProperty(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(propertyService.getOwnerProperty(user.getId(), id));
    }

    @PatchMapping("/{id}")
    @Operation(summary = "Update property details")
    public ResponseEntity<PropertyDetailResponse> updateProperty(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody UpdatePropertyRequest request) {
        return ResponseEntity.ok(propertyService.updateOwnerProperty(user.getId(), id, request));
    }

    @PostMapping("/{id}/submit")
    @Operation(summary = "Submit draft property for platform admin approval")
    public ResponseEntity<PropertyDetailResponse> submitForApproval(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(propertyService.submitForApproval(user.getId(), id));
    }

    @PostMapping("/{id}/photos")
    @Operation(summary = "Upload photo metadata / signed photo record")
    public ResponseEntity<PropertyPhotoResponse> uploadPhoto(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody PhotoUploadRequest request) {
        return new ResponseEntity<>(propertyService.addPhoto(user.getId(), id, request), HttpStatus.CREATED);
    }

    @PutMapping("/{id}/rates")
    @Operation(summary = "Set rate rules for property or specific room")
    public ResponseEntity<Map<String, String>> setRates(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody RateRuleRequest request) {
        propertyService.setRates(user.getId(), id, request);
        return ResponseEntity.ok(Map.of("message", "Rates updated successfully"));
    }

    @PutMapping("/{id}/availability")
    @Operation(summary = "Update bed availability status")
    public ResponseEntity<Map<String, String>> updateAvailability(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAvailabilityRequest request) {
        propertyService.updateAvailability(user.getId(), id, request);
        return ResponseEntity.ok(Map.of("message", "Availability updated successfully"));
    }
}

