# HealAll - Quick Start Guide

**Last Updated:** 16 Feb 2026

This guide will get you up and running with the HealAll backend in under 5 minutes.

---

## Prerequisites

Before you begin, make sure you have:

- ✅ **Docker Desktop** installed and running
- ✅ **Python 3.12+** installed
- ✅ **pip** or **uv** for Python packages
- ✅ **Git** (you already have the code)

---

## Option 1: Automated Setup (Recommended)

The fastest way to get started:

```bash
cd /Users/anupam8nith/Desktop/HealAll/backend

# Run the automated setup script
./scripts/setup.sh
```

This script will:
1. ✅ Check if Docker is running
2. ✅ Install Python dependencies
3. ✅ Start PostgreSQL, Redis, and MinIO
4. ✅ Run database migrations
5. ✅ Seed admin user and invite codes
6. ✅ Give you next steps

**After the script completes:**

```bash
# Start the API server
make dev

# Visit http://localhost:8000/docs
```

---

## Option 2: Manual Setup (Step-by-Step)

If you prefer to do it manually or the script fails:

### Step 1: Install Dependencies

```bash
cd /Users/anupam8nith/Desktop/HealAll/backend

# Using pip
pip install -e ".[dev]"

# OR using uv (faster)
uv pip install -e ".[dev]"
```

### Step 2: Setup Environment

```bash
# Copy the example environment file
cp .env.example .env

# The defaults work for local development, no need to edit
```

### Step 3: Start Docker Services

```bash
# Start PostgreSQL, Redis, and MinIO
make up

# OR
docker compose up -d

# Wait ~10 seconds for services to start
# Check status
docker compose ps
# All services should show "Up (healthy)"
```

### Step 4: Setup Database

```bash
# Run migrations to create tables
make migrate

# OR
alembic upgrade head

# Seed admin user and demo invite codes
make seed

# OR
python -m app.db.seed
```

### Step 5: Start the API

```bash
# Start development server with hot reload
make dev

# OR
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## Verify Everything Works

### Option A: Run Verification Script

```bash
./scripts/verify.sh
```

This checks:
- ✅ Docker is running
- ✅ Services are healthy
- ✅ Database is connected
- ✅ Migrations are applied
- ✅ Seed data exists

### Option B: Manual Checks

```bash
# 1. Health check
curl http://localhost:8000/health
# Should return: {"status":"healthy","version":"0.1.0"}

# 2. Check Swagger docs
open http://localhost:8000/docs
# Should open the interactive API documentation

# 3. Check database
docker compose exec postgres psql -U healall healall_db -c "\dt"
# Should show 5 tables: users, invite_codes, otp_attempts, refresh_tokens, user_skills
```

---

## Test the Authentication Flow

### Using Swagger UI (Easiest)

1. **Open Swagger:** http://localhost:8000/docs

2. **Expand `POST /v1/auth/signup`** and click "Try it out"

3. **Use this test data:**
   ```json
   {
     "name": "Test User",
     "phone": "+919876543210",
     "email": "test@example.com",
     "city": "Mumbai",
     "age_range": "18-24",
     "invite_code": "HEAL-DEMO001",
     "roles": ["helper", "help_seeker"]
   }
   ```

4. **Click Execute**

5. **Check your console** (where `make dev` is running) for OTP codes:
   ```
   [STUB SMS] To: +919876543210, Message: Your HealAll OTP is: 123456...
   [STUB EMAIL] To: test@example.com, ...OTP is: 654321...
   ```

6. **Verify Phone:**
   - Expand `POST /v1/auth/verify-otp`
   - Use the phone OTP from console:
     ```json
     {
       "phone_or_email": "+919876543210",
       "otp_code": "123456"
     }
     ```

7. **Verify Email:**
   - Same endpoint, use email OTP:
     ```json
     {
       "phone_or_email": "test@example.com",
       "otp_code": "654321"
     }
     ```

8. **Get Login OTP:**
   - Expand `POST /v1/auth/resend-otp`
   - Request new OTP for login:
     ```json
     {
       "phone_or_email": "+919876543210"
     }
     ```
   - Check console for new OTP

9. **Login:**
   - Expand `POST /v1/auth/token`
   - Use the login OTP:
     ```json
     {
       "phone_or_email": "+919876543210",
       "otp_code": "789012"
     }
     ```
   - Copy the `access_token` from response

10. **Test Authenticated Endpoint:**
    - Click 🔒 "Authorize" at top right
    - Paste your access token
    - Click "Authorize"
    - Now try `POST /v1/auth/logout`

---

## Available Commands

```bash
# Docker
make up            # Start services
make down          # Stop services
make logs          # View service logs

