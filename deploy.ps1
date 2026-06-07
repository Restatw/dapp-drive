# IPFS Drive — deployment script
#
# Usage:
#   .\deploy.ps1                        # build → add → publish (offline/local)
#   .\deploy.ps1 -SetupCors             # first time: configure CORS + fix listen address
#   .\deploy.ps1 -SetupCors -SkipBuild  # fix CORS only (no rebuild, no re-add)
#   .\deploy.ps1 -Online                # propagate IPNS record to DHT network

[CmdletBinding()]
param(
    [switch]$SetupCors, # configure API CORS (run once after creating the key)
    [switch]$Online,    # propagate IPNS record to DHT network
    [switch]$SkipBuild  # skip npm build (useful when only re-publishing or fixing CORS)
)

Set-Location $PSScriptRoot

$KeyName = "dapp-drive"

function Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "    OK  $msg" -ForegroundColor Green }
function Info($msg) { Write-Host "    ..  $msg" -ForegroundColor DarkGray }
function Warn($msg) { Write-Host "    !!  $msg" -ForegroundColor Yellow }
function Fail($msg) { Write-Host "`n    ERR $msg`n" -ForegroundColor Red; exit 1 }

# Helper: get key ID via JSON (avoids CRLF / whitespace parsing issues)
function Get-IpnsId([string]$name) {
    $raw = ipfs key list --enc json 2>&1 | Out-String
    try { ($raw | ConvertFrom-Json).Keys | Where-Object { $_.Name -eq $name } | Select-Object -ExpandProperty Id }
    catch { $null }
}

# ── 1. IPFS daemon ────────────────────────────────────────────────
Step "Checking IPFS daemon"
ipfs id 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { Fail "IPFS daemon not running.  Run: ipfs daemon" }
Ok "Daemon is up"

# ── 2. IPNS key ───────────────────────────────────────────────────
Step "IPNS key '$KeyName'"

# Trim each line to handle Windows CRLF output from ipfs
$keyNames = (ipfs key list 2>&1) | ForEach-Object { "$_".Trim() }
if ($LASTEXITCODE -ne 0) { Fail "Failed to list IPNS keys" }

if ($KeyName -notin $keyNames) {
    Info "Key not found — creating..."
    ipfs key gen $KeyName | Out-Null
    if ($LASTEXITCODE -ne 0) { Fail "Failed to create key '$KeyName'" }
    Ok "Key created"
}

$ipnsId = Get-IpnsId $KeyName
if (-not $ipnsId) { Fail "Could not resolve ID for key '$KeyName'" }
Ok "IPNS ID: $ipnsId"

# ── 3. Build ──────────────────────────────────────────────────────
Step "Building Vue3 app"
if ($SkipBuild) {
    Info "Skipping build (-SkipBuild)"
} else {
    npm run build
    if ($LASTEXITCODE -ne 0) { Fail "npm run build failed" }
    Ok "dist/ is ready"
}

# ── 4. Add dist/ to IPFS ─────────────────────────────────────────
Step "Adding dist/ to IPFS"
$addOut = ipfs add -r --cid-version=1 --quieter dist/ 2>&1
if ($LASTEXITCODE -ne 0) { Fail "ipfs add failed: $addOut" }
$cid = ($addOut | Select-Object -Last 1).ToString().Trim()
Ok "CID: $cid"

# ── 5. Publish to IPNS ───────────────────────────────────────────
Step "Publishing to IPNS"
if ($Online) {
    Info "Publishing to DHT network..."
    ipfs name publish --key $KeyName $cid
} else {
    Info "Publishing locally (--allow-offline). Use -Online to broadcast to DHT."
    ipfs name publish --key $KeyName --allow-offline $cid
}
if ($LASTEXITCODE -ne 0) { Fail "ipfs name publish failed" }
Ok "Published"

# ── 6. CORS setup (first time or -SetupCors) ─────────────────────
# All origins allowed to call the local IPFS API (http://127.0.0.1:5001):
#   browsers treat 127.0.0.1 as a secure context, so HTTPS → HTTP is permitted.
$origin          = "http://$ipnsId.ipns.localhost:8080"   # local IPNS gateway
$inbrowserOrigin = "https://$ipnsId.ipns.inbrowser.link"  # public gateway (inbrowser.link)
$dwebOrigin      = "https://$ipnsId.ipns.dweb.link"       # public gateway (dweb.link)
$devOrigin       = "http://localhost:5173"                 # Vite dev server

