# HealAll Backend

Backend API for the HealAll mutual-aid platform.

## Quick Start

### Prerequisites
- Python 3.12+
- Docker Desktop (for PostgreSQL, Redis, MinIO)
- pip or uv

### Setup

```bash
# 1. Install dependencies
pip install -r requirements-dev.txt
# OR
pip install -e ".[dev]"

# 2. Copy environment file
cp .env.example .env

# 3. Start services
make up

# 4. Run migrations
make migrate

# 5. Seed database
make seed

# 6. Start dev server
make dev
```

Visit:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### Quick Test

Use the invite code `HEAL-DEMO001` to test signup flow in Swagger UI.
OTP codes will appear in the console logs.

## Project Structure

```
backend/
├── app/
│   ├── main.py              # FastAPI app
│   ├── api/v1/              # API endpoints
│   ├── core/                # Config, security, exceptions
│   ├── models/              # SQLAlchemy models
│   ├── schemas/             # Pydantic schemas
│   ├── services/            # Business logic
│   └── db/                  # Database utilities
├── alembic/                 # Database migrations
├── tests/                   # Test suite
├── docker-compose.yml       # Docker services
├── pyproject.toml          # Project metadata
└── Makefile                # Dev commands
```

## Available Commands

```bash
make install       # Install dependencies
make up            # Start Docker services
make down          # Stop Docker services
make migrate       # Run database migrations
make rollback      # Rollback last migration
make seed          # Seed database
make dev           # Start dev server
make test          # Run tests
make lint          # Lint code
make format        # Format code
```

## API Endpoints

### Public
- `POST /v1/auth/signup` - Register new user
- `POST /v1/auth/verify-otp` - Verify phone/email
- `POST /v1/auth/token` - Login

### Authenticated
- `POST /v1/auth/logout` - Logout

### Admin Only
- `POST /v1/invites` - Create invite code
- `GET /v1/invites` - List invite codes
- `DELETE /v1/invites/{id}` - Revoke invite code

## Testing

Check OTP codes in console logs (stubbed for development).

Example signup:
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

## Documentation

Full documentation: `/docs/README_BE.md`
Implementation status: `/IMPLEMENTATION_STATUS.md`
