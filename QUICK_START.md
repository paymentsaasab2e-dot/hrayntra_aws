# Quick Start Guide - Backend & Frontend Integration

## Overview
This guide will help you set up and run both the backend and frontend with OTP functionality integrated.

## Backend Setup

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Create `.env` File
Create a `.env` file in the `backend` directory with this content:

```env
DATABASE_URL="mongodb+srv://softwareaitik_db_user:zxFPaSdkNGlimQSk@cluster0.a6kmygv.mongodb.net/jobportal?retryWrites=true&w=majority&appName=Cluster0"
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Generate Prisma Client
```bash
npm run prisma:generate
```

### 5. Start Backend Server
```bash
npm run dev
```

The backend will run on `http://localhost:5000`

## Frontend Setup

### 1. Navigate to Frontend Directory
```bash
cd phasdenewwwww
```

### 2. Create `.env.local` File
Create a `.env.local` file in the `phasdenewwwww` directory:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

### 3. Start Frontend Server
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

## Testing the Integration

### 1. Open WhatsApp Login Page
Navigate to: `http://localhost:3000/whatsapp`

### 2. Enter WhatsApp Number
- Select country code (default: +91)
- Enter your WhatsApp number (e.g., 1234567890)
- Click "Send OTP on WhatsApp"

### 3. OTP Display (Development Mode)
- In development mode, the OTP will be displayed on the screen in a green box
- The OTP is also returned in the API response
- Example: "Development Mode - OTP: 123456"

### 4. Verify OTP
- You'll be redirected to `/whatsapp/verify`
- Enter the 6-digit OTP shown on the previous screen
- Click "Verify OTP"
- On success, you'll be redirected to `/uploadcv`

## API Endpoints

### Send OTP
- **URL**: `POST /api/auth/send-otp`
- **Body**:
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91"
  }
  ```
- **Response** (Development):
  ```json
  {
    "success": true,
    "message": "OTP sent successfully",
    "data": {
      "candidateId": "...",
      "whatsappNumber": "+911234567890",
      "otp": "123456",
      "expiresAt": "2024-01-01T12:05:00.000Z"
    }
  }
  ```

### Verify OTP
- **URL**: `POST /api/auth/verify-otp`
- **Body**:
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91",
    "otp": "123456"
  }
  ```
- **Response**:
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

### Resend OTP
- **URL**: `POST /api/auth/resend-otp`
- **Body**:
  ```json
  {
    "whatsappNumber": "1234567890",
    "countryCode": "+91"
  }
  ```

## Features

### ✅ Implemented
- OTP generation (6-digit numeric)
- OTP storage in MongoDB via Prisma
- OTP expiration (5 minutes)
- OTP verification
- Candidate creation/retrieval
- Frontend integration
- OTP display in development mode
- Error handling
- Form validation

### 🔄 Future Enhancements
- WhatsApp API integration for production OTP delivery
- Rate limiting for OTP requests
- JWT token generation after verification
- Session management

## Troubleshooting

### Backend won't start
- Check if port 5000 is available
- Verify `.env` file exists and has correct values
- Run `npm run prisma:generate` if Prisma errors occur

### Frontend can't connect to backend
- Ensure backend is running on port 5000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Verify CORS settings in backend

### OTP not showing
- Check browser console for errors
- Verify backend is in development mode (`NODE_ENV=development`)
- Check network tab for API response

### Database connection errors
- Verify MongoDB connection string
- Check if IP is whitelisted in MongoDB Atlas
- Ensure database name is correct

## Development Notes

- **OTP Display**: The OTP is intentionally shown in development mode for testing. In production, this should be removed and OTP should only be sent via WhatsApp API.
- **Session Storage**: WhatsApp number and country code are stored in `sessionStorage` to pass between pages.
- **Error Handling**: Both frontend and backend have comprehensive error handling with user-friendly messages.

## Next Steps

1. Integrate WhatsApp API for production OTP delivery
2. Add JWT authentication after OTP verification
3. Implement rate limiting
4. Add logging and monitoring
5. Set up production environment variables
