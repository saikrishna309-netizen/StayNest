package com.staynest.room.controller;

import com.staynest.bed.dto.BedResponse;
import com.staynest.bed.dto.CreateBedRequest;
import com.staynest.bed.dto.UpdateBedRequest;
import com.staynest.room.dto.CreateRoomRequest;
import com.staynest.room.dto.RoomResponse;
import com.staynest.room.dto.UpdateRoomRequest;
import com.staynest.room.service.RoomBedService;
import com.staynest.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/owner")
@Tag(name = "Owner Rooms & Beds", description = "Room and bed inventory management for PG properties")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
public class OwnerRoomBedController {

    private final RoomBedService roomBedService;

    public OwnerRoomBedController(RoomBedService roomBedService) {
        this.roomBedService = roomBedService;
    }

    @PostMapping("/properties/{id}/rooms")
    @Operation(summary = "Create room under property")
    public ResponseEntity<RoomResponse> createRoom(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody CreateRoomRequest request) {
        return new ResponseEntity<>(roomBedService.createRoom(user.getId(), id, request), HttpStatus.CREATED);
    }

    @PatchMapping("/rooms/{roomId}")
    @Operation(summary = "Update room details")
    public ResponseEntity<RoomResponse> updateRoom(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID roomId,
            @Valid @RequestBody UpdateRoomRequest request) {
        return ResponseEntity.ok(roomBedService.updateRoom(user.getId(), roomId, request));
    }

    @PostMapping("/rooms/{roomId}/beds")
    @Operation(summary = "Create bed inventory inside room")
    public ResponseEntity<BedResponse> createBed(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID roomId,
            @Valid @RequestBody CreateBedRequest request) {
        return new ResponseEntity<>(roomBedService.createBed(user.getId(), roomId, request), HttpStatus.CREATED);
    }

    @PatchMapping("/beds/{bedId}")
    @Operation(summary = "Update bed status or label")
    public ResponseEntity<BedResponse> updateBed(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID bedId,
            @Valid @RequestBody UpdateBedRequest request) {
        return ResponseEntity.ok(roomBedService.updateBed(user.getId(), bedId, request));
    }
}

