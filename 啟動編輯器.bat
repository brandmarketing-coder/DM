@echo off
chcp 65001 > nul
title O'right PRO DM 編輯器本地伺服器
echo ═════════════════════════════════════════════════════
echo           O'right PRO DM 編輯器 本地伺服器
echo ═════════════════════════════════════════════════════
echo.
echo  正在開啟瀏覽器並啟動本地伺服器...
echo  [提示] 編輯期間請保持此命令提示字元視窗開啟。
echo  [提示] 使用完畢後，直接關閉此視窗即可結束伺服器。
echo.
start "" "http://localhost:8080"
node server.js
