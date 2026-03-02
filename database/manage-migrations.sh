#!/bin/bash
# Database Migration Manager
# Delegates to Node.js migrate.js (no psql dependency required)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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

# Check node is available
if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not found. Install Node.js first."
    exit 1
fi

# Show usage
usage() {
    cat << EOF
Usage: $0 [COMMAND]

Commands:
    init        Apply all pending migrations
    up          Apply all pending migrations
    up <prefix> Apply migrations up to prefix (e.g. "003")
    list        List all available migrations
    status      Show migration status (applied/pending)
    redo        Re-apply the last migration (development only)
    help        Show this help message

Environment Variables:
    DB_HOST         Database host (default: localhost)
    DB_PORT         Database port (default: 5432)
    DB_NAME         Database name (default: cafeteria)
    DB_USER         Database user (default: admin)
    DB_PASSWORD     Database password (default: secret123)

Examples:
    $0 status
    $0 init
    DB_HOST=prod-db.example.com $0 up
EOF
}

# Main
case "${1:-help}" in
    init|up)
        node "$SCRIPT_DIR/migrate.js" up "$2"
        ;;
    list)
        log_info "Available migrations:"
        ls -1 "$SCRIPT_DIR/migrations/"*.sql | xargs -n1 basename | sort
        ;;
    status)
        node "$SCRIPT_DIR/migrate.js" status
        ;;
    redo)
        node "$SCRIPT_DIR/migrate.js" redo
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
