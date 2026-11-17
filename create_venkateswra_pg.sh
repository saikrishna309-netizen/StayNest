#!/usr/bin/env bash
# =============================================================================
# StayNest - Create "Venkateswra Gents PG" (5 Floors, 25 Rooms, 70 Beds)
# =============================================================================

set -e
BASE_URL="http://localhost:8080/api/v1"

# Use provided token or default to your active token
OWNER_TOKEN="${TOKEN:-eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxZWQ3ZTQ2ZS1mMjg4LTQzMTQtODQyNy1mZWJmOWM3MjQxOTMiLCJlbWFpbCI6InNhaWtyaXNobmFrcmlzaG5hMTk5N0BnbWFpbC5jb20iLCJyb2xlIjoiUk9MRV9PV05FUiIsInR5cGUiOiJBQ0NFU1MiLCJpYXQiOjE3OTQ2NDMzNzIsImV4cCI6MTc5NDcyOTc3Mn0.RrICH37E1-_vuoai3gz7LkTi_cKgaMnlgOaPx1uZL-JTxHykfsCr7nCq_529lEFLpYXw443zZEjqwXI59zG0KQ}"

echo "======================================================================"
echo "StayNest: Deploying Venkateswra Gents PG"
echo "Target: $BASE_URL"
echo "======================================================================"

# 1. Quick check if backend is running
if ! curl -s "$BASE_URL/cities" > /dev/null; then
  echo "ERROR: Backend server is not running on port 8080!"
  echo "Please start the backend in another terminal with:"
  echo "  cd backend && JAVA_HOME=/opt/homebrew/opt/openjdk /opt/homebrew/bin/mvn -s settings.xml spring-boot:run -Dspring-boot.run.profiles=dev"
  exit 1
fi
echo "[1/6] Server is UP and healthy!"

# 2. Dynamically fetch City and Locality IDs from the live database
echo "[2/6] Fetching active City and Locality IDs from database..."
CITY_ID=$(curl -s "$BASE_URL/cities" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
if [ -z "$CITY_ID" ]; then
  echo "ERROR: No cities found in the database. Please ensure cities are seeded."
  exit 1
fi

LOCALITY_ID=$(curl -s "$BASE_URL/localities?cityId=$CITY_ID" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
echo "Using City ID: $CITY_ID"
if [ -n "$LOCALITY_ID" ]; then
  echo "Using Locality ID: $LOCALITY_ID"
fi

# 3. Get Admin token for automatic publishing
echo "[3/6] Authenticating Admin for auto-approval..."
ADMIN_LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staynest.in","password":"Admin@123456"}')
ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# 4. Create Property Listing
echo "[4/6] Creating Venkateswra Gents PG property..."
PROP_RESP=$(curl -s -X POST "$BASE_URL/owner/properties" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Venkateswra Gents PG\",
    \"propertyType\": \"PG\",
    \"genderPolicy\": \"BOYS\",
    \"description\": \"5-floor premium Gents PG in Koramangala. 2, 3, and 4 sharing rooms with attached washrooms, 3 daily meals, Wi-Fi, and power backup.\",
    \"cityId\": \"$CITY_ID\",
    \"localityId\": \"$LOCALITY_ID\",
    \"addressLine\": \"#24, 7th Main, 4th Block, Koramangala\",
    \"pincode\": \"560034\",
    \"startingPricePaise\": 650000,
    \"foodIncluded\": true,
    \"payAtPropertyAllowed\": true,
    \"rules\": \"Gates close at 11:00 PM. Smoking prohibited.\",
    \"cancellationPolicy\": \"Full refund if cancelled 7 days prior.\",
    \"amenities\": [\"WIFI\", \"AC\", \"FOOD\", \"WASHING_MACHINE\", \"POWER_BACKUP\", \"HOUSEKEEPING\", \"CCTV\", \"RO_WATER\"]
  }")

PROPERTY_ID=$(echo "$PROP_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -z "$PROPERTY_ID" ]; then
  echo "Failed to create property. Server response: $PROP_RESP"
  exit 1
fi
echo "Property created successfully! ID: $PROPERTY_ID"

# 5. Loop 5 Floors x 5 Rooms = 25 Rooms & 70 Beds
echo "[5/6] Building 5 Floors, 25 Rooms and 70 Beds..."

ROOM_COUNT=0
BED_COUNT=0

for FLOOR in {1..5}; do
  for ROOM_IDX in {1..5}; do
    ROOM_NUM="${FLOOR}0${ROOM_IDX}"

    # Rooms 1 & 2: 2-sharing (Double) -> ₹8,000 (800000 paise)
    # Rooms 3 & 4: 3-sharing (Triple) -> ₹7,000 (700000 paise)
    # Room 5:      4-sharing (4-plus) -> ₹6,500 (650000 paise)
    if [ "$ROOM_IDX" -le 2 ]; then
      SHARING="DOUBLE"; CAPACITY=2; RENT_PAISE=800000
    elif [ "$ROOM_IDX" -le 4 ]; then
      SHARING="TRIPLE"; CAPACITY=3; RENT_PAISE=700000
    else
      SHARING="FOUR_PLUS"; CAPACITY=4; RENT_PAISE=650000
    fi

    ROOM_RESP=$(curl -s -X POST "$BASE_URL/owner/properties/$PROPERTY_ID/rooms" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"roomNumber\": \"$ROOM_NUM\",
        \"sharingType\": \"$SHARING\",
        \"capacity\": $CAPACITY,
        \"floorNumber\": $FLOOR,
        \"rentMonthlyPaise\": $RENT_PAISE,
        \"depositPaise\": $RENT_PAISE
      }")

    ROOM_ID=$(echo "$ROOM_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)
    ROOM_COUNT=$((ROOM_COUNT + 1))

    BED_LABELS=("A" "B" "C" "D")
    for ((b=0; b<CAPACITY; b++)); do
      curl -s -X POST "$BASE_URL/owner/rooms/$ROOM_ID/beds" \
        -H "Authorization: Bearer $OWNER_TOKEN" \
        -H "Content-Type: application/json" \
        -d "{\"bedLabel\": \"Bed ${ROOM_NUM}-${BED_LABELS[$b]}\"}" > /dev/null
      BED_COUNT=$((BED_COUNT + 1))
    done
  done
  echo "  ✓ Floor $FLOOR complete (5 rooms added)"
done

# 6. Submit & Approve
echo "[6/6] Publishing property..."
curl -s -X POST "$BASE_URL/owner/properties/$PROPERTY_ID/submit" \
  -H "Authorization: Bearer $OWNER_TOKEN" > /dev/null

curl -s -X POST "$BASE_URL/admin/properties/$PROPERTY_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null

echo "======================================================================"
echo "SUCCESS! Venkateswra Gents PG is now LIVE on StayNest!"
echo "Property ID: $PROPERTY_ID"
echo "Rooms Created: $ROOM_COUNT (5 Floors x 5 Rooms/Floor)"
echo "Beds Created: $BED_COUNT Beds"
echo "Rates Configured:"
echo "  • 2-Sharing (Double):  ₹8,000/month (Rooms x01, x02)"
echo "  • 3-Sharing (Triple):  ₹7,000/month (Rooms x03, x04)"
echo "  • 4-Sharing (4 Plus):  ₹6,500/month (Room x05)"
echo "======================================================================"
echo "View your live property:"
echo "curl -s http://localhost:8080/api/v1/properties/$PROPERTY_ID | python3 -m json.tool"
