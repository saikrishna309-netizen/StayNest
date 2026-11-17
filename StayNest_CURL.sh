#!/usr/bin/env bash
# =============================================================================
# StayNest - Direct cURL Commands & Test Script
# =============================================================================
# You can:
# 1. Run the entire script to test APIs:  bash StayNest_CURL.sh
# 2. Or copy-paste any single curl command below directly into your terminal!
# =============================================================================

BASE_URL="http://localhost:8080/api/v1"

echo "=================================================="
echo "StayNest API Test Suite"
echo "Target: $BASE_URL"
echo "=================================================="

# -----------------------------------------------------------------------------
# 1. PUBLIC DISCOVERY (No Auth Needed)
# -----------------------------------------------------------------------------

echo -e "\n[1.1] Fetch Supported Cities:"
curl -s -X GET "$BASE_URL/cities" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.2] Fetch Localities for Bengaluru:"
curl -s -X GET "$BASE_URL/localities?cityId=6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.3] Search Properties (Co-Ed in Bengaluru):"
curl -s -X GET "$BASE_URL/properties?cityId=6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04&genderPolicy=CO_ED&page=0&size=5" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.4] View Published Property Details:"
curl -s -X GET "$BASE_URL/properties/f1111111-1111-1111-1111-111111111111" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.5] Check Bed Availability:"
curl -s -X GET "$BASE_URL/properties/f1111111-1111-1111-1111-111111111111/availability?checkIn=2026-12-01&checkOut=2027-05-31" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.6] View Property Reviews:"
curl -s -X GET "$BASE_URL/properties/f1111111-1111-1111-1111-111111111111/reviews" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[1.7] List SaaS Subscription Plans:"
curl -s -X GET "$BASE_URL/subscription-plans" \
  -H "Accept: application/json" | python3 -m json.tool || true

# -----------------------------------------------------------------------------
# 2. AUTHENTICATION & LOGIN (Extracting JWT Tokens)
# -----------------------------------------------------------------------------

echo -e "\n[2.1] Login as Customer:"
CUSTOMER_LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@staynest.in",
    "password": "Customer@123456"
  }')
echo "$CUSTOMER_LOGIN_RESP" | python3 -m json.tool || echo "$CUSTOMER_LOGIN_RESP"

CUSTOMER_TOKEN=$(echo "$CUSTOMER_LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo -e "\n[2.2] Login as Owner:"
OWNER_LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@staynest.in",
    "password": "Owner@123456"
  }')
echo "$OWNER_LOGIN_RESP" | python3 -m json.tool || echo "$OWNER_LOGIN_RESP"

OWNER_TOKEN=$(echo "$OWNER_LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

echo -e "\n[2.3] Login as Admin:"
ADMIN_LOGIN_RESP=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@staynest.in",
    "password": "Admin@123456"
  }')
echo "$ADMIN_LOGIN_RESP" | python3 -m json.tool || echo "$ADMIN_LOGIN_RESP"

ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESP" | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

# -----------------------------------------------------------------------------
# 3. USER PROFILE (Authenticated)
# -----------------------------------------------------------------------------

echo -e "\n[3.1] Get My Profile (Customer):"
curl -s -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Accept: application/json" | python3 -m json.tool || true

echo -e "\n[3.2] Update Profile:"
curl -s -X PATCH "$BASE_URL/users/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Priya S. Sharma",
    "phone": "9777722222",
    "emergencyContact": "9888800000"
  }' | python3 -m json.tool || true

# -----------------------------------------------------------------------------
# 4. BOOKING FLOW (15-min Hold + Confirmation)
# -----------------------------------------------------------------------------

echo -e "\n[4.1] Create 15-Minute Temporary Hold on Bed:"
HOLD_RESP=$(curl -s -X POST "$BASE_URL/bookings/holds" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "f1111111-1111-1111-1111-111111111111",
    "roomId": "a1111111-1111-1111-1111-111111111111",
    "bedId": "b0000001-0000-0000-0000-000000000001",
    "checkInDate": "2026-12-01",
    "checkOutDate": "2027-05-31"
  }')
echo "$HOLD_RESP" | python3 -m json.tool || echo "$HOLD_RESP"

HOLD_ID=$(echo "$HOLD_RESP" | grep -o '"holdId":"[^"]*' | cut -d'"' -f4)

