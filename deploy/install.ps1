# ═══════════════════════════════════════════════════════════════════════════════
# Tentacle Platform Installer for Windows
# ═══════════════════════════════════════════════════════════════════════════════
#Requires -Version 5.1

[CmdletBinding()]
param(
    [string]$Version = "{{VERSION}}",
    [string]$InstallDir = "C:\Tentacle",
    [switch]$Help
)

$ErrorActionPreference = "Stop"

$Repo = "joyautomation/tentacle"
$ConfigDir = Join-Path $InstallDir "config"
$DataDir = Join-Path $InstallDir "data"

# State
$Script:DeployMethod = ""
$Script:SelectedModules = @()

# ═══════════════════════════════════════════════════════════════════════════════
# Utilities
# ═══════════════════════════════════════════════════════════════════════════════

function Write-Info  { param([string]$Msg) Write-Host "[+] $Msg" -ForegroundColor Green }
function Write-Warn  { param([string]$Msg) Write-Host "[!] $Msg" -ForegroundColor Yellow }
function Write-Err   { param([string]$Msg) Write-Host "[x] $Msg" -ForegroundColor Red }
function Write-Step  { param([string]$Msg) Write-Host "[>] $Msg" -ForegroundColor Cyan }

function Confirm-Prompt {
    param([string]$Message, [bool]$Default = $true)
    $suffix = if ($Default) { "[Y/n]" } else { "[y/N]" }
    $answer = Read-Host "[?] $Message $suffix"
    if ([string]::IsNullOrWhiteSpace($answer)) {
        return $Default
    }
    return $answer.Trim().ToLower() -eq "y"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Help
# ═══════════════════════════════════════════════════════════════════════════════

if ($Help) {
    Write-Host @"
Tentacle Platform Installer for Windows

Usage: .\install.ps1 [OPTIONS]

Options:
  -Version VER      Override version to install (default: $Version)
  -InstallDir DIR   Override install directory (default: C:\Tentacle)
  -Help             Show this help

Examples:
  .\install.ps1
  .\install.ps1 -Version 1.2.0
  .\install.ps1 -InstallDir D:\Tentacle
"@
    exit 0
}

# ═══════════════════════════════════════════════════════════════════════════════
# Banner
# ═══════════════════════════════════════════════════════════════════════════════

function Show-Banner {
    Write-Host ""
    Write-Host "  +====================================================+" -ForegroundColor Cyan
    Write-Host "  |                                                    |" -ForegroundColor Cyan
    Write-Host "  |          TENTACLE PLATFORM  v$Version              |" -ForegroundColor Cyan
    Write-Host "  |       Industrial Automation Made Simple            |" -ForegroundColor Cyan
    Write-Host "  |                                                    |" -ForegroundColor Cyan
    Write-Host "  +====================================================+" -ForegroundColor Cyan
    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Platform detection
# ═══════════════════════════════════════════════════════════════════════════════

function Get-Platform {
    $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "386" }

    # Check for ARM64 on Windows 11+
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64") {
        $arch = "arm64"
    }

    $Script:Arch = $arch
    $Script:Platform = "windows-$arch"
    Write-Info "Platform: windows/$arch"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Pre-flight checks
# ═══════════════════════════════════════════════════════════════════════════════

function Test-Preflight {
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator
    )

    if (-not $isAdmin) {
        Write-Warn "Not running as Administrator. You may need elevated permissions for service installation."
        if (-not (Confirm-Prompt "Continue anyway?")) {
            Write-Err "Re-run this script as Administrator."
            exit 1
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Module selection
# ═══════════════════════════════════════════════════════════════════════════════

function Select-Modules {
    Write-Host ""
    Write-Step "Module Selection"
    Write-Host ""
    Write-Host "  NATS Server is always installed (required backbone)." -ForegroundColor DarkGray
    Write-Host ""

    $modules = @(
        @{ Name = "tentacle-graphql";    Label = "GraphQL API";                Default = $true  }
        @{ Name = "tentacle-web";        Label = "Web Dashboard";              Default = $true  }
        @{ Name = "tentacle-ethernetip"; Label = "EtherNet/IP Scanner";        Default = $false }
        @{ Name = "tentacle-opcua";      Label = "OPC UA Client";             Default = $false }
        @{ Name = "tentacle-mqtt";       Label = "MQTT Sparkplug B Bridge";   Default = $false }
    )

    $selected = @()
    foreach ($m in $modules) { $selected += $m.Default }

    Write-Host "  Available modules:"
    for ($i = 0; $i -lt $modules.Count; $i++) {
        $mark = if ($selected[$i]) { "x" } else { " " }
        $idx = $i + 1
        Write-Host "    $idx) [$mark] $($modules[$i].Label) " -NoNewline
        Write-Host "($($modules[$i].Name))" -ForegroundColor DarkGray
    }

    Write-Host ""
    Write-Host "  Enter module numbers to toggle, 'a' for all, or Enter to accept defaults:"
    $selection = Read-Host "  >"

    if ($selection -eq "a" -or $selection -eq "A") {
        for ($i = 0; $i -lt $modules.Count; $i++) { $selected[$i] = $true }
    }
    elseif (-not [string]::IsNullOrWhiteSpace($selection)) {
        $nums = $selection -split "[,\s]+" | Where-Object { $_ -match "^\d+$" }
        foreach ($num in $nums) {
            $idx = [int]$num - 1
            if ($idx -ge 0 -and $idx -lt $modules.Count) {
                $selected[$idx] = -not $selected[$idx]
            }
        }
    }

    $Script:SelectedModules = @()
    for ($i = 0; $i -lt $modules.Count; $i++) {
        if ($selected[$i]) {
            $Script:SelectedModules += $modules[$i].Name
        }
    }

    Write-Host ""
    Write-Info "Selected modules: $($Script:SelectedModules -join ', ')"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Deployment method
# ═══════════════════════════════════════════════════════════════════════════════

function Select-Deployment {
    Write-Host ""
    Write-Step "Deployment Method"
    Write-Host ""

    $options = @()

    # Check for Docker
    $hasDocker = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
    if ($hasDocker) {
        $options += @{ Key = "docker"; Label = "Docker Compose" }
    }

    # Check for NSSM (Non-Sucking Service Manager)
    $hasNssm = $null -ne (Get-Command nssm -ErrorAction SilentlyContinue)
    if ($hasNssm) {
        $options += @{ Key = "service"; Label = "Windows Services via NSSM (recommended)" }
    }

    $options += @{ Key = "binary"; Label = "Binary only (manual management)" }

    for ($i = 0; $i -lt $options.Count; $i++) {
        $idx = $i + 1
        Write-Host "    $idx) $($options[$i].Label)"
    }

    Write-Host ""
    $choice = Read-Host "  Select deployment method [1]"
    if ([string]::IsNullOrWhiteSpace($choice)) { $choice = "1" }

    $idx = [int]$choice - 1
    if ($idx -ge 0 -and $idx -lt $options.Count) {
        $Script:DeployMethod = $options[$idx].Key
    }
    else {
        $Script:DeployMethod = "binary"
    }

    Write-Info "Deployment method: $($Script:DeployMethod)"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

function Set-Configuration {
    Write-Host ""
    Write-Step "Configuration"
    Write-Host ""

    $envFile = Join-Path $ConfigDir "tentacle.env"

    if (Test-Path $envFile) {
        Write-Warn "Existing configuration found at $envFile"
        if (-not (Confirm-Prompt "Overwrite configuration?" $false)) {
            Write-Info "Keeping existing configuration."
            return
        }
    }

    $natsServers = Read-Host "  NATS server address [nats://localhost:4222]"
    if ([string]::IsNullOrWhiteSpace($natsServers)) { $natsServers = "nats://localhost:4222" }

    $graphqlPort = Read-Host "  GraphQL API port [4000]"
    if ([string]::IsNullOrWhiteSpace($graphqlPort)) { $graphqlPort = "4000" }

    $webPort = Read-Host "  Web dashboard port [3012]"
    if ([string]::IsNullOrWhiteSpace($webPort)) { $webPort = "3012" }

    $graphqlUrl = "http://localhost:${graphqlPort}/graphql"
    if ($Script:DeployMethod -eq "docker") {
        $graphqlUrl = "http://graphql:${graphqlPort}/graphql"
    }

    New-Item -ItemType Directory -Path $ConfigDir -Force | Out-Null

    $timestamp = Get-Date -Format "o"
    $envContent = @"
# Tentacle Platform Configuration
# Generated by install.ps1 on $timestamp

# NATS
NATS_SERVERS=$natsServers

# GraphQL API
GRAPHQL_PORT=$graphqlPort
GRAPHQL_HOSTNAME=0.0.0.0
TENTACLE_MODE=$($Script:DeployMethod)

# Web Dashboard
GRAPHQL_URL=$graphqlUrl
PORT=$webPort

# MQTT (uncomment and configure if using tentacle-mqtt)
# MQTT_BROKER_URL=mqtt://localhost:1883
# MQTT_CLIENT_ID=tentacle-mqtt
# MQTT_GROUP_ID=TentacleGroup
# MQTT_EDGE_NODE=EdgeNode1

# OPC UA
# OPCUA_PKI_DIR=$DataDir\opcua\pki
# OPCUA_AUTO_ACCEPT_CERTS=true
"@

    Set-Content -Path $envFile -Value $envContent -Encoding UTF8
    Write-Info "Configuration written to $envFile"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Binary installation
# ═══════════════════════════════════════════════════════════════════════════════

function Install-Binaries {
    Write-Host ""
    Write-Step "Installing Binaries"
    Write-Host ""

    $binDir = Join-Path $InstallDir "bin"
    $natsDataDir = Join-Path $DataDir "nats"
    $opcuaPkiDir = Join-Path $DataDir "opcua\pki"

    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    New-Item -ItemType Directory -Path $natsDataDir -Force | Out-Null
    New-Item -ItemType Directory -Path $opcuaPkiDir -Force | Out-Null

    $allModules = @("nats-server") + $Script:SelectedModules

    Write-Info "Downloading Tentacle v$Version for $($Script:Platform)..."
    $url = "https://github.com/$Repo/releases/download/v$Version/tentacle-v$Version-$($Script:Platform).zip"
    $tmpDir = Join-Path $env:TEMP "tentacle-install-$(Get-Random)"
    New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null

    $zipFile = Join-Path $tmpDir "release.zip"

    try {
        Write-Host "  Downloading from $url ..."
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $zipFile -UseBasicParsing
    }
    catch {
        Write-Err "Download failed: $_"
        Write-Host ""
        Write-Host "  You can manually download the release from:" -ForegroundColor Yellow
        Write-Host "  https://github.com/$Repo/releases" -ForegroundColor Cyan
        Write-Host "  Extract the bin/ folder contents to: $binDir" -ForegroundColor Yellow
        return
    }

    Expand-Archive -Path $zipFile -DestinationPath $tmpDir -Force

    foreach ($mod in $allModules) {
        $exeName = "$mod.exe"
        # Search for the binary in extracted contents
        $src = Get-ChildItem -Path $tmpDir -Recurse -Filter $exeName -File | Select-Object -First 1
        if ($src) {
            Copy-Item -Path $src.FullName -Destination (Join-Path $binDir $exeName) -Force
            Write-Info "  Installed $exeName"
        }
        else {
            Write-Warn "  Binary not found in release: $exeName"
        }
    }

    Remove-Item -Path $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
}

# ═══════════════════════════════════════════════════════════════════════════════
# NSSM Windows Service setup
# ═══════════════════════════════════════════════════════════════════════════════

function Install-WindowsServices {
    Write-Host ""
    Write-Step "Setting up Windows Services via NSSM"
    Write-Host ""

    $binDir = Join-Path $InstallDir "bin"
    $envFile = Join-Path $ConfigDir "tentacle.env"

    # Read env vars from config file
    $envVars = @{}
    if (Test-Path $envFile) {
        Get-Content $envFile | ForEach-Object {
            if ($_ -match "^\s*([A-Z_]+)=(.*)$" -and $_ -notmatch "^\s*#") {
                $envVars[$Matches[1]] = $Matches[2]
            }
        }
    }

    # Install NATS first
    $natsBin = Join-Path $binDir "nats-server.exe"
    if (Test-Path $natsBin) {
        $natsDataDir = Join-Path $DataDir "nats"
        & nssm install tentacle-nats "$natsBin" "-js -sd `"$natsDataDir`""
        & nssm set tentacle-nats DisplayName "Tentacle NATS Server"
        & nssm set tentacle-nats Description "NATS JetStream server for Tentacle platform"
        & nssm set tentacle-nats Start SERVICE_AUTO_START
        & nssm set tentacle-nats AppStdout (Join-Path $InstallDir "logs\nats.log")
        & nssm set tentacle-nats AppStderr (Join-Path $InstallDir "logs\nats.log")
        New-Item -ItemType Directory -Path (Join-Path $InstallDir "logs") -Force | Out-Null
        & nssm start tentacle-nats
        Write-Info "  Installed and started tentacle-nats service"
        Start-Sleep -Seconds 2
    }

    # Install other services
    foreach ($mod in $Script:SelectedModules) {
        $exePath = Join-Path $binDir "$mod.exe"
        if (-not (Test-Path $exePath)) {
            Write-Warn "  Binary not found: $exePath — skipping service"
            continue
        }

        $svcName = $mod
        & nssm install $svcName "$exePath"
        & nssm set $svcName DisplayName "Tentacle - $mod"
        & nssm set $svcName Description "Tentacle platform module: $mod"
        & nssm set $svcName Start SERVICE_AUTO_START
        & nssm set $svcName AppStdout (Join-Path $InstallDir "logs\$mod.log")
        & nssm set $svcName AppStderr (Join-Path $InstallDir "logs\$mod.log")
        & nssm set $svcName DependOnService tentacle-nats

        # Set environment variables from config
        $envString = ($envVars.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join "`n"
        if ($envString) {
            & nssm set $svcName AppEnvironmentExtra $envString
        }

        & nssm start $svcName
        Write-Info "  Installed and started $svcName service"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Docker Compose setup
# ═══════════════════════════════════════════════════════════════════════════════

function Install-Docker {
    Write-Host ""
    Write-Step "Setting up Docker Compose"
    Write-Host ""

    $dockerDir = Join-Path $InstallDir "docker"
    $dockerBinDir = Join-Path $dockerDir "bin"
    New-Item -ItemType Directory -Path $dockerBinDir -Force | Out-Null

    # Download docker-compose.yml and Dockerfiles from the release
    $baseUrl = "https://raw.githubusercontent.com/$Repo/v$Version/deploy"

    $filesToDownload = @("docker-compose.yml")
    foreach ($mod in $Script:SelectedModules) {
        $svc = $mod -replace "tentacle-", ""
        $filesToDownload += "Dockerfile.$svc"
    }

    foreach ($file in $filesToDownload) {
        try {
            $url = "$baseUrl/$file"
            $dest = Join-Path $dockerDir $file
            Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -ErrorAction Stop
            Write-Info "  Downloaded $file"
        }
        catch {
            Write-Warn "  Could not download $file (you may need to copy it manually)"
        }
    }

    # Copy binaries into docker build context
    $binDir = Join-Path $InstallDir "bin"
    foreach ($mod in $Script:SelectedModules) {
        $src = Join-Path $binDir "$mod.exe"
        if (Test-Path $src) {
            Copy-Item -Path $src -Destination (Join-Path $dockerBinDir "$mod.exe") -Force
        }
    }

    # Copy env file
    $envFile = Join-Path $ConfigDir "tentacle.env"
    if (Test-Path $envFile) {
        Copy-Item -Path $envFile -Destination (Join-Path $dockerDir ".env") -Force
    }

    Write-Info "Docker Compose files installed in $dockerDir"

    if (Confirm-Prompt "Start services now with docker compose?") {
        Push-Location $dockerDir
        & docker compose up -d --build
        Pop-Location
        Write-Info "Services started!"
    }
    else {
        Write-Info "To start later: cd $dockerDir; docker compose up -d --build"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Binary-only setup (start/stop scripts)
# ═══════════════════════════════════════════════════════════════════════════════

function Install-BinaryOnly {
    Write-Host ""
    Write-Step "Binary-only installation"
    Write-Host ""

    $binDir = Join-Path $InstallDir "bin"
    $natsDataDir = Join-Path $DataDir "nats"
    $envFile = Join-Path $ConfigDir "tentacle.env"

    # Create start.bat
    $startLines = @(
        "@echo off"
        "setlocal"
        ""
        "REM Load environment from config"
        "if exist `"$envFile`" ("
        "  for /F `"usebackq tokens=1,* delims==`" %%A in (`"$envFile`") do ("
        "    set `"%%A=%%B`""
        "  )"
        ")"
        ""
        "echo Starting Tentacle services..."
        ""
        "REM Start NATS server"
        "start `"NATS Server`" /B `"$binDir\nats-server.exe`" -js -sd `"$natsDataDir`""
        "echo   NATS server started"
        "timeout /t 2 /nobreak >nul"
        ""
    )

    foreach ($mod in $Script:SelectedModules) {
        $startLines += "REM Start $mod"
        $startLines += "start `"$mod`" /B `"$binDir\$mod.exe`""
        $startLines += "echo   $mod started"
        $startLines += ""
    }

    $startLines += @(
        "echo."
        "echo All services started."
        "echo Web Dashboard: http://localhost:%PORT%"
        "echo."
        "echo Press any key to stop all services..."
        "pause >nul"
        ""
        "REM Stop all services"
        "taskkill /F /IM nats-server.exe >nul 2>&1"
    )

    foreach ($mod in $Script:SelectedModules) {
        $startLines += "taskkill /F /IM $mod.exe >nul 2>&1"
    }

    $startLines += @(
        "echo Services stopped."
    )

    $startBat = Join-Path $InstallDir "start.bat"
    Set-Content -Path $startBat -Value ($startLines -join "`r`n") -Encoding ASCII
    Write-Info "Start script created: $startBat"

    # Create stop.bat
    $stopLines = @(
        "@echo off"
        "echo Stopping Tentacle services..."
        "taskkill /F /IM nats-server.exe >nul 2>&1"
    )

    foreach ($mod in $Script:SelectedModules) {
        $stopLines += "taskkill /F /IM $mod.exe >nul 2>&1"
    }

    $stopLines += @(
        "echo All services stopped."
    )

    $stopBat = Join-Path $InstallDir "stop.bat"
    Set-Content -Path $stopBat -Value ($stopLines -join "`r`n") -Encoding ASCII
    Write-Info "Stop script created: $stopBat"

    # Create start.ps1 for PowerShell users who prefer it
    $ps1Lines = @(
        "# Tentacle Platform - Start all services"
        '$ErrorActionPreference = "Continue"'
        '$binDir = "' + $binDir + '"'
        '$envFile = "' + $envFile + '"'
        '$natsDataDir = "' + $natsDataDir + '"'
        ""
        "# Load environment"
        'if (Test-Path $envFile) {'
        '    Get-Content $envFile | ForEach-Object {'
        '        if ($_ -match "^\s*([A-Z_]+)=(.*)$" -and $_ -notmatch "^\s*#") {'
        '            [Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")'
        '        }'
        '    }'
        '}'
        ""
        'Write-Host "Starting Tentacle services..." -ForegroundColor Cyan'
        ""
        '# Start NATS'
        '$procs = @()'
        '$procs += Start-Process -FilePath "$binDir\nats-server.exe" -ArgumentList "-js", "-sd", "$natsDataDir" -PassThru -WindowStyle Hidden'
        'Write-Host "  NATS server started (PID: $($procs[-1].Id))"'
        'Start-Sleep -Seconds 2'
        ""
    )

    foreach ($mod in $Script:SelectedModules) {
        $ps1Lines += '# Start ' + $mod
        $ps1Lines += '$procs += Start-Process -FilePath "' + $binDir + '\' + $mod + '.exe" -PassThru -WindowStyle Hidden'
        $ps1Lines += 'Write-Host "  ' + $mod + ' started (PID: $($procs[-1].Id))"'
        $ps1Lines += ""
    }

    $ps1Lines += @(
        '$port = if ($env:PORT) { $env:PORT } else { "3012" }'
        'Write-Host ""'
        'Write-Host "All services started." -ForegroundColor Green'
        'Write-Host "Web Dashboard: http://localhost:$port" -ForegroundColor Cyan'
        'Write-Host ""'
        'Write-Host "Press Ctrl+C to stop all services..."'
        ""
        'try {'
        '    while ($true) { Start-Sleep -Seconds 1 }'
        '}'
        'finally {'
        '    Write-Host "Stopping services..." -ForegroundColor Yellow'
        '    foreach ($p in $procs) {'
        '        if (-not $p.HasExited) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue }'
        '    }'
        '    Write-Host "All services stopped." -ForegroundColor Green'
        '}'
    )

    $startPs1 = Join-Path $InstallDir "start.ps1"
    Set-Content -Path $startPs1 -Value ($ps1Lines -join "`r`n") -Encoding UTF8
    Write-Info "PowerShell start script created: $startPs1"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Verification
# ═══════════════════════════════════════════════════════════════════════════════

function Test-Installation {
    Write-Host ""
    Write-Step "Verifying Installation"
    Write-Host ""

    Start-Sleep -Seconds 3

    # Check NATS
    try {
        $null = Invoke-WebRequest -Uri "http://localhost:8222/healthz" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Info "NATS server: running"
    }
    catch {
        Write-Warn "NATS server: not responding on :8222 (may still be starting)"
    }

    # Check GraphQL
    $envFile = Join-Path $ConfigDir "tentacle.env"
    $graphqlPort = "4000"
    if (Test-Path $envFile) {
        $match = Select-String -Path $envFile -Pattern "^GRAPHQL_PORT=(\d+)" | Select-Object -First 1
        if ($match) { $graphqlPort = $match.Matches.Groups[1].Value }
    }

    try {
        $body = '{"query":"{__typename}"}'
        $null = Invoke-WebRequest -Uri "http://localhost:${graphqlPort}/graphql" -Method POST `
            -ContentType "application/json" -Body $body -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Info "GraphQL API: running on port $graphqlPort"
    }
    catch {
        Write-Warn "GraphQL API: not responding on :$graphqlPort (may still be starting)"
    }

    # Check Web
    $webPort = "3012"
    if (Test-Path $envFile) {
        $match = Select-String -Path $envFile -Pattern "^PORT=(\d+)" | Select-Object -First 1
        if ($match) { $webPort = $match.Matches.Groups[1].Value }
    }

    try {
        $null = Invoke-WebRequest -Uri "http://localhost:${webPort}" -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        Write-Info "Web Dashboard: running on port $webPort"
    }
    catch {
        Write-Warn "Web Dashboard: not responding on :$webPort (may still be starting)"
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

function Show-Summary {
    $envFile = Join-Path $ConfigDir "tentacle.env"
    $graphqlPort = "4000"
    $webPort = "3012"

    if (Test-Path $envFile) {
        $match = Select-String -Path $envFile -Pattern "^GRAPHQL_PORT=(\d+)" | Select-Object -First 1
        if ($match) { $graphqlPort = $match.Matches.Groups[1].Value }
        $match = Select-String -Path $envFile -Pattern "^PORT=(\d+)" | Select-Object -First 1
        if ($match) { $webPort = $match.Matches.Groups[1].Value }
    }

    Write-Host ""
    Write-Host "  +====================================================+" -ForegroundColor Green
    Write-Host "  |           Installation Complete!                    |" -ForegroundColor Green
    Write-Host "  +====================================================+" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Version:          $Version"
    Write-Host "  Install dir:      $InstallDir"
    Write-Host "  Config:           $ConfigDir\tentacle.env"
    Write-Host "  Deploy method:    $($Script:DeployMethod)"
    Write-Host ""
    Write-Host "  Services:"
    Write-Host "    Web Dashboard:  http://localhost:$webPort" -ForegroundColor Cyan
    Write-Host "    GraphQL API:    http://localhost:${graphqlPort}/graphql" -ForegroundColor Cyan
    Write-Host "    NATS:           nats://localhost:4222" -ForegroundColor Cyan
    Write-Host ""

    switch ($Script:DeployMethod) {
        "service" {
            Write-Host "  Management:"
            Write-Host "    nssm status tentacle-nats"
            Write-Host "    nssm restart tentacle-graphql"
            Write-Host "    Get-Content $InstallDir\logs\tentacle-web.log -Wait"
            Write-Host ""
            Write-Host "  To remove a service:"
            Write-Host "    nssm stop <service-name>"
            Write-Host "    nssm remove <service-name> confirm"
        }
        "docker" {
            Write-Host "  Management:"
            Write-Host "    cd $InstallDir\docker; docker compose ps"
            Write-Host "    cd $InstallDir\docker; docker compose logs -f"
            Write-Host "    cd $InstallDir\docker; docker compose restart"
        }
        "binary" {
            Write-Host "  Management:"
            Write-Host "    $InstallDir\start.bat        (Batch script)"
            Write-Host "    $InstallDir\start.ps1        (PowerShell script)"
            Write-Host "    $InstallDir\stop.bat         (Stop all services)"
        }
    }

    Write-Host ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

function Main {
    Show-Banner
    Get-Platform
    Test-Preflight
    Select-Modules
    Select-Deployment
    Set-Configuration
    Install-Binaries

    switch ($Script:DeployMethod) {
        "service" { Install-WindowsServices }
        "docker"  { Install-Docker }
        "binary"  { Install-BinaryOnly }
    }

    if ($Script:DeployMethod -ne "binary") {
        Test-Installation
    }

    Show-Summary
}

Main
