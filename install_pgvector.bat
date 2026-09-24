@echo off
echo ===============================================================
echo  KnowSphere - pgvector Extension Installer for PostgreSQL 17
echo ===============================================================
echo.
echo Checking administrator privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Please right-click this file and select "Run as administrator".
    pause
    exit /b 1
)

set PG_DIR=C:\Program Files\PostgreSQL\17
set SRC_DIR=%TEMP%\vector_pg17

if not exist "%SRC_DIR%\lib\vector.dll" (
    echo [INFO] Downloading precompiled pgvector binaries for PostgreSQL 17...
    powershell -Command "Invoke-WebRequest -Uri 'https://github.com/andreiramani/pgvector_pgsql_windows/releases/download/0.8.6_17/vector.v0.8.6-pg17.zip' -OutFile '%TEMP%\vector_pg17.zip'; Expand-Archive -Path '%TEMP%\vector_pg17.zip' -DestinationPath '%TEMP%\vector_pg17' -Force"
)

echo [INFO] Copying vector.dll to %PG_DIR%\lib...
copy /Y "%SRC_DIR%\lib\vector.dll" "%PG_DIR%\lib\"

echo [INFO] Copying extension SQL and control files to %PG_DIR%\share\extension...
copy /Y "%SRC_DIR%\share\extension\vector*" "%PG_DIR%\share\extension\"

echo.
echo [SUCCESS] pgvector files copied successfully!
echo Enabling extension in database 'knowsphere'...
"%PG_DIR%\bin\psql.exe" -U postgres -d knowsphere -c "CREATE EXTENSION IF NOT EXISTS vector;"
echo.
echo All done! You can now restart or run KnowSphere.
pause
