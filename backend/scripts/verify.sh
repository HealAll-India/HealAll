#!/bin/bash
set -e

echo "🔍 HealAll Backend Verification Script"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
DB_USER="${POSTGRES_USER:-healall}"
DB_NAME="${POSTGRES_DB:-healall_db}"

ERRORS=0

# Function to check command
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 is not installed${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Function to check service
check_service() {
    if docker compose ps | grep -q "$1.*Up"; then
        echo -e "${GREEN}✅ $1 is running${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 is not running${NC}"
        ERRORS=$((ERRORS + 1))
        return 1
    fi
}

# Check Docker
echo "📦 Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✅ Docker is running${NC}"
fi
echo ""

# Check Python
echo "🐍 Checking Python..."
check_command python3
if python3 --version > /dev/null 2>&1; then
    VERSION=$(python3 --version)
    echo "   Version: $VERSION"
fi
echo ""

# Check pip
echo "📦 Checking pip..."
check_command pip
echo ""

# Check if in backend directory
echo "📁 Checking directory..."
if [ -f "pyproject.toml" ] && [ -f "app/main.py" ]; then
    echo -e "${GREEN}✅ You are in the backend directory${NC}"
else
    echo -e "${RED}❌ Not in backend directory. Please cd to backend/${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check .env file
echo "🔧 Checking .env file..."
if [ -f ".env" ]; then
    echo -e "${GREEN}✅ .env file exists${NC}"
else
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "   Run: cp .env.example .env"
fi
echo ""

# Check Docker services
echo "🐳 Checking Docker services..."
if docker compose ps > /dev/null 2>&1; then
    check_service postgres
    check_service redis
    check_service minio
else
    echo -e "${RED}❌ Docker services not running${NC}"
    echo "   Run: make up"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check PostgreSQL connection
echo "🗄️  Checking PostgreSQL connection..."
if docker compose exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PostgreSQL is accepting connections${NC}"
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if database exists
echo "🗄️  Checking database..."
if docker compose exec -T postgres psql -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo -e "${GREEN}✅ Database '$DB_NAME' exists${NC}"
else
    echo -e "${YELLOW}⚠️  Database '$DB_NAME' not found${NC}"
fi
echo ""

# Check if migrations are up to date
echo "🔄 Checking migrations..."
if alembic current > /dev/null 2>&1; then
    CURRENT=$(alembic current 2>/dev/null)
    if [ -z "$CURRENT" ]; then
        echo -e "${YELLOW}⚠️  No migrations applied${NC}"
        echo "   Run: make migrate"
    else
        echo -e "${GREEN}✅ Migrations are applied${NC}"
        echo "   Current: $CURRENT"
    fi
else
    echo -e "${RED}❌ Cannot check migrations${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Check if tables exist
echo "📊 Checking database tables..."
TABLES=$(docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME" -c "\dt" 2>/dev/null | grep -c "public" || echo 0)
if [ "$TABLES" -gt 0 ]; then
    echo -e "${GREEN}✅ Database has $TABLES tables${NC}"
else
    echo -e "${YELLOW}⚠️  No tables found in database${NC}"
    echo "   Run: make migrate"
fi
echo ""

# Check if seed data exists
echo "🌱 Checking seed data..."
ADMIN_COUNT=$(docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE 'head_admin' = ANY(roles)" 2>/dev/null | xargs || echo 0)
INVITE_COUNT=$(docker compose exec -T postgres psql -U "$DB_USER" "$DB_NAME" -t -c "SELECT COUNT(*) FROM invite_codes" 2>/dev/null | xargs || echo 0)

if [ "$ADMIN_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Admin user exists${NC}"
else
    echo -e "${YELLOW}⚠️  No admin user found${NC}"
    echo "   Run: make seed"
fi

if [ "$INVITE_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ $INVITE_COUNT invite code(s) exist${NC}"
else
    echo -e "${YELLOW}⚠️  No invite codes found${NC}"
    echo "   Run: make seed"
fi
echo ""

# Check if API can import
echo "🔍 Checking Python imports..."
if python3 -c "from app.main import app" 2>/dev/null; then
    echo -e "${GREEN}✅ Python imports work${NC}"
else
    echo -e "${RED}❌ Python imports failed${NC}"
    echo "   Run: pip install -e \".[dev]\""
    ERRORS=$((ERRORS + 1))
fi
echo ""

# Summary
echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "You're ready to start the server:"
    echo "  ${GREEN}make dev${NC}"
    echo ""
    echo "Or run tests:"
    echo "  ${GREEN}make test${NC}"
else
    echo -e "${RED}❌ $ERRORS error(s) found${NC}"
    echo ""
    echo "Please fix the issues above and try again."
    echo "See TROUBLESHOOTING.md for help."
fi
echo ""
