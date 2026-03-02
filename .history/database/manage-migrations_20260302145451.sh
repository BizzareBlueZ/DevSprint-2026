#!/bin/bash
# Database Migration Manager
# Handles migration execution and rollback

set -e

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-cafeteria}"
DB_USER="${DB_USER:-admin}"
DB_PASSWORD="${DB_PASSWORD:-admin}"

export PGPASSWORD="$DB_PASSWORD"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if database exists
check_db_exists() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1
}

# Create database if not exists
create_database() {
    log_info "Creating database '$DB_NAME'..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null || log_warn "Database already exists"
}

# Run migration file
run_migration() {
    local migration_file=$1
    log_info "Running migration: $migration_file"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -f "$migration_file"
}

# Initialize database with all migrations
init_database() {
    log_info "Initializing database..."
    
    if ! check_db_exists; then
        create_database
    fi
    
    local migrations_dir="$(dirname "$0")/migrations"
    
    if [ ! -d "$migrations_dir" ]; then
        log_error "Migrations directory not found: $migrations_dir"
        exit 1
    fi
    
    # Run all migration files in order
    for migration in $(ls -1 "$migrations_dir"/*.sql | sort); do
        run_migration "$migration"
    done
    
    log_info "Database initialization complete!"
}

# List all migrations
list_migrations() {
    local migrations_dir="$(dirname "$0")/migrations"
    log_info "Available migrations:"
    ls -1 "$migrations_dir"/*.sql | xargs -n1 basename | sort
}

# Show usage
usage() {
    cat << EOF
Usage: $0 [COMMAND]

Commands:
    init        Initialize database with all migrations
    list        List all available migrations
    status      Show database schema status
    help        Show this help message

Environment Variables:
    DB_HOST         Database host (default: localhost)
    DB_PORT         Database port (default: 5432)
    DB_NAME         Database name (default: cafeteria)
    DB_USER         Database user (default: admin)
    DB_PASSWORD     Database password (default: admin)

Examples:
    $0 init
    DB_HOST=prod-db.example.com $0 init
EOF
}

# Main
case "${1:-help}" in
    init)
        init_database
        ;;
    list)
        list_migrations
        ;;
    status)
        log_info "Database status:"
        psql -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -U "$DB_USER" -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema');"
        ;;
    help)
        usage
        ;;
    *)
        log_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
