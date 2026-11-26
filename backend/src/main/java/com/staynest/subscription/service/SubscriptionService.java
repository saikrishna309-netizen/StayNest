package com.staynest.subscription.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.subscription.dto.CreateOwnerSubscriptionRequest;
import com.staynest.subscription.dto.OwnerSubscriptionResponse;
import com.staynest.subscription.dto.SubscriptionPlanResponse;
import com.staynest.subscription.entity.OwnerSubscription;
import com.staynest.subscription.entity.SubscriptionPlan;
import com.staynest.subscription.repository.OwnerSubscriptionRepository;
import com.staynest.subscription.repository.SubscriptionPlanRepository;
import com.staynest.user.entity.User;
import com.staynest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);
    private static final String RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

    @Value("${staynest.subscription.merchant-upi-id:staynest.subscription@okaxis}")
    private String merchantUpiId;

    @Value("${staynest.subscription.razorpay-key-id:}")
    private String razorpayKeyId;

    @Value("${staynest.subscription.razorpay-key-secret:}")
    private String razorpayKeySecret;

    @Value("${staynest.subscription.razorpay-plan-id:}")
    private String razorpayPlanId;

    @Value("${staynest.subscription.razorpay-webhook-secret:}")
    private String razorpayWebhookSecret;

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final OwnerSubscriptionRepository ownerSubscriptionRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public SubscriptionService(SubscriptionPlanRepository subscriptionPlanRepository,
                               OwnerSubscriptionRepository ownerSubscriptionRepository,
                               UserRepository userRepository,
                               ObjectMapper objectMapper) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.ownerSubscriptionRepository = ownerSubscriptionRepository;
        this.userRepository = userRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPlanResponse> listPlans() {
        return subscriptionPlanRepository.findByActiveTrue().stream()
                .map(SubscriptionPlanResponse::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public OwnerSubscriptionResponse createOrChangeSubscription(UUID ownerId, CreateOwnerSubscriptionRequest request) {
        SubscriptionPlan plan = subscriptionPlanRepository.findById(request.getPlanId())
                .orElseThrow(() -> new ResourceNotFoundException("Subscription Plan", request.getPlanId()));

        LocalDate start = LocalDate.now();
        LocalDate end = start.plusMonths(1);

        OwnerSubscription sub = new OwnerSubscription(ownerId, plan.getId(), start, end);
        sub.setAutoRenew(request.isAutoRenew());
        sub.setStatus("ACTIVE");

        sub = ownerSubscriptionRepository.save(sub);
        return OwnerSubscriptionResponse.from(sub, plan);
    }

    private LocalDate resolveAccountCreatedDate(UUID ownerId) {
        return userRepository.findById(ownerId)
                .map(User::getCreatedAt)
                .map(inst -> inst.atZone(ZoneId.systemDefault()).toLocalDate())
                .orElse(LocalDate.now());
    }

    @Transactional(readOnly = true)
    public OwnerSubscriptionResponse getCurrentSubscription(UUID ownerId) {
        LocalDate today = LocalDate.now();
        LocalDate trialStart = resolveAccountCreatedDate(ownerId);
        LocalDate trialEnd = trialStart.plusDays(30);

        OwnerSubscription sub = ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId).orElse(null);
        if (sub != null) {
            String st = sub.getStatus();
            String tier = sub.getPlanTier();
            boolean isPaidOrVerified = ("ACTIVE".equalsIgnoreCase(st) || "CANCEL_AT_PERIOD_END".equalsIgnoreCase(st))
                    && ("PRO_TRIAL".equalsIgnoreCase(tier) || "PRO_ACTIVE".equalsIgnoreCase(tier))
                    && sub.getEndDate() != null
                    && !sub.getEndDate().isBefore(today);

            if (isPaidOrVerified) {
                SubscriptionPlan plan = subscriptionPlanRepository.findById(sub.getPlanId()).orElse(null);
                OwnerSubscriptionResponse res = OwnerSubscriptionResponse.from(sub, plan);
                res.setHasFullAccess(true);
                res.setTrialExpired(false);
                res.setTrialDaysLeft(Math.max(0L, ChronoUnit.DAYS.between(today, sub.getEndDate())));
                return res;
            }
        }

        // Fallback to 30-day account-creation free trial
        boolean inAccountTrial = !today.isAfter(trialEnd);
        long daysLeft = inAccountTrial ? Math.max(1L, ChronoUnit.DAYS.between(today, trialEnd)) : 0L;

        OwnerSubscriptionResponse res = new OwnerSubscriptionResponse();
        res.setOwnerId(ownerId);
        res.setPlanName("StayNest Pro");
        res.setPlanCode("PRO_149");
        res.setStartDate(trialStart);
        res.setEndDate(trialEnd);
        res.setAutoRenew(sub != null && sub.isAutoRenew());
        res.setAutopayStatus(sub != null && sub.getAutopayStatus() != null ? sub.getAutopayStatus() : "NONE");
        res.setGatewaySubscriptionId(sub != null ? sub.getGatewaySubscriptionId() : null);

        if (inAccountTrial) {
            res.setStatus("ACTIVE");
            res.setPlanTier("PRO_TRIAL");
            res.setHasFullAccess(true);
            res.setTrialExpired(false);
            res.setTrialDaysLeft(daysLeft);
        } else {
            res.setStatus("TRIAL_EXPIRED");
            res.setPlanTier("FREE");
            res.setHasFullAccess(false);
            res.setTrialExpired(true);
            res.setTrialDaysLeft(0L);
        }
        return res;
    }

    @Transactional(readOnly = true)
    public boolean hasActiveProSubscription(UUID ownerId) {
        return getCurrentSubscription(ownerId).isHasFullAccess();
    }

    private boolean isRazorpayConfigured() {
        return razorpayKeyId != null && !razorpayKeyId.isBlank()
                && razorpayKeySecret != null && !razorpayKeySecret.isBlank()
                && razorpayPlanId != null && !razorpayPlanId.isBlank();
    }

    private String razorpayAuthHeader() {
        String creds = razorpayKeyId.trim() + ":" + razorpayKeySecret.trim();
        return "Basic " + Base64.getEncoder().encodeToString(creds.getBytes(StandardCharsets.UTF_8));
    }

    private String hmacSha256Hex(String data, String secret) throws Exception {
        Mac sha256Hmac = Mac.getInstance("HmacSHA256");
        sha256Hmac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] hash = sha256Hmac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(hash);
    }

    @Transactional
    public Map<String, Object> createAutoPayMandate(UUID ownerId, String preferredApp) {
        SubscriptionPlan proPlan = subscriptionPlanRepository.findByActiveTrue().stream()
                .filter(p -> p.getPriceMonthlyPaise() >= 14900L || "PRO".equalsIgnoreCase(p.getPlanCode()) || "PRO_149".equalsIgnoreCase(p.getPlanCode()))
                .findFirst()
                .orElseGet(() -> subscriptionPlanRepository.save(
                        new SubscriptionPlan("PRO_149", "StayNest Pro Plan", 14900L, 999, 9999, 10, true)
                ));

        LocalDate today = LocalDate.now();
        LocalDate trialEnd = resolveAccountCreatedDate(ownerId).plusDays(30);
        boolean hasRemainingTrial = trialEnd.isAfter(today);
        LocalDate nextBilling = hasRemainingTrial ? trialEnd : today.plusDays(30);
        String gatewaySubId = "sub_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        String shortUrl = null;
        String gatewayMode = "SANDBOX_FALLBACK";

        if (isRazorpayConfigured()) {
            try {
                Map<String, Object> reqBody = new LinkedHashMap<>();
                reqBody.put("plan_id", razorpayPlanId.trim());
                reqBody.put("total_count", 120);
                reqBody.put("quantity", 1);
                reqBody.put("customer_notify", 1);
                // Only defer first charge if the user still has remaining days in their 30-day account trial
                if (hasRemainingTrial) {
                    long remainingDays = ChronoUnit.DAYS.between(today, trialEnd);
                    reqBody.put("start_at", Instant.now().plus(remainingDays, ChronoUnit.DAYS).getEpochSecond());
                }
                reqBody.put("notes", Map.of(
                        "owner_id", ownerId.toString(),
                        "preferred_app", preferredApp != null ? preferredApp : "PHONEPE"
                ));

                String jsonBody = objectMapper.writeValueAsString(reqBody);
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(RAZORPAY_API_BASE + "/subscriptions"))
                        .header("Authorization", razorpayAuthHeader())
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(15))
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    Map<String, Object> rzpResp = objectMapper.readValue(response.body(), new TypeReference<>() {});
                    if (rzpResp.get("id") != null) {
                        gatewaySubId = String.valueOf(rzpResp.get("id"));
                    }
                    if (rzpResp.get("short_url") != null) {
                        shortUrl = String.valueOf(rzpResp.get("short_url"));
                    }
                    gatewayMode = "RAZORPAY";
                } else {
                    log.error("Razorpay create subscription failed ({}): {}", response.statusCode(), response.body());
                    throw new IllegalStateException("Razorpay subscription creation failed: HTTP " + response.statusCode());
                }
            } catch (Exception ex) {
                log.error("Failed to create Razorpay subscription for owner {}", ownerId, ex);
                throw new IllegalStateException("Unable to initiate Razorpay AutoPay mandate: " + ex.getMessage(), ex);
            }
        }

        // Always start in PENDING / FREE until verified by Razorpay callback or webhook
        OwnerSubscription sub = new OwnerSubscription(ownerId, proPlan.getId(), today, nextBilling);
        sub.setStatus("PENDING");
        sub.setPlanTier("FREE");
        sub.setAutopayStatus("PENDING");
        sub.setAutoRenew(true);
        sub.setGatewaySubscriptionId(gatewaySubId);
        ownerSubscriptionRepository.save(sub);

        String cleanMerchantUpi = merchantUpiId != null && !merchantUpiId.isBlank()
                ? merchantUpiId.trim()
                : "staynest.subscription@okaxis";
        String tn = URLEncoder.encode("StayNest Pro AutoPay 149/mo", StandardCharsets.UTF_8);
        String pn = URLEncoder.encode("StayNest PG", StandardCharsets.UTF_8);
        String mandateUrl = String.format(
                "upi://mandate?pa=%s&pn=%s&am=149.00&cu=INR&recur=MONTHLY&tr=%s&tn=%s",
                cleanMerchantUpi, pn, gatewaySubId, tn
        );

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("subscriptionId", gatewaySubId);
        resp.put("plan", "FREE");
        resp.put("status", "PENDING");
        resp.put("autopayStatus", "PENDING");
        resp.put("trialAmountRupees", 0);
        resp.put("monthlyAmountRupees", 149);
        resp.put("totalCount", 120);
        resp.put("startAt", nextBilling.toString());
        resp.put("nextBillingDate", nextBilling.toString());
        resp.put("shortUrl", shortUrl);
        resp.put("mandateAuthUrl", shortUrl != null ? shortUrl : mandateUrl);
        resp.put("gatewayMode", gatewayMode);
        resp.put("razorpayKeyId", razorpayKeyId != null && !razorpayKeyId.isBlank() ? razorpayKeyId : null);
        resp.put("preferredApp", preferredApp != null ? preferredApp : "PHONEPE");
        return resp;
    }

    @Transactional
    public Map<String, Object> verifyMandate(UUID ownerId, String subscriptionId, String paymentId, String signature) {
        OwnerSubscription sub = (subscriptionId != null && !subscriptionId.isBlank())
                ? ownerSubscriptionRepository.findByGatewaySubscriptionId(subscriptionId.trim())
                    .orElseThrow(() -> new ResourceNotFoundException("Subscription not found: " + subscriptionId))
                : ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId)
                    .orElseThrow(() -> new ResourceNotFoundException("No subscription found for owner: " + ownerId));

        if (!sub.getOwnerId().equals(ownerId)) {
            throw new IllegalArgumentException("Subscription does not belong to authenticated owner");
        }

        boolean verified = "ACTIVE".equalsIgnoreCase(sub.getStatus())
                && ("PRO_TRIAL".equalsIgnoreCase(sub.getPlanTier()) || "PRO_ACTIVE".equalsIgnoreCase(sub.getPlanTier()));

        // 1. Verify Razorpay SDK signature if provided
        if (!verified && paymentId != null && !paymentId.isBlank() && signature != null && !signature.isBlank()
                && razorpayKeySecret != null && !razorpayKeySecret.isBlank()) {
            try {
                String expected = hmacSha256Hex(paymentId.trim() + "|" + sub.getGatewaySubscriptionId(), razorpayKeySecret.trim());
                if (expected.equalsIgnoreCase(signature.trim())) {
                    sub.setPlanTier("PRO_TRIAL");
                    sub.setAutopayStatus("ACTIVE");
                    sub.setStatus("ACTIVE");
                    if (sub.getEndDate() == null) {
                        sub.setEndDate(LocalDate.now().plusDays(30));
                    }
                    ownerSubscriptionRepository.save(sub);
                    verified = true;
                } else {
                    throw new IllegalArgumentException("Invalid Razorpay payment signature");
                }
            } catch (IllegalArgumentException ex) {
                throw ex;
            } catch (Exception ex) {
                log.error("Signature verification error for subscription {}", sub.getGatewaySubscriptionId(), ex);
            }
        }

        // 2. Otherwise poll Razorpay Subscriptions API (for hosted short_url checkout)
        if (!verified && isRazorpayConfigured() && sub.getGatewaySubscriptionId() != null) {
            try {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(RAZORPAY_API_BASE + "/subscriptions/" + sub.getGatewaySubscriptionId()))
                        .header("Authorization", razorpayAuthHeader())
                        .timeout(Duration.ofSeconds(15))
                        .GET()
                        .build();

                HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() >= 200 && response.statusCode() < 300) {
                    Map<String, Object> rzpSub = objectMapper.readValue(response.body(), new TypeReference<>() {});
                    String rzpStatus = String.valueOf(rzpSub.getOrDefault("status", "")).toLowerCase();
                    if ("authenticated".equals(rzpStatus) || "active".equals(rzpStatus)) {
                        sub.setPlanTier("active".equals(rzpStatus) ? "PRO_ACTIVE" : "PRO_TRIAL");
                        sub.setAutopayStatus("ACTIVE");
                        sub.setStatus("ACTIVE");
                        if (sub.getEndDate() == null) {
                            sub.setEndDate(LocalDate.now().plusDays(30));
                        }
                        ownerSubscriptionRepository.save(sub);
                        verified = true;
                    }
                }
            } catch (Exception ex) {
                log.warn("Could not poll Razorpay subscription {}: {}", sub.getGatewaySubscriptionId(), ex.getMessage());
            }
        }

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("verified", verified);
        resp.put("subscriptionId", sub.getGatewaySubscriptionId());
        resp.put("plan", verified ? sub.getPlanTier() : "FREE");
        resp.put("status", sub.getStatus());
        resp.put("autopayStatus", sub.getAutopayStatus());
        resp.put("nextBillingDate", sub.getEndDate() != null ? sub.getEndDate().toString() : LocalDate.now().plusDays(30).toString());
        return resp;
    }

    @Transactional
    public Map<String, Object> cancelAutoPay(UUID ownerId) {
        OwnerSubscription sub = ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("No active subscription found for owner: " + ownerId));

        sub.setAutoRenew(false);
        sub.setAutopayStatus("CANCELLED");
        sub.setStatus("CANCEL_AT_PERIOD_END");
        ownerSubscriptionRepository.save(sub);

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("subscriptionId", sub.getGatewaySubscriptionId());
        resp.put("plan", sub.getPlanTier() != null ? sub.getPlanTier() : "PRO_TRIAL");
        resp.put("autopayStatus", "CANCELLED");
        resp.put("status", sub.getStatus());
        resp.put("nextBillingDate", sub.getEndDate() != null ? sub.getEndDate().toString() : LocalDate.now().toString());
        return resp;
    }

    @Transactional
    public void handleSubscriptionWebhook(String provider, Map<String, Object> payload) {
        handleSubscriptionWebhook(provider, null, null, payload);
    }

    @Transactional
    public void handleSubscriptionWebhook(String provider, String signature, String rawBody, Map<String, Object> payload) {
        log.info("Processing subscription webhook from provider: {}", provider);

        if (razorpayWebhookSecret != null && !razorpayWebhookSecret.isBlank()) {
            if (signature == null || rawBody == null) {
                throw new IllegalArgumentException("Missing webhook signature or payload");
            }
            try {
                String expected = hmacSha256Hex(rawBody, razorpayWebhookSecret.trim());
                if (!expected.equalsIgnoreCase(signature.trim())) {
                    throw new IllegalArgumentException("Invalid webhook signature");
                }
            } catch (IllegalArgumentException ex) {
                throw ex;
            } catch (Exception ex) {
                throw new IllegalStateException("Webhook signature verification failed", ex);
            }
        }

        if (payload == null && rawBody != null && !rawBody.isBlank()) {
            try {
                payload = objectMapper.readValue(rawBody, new TypeReference<>() {});
            } catch (Exception ex) {
                log.warn("Failed to parse webhook JSON body: {}", ex.getMessage());
                return;
            }
        }

        if (payload == null) return;
        String event = String.valueOf(payload.getOrDefault("event", ""));
        String subId = extractGatewaySubId(payload);
        if (subId == null) return;

        ownerSubscriptionRepository.findByGatewaySubscriptionId(subId).ifPresent(sub -> {
            if ("subscription.authenticated".equalsIgnoreCase(event)) {
                sub.setPlanTier("PRO_TRIAL");
                sub.setAutopayStatus("ACTIVE");
                sub.setStatus("ACTIVE");
                if (sub.getEndDate() == null) {
                    sub.setEndDate(LocalDate.now().plusDays(30));
                }
                ownerSubscriptionRepository.save(sub);
            } else if ("subscription.charged".equalsIgnoreCase(event)) {
                sub.setPlanTier("PRO_ACTIVE");
                sub.setAutopayStatus("ACTIVE");
                sub.setStatus("ACTIVE");
                sub.setEndDate(LocalDate.now().plusDays(30));
                ownerSubscriptionRepository.save(sub);
            } else if ("subscription.halted".equalsIgnoreCase(event) || "payment.failed".equalsIgnoreCase(event)) {
                sub.setPlanTier("FREE");
                sub.setAutopayStatus("NONE");
                sub.setStatus("PAST_DUE");
                ownerSubscriptionRepository.save(sub);
            } else if ("subscription.cancelled".equalsIgnoreCase(event)) {
                sub.setAutopayStatus("CANCELLED");
                sub.setAutoRenew(false);
                sub.setStatus("CANCEL_AT_PERIOD_END");
                ownerSubscriptionRepository.save(sub);
            }
        });
    }

    @SuppressWarnings("unchecked")
    private String extractGatewaySubId(Map<String, Object> payload) {
        if (payload.get("subscription_id") != null) {
            return String.valueOf(payload.get("subscription_id"));
        }
        Object pObj = payload.get("payload");
        if (pObj instanceof Map<?, ?> pMap) {
            Object subWrap = pMap.get("subscription");
            if (subWrap instanceof Map<?, ?> sMap) {
                Object entity = sMap.get("entity");
                if (entity instanceof Map<?, ?> eMap && eMap.get("id") != null) {
                    return String.valueOf(eMap.get("id"));
                }
            }
        }
        return null;
    }
}

