# TODO

# UI Cleanup
 - [ ] make video stream centered and main focus of page
 - [ ] add a fullscreen button for the stream
 - [ ] make stream controls overlay the stream video to save space (basically making a web player here with custom UI)
  - for this I'm thinking we can place buttons along the bottom for quality (stylized dropdown?), audio (toggle), fullscreen (button), and then on the right side, near the middle of the viewport we can put the pan controls.  
  - we can put the camera's name up in the top right of the stream overlay ui
  - unfortunately the camera has some UI put onto it, so we'll need our UI to have a background color such that it is easily visible when overlayed on top of the stream.
 - [ ] need shimmer or spinner loader for stream and shimmer loader for camera tiles

## Features
- [ ] `POST /api/system/reboot` endpoint on the Node server (ONVIF SystemReboot via `onvif` lib)
- [x] Digital zoom feature in the Angular web app
- [x] Quality selector in the live view (driven by per-model stream list)

## Setup / Infrastructure
- [x] Create the Angular web app at `web/` (`tapo-viewer-web`)
- [x] Backend multi-camera support: `cameras.yaml` + `models.yaml`, PTZ scoped by camera id, `/api/cameras` returns metadata only (no creds)
- [ ] Wire `CameraListComponent` to `/api/cameras` (renders a list with thumbnail + label, links to `/cam/:id`)
- [ ] go2rtc `webrtc.candidates` host is hardcoded via deploy.env `PiHost`; revisit if/when the Pi gets multiple network names