echo -e "\n[4.2] Create Booking (Confirm Reservation):"
BOOKING_RESP=$(curl -s -X POST "$BASE_URL/bookings" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Idempotency-Key: curl-test-key-$(date +%s)" \
  -H "Content-Type: application/json" \
  -d "{
    \"propertyId\": \"f1111111-1111-1111-1111-111111111111\",
    \"roomId\": \"a1111111-1111-1111-1111-111111111111\",
    \"bedId\": \"b0000001-0000-0000-0000-000000000001\",
    \"holdId\": \"$HOLD_ID\",
    \"checkInDate\": \"2026-12-01\",
    \"checkOutDate\": \"2027-05-31\",
    \"rentMonthlyPaise\": 950000,
    \"depositPaise\": 950000,
    \"specialRequests\": \"Quiet room preferred\"
  }")
echo "$BOOKING_RESP" | python3 -m json.tool || echo "$BOOKING_RESP"

BOOKING_ID=$(echo "$BOOKING_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

echo -e "\n[4.3] List Customer Bookings:"
curl -s -X GET "$BASE_URL/customer/bookings" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" | python3 -m json.tool || true

# -----------------------------------------------------------------------------
# 5. PAYMENTS & WEBHOOKS
# -----------------------------------------------------------------------------

if [ -n "$BOOKING_ID" ]; then
  echo -e "\n[5.1] Create Gateway Order for Booking $BOOKING_ID:"
  ORDER_RESP=$(curl -s -X POST "$BASE_URL/payments/orders" \
    -H "Authorization: Bearer $CUSTOMER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"bookingId\": \"$BOOKING_ID\",
      \"amountPaise\": 950000,
      \"paymentType\": \"BOOKING_ADVANCE\",
      \"paymentMethod\": \"ONLINE\",
      \"gatewayProvider\": \"RAZORPAY\"
    }")
  echo "$ORDER_RESP" | python3 -m json.tool || echo "$ORDER_RESP"

  PAYMENT_ID=$(echo "$ORDER_RESP" | grep -o '"paymentId":"[^"]*' | cut -d'"' -f4)
  GATEWAY_ORDER_ID=$(echo "$ORDER_RESP" | grep -o '"gatewayOrderId":"[^"]*' | cut -d'"' -f4)

  if [ -n "$PAYMENT_ID" ]; then
    echo -e "\n[5.2] Check Payment Status ($PAYMENT_ID):"
    curl -s -X GET "$BASE_URL/payments/$PAYMENT_ID" \
      -H "Authorization: Bearer $CUSTOMER_TOKEN" | python3 -m json.tool || true

    echo -e "\n[5.3] Simulate Gateway Webhook (payment.captured):"
    curl -s -X POST "$BASE_URL/payments/webhooks/razorpay" \
      -H "Content-Type: application/json" \
      -d "{
        \"event\": \"payment.captured\",
        \"payload\": {
          \"payment\": {
            \"entity\": {
              \"id\": \"pay_curl_mock_12345\",
              \"order_id\": \"$GATEWAY_ORDER_ID\",
              \"amount\": 950000,
              \"status\": \"captured\"
            }
          }
        }
      }" | python3 -m json.tool || true
  fi
fi

# -----------------------------------------------------------------------------
# 6. PROPERTY OWNER OPERATIONS
# -----------------------------------------------------------------------------

echo -e "\n[6.1] List Owner's Properties:"
curl -s -X GET "$BASE_URL/owner/properties" \
  -H "Authorization: Bearer $OWNER_TOKEN" | python3 -m json.tool || true

echo -e "\n[6.2] Create New Draft Property Listing:"
NEW_PROP_RESP=$(curl -s -X POST "$BASE_URL/owner/properties" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "StayNest Luxury Residence",
    "propertyType": "PG",
    "genderPolicy": "CO_ED",
    "description": "Premium living spaces in Indiranagar with high-speed internet and daily housekeeping.",
    "cityId": "6b31843d-a7cc-46ad-8ad0-8b4b2cfc8c04",
    "localityId": "b3333333-3333-3333-3333-333333333333",
    "addressLine": "#101, 12th Main, Indiranagar",
    "pincode": "560038",
    "latitude": 12.9716,
    "longitude": 77.6412,
    "startingPricePaise": 1100000,
    "noticePeriodDays": 30,
    "depositMonths": 1,
    "foodIncluded": true,
    "payAtPropertyAllowed": true,
    "rules": "Quiet hours 10 PM to 6 AM.",
    "cancellationPolicy": "Full refund if cancelled 7 days before check-in.",
    "amenityCodes": ["WIFI", "AC", "FOOD", "POWER_BACKUP", "RO_WATER"]
  }')
echo "$NEW_PROP_RESP" | python3 -m json.tool || echo "$NEW_PROP_RESP"

