# Unique ID System Based on WhatsApp Number

## Overview

The system generates a **deterministic, unique ID** for each candidate based on their WhatsApp number. This ensures that:
- The same WhatsApp number always generates the same ID
- The ID is unique across all candidates
- The ID is compatible with MongoDB ObjectId format (24 hex characters)

## How It Works

### ID Generation

The ID is generated using a **SHA-256 hash** of the normalized WhatsApp number:

```typescript
function generateCandidateId(whatsappNumber: string): string {
  // Normalize: remove spaces, ensure consistent format
  const normalized = whatsappNumber.replace(/\s+/g, '').trim();
  
  // Create SHA-256 hash
  const hash = crypto.createHash('sha256').update(normalized).digest('hex');
  
  // Take first 24 characters (MongoDB ObjectId format)
  return hash.substring(0, 24);
}
```

### Example

```javascript
WhatsApp Number: "+911234567890"
Generated ID: "a1b2c3d4e5f6g7h8i9j0k1l2" (24 hex characters)

// Same number always generates same ID
generateCandidateId("+911234567890") === "a1b2c3d4e5f6g7h8i9j0k1l2" // true
```

## Database Storage

### Candidate Model

```prisma
model Candidate {
  id                String    @id @default(auto()) @map("_id") @db.ObjectId
  whatsappNumber    String    @unique
  countryCode       String    @default("+91")
  isVerified        Boolean   @default(false)
  // ... other fields
}
```

**Note**: The `id` field is now set explicitly when creating candidates, using the generated ID from WhatsApp number.

## Implementation Details

### 1. Send OTP Flow

When a user requests an OTP:
1. WhatsApp number is normalized (removed spaces, trimmed)
2. Unique ID is generated from the WhatsApp number
3. System checks if candidate exists by:
   - First: Check by generated ID
   - Second: Check by WhatsApp number (for backward compatibility)
4. If candidate doesn't exist, create with generated ID
5. Store OTP linked to candidate ID

### 2. Verify OTP Flow

When verifying OTP:
1. Generate candidate ID from WhatsApp number
2. Find candidate by generated ID
3. Verify OTP and update candidate status

### 3. Resend OTP Flow

Similar to Send OTP, uses the same ID generation logic.

## Benefits

1. **Deterministic**: Same WhatsApp number = Same ID (always)
2. **Unique**: SHA-256 hash ensures uniqueness
3. **Consistent**: No random IDs, predictable for same input
4. **Backward Compatible**: Handles existing records that might have different IDs
5. **MongoDB Compatible**: 24-character hex string matches ObjectId format

## Backward Compatibility

The system handles existing candidates that were created before this ID system:
- First tries to find by generated ID
- Falls back to finding by WhatsApp number (which is unique)
- New candidates always use the ID-based system

## Testing

To verify the ID generation:

```javascript
const { generateCandidateId } = require('./src/utils/candidate.util');

const id1 = generateCandidateId("+911234567890");
const id2 = generateCandidateId("+911234567890");
const id3 = generateCandidateId("+911234567891");

console.log(id1 === id2); // true (same number = same ID)
console.log(id1 === id3); // false (different number = different ID)
```

## Security Considerations

- The hash is one-way (cannot reverse to get WhatsApp number)
- The ID doesn't expose the WhatsApp number
- SHA-256 provides strong collision resistance
- Normalization ensures consistent hashing regardless of input format

## Future Enhancements

1. **Migration Script**: Migrate existing candidates to use ID-based system
2. **ID Validation**: Add validation to ensure ID format is correct
3. **Caching**: Cache ID generation for frequently accessed numbers
4. **Monitoring**: Track ID collisions (should be extremely rare with SHA-256)
