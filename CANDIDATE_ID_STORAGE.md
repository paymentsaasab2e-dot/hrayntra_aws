# Candidate ID Storage in Database

## ✅ YES - Candidate ID IS Stored in Database

The candidate ID **IS being stored** in the database. Here's how it works:

## How Candidate ID is Stored

### 1. **ID Generation**
- ID is generated from WhatsApp number using SHA-256 hash
- Same WhatsApp number = Same ID (deterministic)
- Format: 24-character hex string (MongoDB ObjectId compatible)

### 2. **Storage Process**

#### **Step 1: Send OTP** (`/api/auth/send-otp`)
```typescript
// Generate ID from WhatsApp number
const candidateId = generateCandidateId("+919321362064");
// Result: "058cb12dcd8f7ef72d990457"

// Create candidate with this ID
candidate = await prisma.candidate.create({
  data: {
    id: candidateId, // ✅ ID IS STORED HERE
    whatsappNumber: fullWhatsAppNumber,
    countryCode: countryCode,
    isVerified: false,
  },
});
```

**Database Storage:**
```json
{
  "_id": "058cb12dcd8f7ef72d990457",  // ✅ Stored in DB
  "whatsappNumber": "+919321362064",
  "countryCode": "+91",
  "isVerified": false
}
```

#### **Step 2: Verify OTP** (`/api/auth/verify-otp`)
```typescript
// Generate same ID from WhatsApp number
const candidateId = generateCandidateId("+919321362064");
// Result: "058cb12dcd8f7ef72d990457" (same as before)

// If candidate has different ID, migrate to correct ID
if (candidate.id !== candidateId) {
  // Create new candidate with correct ID
  correctCandidate = await prisma.candidate.create({
    data: {
      id: candidateId, // ✅ ID STORED IN DB
      whatsappNumber: fullWhatsAppNumber,
      countryCode: countryCode,
      isVerified: true,
    },
  });
  
  // Delete old candidate
  // Migrate OTP verifications
}
```

## Database Schema

```prisma
model Candidate {
  id                String    @id @default(auto()) @map("_id") @db.ObjectId
  whatsappNumber    String    @unique
  countryCode       String    @default("+91")
  isVerified        Boolean   @default(false)
  // ...
}
```

**Note:** The `@default(auto())` means MongoDB will auto-generate an ID **ONLY if we don't provide one**. Since we **always provide the ID** when creating candidates, our generated ID is stored.

## Verification Logs

When you run the backend, you'll see logs confirming storage:

```
✅ Candidate created and stored in DB with ID: 058cb12dcd8f7ef72d990457
✅ Candidate ID matches generated ID: true
✅ VERIFICATION SUCCESS: Candidate stored in DB with ID: 058cb12dcd8f7ef72d990457
✅ FINAL VERIFICATION: Candidate confirmed in database
   - ID: 058cb12dcd8f7ef72d990457
   - WhatsApp: +919321362064
   - Verified: true
```

## How to Verify in Database

### Using MongoDB Compass or CLI:

```javascript
// Find candidate by WhatsApp number
db.candidates.findOne({ whatsappNumber: "+919321362064" })

// Result:
{
  "_id": ObjectId("058cb12dcd8f7ef72d990457"),  // ✅ ID based on WhatsApp
  "whatsappNumber": "+919321362064",
  "countryCode": "+91",
  "isVerified": true,
  "createdAt": ISODate("2025-03-05T10:47:03.585Z"),
  "updatedAt": ISODate("2025-03-05T10:47:23.062Z")
}
```

### Using Prisma Studio:

```bash
cd backend
npm run prisma:studio
```

Then navigate to `candidates` collection and verify:
- `_id` field shows the generated ID (e.g., `058cb12dcd8f7ef72d990457`)
- `whatsappNumber` matches the input
- `isVerified` is `true` after OTP verification

## Migration Process

If a candidate exists with a different ID (from before the ID system was implemented):

1. **During OTP Verification:**
   - System detects ID mismatch
   - Creates new candidate with correct ID
   - Migrates all OTP verifications
   - Deletes old candidate
   - **Result:** Candidate now has ID based on WhatsApp number

2. **Example:**
   ```
   Before:  _id: "69a95625d822d2d3e129fbc1" (auto-generated)
   After:   _id: "058cb12dcd8f7ef72d990457" (based on WhatsApp)
   ```

## Key Points

✅ **Candidate ID IS stored in database**
✅ **ID is based on WhatsApp number** (deterministic)
✅ **Same WhatsApp number = Same ID** (always)
✅ **Migration happens automatically** during OTP verification
✅ **Verification logs confirm storage**

## Testing

1. **Send OTP:**
   ```bash
   POST /api/auth/send-otp
   {
     "whatsappNumber": "9321362064",
     "countryCode": "+91"
   }
   ```
   - Check logs: `✅ Candidate created and stored in DB with ID: ...`

2. **Verify OTP:**
   ```bash
   POST /api/auth/verify-otp
   {
     "whatsappNumber": "9321362064",
     "countryCode": "+91",
     "otp": "123456"
   }
   ```
   - Check logs: `✅ FINAL VERIFICATION: Candidate confirmed in database`
   - Response includes: `candidateId: "058cb12dcd8f7ef72d990457"`

3. **Check Database:**
   - Query MongoDB or use Prisma Studio
   - Verify `_id` field matches generated ID

## Summary

**YES, the candidate ID is stored in the database.** The system:
- Generates ID from WhatsApp number
- Stores it when creating candidates
- Migrates to correct ID if needed during verification
- Verifies storage with database queries
- Logs all operations for debugging

The candidate ID is **permanently stored** in MongoDB and can be queried using either:
- The generated ID: `findById("058cb12dcd8f7ef72d990457")`
- The WhatsApp number: `findByWhatsAppNumber("+919321362064")`
