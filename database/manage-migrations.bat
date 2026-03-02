@echo off
REM Database Migration Manager for Windows
REM Delegates to Node.js migrate.js (no psql dependency required)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js is required but not found. Install Node.js first.
    exit /b 1
)

if "%1"=="init" (
    node "%SCRIPT_DIR%migrate.js" up %2
) else if "%1"=="up" (
    node "%SCRIPT_DIR%migrate.js" up %2
) else if "%1"=="list" (
    echo [INFO] Available migrations:
    dir /b "%SCRIPT_DIR%migrations\*.sql"
) else if "%1"=="status" (
    node "%SCRIPT_DIR%migrate.js" status
) else if "%1"=="redo" (
    node "%SCRIPT_DIR%migrate.js" redo
) else (
    call :show_help
)

exit /b

:show_help
echo Usage: %0 [COMMAND]
echo.
echo Commands:
echo     init        Apply all pending migrations
echo     up          Apply all pending migrations
echo     up [prefix] Apply migrations up to prefix (e.g. "003")
echo     list        List all available migrations
echo     status      Show migration status (applied/pending)
echo     redo        Re-apply the last migration (development only)
echo     help        Show this help message
echo.
echo Environment Variables:
echo     DB_HOST         Database host (default: localhost)
echo     DB_PORT         Database port (default: 5432)
echo     DB_NAME         Database name (default: cafeteria)
echo     DB_USER         Database user (default: admin)
echo     DB_PASSWORD     Database password (default: secret123)
exit /b
