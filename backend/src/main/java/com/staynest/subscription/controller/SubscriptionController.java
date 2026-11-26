package com.staynest.subscription.controller;

import com.staynest.security.UserPrincipal;
import com.staynest.subscription.dto.CreateOwnerSubscriptionRequest;
import com.staynest.subscription.dto.OwnerSubscriptionResponse;
import com.staynest.subscription.dto.SubscriptionPlanResponse;
import com.staynest.subscription.service.SubscriptionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@Tag(name = "Owner Subscriptions", description = "SaaS subscription plans, active plan management, and provider webhooks")
public class SubscriptionController {

    private final SubscriptionService subscriptionService;

    public SubscriptionController(SubscriptionService subscriptionService) {
        this.subscriptionService = subscriptionService;
    }

    @GetMapping("/subscription-plans")
    @Operation(summary = "List available SaaS subscription tiers (Starter, Growth, Business)")
    public ResponseEntity<List<SubscriptionPlanResponse>> listPlans() {
        return ResponseEntity.ok(subscriptionService.listPlans());
    }

    @PostMapping("/owner/subscriptions")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Start or change owner subscription plan")
    public ResponseEntity<OwnerSubscriptionResponse> startSubscription(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateOwnerSubscriptionRequest request) {
        return new ResponseEntity<>(subscriptionService.createOrChangeSubscription(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/owner/subscription")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Read owner's current active subscription and entitlements")
    public ResponseEntity<OwnerSubscriptionResponse> getMySubscription(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(subscriptionService.getCurrentSubscription(user.getId()));
    }

    @PostMapping("/subscriptions/create-mandate")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Create a PENDING Razorpay UPI AutoPay mandate (1-Month Free Trial, ₹149/mo after)")
    public ResponseEntity<Map<String, Object>> createAutoPayMandate(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody(required = false) Map<String, String> body) {
        String preferredApp = body != null ? body.get("preferredApp") : "GPAY";
        return ResponseEntity.ok(subscriptionService.createAutoPayMandate(user.getId(), preferredApp));
    }

    @PostMapping("/subscriptions/verify-mandate")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Verify Razorpay UPI AutoPay mandate authorization and activate PRO_TRIAL")
    public ResponseEntity<Map<String, Object>> verifyAutoPayMandate(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestBody(required = false) Map<String, String> body) {
        String subscriptionId = body != null ? body.get("subscriptionId") : null;
        String paymentId = body != null ? body.get("razorpayPaymentId") : null;
        String signature = body != null ? body.get("razorpaySignature") : null;
        return ResponseEntity.ok(subscriptionService.verifyMandate(user.getId(), subscriptionId, paymentId, signature));
    }

    @PostMapping("/subscriptions/cancel-autopay")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Cancel recurring UPI AutoPay mandate at period end")
    public ResponseEntity<Map<String, Object>> cancelAutoPay(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(subscriptionService.cancelAutoPay(user.getId()));
    }

    @PostMapping("/webhooks/subscription")
    @Operation(summary = "Process Razorpay/Cashfree/PhonePe UPI AutoPay subscription webhook")
    public ResponseEntity<Map<String, String>> processUnifiedWebhook(
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestBody String rawBody) {
        subscriptionService.handleSubscriptionWebhook("razorpay", signature, rawBody, null);
        return ResponseEntity.ok(Map.of("status", "processed"));
    }

    @PostMapping("/subscriptions/webhooks/{provider}")
    @Operation(summary = "Process subscription recurring billing provider webhook events")
    public ResponseEntity<Map<String, String>> processSubscriptionWebhook(
            @PathVariable String provider,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestBody String rawBody) {
        subscriptionService.handleSubscriptionWebhook(provider, signature, rawBody, null);
        return ResponseEntity.ok(Map.of("status", "processed"));
    }
}

