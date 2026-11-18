@echo off
title LAST ROUND v3 - Online Multiplayer 3D Revolver Roulette
if not exist server\node_modules (
    call npm --prefix server install
)
if not exist client\node_modules\tailwindcss (
    call npm --prefix client install
)
call npm run dev
pause
