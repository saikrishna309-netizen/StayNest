package com.staynest.payment.controller;

import com.staynest.common.response.PageResponse;
import com.staynest.payment.dto.*;
import com.staynest.payment.service.PaymentService;
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
@RequestMapping("/api/v1")
@Tag(name = "Payments & Settlements", description = "Online gateway orders, webhooks, pay-at-property records, refunds and owner collections")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping("/payments/orders")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Create gateway order for booking")
    public ResponseEntity<OrderResponse> createOrder(
            @AuthenticationPrincipal UserPrincipal user,
            @Valid @RequestBody CreateOrderRequest request) {
        return new ResponseEntity<>(paymentService.createOrder(user.getId(), request), HttpStatus.CREATED);
    }

    @GetMapping("/payments/{id}")
    @SecurityRequirement(name = "bearerAuth")
    @Operation(summary = "Get payment status")
    public ResponseEntity<PaymentResponse> getPayment(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id) {
        return ResponseEntity.ok(paymentService.getPayment(user.getId(), id));
    }

    @PostMapping("/payments/webhooks/{provider}")
    @Operation(summary = "Receive signed payment gateway webhook (e.g. Razorpay)")
    public ResponseEntity<Map<String, String>> receiveWebhook(
            @PathVariable String provider,
            @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
            @RequestBody Map<String, Object> payload) {
        paymentService.processWebhook(provider, signature, payload);
        return ResponseEntity.ok(Map.of("status", "received"));
    }

    @PostMapping("/payments/{id}/refunds")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Initiate eligible refund for a booking payment")
    public ResponseEntity<RefundResponse> initiateRefund(
            @AuthenticationPrincipal UserPrincipal user,
            @PathVariable UUID id,
            @Valid @RequestBody RefundRequest request) {
        return ResponseEntity.ok(paymentService.initiateRefund(user.getId(), id, request));
    }

    @GetMapping("/owner/payments")
    @SecurityRequirement(name = "bearerAuth")
    @PreAuthorize("hasAnyRole('OWNER', 'ADMIN')")
    @Operation(summary = "Owner payment and collection view across properties")
    public ResponseEntity<PageResponse<PaymentResponse>> listOwnerPayments(
            @AuthenticationPrincipal UserPrincipal user,
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(paymentService.listOwnerPayments(user.getId(), pageable));
    }
}

