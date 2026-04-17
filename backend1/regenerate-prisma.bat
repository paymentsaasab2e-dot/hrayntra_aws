@echo off
echo Regenerating Prisma Client...
cd /d %~dp0
npx prisma generate
echo.
echo Prisma client regenerated successfully!
echo Please restart your backend server.
pause
