package com.staynest.payment.entity;

public enum PaymentState {
    CREATED,
    PENDING,
    AUTHORIZED,
    PAID,
    FAILED,
    REFUND_PENDING,
    REFUNDED,
    DUE_AT_PROPERTY,
    COLLECTED_OFFLINE
}

