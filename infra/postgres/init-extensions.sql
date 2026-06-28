-- Extensions required by every service's database. Loaded on first volume init
-- via /docker-entrypoint-initdb.d/. Safe to re-run (CREATE ... IF NOT EXISTS).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
