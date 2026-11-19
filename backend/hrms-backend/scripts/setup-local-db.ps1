# Requires MongoDB running locally on 127.0.0.1:27017
# Install (Windows): winget install MongoDB.Server
# Then run this script from hrms-backend folder.

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Checking MongoDB service..."
$mongoService = Get-Service -Name "MongoDB" -ErrorAction SilentlyContinue
if (-not $mongoService) {
  Write-Host "MongoDB service not found. Install with: winget install MongoDB.Server"
  exit 1
}

if ($mongoService.Status -ne "Running") {
  Write-Host "Starting MongoDB service..."
  Start-Service MongoDB
}

Write-Host "Generating Prisma client..."
npx prisma generate

Write-Host "Pushing schema..."
npx prisma db push

Write-Host "Seeding database..."
node prisma/seed.js

Write-Host "Done. Start backend with: npm run dev"
Write-Host "Login: superadmin@hrms.local / SuperAdmin@123"
