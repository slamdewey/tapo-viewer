#!/usr/bin/env bash
# One-time setup on the Pi. Run after the first publish has placed scripts/ under /opt/tapo-viewer.
set -euo pipefail

REMOTE_DIR=/opt/tapo-viewer
GO2RTC_VERSION=v1.9.4

case "$(uname -m)" in
  aarch64) GO2RTC_ARCH=linux_arm64 ;;
  armv7l)  GO2RTC_ARCH=linux_arm ;;
  x86_64)  GO2RTC_ARCH=linux_amd64 ;;
  *) echo "Unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js LTS"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v go2rtc >/dev/null 2>&1; then
  echo "==> Installing go2rtc $GO2RTC_VERSION ($GO2RTC_ARCH)"
  sudo curl -fsSL -o /usr/local/bin/go2rtc \
    "https://github.com/AlexxIT/go2rtc/releases/download/${GO2RTC_VERSION}/go2rtc_${GO2RTC_ARCH}"
  sudo chmod +x /usr/local/bin/go2rtc
fi

sudo mkdir -p "$REMOTE_DIR"
sudo chown "$USER:$USER" "$REMOTE_DIR"

echo "==> Installing systemd units"
sudo cp "$REMOTE_DIR/scripts/go2rtc.service"     /etc/systemd/system/
sudo cp "$REMOTE_DIR/scripts/tapo-server.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable go2rtc tapo-server

echo
echo "==> Setup complete."
echo "    Next: create $REMOTE_DIR/server/.env (copy from .env.example), edit $REMOTE_DIR/go2rtc.yaml,"
echo "    then: sudo systemctl start go2rtc tapo-server"
