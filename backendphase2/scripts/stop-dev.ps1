# Stops backendphase2 dev server including nodemon parent (prevents auto-restart).
param(
    [int]$Port = 5001,
    [string]$ProjectMarker = "backendphase2"
)

$ErrorActionPreference = "SilentlyContinue"
$stopped = [System.Collections.Generic.HashSet[int]]::new()

function Stop-ProcessTree {
    param([int]$ProcessId)
    if (-not $ProcessId -or $ProcessId -le 0) { return }
    if ($stopped.Contains($ProcessId)) { return }
    [void]$stopped.Add($ProcessId)
    $null = Start-Process -FilePath "taskkill.exe" -ArgumentList "/PID", $ProcessId, "/T", "/F" -Wait -NoNewWindow -ErrorAction SilentlyContinue
    Write-Host "Stopped process tree PID $ProcessId"
}

function Get-PortListenerPids {
    param([int]$ListenPort)
    $pids = @()

    try {
        Get-NetTCPConnection -LocalPort $ListenPort -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { $pids += $_.OwningProcess }
    } catch {
        # Get-NetTCPConnection may be unavailable on some Windows builds.
    }

    netstat -ano | Select-String ":$ListenPort\s+.*LISTENING\s+(\d+)$" | ForEach-Object {
        $pids += [int]$_.Matches.Groups[1].Value
    }

    return $pids | Sort-Object -Unique
}

function Get-PortBoundServerPids {
    param([int]$ListenPort)
    $pids = @()
    netstat -ano | Select-String ":\s*$ListenPort\s+" | ForEach-Object {
        $line = $_.Line.Trim()
        if ($line -match "LISTENING\s+(\d+)$") {
            $pids += [int]$Matches[1]
            return
        }
        if ($line -match "^\s*TCP\s+127\.0\.0\.1:$ListenPort\s+") {
            if ($line -match "\s+(\d+)\s*$") {
                $pids += [int]$Matches[1]
            }
        }
    }
    return $pids | Sort-Object -Unique
}

function Get-ProjectDevPids {
    param([string]$Marker)
    $names = @("node.exe", "nodemon.exe", "tsx.exe", "pnpm.exe", "pwsh.exe", "powershell.exe", "cmd.exe")
    $pids = @()
    foreach ($name in $names) {
        Get-CimInstance Win32_Process -Filter "Name = '$name'" | ForEach-Object {
            $cmd = $_.CommandLine
            if (-not $cmd) { return }
            if ($cmd -like "*$Marker*" -and $cmd -match "nodemon|tsx|server\.js|pnpm(\.exe)?\s+dev|next dev|saas-recruitment-backend") {
                $pids += $_.ProcessId
            }
        }
    }
    return $pids | Sort-Object -Unique
}

Write-Host "Stopping $ProjectMarker dev processes on port $Port..."

foreach ($procId in (Get-PortListenerPids -ListenPort $Port)) {
    Stop-ProcessTree -ProcessId $procId
}

foreach ($procId in (Get-PortBoundServerPids -ListenPort $Port)) {
    Stop-ProcessTree -ProcessId $procId
}

foreach ($procId in (Get-ProjectDevPids -Marker $ProjectMarker)) {
    Stop-ProcessTree -ProcessId $procId
}

Start-Sleep -Milliseconds 400

$remaining = Get-PortListenerPids -ListenPort $Port
if ($remaining.Count -gt 0) {
    Write-Host "Port $Port still in use by PID(s): $($remaining -join ', '). Retrying..."
    foreach ($procId in $remaining) {
        Stop-ProcessTree -ProcessId $procId
    }
    Start-Sleep -Milliseconds 400
    $remaining = Get-PortListenerPids -ListenPort $Port
}

if ($remaining.Count -gt 0) {
    Write-Host "Warning: port $Port may still be in use (PID(s): $($remaining -join ', '))."
    exit 1
}

Write-Host "Port $Port is free. Dev server stopped."
