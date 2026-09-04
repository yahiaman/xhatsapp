#!/usr/bin/env sh
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --set ON_ERROR_STOP=1 \
  --set openwa_db="$OPENWA_DATABASE_NAME" \
  --set openwa_user="$OPENWA_DATABASE_USERNAME" \
  --set openwa_password="$OPENWA_DB_PASSWORD" \
  --set xhatsapp_db="$XHATSAPP_DATABASE_NAME" \
  --set xhatsapp_user="$XHATSAPP_DATABASE_USERNAME" \
  --set xhatsapp_password="$XHATSAPP_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'openwa_user', :'openwa_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'openwa_user') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'xhatsapp_user', :'xhatsapp_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'xhatsapp_user') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'openwa_db', :'openwa_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'openwa_db') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'xhatsapp_db', :'xhatsapp_user')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'xhatsapp_db') \gexec
SQL

