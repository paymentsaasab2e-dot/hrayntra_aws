# Backend Setup Instructions

## Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- MongoDB Atlas account

## Step 1: Install Dependencies

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

## Step 2: Create Environment File

Create a `.env` file in the `backend` directory. **Never commit real secrets.** Copy values from your password manager / cloud dashboards:

```env
# MongoDB via Prisma — from Atlas → Database → Connect
DATABASE_URL="mongodb+srv://<DB_USER>:<DB_PASSWORD>@<CLUSTER>.mongodb.net/jobportal?retryWrites=true&w=majority"

# Cloudinary — from Cloudinary Dashboard → API Keys
CLOUDINARY_CLOUD_NAME=<your_cloud_name>
CLOUDINARY_API_KEY=<your_api_key>
CLOUDINARY_API_SECRET=<your_api_secret>

# Resend Email — from Resend Dashboard → API Keys
RESEND_API_KEY=re_<your_resend_api_key>
RESEND_FROM_EMAIL=onboarding@resend.dev

# JWT — generate locally, e.g.:
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=<generate_strong_secret>
JWT_REFRESH_SECRET=<generate_strong_secret>
JWT_ACCESS_EXPIRES=30m
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
- **Database**: Uses MongoDB Atlas. Put the connection string only in local `.env` (never in docs or git).

## Troubleshooting

### Prisma Client not found
```bash
npm run prisma:generate
```

### Database connection issues
- Verify your MongoDB Atlas connection string in `.env`
- Check if your IP is whitelisted in MongoDB Atlas
- Ensure the database name is correct (`jobportal`)

### Port already in use
Change the `PORT` in `.env` file to a different port (e.g., 5001)

### CORS issues
Make sure `FRONTEND_URL` in `.env` matches your frontend URL (default: `http://localhost:3000`)

## Security notes

- Keep `.env` out of git (already gitignored).
- Do not paste Mongo URIs, API keys, JWT secrets, or user passwords into README / setup docs.
- If secrets were ever committed, rotate them in Atlas / Cloudinary / Resend / JWT env and treat old values as compromised.
