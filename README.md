# scry

Self-hosted viewer for TP-Link Tapo IP cameras. A Raspberry Pi pulls RTSP from
each camera, relays to WebRTC via [go2rtc](https://github.com/AlexxIT/go2rtc),
and serves a small Angular web app for live viewing and PTZ. Remote access is
via WireGuard.

Built for a single household: a few cameras, a few devices, accessed on the
LAN or while travelling.

## Architecture

```
            +----------------- Pi (wormhole) -----------------+
            |                                                 |
[Tapo cam] -+-RTSP-> [go2rtc] --WebRTC (UDP 8555)--+          |
            |           ^                          |          |
            |     /stream/* proxy                  |          |
            |           |                          v          |
            |        [Node/Express :8080] <-------/           |
            |          ^      |                               |
            |          |      +-- ONVIF PTZ ------> [Tapo cam]|
            |          |                                      |
            |     [Pi-hole :53]   [WireGuard :51820/udp]      |
            |                                                 |
            +-------------------------------------------------+
                  ^                            ^
                  |                            |
            LAN browser                  WG peer (phone, laptop)
```

Two user-mode systemd services hold the app code:

| Service        | Port(s)        | Role                                                 |
| -------------- | -------------- | ---------------------------------------------------- |
| `go2rtc`       | 1984, 8555/udp | RTSP→WebRTC relay, snapshot frames                   |
| `tapo-server`  | 8080           | Static web bundle + `/api/cameras` + ONVIF PTZ proxy |

Three system services support them, installed and configured by
`scripts/install-pi.sh`:

| Service     | Role                                                            |
| ----------- | --------------------------------------------------------------- |
| `dnsmasq`   | DNS on :53; resolves `scry` and `wormhole` to the Pi's LAN IP   |
| `caddy`     | Reverse proxy on :80; forwards everything to the Node server    |
| `wireguard` | Remote access; tunnel terminates at the Pi on UDP 51820         |

The Angular client talks to the Node server, which proxies `/stream/*` to
go2rtc and issues ONVIF `ContinuousMove` for PTZ. WebRTC media flows directly
from go2rtc to the browser on UDP 8555.

Caddy means `http://scry` (no port) works for LAN and WG clients alike. Its
config is one site block — see [`scripts/Caddyfile`](scripts/Caddyfile). When
you want HTTPS, switch the `:80` block to an FQDN site block and Caddy will
fetch and renew a Let's Encrypt cert automatically.

dnsmasq replaces Pi-hole as the local resolver — no admin UI, no blocklists,
no embedded webserver fighting for port 80. Local DNS records live in
[`scripts/dnsmasq.scry.conf`](scripts/dnsmasq.scry.conf). Add another
`address=/name/<ip>` line and re-run `install-pi.sh` to publish.

## Repo layout

```
cameras.yaml          Camera inventory (id, label, model, RTSP creds, ONVIF)
cameras.example.yaml  Template
models.yaml           Per-model stream paths + capabilities (PTZ, audio)
deploy.env            Pi host + WG-host overrides (gitignored; see *.example)
server/               Node/Express API + reverse proxy
web/                  Angular client (live view, camera list, PTZ overlay)
scripts/              Systemd units, install + publish scripts
tools/                Local dev helpers (dev-mode go2rtc config etc.)
```

## Prerequisites

- A Raspberry Pi (or any Debian-ish Linux box) with SSH access.
- Tapo cameras with RTSP enabled (Tapo app → camera settings → Camera Account).
- Node 20+ on your dev machine for builds.
- A WireGuard server on the Pi (PiVPN is the easiest installer). Out of scope
  here.
- `install-pi.sh` will install dnsmasq and Caddy automatically; no separate
  DNS server or reverse proxy needs to be set up by hand.

## Quick start

Assuming the Pi already has WireGuard + Pi-hole running and your camera is
reachable on the LAN:

```bash
cp cameras.example.yaml cameras.yaml         # then edit
cp deploy.env.example deploy.env             # then edit
npm install
npm run deploy
ssh wormhole.local 'bash ~/tapo-viewer/scripts/install-pi.sh'   # first time only
```

Site is then at `http://scry` (LAN or VPN, once DNS is set up) or
`http://192.168.0.77:8080` (LAN, by raw IP).

## Configuring cameras

Each camera is one entry in `cameras.yaml`:

```yaml
cameras:
  - id: eye_of_sauron       # used in URLs, must be unique
    label: Eye of Sauron    # shown in the UI
    model: tapo-c200        # key into models.yaml
    network:
      ip: 192.168.0.88
      user: <rtsp-username>
      pass: <rtsp-password>
```

`models.yaml` defines what each model can do (PTZ, audio, available stream
qualities and the RTSP paths to reach them). Add a new entry there if you have
a model that isn't listed. The go2rtc config is regenerated from both YAMLs on
every deploy.

## Local development

```bash
npm install
npm run dev
```

Boots go2rtc and the Node server on your dev machine, with the Angular dev
server proxying through. The dev process connects directly to each camera by
its RTSP URL.

**Caveat — subnet collisions:** if your dev machine's LAN is *the same subnet*
as the camera's LAN (e.g., both `192.168.0.0/24`), and you're remote with WG
up, the dev machine can't actually reach the camera. The directly-connected
`/24` wins routing over the tunnel's `0.0.0.0/0`. Either run dev on the
camera's LAN, add a host-specific WG route, or just iterate against the prod
deployment.

## Deploy

```bash
npm run deploy
```

Builds server + web, copies artifacts and configs to the Pi over SSH,
regenerates `go2rtc.yaml` from `cameras.yaml` + `models.yaml`, runs
`install-pi.sh` (idempotent system setup — installs missing packages,
syncs dnsmasq/Caddy config, reloads units), then restarts the user-mode
services. Overrides for host/user/dir live in `deploy.env`.

`install-pi.sh` only does work when something actually changed: package
installs are gated on `command -v`, config copies on `cmp`, service restarts
only happen when their config changed or the service isn't running. Sudo
prompts only appear when something genuinely needs sudo. Safe to run on
every deploy.

## Network access

### LAN

Visit `http://scry` (Pi-hole resolves the name, lighttpd routes to the Node
server). `http://wormhole.local:8080` also works via mDNS + the raw port.

### Remote (WireGuard + Pi-hole)

The Pi runs WireGuard on UDP 51820. Each peer's `[Interface]` should have
`DNS = <pi-LAN-ip>` so Pi-hole resolves local names while the tunnel is up.

Once that's in place, the site is just `http://scry` from anywhere — phone,
laptop, on-LAN, off-LAN. WebRTC media flows over the tunnel via the candidates
go2rtc advertises (set `PiWgHost` in `deploy.env` so the WG IP is included
alongside `wormhole.local:8555`).

### Adding a WG peer

PiVPN: `pivpn add` on the Pi.

Manual: generate a keypair, append a `[Peer]` block to `/etc/wireguard/wg0.conf`,
then `sudo wg syncconf wg0 <(sudo wg-quick strip wg0)` to apply without
dropping existing peers.

Either way, the client config needs `DNS = <pi-ip>` in its `[Interface]`
section. Don't forget — see [Troubleshooting](#troubleshooting).

## DNS (dnsmasq)

`scripts/dnsmasq.scry.conf` is the source of truth for local names. To add a
new name, append another `address=/foo/<ip>` line, then:

```bash
npm run deploy
ssh wormhole 'bash ~/tapo-viewer/scripts/install-pi.sh'
```

The script copies the new conf into `/etc/dnsmasq.d/` and restarts dnsmasq.

For LAN-wide name resolution (so every device on the LAN uses the Pi without
extra setup), point your router's DHCP DNS server at the Pi's LAN IP. WG
peers should set `DNS = <pi-LAN-ip>` in their `[Interface]` block — dnsmasq
listens on `wg0` along with `eth0`.

## Troubleshooting

### DNS doesn't resolve over WG (or LAN)

- **Peer config wasn't reloaded.** After editing `DNS =`, toggle the tunnel
  off and back on; WG only re-reads DNS on activation.
- **dnsmasq isn't running.** `sudo ss -lunp | grep :53` should show
  `0.0.0.0:53` bound to `dnsmasq`. If not: `sudo systemctl restart dnsmasq`
  and check `journalctl -u dnsmasq -n 50`.
- **Android Private DNS is on.** Settings → Network → Private DNS. Even
  "Automatic" overrides the VPN's DNS line with DoT to Google. Set to **Off**
  while on the tunnel. iOS doesn't have this footgun.
- **Browser DoH is on.** Chrome / Edge / Firefox each have a "Secure DNS"
  setting that bypasses the OS resolver entirely. Turn it off in each
  browser you want to use local names from — settings page differs per
  browser. (`chrome://settings/security`, etc.)

### WebRTC stream times out

- Confirm `go2rtc.yaml` on the Pi has both `wormhole.local:8555` and the WG IP
  in `candidates`. If only the `.local` one is there, set `PiWgHost` in
  `deploy.env` and redeploy.
- Open `chrome://webrtc-internals` in another tab while reproducing. If
  signalling state stalls at `have-local-offer`, the POST to
  `/stream/api/webrtc` is hanging — usually means ICE gathering is taking
  longer than the client-side timeout. The web service caps ICE gathering at
  2.5s, but the timeout window is in `web/src/app/services/go2rtc-webrtc.service.ts`
  if you need to extend it.

### Site loads but stream is a black square (audio works)

`<video>` is rendering at near-zero size. Almost always means a parent host
element collapsed to `display: inline`. Check `:host { display: flex/block }`
on the routed component.

### Subnet collision on the dev machine

Your dev machine's LAN shares its subnet with the camera/Pi LAN (`192.168.0.x`).
Hitting the Pi's LAN IP gets ARP'd on the wrong network and fails with
`General failure` / `ERR_NETWORK_ACCESS_DENIED`. Either:

- Use the Pi's WG IP (`10.210.235.1`) instead, or
- Add a host-specific route with higher precedence:
  ```powershell
  $idx = (Get-NetAdapter | ? { $_.InterfaceDescription -like "*WireGuard*" }).ifIndex
  New-NetRoute -DestinationPrefix "192.168.0.0/24" -InterfaceIndex $idx -NextHop 10.210.235.1 -RouteMetric 1
  ```

## Known issues

- **`/api/streams` leaks RTSP credentials.** Both go2rtc directly and the
  proxied path return camera RTSP URLs with username/password embedded.
  Anyone reaching `:1984` or `:8080` can read the camera password. Don't
  expose 8080 publicly until this is fixed; on private networks (LAN + WG)
  it's only as bad as the trust on those networks.
- **`wormhole.local` and `scry.local` don't work over the tunnel.** mDNS
  doesn't cross routing boundaries. Use the bare names (resolved by dnsmasq)
  or the IP directly when on WG.
