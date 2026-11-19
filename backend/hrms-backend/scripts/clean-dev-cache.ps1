# Clears safe dev caches — does NOT delete node_modules or source code.
$ErrorActionPreference = "SilentlyContinue"

$frontend = Join-Path $PSScriptRoot "..\..\frontend\hrms-frontend"
$backend = Join-Path $PSScriptRoot ".."

Write-Host "Cleaning npm cache..."
npm cache clean --force | Out-Null

if (Test-Path (Join-Path $frontend ".next")) {
  Write-Host "Removing frontend .next build cache..."
  Remove-Item (Join-Path $frontend ".next") -Recurse -Force
}

if (Test-Path (Join-Path $backend "dist")) {
  Write-Host "Removing backend dist build..."
  Remove-Item (Join-Path $backend "dist") -Recurse -Force
}

Get-ChildItem "$env:LOCALAPPDATA\Temp" -Filter "ts-node-dev-hook-*" | Remove-Item -Recurse -Force
Get-ChildItem "$env:LOCALAPPDATA\Temp" -Filter "mongodb-*" | Remove-Item -Recurse -Force

Write-Host "Done. Safe caches cleared."
Write-Host "Note: node_modules (~900MB total) is required — do not delete unless reinstalling."
