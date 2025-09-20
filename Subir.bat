@echo off
cd /d %~dp0

:: Fecha
set FECHA=%date%

:: Hora sin segundos
for /f "tokens=1-2 delims=:" %%a in ("%time%") do (
    set HORA=%%a:%%b
)

:: Mensaje
set msg=Actualizado el %FECHA% %HORA%

git add .
git commit -m "%msg%"
git push origin main --force

if %errorlevel% neq 0 (
    echo.
    echo ==== ERROR: No se pudieron subir los cambios ====
) else (
    echo.
    echo ==== Cambios SUBIDOS y REMOTO reemplazado ====
)

pause
