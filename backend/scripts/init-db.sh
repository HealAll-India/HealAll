#!/bin/bash
set -e

echo "🔄 Waiting for PostgreSQL to be ready..."
until PGPASSWORD=$POSTGRES_PASSWORD psql -h "postgres" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' 2>/dev/null; do
  sleep 1
done

echo "✅ PostgreSQL is ready!"

echo "🔄 Running database migrations..."
alembic upgrade head

echo "🌱 Seeding database..."
python -m app.db.seed

echo "🎉 Database initialization complete!"
