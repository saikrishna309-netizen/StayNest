package com.staynest.property.service;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.repository.BedRepository;
import com.staynest.booking.repository.BookingRepository;
import com.staynest.booking.repository.InventoryHoldRepository;
import com.staynest.common.exception.ForbiddenException;
import com.staynest.common.exception.ResourceNotFoundException;
import com.staynest.common.response.PageResponse;
import com.staynest.property.dto.*;
import com.staynest.property.entity.*;
import com.staynest.property.repository.*;
import com.staynest.room.entity.Room;
import com.staynest.room.repository.RoomRepository;
import com.staynest.subscription.service.SubscriptionService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PropertyService {

    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final CityRepository cityRepository;
    private final LocalityRepository localityRepository;
    private final ReviewRepository reviewRepository;
    private final RoomRepository roomRepository;
    private final BedRepository bedRepository;
    private final BookingRepository bookingRepository;
    private final InventoryHoldRepository inventoryHoldRepository;
    private final SubscriptionService subscriptionService;

    public PropertyService(PropertyRepository propertyRepository,
                           PropertyPhotoRepository propertyPhotoRepository,
                           CityRepository cityRepository,
                           LocalityRepository localityRepository,
                           ReviewRepository reviewRepository,
                           RoomRepository roomRepository,
                           BedRepository bedRepository,
                           BookingRepository bookingRepository,
                           InventoryHoldRepository inventoryHoldRepository,
                           SubscriptionService subscriptionService) {
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.cityRepository = cityRepository;
        this.localityRepository = localityRepository;
        this.reviewRepository = reviewRepository;
        this.roomRepository = roomRepository;
        this.bedRepository = bedRepository;
        this.bookingRepository = bookingRepository;
        this.inventoryHoldRepository = inventoryHoldRepository;
        this.subscriptionService = subscriptionService;
    }

    // --- Public Discovery Methods ---

    @Transactional(readOnly = true)
    public List<CityResponse> getCities() {
        return cityRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(c -> new CityResponse(c.getId(), c.getName(), c.getState()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LocalityResponse> getLocalities(UUID cityId) {
        return localityRepository.findByCityIdAndActiveTrueOrderByNameAsc(cityId).stream()
                .map(l -> new LocalityResponse(l.getId(), l.getCityId(), l.getName(), l.getPincode()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PageResponse<PropertySummaryResponse> searchProperties(
            UUID cityId, UUID localityId, GenderPolicy genderPolicy,
            Long minRent, Long maxRent, Boolean foodIncluded, String q, Pageable pageable) {

        String search = (q != null && !q.trim().isEmpty()) ? "%" + q.trim().toLowerCase() + "%" : null;

        Page<Property> page = propertyRepository.searchProperties(
                cityId, localityId, genderPolicy, minRent, maxRent, foodIncluded, search, pageable);

        List<PropertySummaryResponse> dtos = page.getContent().stream()
                .map(this::mapToSummaryResponse)
                .collect(Collectors.toList());

        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public PropertyDetailResponse getPublishedProperty(UUID id) {
        Property property = propertyRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Property", id));
        return mapToDetailResponse(property);
    }

    @Transactional(readOnly = true)
    public List<BedAvailabilityResponse> checkAvailability(UUID propertyId, LocalDate checkIn, LocalDate checkOut) {
        if (checkIn == null) checkIn = LocalDate.now();
        if (checkOut == null) checkOut = checkIn.plusMonths(1);

        LocalDate effectiveCheckIn = checkIn;
        LocalDate effectiveCheckOut = checkOut;
        Instant now = Instant.now();

        List<Room> rooms = roomRepository.findByPropertyId(propertyId);
        Map<UUID, Room> roomMap = rooms.stream().collect(Collectors.toMap(Room::getId, r -> r));

        List<Bed> beds = bedRepository.findByPropertyId(propertyId);
        List<BedAvailabilityResponse> results = new ArrayList<>();

        for (Bed bed : beds) {
            Room room = roomMap.get(bed.getRoomId());
            if (room == null || !bed.isActive()) continue;

            long overlappingBookings = bookingRepository.countOverlappingActiveBookings(bed.getId(), effectiveCheckIn, effectiveCheckOut);
            long overlappingHolds = inventoryHoldRepository.countOverlappingActiveHolds(bed.getId(), effectiveCheckIn, effectiveCheckOut, now);

            boolean isAvailable = (overlappingBookings == 0 && overlappingHolds == 0);

            results.add(new BedAvailabilityResponse(
                    bed.getId(),
                    bed.getBedLabel(),
                    room.getId(),
                    room.getRoomNumber(),
                    room.getSharingType().name(),
                    room.getRentMonthlyPaise(),
                    isAvailable,
                    effectiveCheckIn,
                    effectiveCheckOut
            ));
        }

        return results;
    }

    @Transactional(readOnly = true)
    public List<ReviewResponse> getReviews(UUID propertyId) {
        return reviewRepository.findByPropertyIdAndPublishedTrueOrderByCreatedAtDesc(propertyId).stream()
                .map(ReviewResponse::from)
                .collect(Collectors.toList());
    }

    // --- Owner Property Management Methods ---

    @Transactional
    public PropertyDetailResponse createDraftProperty(UUID ownerId, CreatePropertyRequest request) {
        if (propertyRepository.findByOwnerId(ownerId).size() >= 1 && !subscriptionService.hasActiveProSubscription(ownerId)) {
            throw new ForbiddenException(
                    "Free plan includes 1 property. Start your 1-Month Free Trial (₹0 today, ₹99/mo after) to manage unlimited properties."
            );
        }

        UUID cityId = request.getCityId();
        if (cityId == null || !cityRepository.existsById(cityId)) {
            // Fallback to first existing city if available
            cityId = cityRepository.findAll().stream()
                    .map(City::getId)
                    .findFirst()
                    .orElseThrow(() -> new ResourceNotFoundException("No active cities found. Please seed cities first."));
        }

        UUID localityId = request.getLocalityId();
        if (localityId != null && !localityRepository.existsById(localityId)) {
            localityId = localityRepository.findByCityIdAndActiveTrueOrderByNameAsc(cityId).stream()
                    .map(Locality::getId)
                    .findFirst()
                    .orElse(null);
        }

        Property property = new Property();
        property.setOwnerId(ownerId);
        property.setName(request.getName().trim());
        property.setPropertyType(request.getPropertyType());
        property.setGenderPolicy(request.getGenderPolicy());
        property.setDescription(request.getDescription());
        property.setCityId(cityId);
        property.setLocalityId(localityId);
        property.setAddressLine(request.getAddressLine());
        property.setPincode(request.getPincode());
        property.setLatitude(request.getLatitude());
        property.setLongitude(request.getLongitude());
        property.setStartingPricePaise(request.getStartingPricePaise());
        property.setNoticePeriodDays(request.getNoticePeriodDays());
        property.setDepositMonths(request.getDepositMonths());
        property.setFoodIncluded(request.isFoodIncluded());
        property.setPayAtPropertyAllowed(request.isPayAtPropertyAllowed());
        property.setRules(request.getRules());
        property.setCancellationPolicy(request.getCancellationPolicy());
        if (request.getAmenities() != null) {
            property.setAmenities(request.getAmenities());
        }
        property.setApprovalStatus(ApprovalStatus.APPROVED);
        property.setPublished(true);
        property.setPublishedAt(Instant.now());

        property = propertyRepository.save(property);
        return mapToDetailResponse(property);
    }

    @Transactional(readOnly = true)
    public PageResponse<PropertySummaryResponse> listOwnerProperties(UUID ownerId, Pageable pageable) {
        Page<Property> page = propertyRepository.findByOwnerId(ownerId, pageable);
        List<PropertySummaryResponse> dtos = page.getContent().stream()
                .map(this::mapToSummaryResponse)
                .collect(Collectors.toList());
        return new PageResponse<>(dtos, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages(), page.isLast());
    }

    @Transactional(readOnly = true)
    public PropertyDetailResponse getOwnerProperty(UUID ownerId, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this property");
        }
        return mapToDetailResponse(property);
    }

    @Transactional
    public PropertyDetailResponse updateOwnerProperty(UUID ownerId, UUID propertyId, UpdatePropertyRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have permission to modify this property");
        }

        if (request.getName() != null) property.setName(request.getName().trim());
        if (request.getPropertyType() != null) property.setPropertyType(request.getPropertyType());
        if (request.getGenderPolicy() != null) property.setGenderPolicy(request.getGenderPolicy());
        if (request.getDescription() != null) property.setDescription(request.getDescription());
        if (request.getCityId() != null) property.setCityId(request.getCityId());
        if (request.getLocalityId() != null) property.setLocalityId(request.getLocalityId());
        if (request.getAddressLine() != null) property.setAddressLine(request.getAddressLine());
        if (request.getPincode() != null) property.setPincode(request.getPincode());
        if (request.getLatitude() != null) property.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) property.setLongitude(request.getLongitude());
        if (request.getStartingPricePaise() != null) property.setStartingPricePaise(request.getStartingPricePaise());
        if (request.getNoticePeriodDays() != null) property.setNoticePeriodDays(request.getNoticePeriodDays());
        if (request.getDepositMonths() != null) property.setDepositMonths(request.getDepositMonths());
        if (request.getFoodIncluded() != null) property.setFoodIncluded(request.getFoodIncluded());
        if (request.getPayAtPropertyAllowed() != null) property.setPayAtPropertyAllowed(request.getPayAtPropertyAllowed());
        if (request.getRules() != null) property.setRules(request.getRules());
        if (request.getCancellationPolicy() != null) property.setCancellationPolicy(request.getCancellationPolicy());
        if (request.getAmenities() != null) property.setAmenities(request.getAmenities());

        property = propertyRepository.save(property);
        return mapToDetailResponse(property);
    }

    @Transactional
    public PropertyDetailResponse submitForApproval(UUID ownerId, UUID propertyId) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have permission to submit this property");
        }

        property.setApprovalStatus(ApprovalStatus.SUBMITTED);
        property = propertyRepository.save(property);
        return mapToDetailResponse(property);
    }

    @Transactional
    public PropertyPhotoResponse addPhoto(UUID ownerId, UUID propertyId, PhotoUploadRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this property");
        }

        PropertyPhoto photo = new PropertyPhoto(propertyId, request.getPhotoUrl(), request.getCaption(), request.isPrimary());
        photo.setDisplayOrder(request.getDisplayOrder());
        photo = propertyPhotoRepository.save(photo);
        return PropertyPhotoResponse.from(photo);
    }

    @Transactional
    public void setRates(UUID ownerId, UUID propertyId, RateRuleRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this property");
        }

        if (request.getRoomId() != null) {
            Room room = roomRepository.findById(request.getRoomId())
                    .orElseThrow(() -> new ResourceNotFoundException("Room", request.getRoomId()));
            if (!room.getPropertyId().equals(propertyId)) {
                throw new ForbiddenException("Room does not belong to this property");
            }
            room.setRentMonthlyPaise(request.getMonthlyRentPaise());
            if (request.getDepositPaise() != null) {
                room.setDepositPaise(request.getDepositPaise());
            }
            roomRepository.save(room);
        } else {
            property.setStartingPricePaise(request.getMonthlyRentPaise());
            propertyRepository.save(property);
        }
    }

    @Transactional
    public void updateAvailability(UUID ownerId, UUID propertyId, UpdateAvailabilityRequest request) {
        Property property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ResourceNotFoundException("Property", propertyId));

        if (!property.getOwnerId().equals(ownerId)) {
            throw new ForbiddenException("You do not have access to this property");
        }

        Bed bed = bedRepository.findById(request.getBedId())
                .orElseThrow(() -> new ResourceNotFoundException("Bed", request.getBedId()));

        if (!bed.getPropertyId().equals(propertyId)) {
            throw new ForbiddenException("Bed does not belong to this property");
        }

        bed.setActive(request.getActive());
        bedRepository.save(bed);
    }

    // --- Helper Mappers ---

    private PropertySummaryResponse mapToSummaryResponse(Property p) {
        String cityName = cityRepository.findById(p.getCityId()).map(City::getName).orElse(null);
        String localityName = p.getLocalityId() != null ? localityRepository.findById(p.getLocalityId()).map(Locality::getName).orElse(null) : null;
        String primaryPhoto = propertyPhotoRepository.findByPropertyIdOrderByDisplayOrderAsc(p.getId()).stream()
                .filter(PropertyPhoto::isPrimary)
                .findFirst()
                .map(PropertyPhoto::getPhotoUrl)
                .orElse(null);

        return PropertySummaryResponse.from(p, cityName, localityName, primaryPhoto);
    }

    private PropertyDetailResponse mapToDetailResponse(Property p) {
        PropertyDetailResponse res = new PropertyDetailResponse();
        res.setId(p.getId());
        res.setOwnerId(p.getOwnerId());
        res.setName(p.getName());
        res.setPropertyType(p.getPropertyType());
        res.setGenderPolicy(p.getGenderPolicy());
        res.setDescription(p.getDescription());
        res.setCityId(p.getCityId());
        cityRepository.findById(p.getCityId()).ifPresent(c -> res.setCityName(c.getName()));
        res.setLocalityId(p.getLocalityId());
        if (p.getLocalityId() != null) {
            localityRepository.findById(p.getLocalityId()).ifPresent(l -> res.setLocalityName(l.getName()));
        }
        res.setAddressLine(p.getAddressLine());
        res.setPincode(p.getPincode());
        res.setLatitude(p.getLatitude());
        res.setLongitude(p.getLongitude());
        res.setApprovalStatus(p.getApprovalStatus());
        res.setPublished(p.isPublished());
        res.setStartingPricePaise(p.getStartingPricePaise());
        res.setNoticePeriodDays(p.getNoticePeriodDays());
        res.setDepositMonths(p.getDepositMonths());
        res.setFoodIncluded(p.isFoodIncluded());
        res.setPayAtPropertyAllowed(p.isPayAtPropertyAllowed());
        res.setRules(p.getRules());
        res.setCancellationPolicy(p.getCancellationPolicy());
        res.setAmenities(p.getAmenities());
        res.setPublishedAt(p.getPublishedAt());
        res.setCreatedAt(p.getCreatedAt());

        // Photos
        List<PropertyPhotoResponse> photos = propertyPhotoRepository.findByPropertyIdOrderByDisplayOrderAsc(p.getId()).stream()
                .map(PropertyPhotoResponse::from)
                .collect(Collectors.toList());
        res.setPhotos(photos);

        // Rooms & Beds
        List<Room> rooms = roomRepository.findByPropertyId(p.getId());
        List<PropertyDetailResponse.RoomDetailDto> roomDtos = new ArrayList<>();
        for (Room r : rooms) {
            PropertyDetailResponse.RoomDetailDto roomDto = new PropertyDetailResponse.RoomDetailDto();
            roomDto.setId(r.getId());
            roomDto.setRoomNumber(r.getRoomNumber());
            roomDto.setSharingType(r.getSharingType().name());
            roomDto.setCapacity(r.getCapacity());
            roomDto.setFloorNumber(r.getFloorNumber());
            roomDto.setRentMonthlyPaise(r.getRentMonthlyPaise());
            roomDto.setDepositPaise(r.getDepositPaise());
            roomDto.setStatus(r.getStatus().name());

            List<PropertyDetailResponse.BedDetailDto> bedDtos = bedRepository.findByRoomId(r.getId()).stream()
                    .map(b -> new PropertyDetailResponse.BedDetailDto(b.getId(), b.getBedLabel(), b.isActive(), b.getStatus().name()))
                    .collect(Collectors.toList());
            roomDto.setBeds(bedDtos);
            roomDtos.add(roomDto);
        }
        res.setRooms(roomDtos);

        return res;
    }
}

