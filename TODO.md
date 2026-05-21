# TODO

## Features
- [ ] `POST /api/system/reboot` endpoint on the Node server (ONVIF SystemReboot via `onvif` lib)
- [ ] Digital zoom feature in the Angular web app

## Setup / Infrastructure
- [ ] Create the Angular web app at `web/` (`tapo-viewer-web`)
- [ ] Template `go2rtc.yaml` from `server/.env` at deploy time, so creds live in one place
  - Currently `go2rtc.yaml` in the repo has literal placeholder text; the live copy on the Pi is hand-edited and will be clobbered by the next `publish.ps1` until this is fixed
- [ ] Fix `WEB_DIST` path in `server/.env.example`: change `../../web/dist/...` → `../web/dist/...`
  (`index.ts:49` already prepends `..` from `server/dist/`)

