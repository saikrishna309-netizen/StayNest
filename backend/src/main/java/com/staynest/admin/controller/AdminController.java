package com.staynest.admin.controller;

import com.staynest.admin.dto.AdminPropertyApprovalRequest;
import com.staynest.admin.dto.AdminSubscriptionResponse;
import com.staynest.admin.dto.AdminUserResponse;
import com.staynest.admin.entity.AuditLog;
import com.staynest.admin.service.AdminService;
import com.staynest.common.response.PageResponse;
import com.staynest.property.dto.PropertySummaryResponse;
import com.staynest.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Platform Administration", description = "Admin oversight: listing moderation, user management, subscriptions, and audit trail")
@SecurityRequirement(name = "bearerAuth")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    private final AdminService adminService;

    public AdminController(AdminService adminService) {
        this.adminService = adminService;
    }

    @GetMapping("/properties/pending")
    @Operation(summary = "Review pending property listings awaiting moderation")
    public ResponseEntity<List<PropertySummaryResponse>> getPendingProperties() {
        return ResponseEntity.ok(adminService.getPendingProperties());
    }

    @PostMapping("/properties/{id}/approve")
    @Operation(summary = "Approve and publish property listing")
    public ResponseEntity<Map<String, String>> approveProperty(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        adminService.approveProperty(user.getId(), id);
        return ResponseEntity.ok(Map.of("message", "Property approved and published"));
    }

    @PostMapping("/properties/{id}/reject")
    @Operation(summary = "Reject property listing with explanation reason")
    public ResponseEntity<Map<String, String>> rejectProperty(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @RequestBody(required = false) AdminPropertyApprovalRequest request) {
        adminService.rejectProperty(user.getId(), id, request);
        return ResponseEntity.ok(Map.of("message", "Property rejected with notes recorded"));
    }

    @GetMapping("/users")
    @Operation(summary = "User administration directory across customers, owners, and staff")
    public ResponseEntity<PageResponse<AdminUserResponse>> listUsers(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.listUsers(pageable));
    }

    @GetMapping("/subscriptions")
    @Operation(summary = "Platform-wide subscription overview and status")
    public ResponseEntity<List<AdminSubscriptionResponse>> listSubscriptions() {
        return ResponseEntity.ok(adminService.listSubscriptions());
    }

    @GetMapping("/audit-logs")
    @Operation(summary = "Audit review: administrative actions, status changes, and transactions")
    public ResponseEntity<PageResponse<AuditLog>> listAuditLogs(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(adminService.listAuditLogs(pageable));
    }
}