if ($SetupCors) {
    Step "Configuring IPFS CORS + listen address"
    Info "Allow-Origin (local gw)  : $origin"
    Info "Allow-Origin (inbrowser) : $inbrowserOrigin"
    Info "Allow-Origin (dweb)      : $dwebOrigin"
    Info "Allow-Origin (dev)       : $devOrigin"

    # `ipfs config --json` + PowerShell = quoting hell: Windows strips the inner "
    # from ["http://..."] before ipfs sees it. Bypass entirely by editing the
    # config file directly with PowerShell's JSON parser — no shell escaping needed.
    $ipfsHome = if ($env:IPFS_PATH) { $env:IPFS_PATH } else { "$env:USERPROFILE\.ipfs" }
    $cfgPath  = Join-Path $ipfsHome 'config'
    if (-not (Test-Path $cfgPath)) { Fail "IPFS config not found: $cfgPath" }

    $cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

    if ($null -eq $cfg.API) {
        $cfg | Add-Member -NotePropertyName 'API' -NotePropertyValue ([PSCustomObject]@{}) -Force
    }

    # ── CORS headers ──────────────────────────────────────────────
    # [string[]] forces ConvertTo-Json to emit a JSON array even for a single string.
    # Four origins: local IPNS gateway + two public IPNS gateways + Vite dev server.
    $cfg.API | Add-Member -NotePropertyName 'HTTPHeaders' -NotePropertyValue ([PSCustomObject]@{
        'Access-Control-Allow-Origin'  = [string[]]@($origin, $inbrowserOrigin, $dwebOrigin, $devOrigin)
        'Access-Control-Allow-Methods' = [string[]]@('GET', 'POST', 'PUT')
        'Access-Control-Allow-Headers' = [string[]]@('Authorization')
    }) -Force

    # ── Listen addresses: use localhost instead of 127.0.0.1 ─────
    # The app is compiled with VITE_IPFS_API=http://localhost:5001.
    # Browsers (especially Firefox) treat http://localhost as a trustworthy
    # origin and allow HTTPS pages to call it without mixed-content blocking.
    # http://127.0.0.1 is an IP address and may be blocked in some browsers.
    if ($null -eq $cfg.Addresses) {
        $cfg | Add-Member -NotePropertyName 'Addresses' -NotePropertyValue ([PSCustomObject]@{}) -Force
    }
    $cfg.Addresses | Add-Member -NotePropertyName 'API'     -NotePropertyValue '/ip4/127.0.0.1/tcp/5001' -Force
    $cfg.Addresses | Add-Member -NotePropertyName 'Gateway' -NotePropertyValue '/ip4/127.0.0.1/tcp/8080' -Force

    Info "API listen    : /ip4/127.0.0.1/tcp/5001  (localhost:5001)"
    Info "Gateway listen: /ip4/127.0.0.1/tcp/8080  (localhost:8080)"

    # PowerShell 5.1's -Encoding UTF8 writes a BOM which IPFS can't parse.
    # Use .NET directly to write UTF-8 without BOM.
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($cfgPath, ($cfg | ConvertTo-Json -Depth 20), $utf8NoBom)
    if (-not $?) { Fail "Failed to write IPFS config" }

    Ok "CORS + listen address configured"
    Warn "Restart daemon to apply:"
    Warn "  ipfs shutdown"
    Warn "  ipfs daemon"
}

# ── 7. Summary ────────────────────────────────────────────────────
$line = "-" * 60
Write-Host ""
Write-Host $line -ForegroundColor DarkGray
Write-Host " Deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "  CID    $cid"
Write-Host "  IPNS   $ipnsId"
Write-Host ""
Write-Host "  Access via:" -ForegroundColor DarkGray
Write-Host "    (local)      $origin/#/" -ForegroundColor Cyan
Write-Host "    (public)     $inbrowserOrigin/#/" -ForegroundColor Cyan
Write-Host "    (public alt) $dwebOrigin/#/" -ForegroundColor Cyan
Write-Host $line -ForegroundColor DarkGray
Write-Host ""
