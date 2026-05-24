#!/usr/bin/env bash
# Idempotent system-side setup. Safe to re-run on every deploy; only does work
# when something actually changed.
set -euo pipefail

REMOTE_DIR="$HOME/scry"
GO2RTC_VERSION=v1.9.4

case "$(uname -m)" in
  aarch64) GO2RTC_ARCH=linux_arm64 ;;
  armv7l)  GO2RTC_ARCH=linux_arm ;;
  x86_64)  GO2RTC_ARCH=linux_amd64 ;;
  *) echo "Unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac

# --- One-time migration from the old tapo-viewer layout -----------------------
OLD_DIR="$HOME/tapo-viewer"
OLD_UNIT="$HOME/.config/systemd/user/tapo-server.service"
if [ -d "$OLD_DIR" ] && [ "$OLD_DIR" != "$REMOTE_DIR" ]; then
  if [ -f "$OLD_DIR/server/.env" ] && [ ! -f "$REMOTE_DIR/server/.env" ]; then
    echo "==> Migrating server/.env from $OLD_DIR to $REMOTE_DIR"
    mkdir -p "$REMOTE_DIR/server"
    cp "$OLD_DIR/server/.env" "$REMOTE_DIR/server/.env"
  fi
fi
if [ -f "$OLD_UNIT" ]; then
  echo "==> Removing legacy tapo-server.service user unit"
  systemctl --user stop tapo-server 2>/dev/null || true
  systemctl --user disable tapo-server 2>/dev/null || true
  rm -f "$OLD_UNIT"
  systemctl --user daemon-reload
fi

if ! command -v node >/dev/null 2>&1; then
  echo "==> Installing Node.js LTS"
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "==> Installing ffmpeg (required for go2rtc snapshot frames)"
  sudo apt-get install -y ffmpeg
fi

if ! command -v go2rtc >/dev/null 2>&1; then
  echo "==> Installing go2rtc $GO2RTC_VERSION ($GO2RTC_ARCH)"
  sudo curl -fsSL -o /usr/local/bin/go2rtc \
    "https://github.com/AlexxIT/go2rtc/releases/download/${GO2RTC_VERSION}/go2rtc_${GO2RTC_ARCH}"
  sudo chmod +x /usr/local/bin/go2rtc
fi

mkdir -p "$REMOTE_DIR"

if command -v pihole >/dev/null 2>&1; then
  echo "!! Pi-hole is still installed. dnsmasq and Caddy both want ports that"
  echo "   Pi-hole occupies (53, 80). Run 'sudo pihole uninstall' first, then"
  echo "   re-run this script."
  exit 1
fi

# --- dnsmasq ------------------------------------------------------------------
if ! dpkg -s dnsmasq >/dev/null 2>&1; then
  echo "==> Installing dnsmasq"
  sudo apt-get update
  sudo apt-get install -y dnsmasq
fi

DNSMASQ_SRC="$REMOTE_DIR/scripts/dnsmasq.scry.conf"
DNSMASQ_DST=/etc/dnsmasq.d/scry.conf
DNSMASQ_CHANGED=0
if [ -f "$DNSMASQ_SRC" ]; then
  PI_IP=$(ip route get 1.1.1.1 2>/dev/null | grep -oP '(?<=src\s)\d+\.\d+\.\d+\.\d+' | head -1)
  PI_HOSTNAME=$(hostname -s)
  TMP_CONF=$(mktemp)
  sed -e "s/__PI_IP__/$PI_IP/g" -e "s/__PI_HOSTNAME__/$PI_HOSTNAME/g" "$DNSMASQ_SRC" > "$TMP_CONF"
  if ! sudo cmp -s "$TMP_CONF" "$DNSMASQ_DST" 2>/dev/null; then
    echo "==> Updating $DNSMASQ_DST (host=$PI_HOSTNAME, ip=$PI_IP)"
    sudo cp "$TMP_CONF" "$DNSMASQ_DST"
    sudo chmod 644 "$DNSMASQ_DST"
    DNSMASQ_CHANGED=1
  fi
  rm -f "$TMP_CONF"
fi
if ! systemctl is-enabled --quiet dnsmasq; then
  sudo systemctl enable dnsmasq >/dev/null
fi
if [ "$DNSMASQ_CHANGED" = "1" ] || ! systemctl is-active --quiet dnsmasq; then
  sudo systemctl restart dnsmasq
fi

# --- Caddy --------------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
  echo "==> Installing Caddy"
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y caddy
fi

CADDY_SRC="$REMOTE_DIR/scripts/Caddyfile"
CADDY_DST=/etc/caddy/Caddyfile
CADDY_CHANGED=0
if [ -f "$CADDY_SRC" ] && ! sudo cmp -s "$CADDY_SRC" "$CADDY_DST" 2>/dev/null; then
  echo "==> Updating $CADDY_DST"
  sudo cp "$CADDY_SRC" "$CADDY_DST"
  CADDY_CHANGED=1
fi
if ! systemctl is-enabled --quiet caddy; then
  sudo systemctl enable caddy >/dev/null
fi
if [ "$CADDY_CHANGED" = "1" ] || ! systemctl is-active --quiet caddy; then
  sudo systemctl restart caddy
fi

# --- User-level systemd units -------------------------------------------------
USER_UNIT_DIR="$HOME/.config/systemd/user"
mkdir -p "$USER_UNIT_DIR"
UNITS_CHANGED=0
for unit in go2rtc.service scry-server.service; do
  if ! cmp -s "$REMOTE_DIR/scripts/$unit" "$USER_UNIT_DIR/$unit" 2>/dev/null; then
    echo "==> Updating user unit $unit"
    cp "$REMOTE_DIR/scripts/$unit" "$USER_UNIT_DIR/$unit"
    UNITS_CHANGED=1
  fi
done
if [ "$UNITS_CHANGED" = "1" ]; then
  systemctl --user daemon-reload
fi
systemctl --user enable go2rtc scry-server >/dev/null 2>&1 || true

# --- Boot-time linger ---------------------------------------------------------
if ! loginctl show-user "$USER" --property=Linger 2>/dev/null | grep -q "Linger=yes"; then
  echo "==> Enabling linger so user services start at boot"
  sudo loginctl enable-linger "$USER"
fi