NEW_PROP_ID=$(echo "$NEW_PROP_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$NEW_PROP_ID" ]; then
  echo -e "\n[6.3] Create Room under Property ($NEW_PROP_ID):"
  NEW_ROOM_RESP=$(curl -s -X POST "$BASE_URL/owner/properties/$NEW_PROP_ID/rooms" \
    -H "Authorization: Bearer $OWNER_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "roomNumber": "101",
      "sharingType": "DOUBLE",
      "capacity": 2,
      "floorNumber": 1,
      "rentMonthlyPaise": 1100000,
      "depositPaise": 1100000
    }')
  echo "$NEW_ROOM_RESP" | python3 -m json.tool || echo "$NEW_ROOM_RESP"

  NEW_ROOM_ID=$(echo "$NEW_ROOM_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -n "$NEW_ROOM_ID" ]; then
    echo -e "\n[6.4] Create Bed in Room ($NEW_ROOM_ID):"
    curl -s -X POST "$BASE_URL/owner/rooms/$NEW_ROOM_ID/beds" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "bedLabel": "Bed 101-A"
      }' | python3 -m json.tool || true
  fi

  echo -e "\n[6.5] Submit Property for Platform Approval:"
  curl -s -X POST "$BASE_URL/owner/properties/$NEW_PROP_ID/submit" \
    -H "Authorization: Bearer $OWNER_TOKEN" | python3 -m json.tool || true

  echo -e "\n[6.6] Admin Approves Property ($NEW_PROP_ID):"
  curl -s -X POST "$BASE_URL/admin/properties/$NEW_PROP_ID/approve" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool || true
fi

# -----------------------------------------------------------------------------
# 7. TENANTS, INVOICES & REPORTS (PMS)
# -----------------------------------------------------------------------------

echo -e "\n[7.1] Onboard New Tenant:"
TENANT_RESP=$(curl -s -X POST "$BASE_URL/owner/tenants" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Amit Patel",
    "phone": "9812345678",
    "email": "amit.p@example.com",
    "emergencyContact": "9812300000",
    "idProofType": "AADHAAR",
    "idProofNumber": "9876-5432-1098"
  }')
echo "$TENANT_RESP" | python3 -m json.tool || echo "$TENANT_RESP"

TENANT_ID=$(echo "$TENANT_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

if [ -n "$TENANT_ID" ]; then
  echo -e "\n[7.2] Generate Monthly Rent Invoice for Tenant:"
  INVOICE_RESP=$(curl -s -X POST "$BASE_URL/owner/rent-invoices" \
    -H "Authorization: Bearer $OWNER_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"tenantId\": \"$TENANT_ID\",
      \"propertyId\": \"f1111111-1111-1111-1111-111111111111\",
      \"billingPeriod\": \"2026-11\",
      \"amountPaise\": 950000,
      \"dueDate\": \"2026-11-05\"
    }")
  echo "$INVOICE_RESP" | python3 -m json.tool || echo "$INVOICE_RESP"

  INVOICE_ID=$(echo "$INVOICE_RESP" | grep -o '"id":"[^"]*' | head -1 | cut -d'"' -f4)

  if [ -n "$INVOICE_ID" ]; then
    echo -e "\n[7.3] Record Offline Rent Payment (UPI):"
    curl -s -X POST "$BASE_URL/owner/rent-invoices/$INVOICE_ID/payments" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{
        "amountPaise": 950000,
        "paymentMode": "UPI",
        "referenceNumber": "UPI-TRANS-778899"
      }' | python3 -m json.tool || true
  fi
fi

echo -e "\n[7.4] Record Property Expense (Electricity Bill):"
curl -s -X POST "$BASE_URL/owner/expenses" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "propertyId": "f1111111-1111-1111-1111-111111111111",
    "category": "ELECTRICITY",
    "amountPaise": 1500000,
    "paymentMode": "ONLINE",
    "paidTo": "BESCOM Electricity",
    "notes": "November electricity billing"
  }' | python3 -m json.tool || true

echo -e "\n[7.5] Get Owner Monthly Financial Report:"
curl -s -X GET "$BASE_URL/owner/reports/monthly?month=2026-11" \
  -H "Authorization: Bearer $OWNER_TOKEN" | python3 -m json.tool || true

echo -e "\n[7.6] Get Occupancy Report:"
curl -s -X GET "$BASE_URL/owner/reports/occupancy" \
  -H "Authorization: Bearer $OWNER_TOKEN" | python3 -m json.tool || true

echo -e "\n[7.7] Export Financial Report (CSV preview):"
curl -s -X GET "$BASE_URL/owner/reports/export?format=csv" \
  -H "Authorization: Bearer $OWNER_TOKEN" | head -n 10

# -----------------------------------------------------------------------------
# 8. ADMIN DIRECTORY & AUDIT LOGS
# -----------------------------------------------------------------------------

echo -e "\n[8.1] List Users in Admin Directory:"
curl -s -X GET "$BASE_URL/admin/users?page=0&size=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool || true

echo -e "\n[8.2] View Platform Audit Logs:"
curl -s -X GET "$BASE_URL/admin/audit-logs?page=0&size=5" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | python3 -m json.tool || true

echo -e "\n=================================================="
echo "StayNest API Test Run Complete!"
echo "=================================================="

