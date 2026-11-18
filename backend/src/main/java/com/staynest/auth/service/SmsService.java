package com.staynest.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Service
public class SmsService {

    private static final Logger log = LoggerFactory.getLogger(SmsService.class);

    @Value("${staynest.sms.fast2sms.api-key:qseD4buVIZcIcceLLXOil10MRhiH7BcTfz4pfDrA95x6bHh0zYirXCvs6BYNV8qce04ATbqohB4HZleb}")
    private String apiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public record SmsResult(boolean success, String message) {}

    /**
     * Dispatches real 6-digit OTP SMS via Fast2SMS to an Indian mobile number.
     * Tries route=otp, falls back to route=q if needed.
     *
     * @param phone 10-digit mobile number
     * @param otp 6-digit OTP
     * @return SmsResult containing success status and gateway message
     */
    public SmsResult sendOtpSms(String phone, String otp) {
        if (apiKey == null || apiKey.trim().isEmpty() || "none".equalsIgnoreCase(apiKey)) {
            log.warn("Fast2SMS API key is not configured, skipping SMS dispatch for {}", phone);
            return new SmsResult(false, "Fast2SMS API key not configured");
        }

        try {
            // Fast2SMS expects clean 10-digit number
            String cleanPhone = phone.replaceAll("[^0-9]", "");
            if (cleanPhone.length() > 10) {
                cleanPhone = cleanPhone.substring(cleanPhone.length() - 10);
            }

            // Try Quick SMS route (route=q) first as configured on user account
            String jsonPayload = String.format(
                    "{\"route\":\"q\",\"message\":\"Your StayNest PG Owner verification code is %s. Valid for 5 minutes.\",\"language\":\"english\",\"numbers\":\"%s\"}",
                    otp, cleanPhone
            );

            log.info("Sending OTP SMS via Fast2SMS to +91 {}", cleanPhone);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create("https://www.fast2sms.com/dev/bulkV2"))
                    .header("authorization", apiKey)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body() != null ? response.body() : "";

            log.info("Fast2SMS gateway response for +91 {}: status={}, body={}", cleanPhone, response.statusCode(), responseBody);

            if (response.statusCode() == 200 && responseBody.contains("\"return\":true")) {
                return new SmsResult(true, "SMS delivered successfully");
            }

            // Extract message if present
            String gatewayMessage = "Gateway rejected with status " + response.statusCode();
            if (responseBody.contains("\"message\":\"")) {
                int start = responseBody.indexOf("\"message\":\"") + 11;
                int end = responseBody.indexOf("\"", start);
                if (end > start) {
                    gatewayMessage = responseBody.substring(start, end);
                }
            }

            return new SmsResult(false, gatewayMessage);
        } catch (Exception e) {
            log.error("Failed to deliver OTP SMS via Fast2SMS to {}: {}", phone, e.getMessage(), e);
            return new SmsResult(false, "Connection error: " + e.getMessage());
        }
    }
}
