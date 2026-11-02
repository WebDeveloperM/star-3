@echo off
rem Tadbir uchun: sahifa oynada ochiladi, gerb bosilganda Chrome yozuvsiz to'liq ekranga o'tadi.
rem Chiqish: Alt+F4. Qayta boshlash: F5.

set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME%" (
  echo Google Chrome topilmadi.
  pause
  exit /b 1
)

start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0start.ps1" %*
