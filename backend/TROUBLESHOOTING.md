# Troubleshooting Guide

## Common Issues and Solutions

### 1. Docker Issues

#### "Cannot connect to the Docker daemon"
**Problem:** Docker Desktop is not running.

**Solution:**
```bash
# Start Docker Desktop application
# Wait for it to fully start (check the whale icon in menu bar)
# Then retry your command
```

#### "Port already in use" (5432, 6379, 9000, etc.)
**Problem:** Another service is using the required port.

**Solution:**
```bash
# Check what's using the port
lsof -i :5432  # For PostgreSQL
lsof -i :6379  # For Redis
lsof -i :9000  # For MinIO

# Stop the conflicting service or change ports in docker-compose.yml
```

#### "Docker compose: service 'postgres' didn't connect successfully"
**Problem:** Services taking too long to start.

**Solution:**
```bash
# Stop everything
docker compose down

# Start again and check logs
docker compose up -d
docker compose logs -f postgres

# Wait until you see "database system is ready to accept connections"
```

### 2. Database Issues

#### "sqlalchemy.exc.OperationalError: could not connect to server"
**Problem:** PostgreSQL is not running or not ready.

**Solution:**
```bash
# Check if PostgreSQL container is running
docker compose ps

# If not running, start it
docker compose up -d postgres

# Wait for it to be healthy
docker compose exec postgres pg_isready -U healall

# If it says "accepting connections", you're good to go
```

#### "alembic.util.exc.CommandError: Can't locate revision identified by"
**Problem:** Database is out of sync with migrations.

**Solution:**
```bash
# Check current revision
alembic current

# If empty or wrong, stamp to the latest
alembic stamp head

# Then run migrations
alembic upgrade head
```

#### "relation 'users' does not exist"
**Problem:** Migrations haven't been run.

**Solution:**
```bash
# Run migrations
make migrate
# OR
alembic upgrade head
```

### 3. Python/Dependencies Issues

#### "ModuleNotFoundError: No module named 'app'"
**Problem:** Package not installed or wrong directory.

**Solution:**
```bash
# Make sure you're in the backend directory
cd /Users/anupam8nith/Desktop/HealAll/backend

# Install the package
pip install -e ".[dev]"
```

#### "ImportError: cannot import name 'X' from 'app.Y'"
**Problem:** Circular import or missing dependency.

**Solution:**
```bash
# Reinstall dependencies
pip install --upgrade -e ".[dev]"

# If that doesn't work, check for circular imports in code
```

### 4. API/Runtime Issues

#### OTP codes not appearing in logs
**Problem:** Looking at wrong console or logs.

**Solution:**
```bash
# Make sure you're watching the uvicorn console output
# NOT the docker compose logs

# OTPs appear in the console where you ran:
make dev
# OR
uvicorn app.main:app --reload

# Look for lines like:
# [STUB SMS] To: +91..., Message: Your HealAll OTP is: 123456
# [STUB EMAIL] To: user@example.com, ...OTP is: 654321
```

#### "401 Unauthorized" on protected endpoints
**Problem:** Missing or invalid access token.

**Solution:**
1. Make sure you've logged in and received an access token
2. In Swagger UI: Click the 🔒 "Authorize" button at top right
3. Paste your access token (without "Bearer " prefix)
4. Click "Authorize"

In curl:
```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" ...
```

#### "422 Validation Error" on signup
**Problem:** Invalid request data.

**Solution:**
Check the response body for details. Common issues:
- Phone must start with `+91` and have 10 digits
- Email must be valid format
- `age_range` must be one of: "13-17", "18-24", "25-34", "35-44", "45+"
- `roles` must be array with "helper" and/or "help_seeker"

### 5. Testing Issues

#### "pytest: command not found"
**Problem:** pytest not installed.

**Solution:**
```bash
pip install -e ".[dev]"
```

#### Tests fail with database errors
**Problem:** Test database doesn't exist or wrong connection.

**Solution:**
```bash
# Create test database
docker compose exec postgres createdb -U healall healall_test

# OR run tests with the test database URL in conftest.py updated
```

### 6. Seed Data Issues

#### "Admin user not created" or "Invite codes not showing"
**Problem:** Seed script didn't run or failed.

**Solution:**
```bash
# Re-run seed script
python -m app.db.seed

# Check database directly
docker compose exec postgres psql -U healall healall_db

# In psql:
healall_db=# SELECT email, roles FROM users WHERE 'head_admin' = ANY(roles);
healall_db=# SELECT code, max_uses, use_count FROM invite_codes;
healall_db=# \q
```

## Quick Fixes

### Complete Reset

If everything is broken and you want to start fresh:

```bash
# Stop and remove all containers and volumes
docker compose down -v

# Remove Python cache
make clean

# Reinstall
pip install -e ".[dev]"

# Start over
docker compose up -d
make migrate
make seed
make dev
```

### Database Reset Only

```bash
# Connect to database
docker compose exec postgres psql -U healall healall_db

# In psql, drop and recreate schema
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
\q

# Re-run migrations and seed
make migrate
make seed
```

### Check Everything is Working

```bash
# 1. Check Docker services
docker compose ps
# All should show "Up" and "healthy"

# 2. Check database connection
docker compose exec postgres pg_isready -U healall
# Should say "accepting connections"

# 3. Check Python imports
python -c "from app.main import app; print('OK')"
# Should print "OK"

# 4. Check API starts
make dev
# Should start without errors and show:
# INFO:     Uvicorn running on http://0.0.0.0:8000

# 5. Test health endpoint
curl http://localhost:8000/health
# Should return: {"status":"healthy","version":"0.1.0"}
```

## Getting Help

If none of these solutions work:

1. **Check the logs:**
   ```bash
   docker compose logs postgres
   docker compose logs redis
   # Look for error messages
   ```

2. **Check the console output** where you ran `make dev` or `uvicorn`

3. **Verify your environment:**
   ```bash
   python --version  # Should be 3.12+
   docker --version
   docker compose version
   ```

4. **Check the .env file:**
   ```bash
   cat .env
   # Verify DATABASE_URL points to localhost:5432
   # Verify REDIS_URL points to localhost:6379
   ```

## Environment-Specific Notes

### macOS
- Docker Desktop must be running
- Port 5432 might be used by system Postgres (stop it with `brew services stop postgresql`)

### Linux
- May need to use `docker-compose` (with hyphen) instead of `docker compose`
- Add user to docker group: `sudo usermod -aG docker $USER`

### Windows
- Use WSL2 for better Docker performance
- Paths might need `\` instead of `/`
- Use Git Bash or WSL terminal instead of CMD
