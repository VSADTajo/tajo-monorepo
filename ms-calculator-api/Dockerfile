# syntax=docker/dockerfile:1

# ── Base wheels layer (cached) ────────────────────────────────────────────────
FROM python:3.12-slim AS wheels
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY pyproject.toml ./
# Pre-download wheels for heavy deps
RUN pip wheel --no-deps --wheel-dir /wheels \
    fastapi "uvicorn[standard]" aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn

# ── Development stage ─────────────────────────────────────────────────────────
FROM python:3.12-slim AS dev
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=wheels /wheels /wheels
COPY pyproject.toml ./
RUN pip install --no-index --find-links /wheels \
    fastapi "uvicorn[standard]" aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn
# Install editable with no deps (already installed above)
RUN pip install -e . --no-deps || true
# Install dev tools (not pre-wheeled — lighter deps)
RUN pip install pytest pytest-asyncio httpx testcontainers ruff mypy
COPY . .
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
EXPOSE 3011
ENTRYPOINT ["dumb-init", "--"]
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3011", "--reload"]

# ── Production stage ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS prod
RUN apt-get update && apt-get install -y --no-install-recommends \
        dumb-init && rm -rf /var/lib/apt/lists/*
RUN groupadd -r app && useradd -r -g app -u 1001 app
WORKDIR /app
COPY --from=wheels /wheels /wheels
COPY pyproject.toml ./
RUN pip install --no-index --find-links /wheels \
        fastapi "uvicorn[standard]" aio-pika pydantic pydantic-settings structlog pandas pytz gunicorn && \
    rm -rf /wheels
COPY --chown=app:app src ./src
COPY --chown=app:app entrypoint.sh ./
RUN chmod +x /app/entrypoint.sh
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
