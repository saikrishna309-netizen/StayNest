package com.staynest.common.exception;

import java.util.ArrayList;
import java.util.List;

public class ErrorResponse {
    private String code;
    private String message;
    private List<FieldErrorItem> fieldErrors = new ArrayList<>();
    private String traceId;

    public ErrorResponse() {
    }

    public ErrorResponse(String code, String message, List<FieldErrorItem> fieldErrors, String traceId) {
        this.code = code;
        this.message = message;
        this.fieldErrors = fieldErrors != null ? fieldErrors : new ArrayList<>();
        this.traceId = traceId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public List<FieldErrorItem> getFieldErrors() {
        return fieldErrors;
    }

    public void setFieldErrors(List<FieldErrorItem> fieldErrors) {
        this.fieldErrors = fieldErrors;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }
}

