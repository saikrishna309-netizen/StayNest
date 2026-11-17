package com.staynest.common.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        String traceId = getTraceId(request);
        log.warn("API Exception [traceId={}]: code={}, message={}", traceId, ex.getCode(), ex.getMessage());
        ErrorResponse response = new ErrorResponse(ex.getCode(), ex.getMessage(), new ArrayList<>(), traceId);
        return new ResponseEntity<>(response, ex.getStatus());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(MethodArgumentNotValidException ex, HttpServletRequest request) {
        String traceId = getTraceId(request);
        List<FieldErrorItem> fieldErrors = new ArrayList<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.add(new FieldErrorItem(
                    fieldError.getField(),
                    fieldError.getDefaultMessage(),
                    fieldError.getRejectedValue()
            ));
        }
        log.warn("Validation failed [traceId={}]: {} field errors", traceId, fieldErrors.size());
        ErrorResponse response = new ErrorResponse("VALIDATION_ERROR", "Request validation failed", fieldErrors, traceId);
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentials(BadCredentialsException ex, HttpServletRequest request) {
        String traceId = getTraceId(request);
        ErrorResponse response = new ErrorResponse("INVALID_CREDENTIALS", "Invalid email/phone or password", new ArrayList<>(), traceId);
        return new ResponseEntity<>(response, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        String traceId = getTraceId(request);
        ErrorResponse response = new ErrorResponse("FORBIDDEN", "Access is denied for this resource", new ArrayList<>(), traceId);
        return new ResponseEntity<>(response, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGenericException(Exception ex, HttpServletRequest request) {
        String traceId = getTraceId(request);
        log.error("Internal Server Error [traceId=" + traceId + "]", ex);
        String detailMessage = ex.getMessage();
        if (ex.getCause() != null && ex.getCause().getMessage() != null) {
            detailMessage = detailMessage + " -> " + ex.getCause().getMessage();
        }
        ErrorResponse response = new ErrorResponse("INTERNAL_SERVER_ERROR",
                detailMessage != null ? detailMessage : "An unexpected error occurred.",
                new ArrayList<>(), traceId);
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private String getTraceId(HttpServletRequest request) {
        String headerTraceId = request.getHeader("X-Trace-Id");
        if (headerTraceId != null && !headerTraceId.isBlank()) {
            return headerTraceId;
        }
        return UUID.randomUUID().toString();
    }
}

