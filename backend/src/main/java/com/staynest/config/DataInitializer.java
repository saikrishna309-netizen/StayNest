package com.staynest.config;

import com.staynest.bed.entity.Bed;
import com.staynest.bed.repository.BedRepository;
import com.staynest.owner.entity.OwnerProfile;
import com.staynest.owner.entity.VerificationStatus;
import com.staynest.owner.repository.OwnerProfileRepository;
import com.staynest.property.entity.*;
import com.staynest.property.repository.*;
import com.staynest.room.entity.Room;
import com.staynest.room.entity.SharingType;
import com.staynest.room.repository.RoomRepository;
import com.staynest.subscription.entity.SubscriptionPlan;
import com.staynest.subscription.repository.SubscriptionPlanRepository;
import com.staynest.user.entity.User;
import com.staynest.user.entity.UserRole;
import com.staynest.user.entity.UserStatus;
import com.staynest.user.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Component
@Profile("!prod")
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final CityRepository cityRepository;
    private final LocalityRepository localityRepository;
    private final AmenityRepository amenityRepository;
    private final SubscriptionPlanRepository subscriptionPlanRepository;
    private final UserRepository userRepository;
    private final OwnerProfileRepository ownerProfileRepository;
    private final PropertyRepository propertyRepository;
    private final PropertyPhotoRepository propertyPhotoRepository;
    private final RoomRepository roomRepository;
    private final BedRepository bedRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(CityRepository cityRepository,
                           LocalityRepository localityRepository,
                           AmenityRepository amenityRepository,
                           SubscriptionPlanRepository subscriptionPlanRepository,
                           UserRepository userRepository,
                           OwnerProfileRepository ownerProfileRepository,
                           PropertyRepository propertyRepository,
                           PropertyPhotoRepository propertyPhotoRepository,
                           RoomRepository roomRepository,
                           BedRepository bedRepository,
                           PasswordEncoder passwordEncoder) {
        this.cityRepository = cityRepository;
        this.localityRepository = localityRepository;
        this.amenityRepository = amenityRepository;
        this.subscriptionPlanRepository = subscriptionPlanRepository;
        this.userRepository = userRepository;
        this.ownerProfileRepository = ownerProfileRepository;
        this.propertyRepository = propertyRepository;
        this.propertyPhotoRepository = propertyPhotoRepository;
        this.roomRepository = roomRepository;
        this.bedRepository = bedRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (cityRepository.count() > 0) {
            log.info("Database already initialized, skipping initial seeding.");
            return;
        }

        log.info("Seeding initial data for StayNest platform...");

        // 1. Seed Cities
        City blr = cityRepository.save(new City("Bengaluru", "Karnataka"));
        City hyd = cityRepository.save(new City("Hyderabad", "Telangana"));
        City pune = cityRepository.save(new City("Pune", "Maharashtra"));
        City chn = cityRepository.save(new City("Chennai", "Tamil Nadu"));
        City del = cityRepository.save(new City("Delhi NCR", "Delhi"));

        // 2. Seed Localities for Bengaluru
        localityRepository.save(new Locality(blr.getId(), "Koramangala", "560034"));
        Locality hsr = localityRepository.save(new Locality(blr.getId(), "HSR Layout", "560102"));
        localityRepository.save(new Locality(blr.getId(), "Indiranagar", "560038"));
        localityRepository.save(new Locality(blr.getId(), "Whitefield", "560066"));
        localityRepository.save(new Locality(blr.getId(), "Electronic City", "560100"));

        // 3. Seed Amenities
        amenityRepository.save(new Amenity("WIFI", "High-speed Wi-Fi", "Connectivity", "wifi"));
        amenityRepository.save(new Amenity("AC", "Air Conditioning", "Comfort", "wind"));
        amenityRepository.save(new Amenity("FOOD", "3 Times North/South Food", "Dining", "utensils"));
        amenityRepository.save(new Amenity("WASHING_MACHINE", "Automatic Washing Machine", "Laundry", "tshirt"));
        amenityRepository.save(new Amenity("POWER_BACKUP", "24/7 Power Backup", "Utility", "bolt"));
        amenityRepository.save(new Amenity("HOUSEKEEPING", "Daily Room Cleaning", "Service", "broom"));
        amenityRepository.save(new Amenity("CCTV", "CCTV & Biometric Security", "Security", "shield-alt"));
        amenityRepository.save(new Amenity("RO_WATER", "Purified RO Drinking Water", "Utility", "tint"));

        // 4. Seed Subscription Plans
        subscriptionPlanRepository.save(new SubscriptionPlan("STARTER", "Starter PG Plan", 99900L, 1, 10, 1, false));
        subscriptionPlanRepository.save(new SubscriptionPlan("GROWTH", "Growth Multi-Property Plan", 249900L, 5, 50, 3, false));
        subscriptionPlanRepository.save(new SubscriptionPlan("BUSINESS", "Business Enterprise Plan", 499900L, 20, 250, 10, true));

        // 5. Seed Platform Admin
        User admin = new User();
        admin.setFullName("StayNest Administrator");
        admin.setEmail("admin@staynest.in");
        admin.setPhone("9999900000");
        admin.setPasswordHash(passwordEncoder.encode("Admin@123456"));
        admin.setRole(UserRole.ROLE_ADMIN);
        admin.setStatus(UserStatus.ACTIVE);
        admin.setEmailVerified(true);
        admin.setPhoneVerified(true);
        userRepository.save(admin);

        // 6. Seed Demo Owner & Verified PG Listing
        User owner = new User();
        owner.setFullName("Ramesh Kumar");
        owner.setEmail("owner@staynest.in");
        owner.setPhone("9888811111");
        owner.setPasswordHash(passwordEncoder.encode("Owner@123456"));
        owner.setRole(UserRole.ROLE_OWNER);
        owner.setStatus(UserStatus.ACTIVE);
        owner.setEmailVerified(true);
        owner.setPhoneVerified(true);
        owner = userRepository.save(owner);

        OwnerProfile ownerProfile = new OwnerProfile(owner.getId(), "Kumar Luxury Living");
        ownerProfile.setVerificationStatus(VerificationStatus.VERIFIED);
        ownerProfile.setPanNumber("ABCDE1234F");
        ownerProfile.setPayoutUpi("ramesh@okhdfcbank");
        ownerProfileRepository.save(ownerProfile);

        Property property = new Property();
        property.setOwnerId(owner.getId());
        property.setName("StayNest Serene Living PG");
        property.setPropertyType(PropertyType.PG);
        property.setGenderPolicy(GenderPolicy.CO_ED);
        property.setDescription("Premium co-living PG with high-speed internet, chef-prepared meals, daily housekeeping and 24x7 security in HSR Layout Sector 2.");
        property.setCityId(blr.getId());
        property.setLocalityId(hsr.getId());
        property.setAddressLine("#42, 14th Main, Sector 2, HSR Layout");
        property.setPincode("560102");
        property.setLatitude(12.9121);
        property.setLongitude(77.6446);
        property.setApprovalStatus(ApprovalStatus.APPROVED);
        property.setPublished(true);
        property.setPublishedAt(Instant.now());
        property.setStartingPricePaise(850000L); // 8,500 INR
        property.setDepositMonths(1);
        property.setNoticePeriodDays(30);
        property.setFoodIncluded(true);
        property.setPayAtPropertyAllowed(true);
        property.setRules("Quiet hours after 10:30 PM. Smoking not permitted inside rooms.");
        property.setCancellationPolicy("Free cancellation up to 7 days before check-in. 50% refund thereafter.");
        property.setAmenities(List.of("WIFI", "AC", "FOOD", "WASHING_MACHINE", "POWER_BACKUP", "HOUSEKEEPING", "CCTV", "RO_WATER"));
        property = propertyRepository.save(property);

        // Add photos
        propertyPhotoRepository.save(new PropertyPhoto(property.getId(), "https://images.unsplash.com/photo-1555854877-bab0e564b8d5", "Modern Facade", true));
        propertyPhotoRepository.save(new PropertyPhoto(property.getId(), "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af", "Cozy Room", false));

        // Add Room 1 (Double Sharing)
        Room room1 = new Room();
        room1.setPropertyId(property.getId());
        room1.setRoomNumber("101");
        room1.setSharingType(SharingType.DOUBLE);
        room1.setCapacity(2);
        room1.setFloorNumber(1);
        room1.setRentMonthlyPaise(950000L); // ₹9,500
        room1.setDepositPaise(950000L);
        room1 = roomRepository.save(room1);

        bedRepository.save(new Bed(room1.getId(), property.getId(), "Bed A"));
        bedRepository.save(new Bed(room1.getId(), property.getId(), "Bed B"));

        // Add Room 2 (Single Sharing)
        Room room2 = new Room();
        room2.setPropertyId(property.getId());
        room2.setRoomNumber("102");
        room2.setSharingType(SharingType.SINGLE);
        room2.setCapacity(1);
        room2.setFloorNumber(1);
        room2.setRentMonthlyPaise(1600000L); // ₹16,000
        room2.setDepositPaise(1600000L);
        room2 = roomRepository.save(room2);

        bedRepository.save(new Bed(room2.getId(), property.getId(), "Bed 1"));

        // 7. Seed Demo Customer
        User customer = new User();
        customer.setFullName("Priya Sharma");
        customer.setEmail("customer@staynest.in");
        customer.setPhone("9777722222");
        customer.setPasswordHash(passwordEncoder.encode("Customer@123456"));
        customer.setRole(UserRole.ROLE_CUSTOMER);
        customer.setStatus(UserStatus.ACTIVE);
        customer.setEmailVerified(true);
        customer.setPhoneVerified(true);
        userRepository.save(customer);

        log.info("StayNest platform successfully seeded with demo accounts, properties, rooms, beds, and subscription tiers!");
    }
}

