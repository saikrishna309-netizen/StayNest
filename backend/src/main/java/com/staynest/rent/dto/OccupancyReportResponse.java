package com.staynest.rent.dto;

import java.util.UUID;

public class OccupancyReportResponse {
    private int totalProperties;
    private int totalRooms;
    private int totalBeds;
    private int occupiedBeds;
    private int availableBeds;
    private double occupancyPercentage;

    public OccupancyReportResponse() {
    }

    public OccupancyReportResponse(int totalProperties, int totalRooms, int totalBeds, int occupiedBeds, int availableBeds, double occupancyPercentage) {
        this.totalProperties = totalProperties;
        this.totalRooms = totalRooms;
        this.totalBeds = totalBeds;
        this.occupiedBeds = occupiedBeds;
        this.availableBeds = availableBeds;
        this.occupancyPercentage = occupancyPercentage;
    }

    public int getTotalProperties() {
        return totalProperties;
    }

    public void setTotalProperties(int totalProperties) {
        this.totalProperties = totalProperties;
    }

    public int getTotalRooms() {
        return totalRooms;
    }

    public void setTotalRooms(int totalRooms) {
        this.totalRooms = totalRooms;
    }

    public int getTotalBeds() {
        return totalBeds;
    }

    public void setTotalBeds(int totalBeds) {
        this.totalBeds = totalBeds;
    }

    public int getOccupiedBeds() {
        return occupiedBeds;
    }

    public void setOccupiedBeds(int occupiedBeds) {
        this.occupiedBeds = occupiedBeds;
    }

    public int getAvailableBeds() {
        return availableBeds;
    }

    public void setAvailableBeds(int availableBeds) {
        this.availableBeds = availableBeds;
    }

    public double getOccupancyPercentage() {
        return occupancyPercentage;
    }

    public void setOccupancyPercentage(double occupancyPercentage) {
        this.occupancyPercentage = occupancyPercentage;
    }
}

