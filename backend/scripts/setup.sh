#!/bin/bash
set -e

echo "🚀 HealAll Backend Setup Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker Desktop and try again.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Docker is running${NC}"
echo ""

# Check if Python 3.12+ is installed
echo "🐍 Checking Python version..."
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found. Please install Python 3.12+${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo -e "${GREEN}✅ Python $PYTHON_VERSION found${NC}"
echo ""

# Check if .env exists, if not copy from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo -e "${GREEN}✅ .env created${NC}"
else
    echo -e "${YELLOW}⚠️  .env already exists, skipping${NC}"
fi
echo ""

# Install Python dependencies
echo "📦 Installing Python dependencies..."
if command -v uv &> /dev/null; then
    echo "Using uv for faster installation..."
    if ! uv pip install -e ".[dev]"; then
        echo -e "${YELLOW}⚠️  Editable install failed, falling back to requirements files${NC}"
        uv pip install -r requirements.txt -r requirements-dev.txt
    fi
else
    if ! pip install -e ".[dev]"; then
        echo -e "${YELLOW}⚠️  Editable install failed, falling back to requirements files${NC}"
        pip install -r requirements.txt -r requirements-dev.txt
    fi
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Start Docker services
echo "🐳 Starting Docker services (Postgres, Redis, MinIO)..."
docker compose down 2>/dev/null || true
docker compose up -d
echo -e "${GREEN}✅ Docker services started${NC}"
echo ""

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3
MAX_RETRIES=30
RETRY_COUNT=0
DB_USER="${POSTGRES_USER:-healall}"
DB_NAME="${POSTGRES_DB:-healall_db}"

while ! docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
        echo -e "${RED}❌ PostgreSQL failed to start after 30 seconds${NC}"
        exit 1
    fi
    echo -n "."
    sleep 1
done
echo ""
echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
echo ""

# Run database migrations
echo "🗄️  Running database migrations..."
alembic upgrade head
echo -e "${GREEN}✅ Migrations completed${NC}"
echo ""

# Seed database
echo "🌱 Seeding database with admin user and invite codes..."
python -m app.db.seed
echo -e "${GREEN}✅ Database seeded${NC}"
echo ""

# Summary
echo ""
echo "🎉 ${GREEN}Setup Complete!${NC}"
echo "================================"
echo ""
echo "📝 Next steps:"
echo ""
echo "1. Start the development server:"
echo "   ${GREEN}make dev${NC}"
echo "   OR"
echo "   ${GREEN}uvicorn app.main:app --reload${NC}"
echo ""
echo "2. Visit the API documentation:"
echo "   ${GREEN}http://localhost:8000/docs${NC}"
echo ""
echo "3. Test the API with these demo credentials:"
echo "   Invite Code: ${GREEN}HEAL-DEMO001${NC} (10 uses, valid 365 days)"
echo "   Invite Code: ${GREEN}HEAL-TEMP001${NC} (1 use, valid 30 days)"
echo ""
echo "4. Admin user for testing:"
echo "   Phone: ${GREEN}+919999999999${NC}"
echo "   Email: ${GREEN}admin@healall.in${NC}"
echo "   (Request OTP to login)"
echo ""
echo "📚 For more information, see:"
echo "   - ${YELLOW}README.md${NC}"
echo "   - ${YELLOW}../IMPLEMENTATION_STATUS.md${NC}"
echo ""
