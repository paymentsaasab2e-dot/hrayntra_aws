# Fixed local Razorpay webhook tunnel (URL never changes once NGROK_DOMAIN is set).
# Prerequisites:
#   1. NGROK_DOMAIN set in backendphase2/.env
#   2. backend1 (:5000) and/or backendphase2 (:5001) running
#   3. ngrok installed and authenticated

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root 'backendphase2\.env'
$proxySource = Join-Path $root 'scripts\razorpay-local-webhook-proxy.js'
# Copy into TEMP (no spaces) so Windows does not split "SAASAROhitr Sir"
$proxyRun = Join-Path $env:TEMP 'hryantra-razorpay-local-webhook-proxy.js'
$proxyOutLog = Join-Path $env:TEMP 'hryantra-razorpay-proxy.out.log'
$proxyErrLog = Join-Path $env:TEMP 'hryantra-razorpay-proxy.err.log'

function Read-EnvValue([string]$path, [string]$key) {
  if (-not (Test-Path -LiteralPath $path)) { return '' }
  $line = Get-Content -LiteralPath $path | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return ($line -replace "^\s*$key\s*=\s*", '').Trim().Trim('"').Trim("'")
}

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Host 'node not found on PATH. Install Node.js, then re-open this terminal.'
  exit 1
}
$nodePath = $nodeCmd.Source

if (-not (Get-Command ngrok -ErrorAction SilentlyContinue)) {
  Write-Host 'ngrok not found on PATH. Install ngrok, then re-open this terminal.'
  exit 1
}

$domain = Read-EnvValue $envFile 'NGROK_DOMAIN'
if (-not $domain) {
  Write-Host 'NGROK_DOMAIN is not set in backendphase2\.env'
  Write-Host 'Add: NGROK_DOMAIN=tangentially-nonconceptual-rhett.ngrok-free.dev'
  Write-Host 'Then re-run this script.'
  exit 1
}

$domain = $domain -replace '^https?://', '' -replace '/$', ''
$proxyPort = Read-EnvValue $envFile 'RAZORPAY_LOCAL_PROXY_PORT'
if (-not $proxyPort) { $proxyPort = '5055' }

$existing = @(Get-NetTCPConnection -LocalPort ([int]$proxyPort) -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
foreach ($procId in $existing) {
  if ($procId -and $procId -ne 0) {
    Write-Host ("Port {0} in use by PID {1} - stopping it..." -f $proxyPort, $procId)
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Milliseconds 400

Write-Host ("Starting local webhook proxy on :{0} ..." -f $proxyPort)
Remove-Item -LiteralPath $proxyOutLog, $proxyErrLog -Force -ErrorAction SilentlyContinue
Copy-Item -LiteralPath $proxySource -Destination $proxyRun -Force

# $proxyRun has no spaces — safe for Start-Process ArgumentList
$proxy = Start-Process -FilePath $nodePath `
  -ArgumentList $proxyRun `
  -WorkingDirectory $env:TEMP `
  -PassThru `
  -WindowStyle Hidden `
  -RedirectStandardOutput $proxyOutLog `
  -RedirectStandardError $proxyErrLog

Start-Sleep -Seconds 2
if ($proxy.HasExited) {
  Write-Host 'Proxy failed to start. Log:'
  if (Test-Path -LiteralPath $proxyOutLog) { Get-Content -LiteralPath $proxyOutLog }
  if (Test-Path -LiteralPath $proxyErrLog) { Get-Content -LiteralPath $proxyErrLog }
  exit 1
}

$listening = Get-NetTCPConnection -LocalPort ([int]$proxyPort) -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host 'Proxy process started but port is not listening yet. Log:'
  if (Test-Path -LiteralPath $proxyOutLog) { Get-Content -LiteralPath $proxyOutLog }
  if (Test-Path -LiteralPath $proxyErrLog) { Get-Content -LiteralPath $proxyErrLog }
  Stop-Process -Id $proxy.Id -Force -ErrorAction SilentlyContinue
  exit 1
}

Write-Host ''
Write-Host 'Proxy OK. Register THESE once in Razorpay Dashboard -> Webhooks:'
Write-Host ("  Phase 1: https://{0}/api/payments/razorpay/webhook" -f $domain)
Write-Host ("  Phase 2: https://{0}/api/v1/payments/razorpay/webhook" -f $domain)
Write-Host ''
Write-Host ("Starting ngrok -> https://{0}  (Ctrl+C stops tunnel + proxy)" -f $domain)
Write-Host ''

try {
  & ngrok http --domain=$domain $proxyPort
} finally {
  if ($proxy -and -not $proxy.HasExited) {
    Stop-Process -Id $proxy.Id -Force -ErrorAction SilentlyContinue
  }
}
