@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Tea Balance - local preview

echo ============================================
echo   Tea Balance  local preview
echo   folder: %cd%
echo ============================================
echo.

echo [1/4] checking Node.js ...
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node.js not found.
  echo       Install Node.js 22.13 or newer from https://nodejs.org
  echo       then run this file again.
  echo.
  pause
  exit /b 1
)
node -v
echo.

echo [2/4] checking pnpm ...
where pnpm >nul 2>nul
if errorlevel 1 (
  echo   pnpm not found, enabling it through corepack ...
  call corepack enable
  call corepack prepare pnpm@11.19.0 --activate
)
where pnpm >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] pnpm still not available.
  echo       Try running this in PowerShell:  npm i -g pnpm
  echo.
  pause
  exit /b 1
)
call pnpm -v
echo.

echo [3/4] pnpm install  (first run can take a few minutes) ...
call pnpm install
if errorlevel 1 (
  echo.
  echo   [X] pnpm install failed. Screenshot the red text above and send it to Claude.
  echo.
  pause
  exit /b 1
)
echo.

echo [4/4] starting dev server ...
echo.
echo   When you see a line with http://localhost:3000 (or 3001),
echo   open that address in your browser.
echo   The music button is the small dark-green circle, bottom right.
echo.
echo   Keep THIS WINDOW OPEN while you preview. Press Ctrl+C to stop.
echo.
call pnpm dev

echo.
echo   Dev server stopped. If it exited with an error, screenshot the text above.
pause
