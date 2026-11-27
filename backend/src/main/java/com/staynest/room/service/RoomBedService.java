package com.staynest.room.service;

import com.staynest.bed.dto.BedResponse;
import com.staynest.bed.dto.CreateBedRequest;
import com.staynest.bed.dto.UpdateBedRequest;
import com.staynest.bed.entity.Bed;
import com.staynest.bed.repository.BedRepository;
import com.staynest.common.exception.ForbiddenException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.property.entity.Property;
import com.staynest.property.repository.PropertyRepository;
import com.staynest.room.dto.CreateRoomRequest;
import com.staynest.room.dto.RoomResponse;
import com.staynest.room.dto.UpdateRoomRequest;
import com.staynest.room.entity.Room;
import com.staynest.room.repository.RoomRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RoomBedService {

    private final PropertyRepository propertyRepository;
    private final RoomRepository roomRepository;
    private final BedRepository bedRepository;

    public RoomBedService(PropertyRepository propertyRepository,
                          RoomRepository roomRepository,
                          BedRepository bedRepository) {
        this.propertyRepository = propertyRepository;
        this.roomRepository = roomRepository;
        this.bedRepository = bedRepository;
    }

    @Transactional
    public RoomResponse createRoom(UUID ownerId, UUID propertyId, CreateRoomRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this property");
        }

        String normalizedRoomNumber = request.getRoomNumber().trim();
        Room existing = roomRepository.findByPropertyId(propertyId).stream()
                .filter(r -> r.getRoomNumber() != null && r.getRoomNumber().trim().equalsIgnoreCase(normalizedRoomNumber))
                .findFirst()
                .orElse(null);

        if (existing != null) {
            existing.setSharingType(request.getSharingType());
            existing.setCapacity(request.getCapacity());
            if (request.getFloorNumber() != null) existing.setFloorNumber(request.getFloorNumber());
            existing.setRentMonthlyPaise(request.getRentMonthlyPaise());
            if (request.getDepositPaise() != null) existing.setDepositPaise(request.getDepositPaise());
            existing = roomRepository.save(existing);

            List<BedResponse> existingBeds = bedRepository.findByRoomId(existing.getId()).stream()
                    .map(BedResponse::from)
                    .collect(Collectors.toList());
            return RoomResponse.from(existing, existingBeds);
        }

        Room room = new Room();
        room.setPropertyId(propertyId);
        room.setRoomNumber(normalizedRoomNumber);
        room.setSharingType(request.getSharingType());
        room.setCapacity(request.getCapacity());
        if (request.getFloorNumber() != null) room.setFloorNumber(request.getFloorNumber());
        room.setRentMonthlyPaise(request.getRentMonthlyPaise());
        if (request.getDepositPaise() != null) room.setDepositPaise(request.getDepositPaise());

        room = roomRepository.save(room);

        // Auto-create initial bed slots for the room based on capacity
        for (int i = 1; i <= room.getCapacity(); i++) {
            Bed bed = new Bed(room.getId(), propertyId, "Bed " + i);
            bedRepository.save(bed);
        }

        List<BedResponse> beds = bedRepository.findByRoomId(room.getId()).stream()
                .map(BedResponse::from)
                .collect(Collectors.toList());

        return RoomResponse.from(room, beds);
    }

    @Transactional
    public RoomResponse updateRoom(UUID ownerId, UUID roomId, UpdateRoomRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room", roomId));

        UUID propertyId = room.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to modify this room");
        }

        if (request.getRoomNumber() != null) room.setRoomNumber(request.getRoomNumber().trim());
        if (request.getSharingType() != null) room.setSharingType(request.getSharingType());
        if (request.getCapacity() != null) room.setCapacity(request.getCapacity());
        if (request.getFloorNumber() != null) room.setFloorNumber(request.getFloorNumber());
        if (request.getRentMonthlyPaise() != null) room.setRentMonthlyPaise(request.getRentMonthlyPaise());
        if (request.getDepositPaise() != null) room.setDepositPaise(request.getDepositPaise());
        if (request.getStatus() != null) room.setStatus(request.getStatus());

        Room saved = roomRepository.save(room);

        List<BedResponse> beds = bedRepository.findByRoomId(saved.getId()).stream()
                .map(BedResponse::from)
                .collect(Collectors.toList());

        return RoomResponse.from(saved, beds);
    }

    @Transactional
    public BedResponse createBed(UUID ownerId, UUID roomId, CreateBedRequest request) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new ResourceNotFoundException("Room", roomId));

        UUID propertyId = room.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this room");
        }

        String normalizedLabel = request.getBedLabel().trim();
        Bed existingBed = bedRepository.findByRoomId(roomId).stream()
                .filter(b -> b.getBedLabel() != null && b.getBedLabel().trim().equalsIgnoreCase(normalizedLabel))
                .findFirst()
                .orElse(null);
        if (existingBed != null) {
            return BedResponse.from(existingBed);
        }

        Bed bed = new Bed(roomId, property.getId(), normalizedLabel);
        bed = bedRepository.save(bed);
        return BedResponse.from(bed);
    }

    @Transactional
    public BedResponse updateBed(UUID ownerId, UUID bedId, UpdateBedRequest request) {
        Bed bed = bedRepository.findById(bedId)
                .orElseThrow(() -> new ResourceNotFoundException("Bed", bedId));

        UUID propertyId = bed.getPropertyId();
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to modify this bed");
        }

        if (request.getBedLabel() != null) bed.setBedLabel(request.getBedLabel().trim());
        if (request.getActive() != null) bed.setActive(request.getActive());
        if (request.getStatus() != null) bed.setStatus(request.getStatus());

        Bed saved = bedRepository.save(bed);
        return BedResponse.from(saved);
    }
}
