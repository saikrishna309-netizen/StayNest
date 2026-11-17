package com.staynest.common.exception;

import org.springframework.http.HttpStatus;

public class ResourceNotFoundException extends ApiException {
    public ResourceNotFoundException(String resourceName, Object identifier) {
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", resourceName + " not found with id: " + identifier);
    }

    public ResourceNotFoundException(String message) {
        super(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", message);
    }
}

