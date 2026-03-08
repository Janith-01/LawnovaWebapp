@echo off
TITLE Lawnova Microservices - Control Center
echo =========================================================================
echo LAWNOVA: ONE-CLICK STARTUP PLATFORM
echo Senior DevOps Control - SLIIT Final Thesis Presentation
echo =========================================================================
echo.
echo [INFO] Initializing system boot sequence...
echo [INFO] Each service will stagger by 2 seconds to optimize CPU.
echo [INFO] A single terminal window will manage all outputs.
echo.

:: Check for node_modules
if not exist node_modules (
    echo [ERROR] Root node_modules not found. Running npm install...
    call npm install
)

:: Run the unified startup command
echo [BOOT] Starting services in unified window...
call npm run start-all

pause
