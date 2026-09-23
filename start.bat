@echo off
setlocal
cd /d "%~dp0"

where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%~dp0start.py"
    goto :end
)

where python >nul 2>nul
if not errorlevel 1 (
    python "%~dp0start.py"
    goto :end
)

echo Python 3 was not found. Install Python 3, then double-click this file again.
pause

:end
endlocal
