[CmdletBinding()]
param(
  [string]$PiHost,
  [string]$PiUser,
  [string]$RemoteDir,
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

$defaults = @{ PiHost = "wormhole.local"; PiUser = "jared"; RemoteDir = "/home/jared/tapo-viewer" }
$envFile = Join-Path $root "deploy.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$' -and -not $_.StartsWith('#')) {
      $defaults[$Matches[1]] = $Matches[2]
    }
  }
}
if (-not $PiHost)    { $PiHost = $defaults.PiHost }
if (-not $PiUser)    { $PiUser = $defaults.PiUser }
if (-not $RemoteDir) { $RemoteDir = $defaults.RemoteDir }

$target = "${PiUser}@${PiHost}"
$hasWeb = Test-Path "$root\web\package.json"

if (-not $SkipBuild) {
  Write-Host "==> Building server" -ForegroundColor Cyan
  Push-Location "$root\server"
  npm ci; if (-not $?) { throw "server npm ci failed" }
  npm run build; if (-not $?) { throw "server build failed" }
  Pop-Location

  if ($hasWeb) {
    Write-Host "==> Building web" -ForegroundColor Cyan
    Push-Location "$root\web"
    npm ci; if (-not $?) { throw "web npm ci failed" }
    npm run build -- --configuration=production; if (-not $?) { throw "web build failed" }
    Pop-Location
  } else {
    Write-Host "==> Skipping web build (web/ not present)" -ForegroundColor Yellow
  }
}

Write-Host "==> Preparing remote dirs on $target" -ForegroundColor Cyan
ssh $target "mkdir -p $RemoteDir/server $RemoteDir/web $RemoteDir/scripts"

Write-Host "==> Syncing server artifacts" -ForegroundColor Cyan
scp -r "$root\server\dist"                       "${target}:$RemoteDir/server/"
scp    "$root\server\package.json"               "${target}:$RemoteDir/server/"
scp    "$root\server\package-lock.json"          "${target}:$RemoteDir/server/"

if (Test-Path "$root\server\.env") {
  Write-Host "==> Syncing server/.env (camera creds)" -ForegroundColor Cyan
  scp "$root\server\.env"                        "${target}:$RemoteDir/server/.env"
} else {
  Write-Host "==> No local server/.env to sync (create $RemoteDir/server/.env on Pi manually)" -ForegroundColor Yellow
}

if ($hasWeb) {
  Write-Host "==> Syncing web build" -ForegroundColor Cyan
  scp -r "$root\web\dist"                          "${target}:$RemoteDir/web/"
} else {
  Write-Host "==> Skipping web sync (web/ not present)" -ForegroundColor Yellow
}

Write-Host "==> Syncing go2rtc config and systemd units" -ForegroundColor Cyan
scp    "$root\go2rtc.yaml"                       "${target}:$RemoteDir/"
scp    "$root\scripts\tapo-server.service"       "${target}:$RemoteDir/scripts/"
scp    "$root\scripts\go2rtc.service"            "${target}:$RemoteDir/scripts/"
scp    "$root\scripts\install-pi.sh"             "${target}:$RemoteDir/scripts/"

Write-Host "==> Installing server prod deps on Pi" -ForegroundColor Cyan
ssh $target "cd $RemoteDir/server && npm ci --omit=dev"

Write-Host "==> Restarting services" -ForegroundColor Cyan
ssh $target "systemctl --user restart go2rtc tapo-server"

Write-Host "==> Done. http://${PiHost}:8080" -ForegroundColor Green
