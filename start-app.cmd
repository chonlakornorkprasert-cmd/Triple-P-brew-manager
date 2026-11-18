@echo off
cd /d "%~dp0"
echo Triple P Brew - http://localhost:3001
echo Keep this window open while using the app.
node backend/server.js
pause
