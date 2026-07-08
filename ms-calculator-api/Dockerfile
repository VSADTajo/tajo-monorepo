# syntax=docker/dockerfile:1

# ── Development stage ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
        fastapi \
        "uvicorn[standard]" \
        aio-pika \
        pydantic \
        pydantic-settings \
        structlog \
        pandas \
        pytz \
        gunicorn \
        pytest \
        pytest-asyncio \
        httpx \
        testcontainers \
        ruff \
        mypy
COPY . .
RUN pip install --no-cache-dir -e . --no-deps
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3011", "--reload"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS prod
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential dumb-init && rm -rf /var/lib/apt/lists/*
RUN groupadd -r app && useradd -r -g app -u 1001 app
WORKDIR /app
COPY pyproject.toml ./
RUN pip install --no-cache-dir \
        fastapi \
        "uvicorn[standard]" \
        aio-pika \
        pydantic \
        pydantic-settings \
        structlog \
        pandas \
        pytz \
        gunicorn \
        httpx \
    && apt-get purge -y --auto-remove build-essential
COPY --chown=app:app src ./src
COPY --chown=app:app entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh && chown -R app:app /app
USER app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--", "/app/entrypoint.sh"]
CMD ["gunicorn", "src.main:app", \
     "--workers", "2", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:3011", \
     "--timeout", "120", \
     "--graceful-timeout", "30"]
