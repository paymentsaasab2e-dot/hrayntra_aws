# Backend Setup Instructions

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- MongoDB Atlas account (already configured)

## Step 1: Install Dependencies

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

## Step 2: Create Environment File

Create a `.env` file in the `backend` directory with the following content:

```env
# MongoDB via Prisma
DATABASE_URL="mongodb+srv://softwareaitik_db_user:zxFPaSdkNGlimQSk@cluster0.a6kmygv.mongodb.net/jobportal?retryWrites=true&w=majority&appName=Cluster0"

# Cloudinary
CLOUDINARY_CLOUD_NAME=drxzuvrbq
CLOUDINARY_API_KEY=287341442254438
CLOUDINARY_API_SECRET=-qLy26-wuIfqzh0nBFn9cJ0OSUQ

# Resend Email
RESEND_API_KEY=re_GejWT8xQ_9TT7Yko5BffUTuTcEeHxMJKw
RESEND_FROM_EMAIL=onboarding@resend.dev

# JWT
JWT_ACCESS_SECRET=jobportal_access_secret_2024_secure
JWT_REFRESH_SECRET=jobportal_refresh_secret_2024_secure
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Server
PORT=5000
NODE_ENV=development

# Frontend
FRONTEND_URL=http://localhost:3000
```

## Step 3: Generate Prisma Client

```bash
npm run prisma:generate
```

This will generate the Prisma Client based on the schema.

## Step 4: Run Database Migrations (Optional)

If you need to push the schema to MongoDB:

```bash
npm run prisma:migrate
```

Note: For MongoDB, Prisma uses `prisma db push` instead of migrations. You can also use:

```bash
npx prisma db push
```

## Step 5: Start the Development Server

```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Step 6: Verify the Setup

1. Check if the server is running:
   ```bash
   curl http://localhost:5000/health
   ```
   Should return: `{"status":"ok","message":"Server is running"}`

2. Test the OTP endpoint:
   ```bash
   curl -X POST http://localhost:5000/api/auth/send-otp \
     -H "Content-Type: application/json" \
     -d '{"whatsappNumber":"1234567890","countryCode":"+91"}'
   ```

## Frontend Integration

Make sure your frontend has the API URL configured. In the frontend `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

## Development Notes

- **OTP Display**: In development mode (`NODE_ENV=development`), the OTP is returned in the API response and displayed on the frontend for testing purposes.
- **OTP Expiration**: OTPs expire after 5 minutes.
- **OTP Format**: 6-digit numeric code.
- **Database**: Uses MongoDB Atlas. The connection string is already configured in the `.env` file.

## Troubleshooting

### Prisma Client not found
```bash
npm run prisma:generate
```

### Database connection issues
- Verify your MongoDB Atlas connection string
- Check if your IP is whitelisted in MongoDB Atlas
- Ensure the database name is correct (`jobportal`)

### Port already in use
Change the `PORT` in `.env` file to a different port (e.g., 5001)

### CORS issues
Make sure `FRONTEND_URL` in `.env` matches your frontend URL (default: `http://localhost:3000`)
