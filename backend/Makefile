.PHONY: install up down logs db-shell migrate rollback seed test lint format clean worker flower monitoring

install:
	pip install -e ".[dev]"

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f postgres redis

db-shell:
	docker compose exec postgres psql -U healall healall_db

migrate:
	alembic upgrade head

rollback:
	alembic downgrade -1

migration:
	@read -p "Enter migration message: " msg; \
	alembic revision --autogenerate -m "$$msg"

seed:
	python -m app.db.seed

dev:
	uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

test:
	pytest tests/ -v --tb=short

test-cov:
	pytest tests/ -v --tb=short --cov=app --cov-report=term-missing

lint:
	ruff check app/ tests/

format:
	ruff format app/ tests/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true

worker:
	celery -A app.worker.celery_app worker --loglevel=info

flower:
	celery -A app.worker.celery_app flower --port=5555

monitoring:
	docker compose --profile monitoring up -d prometheus grafana
