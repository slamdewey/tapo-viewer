import { Injectable } from '@angular/core';

export interface Go2rtcConnection {
  stream: MediaStream;
  close(): void;
}

@Injectable({ providedIn: 'root' })
export class Go2rtcWebrtcService {
  async connect(streamName: string): Promise<Go2rtcConnection> {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceGathering(pc, 2500);

    const trackPromise = new Promise<MediaStream>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for media tracks')),
        15000,
      );
      pc.ontrack = (ev) => {
        if (ev.streams[0]) {
          clearTimeout(timeout);
          resolve(ev.streams[0]);
        }
      };
    });

    const resp = await fetch(
      `/stream/api/webrtc?src=${encodeURIComponent(streamName)}`,
      {
        method: 'POST',
        body: pc.localDescription!.sdp,
      },
    );
    if (!resp.ok) {
      pc.close();
      throw new Error(`go2rtc webrtc: HTTP ${resp.status}`);
    }
    await pc.setRemoteDescription({ type: 'answer', sdp: await resp.text() });

    let stream: MediaStream;
    try {
      stream = await trackPromise;
    } catch (e) {
      pc.close();
      throw e;
    }

    return {
      stream,
      close: () => pc.close(),
    };
  }
}

function waitForIceGathering(pc: RTCPeerConnection, maxMs: number): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      pc.removeEventListener('icegatheringstatechange', onChange);
      clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === 'complete') finish();
    };
    pc.addEventListener('icegatheringstatechange', onChange);
    const timer = setTimeout(finish, maxMs);
  });
}
