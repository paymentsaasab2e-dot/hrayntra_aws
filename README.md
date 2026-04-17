# Job Portal Backend API

Backend API for the Job Portal application built with Express, TypeScript, Prisma, and MongoDB.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env` file in the root directory with the following variables:
   ```env
   DATABASE_URL="mongodb+srv://softwareaitik_db_user:zxFPaSdkNGlimQSk@cluster0.a6kmygv.mongodb.net/jobportal?retryWrites=true&w=majority&appName=Cluster0"
   PORT=5000
   NODE_ENV=development
   FRONTEND_URL=http://localhost:3000
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```

4. **Run database migrations (if needed):**
   ```bash
   npm run prisma:migrate
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication

#### Send OTP
- **POST** `/api/auth/send-otp`
- **Body:**
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "data": {
      "candidateId": "...",
      "whatsappNumber": "+911234567890",
      "otp": "123456", // Only in development
      "expiresAt": "2024-01-01T12:05:00.000Z"
    }
  }
  ```

#### Verify OTP
- **POST** `/api/auth/verify-otp`
- **Body:**
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91",
    "otp": "123456"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "OTP verified successfully",
    "data": {
      "candidateId": "...",
      "isVerified": true
    }
  }
  ```

#### Resend OTP
- **POST** `/api/auth/resend-otp`
- **Body:**
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91"
  }
  ```

## Development Notes

- In development mode, the OTP is returned in the API response for testing purposes
- In production, the OTP should be sent via WhatsApp API (not included in response)
- OTP expires after 5 minutes
- Only one pending OTP is allowed per candidate at a time
