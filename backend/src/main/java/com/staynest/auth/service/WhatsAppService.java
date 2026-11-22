package com.staynest.auth.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;

@Service
public class WhatsAppService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppService.class);

    @Value("${staynest.whatsapp.provider:ultramsg}")
    private String provider;

    @Value("${staynest.whatsapp.ultramsg.instance-id:}")
    private String ultraMsgInstanceId;

    @Value("${staynest.whatsapp.ultramsg.token:}")
    private String ultraMsgToken;

    @Value("${staynest.whatsapp.greenapi.id-instance:}")
    private String greenApiIdInstance;

    @Value("${staynest.whatsapp.greenapi.api-token-instance:}")
    private String greenApiTokenInstance;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public record WhatsAppResult(boolean success, String message) {}

    /**
     * Sends automated WhatsApp OTP to the customer's phone number.
     * Supports UltraMsg and Green-API gateways.
     *
     * @param phone 10-digit Indian phone number
     * @param otp 6-digit verification code
     * @return WhatsAppResult containing delivery status
     */
    public WhatsAppResult sendOtp(String phone, String otp) {
        String cleanPhone = phone.replaceAll("[^0-9]", "");
        if (cleanPhone.length() == 10) {
            cleanPhone = "91" + cleanPhone;
        }

        String message = String.format(
                "Hello! Your StayNest verification code is: *%s*\n\n" +
                "Use this OTP to verify your mobile number and hold your bed. Valid for 10 minutes.\n\n" +
                "— *StayNest PG Living*",
                otp
        );

        // 1. UltraMsg Gateway Route
        if (ultraMsgInstanceId != null && !ultraMsgInstanceId.trim().isEmpty()
                && ultraMsgToken != null && !ultraMsgToken.trim().isEmpty()) {
            return sendViaUltraMsg(cleanPhone, message);
        }

        // 2. Green-API Gateway Route
        if (greenApiIdInstance != null && !greenApiIdInstance.trim().isEmpty()
                && greenApiTokenInstance != null && !greenApiTokenInstance.trim().isEmpty()) {
            return sendViaGreenApi(cleanPhone, message);
        }

        log.info("No external WhatsApp Gateway credentials configured yet. Target: +{}, OTP: {}", cleanPhone, otp);
        return new WhatsAppResult(false, "WhatsApp Gateway awaiting Instance ID & Token configuration");
    }

    private WhatsAppResult sendViaUltraMsg(String phoneWithCountry, String message) {
        try {
            String url = String.format("https://api.ultramsg.com/%s/messages/chat", ultraMsgInstanceId.trim());

            String formData = String.format(
                    "token=%s&to=%s&body=%s",
                    URLEncoder.encode(ultraMsgToken.trim(), StandardCharsets.UTF_8),
                    URLEncoder.encode(phoneWithCountry, StandardCharsets.UTF_8),
                    URLEncoder.encode(message, StandardCharsets.UTF_8)
            );

            log.info("Sending automated WhatsApp OTP via UltraMsg to +{}", phoneWithCountry);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(formData))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body() != null ? response.body() : "";

            log.info("UltraMsg response for +{}: status={}, body={}", phoneWithCountry, response.statusCode(), responseBody);

            if (response.statusCode() == 200 && responseBody.contains("\"sent\":\"true\"")) {
                return new WhatsAppResult(true, "WhatsApp message sent successfully");
            }

            return new WhatsAppResult(false, "UltraMsg response: " + responseBody);
        } catch (Exception e) {
            log.error("Failed to deliver WhatsApp via UltraMsg to +{}: {}", phoneWithCountry, e.getMessage(), e);
            return new WhatsAppResult(false, "UltraMsg connection error: " + e.getMessage());
        }
    }

    private WhatsAppResult sendViaGreenApi(String phoneWithCountry, String message) {
        try {
            String url = String.format(
                    "https://api.green-api.com/waInstance%s/sendMessage/%s",
                    greenApiIdInstance.trim(),
                    greenApiTokenInstance.trim()
            );

            String jsonPayload = String.format(
                    "{\"chatId\":\"%s@c.us\",\"message\":\"%s\"}",
                    phoneWithCountry,
                    message.replace("\"", "\\\"").replace("\n", "\\n")
            );

            log.info("Sending automated WhatsApp OTP via Green-API to +{}", phoneWithCountry);

            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(url))
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(15))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            String responseBody = response.body() != null ? response.body() : "";

            log.info("Green-API response for +{}: status={}, body={}", phoneWithCountry, response.statusCode(), responseBody);

            if (response.statusCode() == 200 && responseBody.contains("\"idMessage\"")) {
                return new WhatsAppResult(true, "WhatsApp message sent successfully via Green-API");
            }

            return new WhatsAppResult(false, "Green-API response: " + responseBody);
        } catch (Exception e) {
            log.error("Failed to deliver WhatsApp via Green-API to +{}: {}", phoneWithCountry, e.getMessage(), e);
            return new WhatsAppResult(false, "Green-API connection error: " + e.getMessage());
        }
    }
}
