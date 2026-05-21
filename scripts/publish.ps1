[CmdletBinding()]
param(
  [string]$PiHost   = "wormhole.local",
  [string]$PiUser   = "pi",
  [string]$RemoteDir = "/opt/tapo-viewer",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$target = "${PiUser}@${PiHost}"

if (-not $SkipBuild) {
  Write-Host "==> Building server" -ForegroundColor Cyan
  Push-Location "$root\server"
  npm ci; if (-not $?) { throw "server npm ci failed" }
  npm run build; if (-not $?) { throw "server build failed" }
  Pop-Location

  Write-Host "==> Building web" -ForegroundColor Cyan
  Push-Location "$root\web"
  npm ci; if (-not $?) { throw "web npm ci failed" }
  npm run build -- --configuration=production; if (-not $?) { throw "web build failed" }
  Pop-Location
}

Write-Host "==> Preparing remote dirs on $target" -ForegroundColor Cyan
ssh $target "mkdir -p $RemoteDir/server $RemoteDir/web $RemoteDir/scripts"

Write-Host "==> Syncing server artifacts" -ForegroundColor Cyan
scp -r "$root\server\dist"                       "${target}:$RemoteDir/server/"
scp    "$root\server\package.json"               "${target}:$RemoteDir/server/"
scp    "$root\server\package-lock.json"          "${target}:$RemoteDir/server/"

Write-Host "==> Syncing web build" -ForegroundColor Cyan
scp -r "$root\web\dist"                          "${target}:$RemoteDir/web/"

Write-Host "==> Syncing go2rtc config and systemd units" -ForegroundColor Cyan
scp    "$root\go2rtc.yaml"                       "${target}:$RemoteDir/"
scp    "$root\scripts\tapo-server.service"       "${target}:$RemoteDir/scripts/"
scp    "$root\scripts\go2rtc.service"            "${target}:$RemoteDir/scripts/"
scp    "$root\scripts\install-pi.sh"             "${target}:$RemoteDir/scripts/"

Write-Host "==> Installing server prod deps on Pi" -ForegroundColor Cyan
ssh $target "cd $RemoteDir/server && npm ci --omit=dev"

Write-Host "==> Restarting services" -ForegroundColor Cyan
ssh $target "sudo systemctl restart go2rtc tapo-server"

Write-Host "==> Done. http://${PiHost}:8080" -ForegroundColor Green
