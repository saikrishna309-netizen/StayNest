package com.staynest.subscription.service;

import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.subscription.dto.CreateOwnerSubscriptionRequest;
import com.staynest.subscription.dto.OwnerSubscriptionResponse;
import com.staynest.subscription.dto.SubscriptionPlanResponse;
import com.staynest.subscription.entity.OwnerSubscription;
import com.staynest.subscription.entity.SubscriptionPlan;
import com.staynest.subscription.repository.OwnerSubscriptionRepository;
import com.staynest.subscription.repository.SubscriptionPlanRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    @Value("${staynest.subscription.merchant-upi-id:staynest.subscription@okaxis}")
    private String merchantUpiId;

    @Value("${staynest.subscription.razorpay-webhook-secret:}")
    private String razorpayWebhookSecret;

    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final OwnerSubscriptionRepository ownerSubscriptionRepository;

    public SubscriptionService(SubscriptionPlanRepository subscriptionPlanRepository,
                               OwnerSubscriptionRepository ownerSubscriptionRepository) {
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.ownerSubscriptionRepository = ownerSubscriptionRepository;
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

    @Transactional(readOnly = true)
    public OwnerSubscriptionResponse getCurrentSubscription(UUID ownerId) {
        OwnerSubscription sub = ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId)
                .orElseThrow(() -> new ResourceNotFoundException("No active subscription found for owner: " + ownerId));

        SubscriptionPlan plan = subscriptionPlanRepository.findById(sub.getPlanId()).orElse(null);
        return OwnerSubscriptionResponse.from(sub, plan);
    }

    @Transactional(readOnly = true)
    public boolean hasActiveProSubscription(UUID ownerId) {
        return ownerSubscriptionRepository.findTopByOwnerIdOrderByCreatedAtDesc(ownerId)
                .map(sub -> {
                    String st = sub.getStatus();
                    boolean validStatus = "ACTIVE".equalsIgnoreCase(st)
                            || "PRO_TRIAL".equalsIgnoreCase(st)
                            || "CANCEL_AT_PERIOD_END".equalsIgnoreCase(st);
                    return validStatus && sub.getEndDate() != null && !sub.getEndDate().isBefore(LocalDate.now());
                })
                .orElse(false);
    }

    @Transactional
    public Map<String, Object> createAutoPayMandate(UUID ownerId, String preferredApp) {
        SubscriptionPlan proPlan = subscriptionPlanRepository.findByActiveTrue().stream()
                .filter(p -> p.getPriceMonthlyPaise() >= 9900L || "PRO".equalsIgnoreCase(p.getPlanCode()))
                .findFirst()
                .orElseGet(() -> subscriptionPlanRepository.save(
                        new SubscriptionPlan("PRO_99", "StayNest Pro Plan", 9900L, 999, 9999, 10, true)
                ));

        LocalDate today = LocalDate.now();
        LocalDate nextBilling = today.plusDays(30);
        String gatewaySubId = "sub_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);

        OwnerSubscription sub = new OwnerSubscription(ownerId, proPlan.getId(), today, nextBilling);
        sub.setStatus("ACTIVE");
        sub.setPlanTier("PRO_TRIAL");
        sub.setAutopayStatus("ACTIVE");
        sub.setAutoRenew(true);
        sub.setGatewaySubscriptionId(gatewaySubId);
        ownerSubscriptionRepository.save(sub);

        String cleanMerchantUpi = merchantUpiId != null && !merchantUpiId.isBlank()
                ? merchantUpiId.trim()
                : "staynest.subscription@okaxis";
        String tn = URLEncoder.encode("StayNest Pro AutoPay 99/mo", StandardCharsets.UTF_8);
        String pn = URLEncoder.encode("StayNest PG", StandardCharsets.UTF_8);
        String mandateUrl = String.format(
                "upi://mandate?pa=%s&pn=%s&am=99.00&cu=INR&recur=MONTHLY&tr=%s&tn=%s",
                cleanMerchantUpi, pn, gatewaySubId, tn
        );

        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("subscriptionId", gatewaySubId);
        resp.put("plan", "PRO_TRIAL");
        resp.put("autopayStatus", "ACTIVE");
        resp.put("trialAmountRupees", 0);
        resp.put("monthlyAmountRupees", 99);
        resp.put("totalCount", 120);
        resp.put("startAt", nextBilling.toString());
        resp.put("nextBillingDate", nextBilling.toString());
        resp.put("mandateAuthUrl", mandateUrl);
        resp.put("preferredApp", preferredApp != null ? preferredApp : "GPAY");
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

        if (razorpayWebhookSecret != null && !razorpayWebhookSecret.isBlank() && signature != null && rawBody != null) {
            try {
                Mac sha256Hmac = Mac.getInstance("HmacSHA256");
                sha256Hmac.init(new SecretKeySpec(razorpayWebhookSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
                byte[] hash = sha256Hmac.doFinal(rawBody.getBytes(StandardCharsets.UTF_8));
                String expected = HexFormat.of().formatHex(hash);
                if (!expected.equalsIgnoreCase(signature.trim())) {
                    throw new IllegalArgumentException("Invalid webhook signature");
                }
            } catch (IllegalArgumentException ex) {
                throw ex;
            } catch (Exception ex) {
                log.warn("Webhook signature verification skipped/error: {}", ex.getMessage());
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
                sub.setEndDate(LocalDate.now().plusDays(30));
                ownerSubscriptionRepository.save(sub);
            } else if ("subscription.charged".equalsIgnoreCase(event)) {
                sub.setPlanTier("PRO_ACTIVE");
                sub.setAutopayStatus("ACTIVE");
                sub.setStatus("ACTIVE");
                sub.setEndDate(LocalDate.now().plusDays(30));
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

