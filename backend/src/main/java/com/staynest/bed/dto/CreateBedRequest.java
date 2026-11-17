package com.staynest.bed.dto;

import jakarta.validation.constraints.NotBlank;

public class CreateBedRequest {

    @NotBlank(message = "Bed label is required (e.g. Bed A, Bed 1)")
    private String bedLabel;

    public CreateBedRequest() {
    }

    public String getBedLabel() {
        return bedLabel;
    }

    public void setBedLabel(String bedLabel) {
        this.bedLabel = bedLabel;
    }
}

