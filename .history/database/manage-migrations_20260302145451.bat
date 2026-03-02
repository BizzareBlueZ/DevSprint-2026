@echo off
REM Database Migration Manager for Windows
REM Handles migration execution and rollback

setlocal enabledelayedexpansion

set DB_HOST=%DB_HOST%
set DB_PORT=%DB_PORT%
set DB_NAME=%DB_NAME%
set DB_USER=%DB_USER%
set DB_PASSWORD=%DB_PASSWORD%

if "!DB_HOST!"=="" set DB_HOST=localhost
if "!DB_PORT!"=="" set DB_PORT=5432
if "!DB_NAME!"=="" set DB_NAME=cafeteria
if "!DB_USER!"=="" set DB_USER=admin
if "!DB_PASSWORD!"=="" set DB_PASSWORD=admin

set "PGPASSWORD=!DB_PASSWORD!"

setlocal

if "%1"=="init" (
    call :init_database
) else if "%1"=="list" (
    call :list_migrations
) else if "%1"=="status" (
    call :show_status
) else (
    call :show_help
)

exit /b

:init_database
echo [INFO] Initializing database...
set "migrations_dir=%~dp0migrations"

if not exist "!migrations_dir!" (
    echo [ERROR] Migrations directory not found: !migrations_dir!
    exit /b 1
)

REM Run all migration files in order
for /f tokens^=* %%f in ('dir /b /s /on "!migrations_dir!\*.sql"') do (
    echo [INFO] Running migration: %%~nf
    psql -h !DB_HOST! -p !DB_PORT! -d !DB_NAME! -U !DB_USER! -f "%%f"
    if errorlevel 1 (
        echo [ERROR] Migration failed: %%~nf
        exit /b 1
    )
)

echo [INFO] Database initialization complete!
exit /b

:list_migrations
echo [INFO] Available migrations:
dir /b "%~dp0migrations\*.sql"
exit /b

:show_status
echo [INFO] Database status:
psql -h !DB_HOST! -p !DB_PORT! -d !DB_NAME! -U !DB_USER! -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema');"
exit /b

:show_help
echo Usage: %0 [COMMAND]
echo.
echo Commands:
echo     init        Initialize database with all migrations
echo     list        List all available migrations
echo     status      Show database schema status
echo     help        Show this help message
echo.
echo Environment Variables:
echo     DB_HOST         Database host (default: localhost)
echo     DB_PORT         Database port (default: 5432)
echo     DB_NAME         Database name (default: cafeteria)
echo     DB_USER         Database user (default: admin)
echo     DB_PASSWORD     Database password (default: admin)
exit /b
