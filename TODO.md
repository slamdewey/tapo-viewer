# TODO

## Features
- [ ] `POST /api/system/reboot` endpoint on the Node server (ONVIF SystemReboot via `onvif` lib)
- [x] Digital zoom feature in the Angular web app
- [x] Quality selector in the live view (driven by per-model stream list)

## Setup / Infrastructure
- [x] Create the Angular web app at `web/` (`tapo-viewer-web`)
- [x] Backend multi-camera support: `cameras.yaml` + `models.yaml`, PTZ scoped by camera id, `/api/cameras` returns metadata only (no creds)
- [ ] Wire `CameraListComponent` to `/api/cameras` (renders a list with thumbnail + label, links to `/cam/:id`)
- [ ] go2rtc `webrtc.candidates` host is hardcoded via deploy.env `PiHost`; revisit if/when the Pi gets multiple network names
