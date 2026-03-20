# SAAS Recruitment Platform - Backend API

Express.js backend API for the SAAS Recruitment Platform built with Prisma and MongoDB.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- pnpm (package manager)
- MongoDB database (local or Atlas)

### Installation

1. Clone the repository and navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pnpm install
```

3. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

4. Update `.env` with your MongoDB connection string and other configuration:
```env
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/saas_recruitment
JWT_SECRET=your_secret_key_here
REFRESH_TOKEN_SECRET=your_refresh_secret_here
RESEND_API_KEY=your_resend_api_key
```

5. Generate Prisma Client:
```bash
pnpm db:generate
```

6. Push schema to database:
```bash
pnpm db:push
```

7. Seed the database (optional):
```bash
pnpm db:seed
```

8. Start the development server:
```bash
pnpm dev
```

The server will run on `http://localhost:5001`

## 📁 Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      # Prisma schema definition
│   └── seed.js            # Database seed file
├── src/
│   ├── config/            # Configuration files
│   │   ├── env.js         # Environment variables
│   │   ├── prisma.js      # Prisma client singleton
│   │   └── email.js       # Email service config
│   ├── middleware/        # Express middleware
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   ├── error.middleware.js
│   │   └── validate.middleware.js
│   ├── modules/           # Feature modules
│   │   ├── auth/
│   │   ├── user/
│   │   ├── candidate/
│   │   ├── client/
│   │   ├── job/
│   │   └── ... (other modules)
│   ├── emails/            # Email templates and service
│   │   ├── templates/
│   │   └── email.service.js
│   ├── utils/             # Utility functions
│   │   ├── response.js
│   │   ├── jwt.js
│   │   ├── otp.js
│   │   ├── pagination.js
│   │   └── logger.js
│   ├── app.js             # Express app configuration
│   └── server.js          # Server entry point
├── .env                   # Environment variables (not in git)
├── .env.example           # Environment variables template
├── package.json
└── README.md
```

## 🔐 Authentication

The API uses JWT-based authentication with refresh tokens.

### Endpoints

- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login and get tokens
- `POST /api/v1/auth/logout` - Logout (requires auth)
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/forgot-password` - Request password reset OTP
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/reset-password` - Reset password with OTP

### Usage

Include the JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## 📚 API Documentation

All API routes are prefixed with `/api/v1/`. See `ROUTES_MAP.md` for complete API documentation.

## 🛠️ Available Scripts

- `pnpm dev` - Start development server with watch mode
- `pnpm start` - Start production server
- `pnpm db:generate` - Generate Prisma Client
- `pnpm db:push` - Push schema changes to database
- `pnpm db:seed` - Seed database with sample data
- `pnpm db:studio` - Open Prisma Studio
- `pnpm db:validate` - Validate Prisma schema

## 🗄️ Database

This project uses MongoDB with Prisma ORM. The schema is defined in `prisma/schema.prisma`.

### Key Models

- **User** - System users (admins, recruiters, managers)
- **Candidate** - Job candidates
- **Client** - Client companies
- **Job** - Job postings
- **Lead** - Sales leads
- **Interview** - Interview scheduling
- **Placement** - Job placements
- **Pipeline** - Recruitment pipeline stages
- **Match** - AI/Manual job-candidate matches
- **Task** - Tasks and activities
- **Billing** - Billing records
- **Team** - Team management
- **Report** - Reports and analytics
- **Setting** - User/Organization settings

## 📧 Email Service

The platform uses Resend for transactional emails. Configure your `RESEND_API_KEY` in `.env`.

Email templates include:
- Welcome emails
- OTP verification
- Interview scheduling
- Placement confirmations

## 🔒 Security

- Passwords are hashed using bcrypt
- JWT tokens for authentication
- Role-based access control (RBAC)
- CORS enabled for frontend
- Input validation on all endpoints

## 📝 License

ISC