# Database
make migrate       # Run migrations
make rollback      # Undo last migration
make seed          # Seed admin + invites
make db-shell      # Open PostgreSQL shell

# Development
make dev           # Start API server
make test          # Run tests
make lint          # Lint code
make format        # Format code
make clean         # Remove cache

# Installation
make install       # Install dependencies
```

---

## Default Credentials & Demo Data

### Admin User (for testing admin endpoints)
- **Phone:** `+919999999999`
- **Email:** `admin@healall.in`
- **Roles:** `head_admin`, `admin`, `case_verifier`, `helper`, `help_seeker`
- **Verification Level:** 2 (ID Verified)

To login as admin:
1. Request OTP with phone `+919999999999`
2. Check console for OTP
3. Login with OTP
4. Use access token for admin endpoints

### Demo Invite Codes
- **`HEAL-DEMO001`** - 10 uses, valid for 365 days (use this for testing)
- **`HEAL-TEMP001`** - 1 use, valid for 30 days

---

## Troubleshooting

### Docker not running?
```bash
# Start Docker Desktop app
# Wait for it to finish starting
# Then retry
```

### Port already in use?
```bash
# Check what's using port 5432
lsof -i :5432

# Stop local PostgreSQL if running
brew services stop postgresql  # macOS
sudo service postgresql stop   # Linux
```

### OTP not showing in logs?
**Make sure you're watching the console where you ran `make dev`**, not the Docker logs.

### Database errors?
```bash
# Reset everything
docker compose down -v
make up
make migrate
make seed
```

### Python import errors?
```bash
# Make sure you're in backend directory
cd /Users/anupam8nith/Desktop/HealAll/backend

# Reinstall
pip install -e ".[dev]"
```

**For more help:** See [TROUBLESHOOTING.md](backend/TROUBLESHOOTING.md)

---

## What's Next?

Once you have the backend running:

1. **Explore the API:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

2. **Test all endpoints:**
   - See [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) for full API documentation

3. **Run tests:**
   ```bash
   make test
   ```

4. **Build the frontend:**
   - Coming soon! Frontend Module 1 implementation

5. **Add more modules:**
   - Module 2: User Profiles
   - Module 3: Posts & Feed
   - Module 4: Cases
   - And more...

---

## Project Structure

```
HealAll/
├── backend/                    # ← You are here
│   ├── app/
│   │   ├── api/v1/            # API endpoints
│   │   ├── core/              # Config, security
│   │   ├── models/            # Database models
│   │   ├── schemas/           # Request/response schemas
│   │   ├── services/          # Business logic
│   │   └── db/                # Database utilities
│   ├── alembic/               # Migrations
│   ├── tests/                 # Test suite
│   ├── scripts/               # Setup & utility scripts
│   ├── docker-compose.yml     # Docker services
│   └── Makefile              # Dev commands
├── frontend/                  # (To be implemented)
├── docs/                      # Architecture docs
│   ├── README_BE.md          # Backend architecture (2094 lines)
│   └── README_FE.md          # Frontend architecture (1672 lines)
├── IMPLEMENTATION_STATUS.md  # Current status
├── QUICKSTART.md             # ← This file
└── TROUBLESHOOTING.md        # Help with issues
```

---

## Documentation

- **Backend Architecture:** [docs/README_BE.md](docs/README_BE.md)
- **Frontend Architecture:** [docs/README_FE.md](docs/README_FE.md)
- **Implementation Status:** [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- **Troubleshooting:** [backend/TROUBLESHOOTING.md](backend/TROUBLESHOOTING.md)
- **Backend README:** [backend/README.md](backend/README.md)

---

## Support

If you encounter any issues:

1. Check [TROUBLESHOOTING.md](backend/TROUBLESHOOTING.md)
2. Run the verification script: `./scripts/verify.sh`
3. Check Docker logs: `docker compose logs`
4. Check API logs: (console where `make dev` is running)

---

**Happy Building! 🚀**
