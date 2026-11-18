import { useCallback, useEffect, useRef } from 'react';
import { socket } from '../socket/socketClient';
import { useGameStore } from '../stores/useGameStore';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: import.meta.env.VITE_STUN_URL ?? 'stun:stun.l.google.com:19302' },
  ...(import.meta.env.VITE_TURN_URL
    ? [
        {
          urls: import.meta.env.VITE_TURN_URL,
          username: import.meta.env.VITE_TURN_USERNAME ?? '',
          credential: import.meta.env.VITE_TURN_CREDENTIAL ?? '',
        },
      ]
    : []),
];

/**
 * Peer-to-peer WebRTC mesh voice chat over Socket.io signaling.
 * Supports rooms up to 6 active players + spectators, VAD speaking detection,
 * per-peer mute/volume controls, and automatic reconnection cleanup.
 */
export function useVoiceChat() {
  const room = useGameStore((s) => s.room);
  const myMemberId = useGameStore((s) => s.myMemberId);
  const micEnabled = useGameStore((s) => s.micEnabled);
  const micMuted = useGameStore((s) => s.micMuted);
  const mutedPeerIds = useGameStore((s) => s.mutedPeerIds);
  const voiceVolume = useGameStore((s) => s.settings.voiceVolume);
  const muteAll = useGameStore((s) => s.settings.muteAll);
  const setMicState = useGameStore((s) => s.setMicState);

  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const vadTimerRef = useRef<number | null>(null);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    const audioEl = audioElsRef.current.get(peerId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioEl.remove();
      audioElsRef.current.delete(peerId);
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetPeerId: string, initiateOffer: boolean) => {
      cleanupPeer(targetPeerId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(targetPeerId, pc);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('voice:ice-candidate', {
            targetPeerId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      pc.ontrack = (event) => {
        let audio = audioElsRef.current.get(targetPeerId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audioElsRef.current.set(targetPeerId, audio);
        }
        audio.srcObject = event.streams[0] ?? null;
        const state = useGameStore.getState();
        const isPeerMuted = Boolean(state.mutedPeerIds[targetPeerId]) || state.settings.muteAll;
        audio.volume = isPeerMuted ? 0 : state.settings.voiceVolume;
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupPeer(targetPeerId);
        }
      };

      if (initiateOffer) {
        void (async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('voice:offer', {
              targetPeerId,
              sdp: pc.localDescription,
            });
          } catch {
            // Ignore negotiation race
          }
        })();
      }

      return pc;
    },
    [cleanupPeer]
  );

  // Sync remote audio elements when mute or volume settings change
  useEffect(() => {
    for (const [peerId, audio] of audioElsRef.current.entries()) {
      const isPeerMuted = Boolean(mutedPeerIds[peerId]) || muteAll;
      audio.volume = isPeerMuted ? 0 : voiceVolume;
    }
  }, [mutedPeerIds, voiceVolume, muteAll]);

  // Handle incoming WebRTC signaling messages
  useEffect(() => {
    const onSignal = async ({
      fromPeerId,
      type,
      sdp,
      candidate,
    }: {
      fromPeerId: string;
      type: 'offer' | 'answer' | 'ice-candidate';
      sdp?: unknown;
      candidate?: unknown;
    }) => {
      if (type === 'offer' && sdp) {
        const pc = createPeerConnection(fromPeerId, false);
        await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice:answer', {
          targetPeerId: fromPeerId,
          sdp: pc.localDescription,
        });
      } else if (type === 'answer' && sdp) {
        const pc = peersRef.current.get(fromPeerId);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
        }
      } else if (type === 'ice-candidate' && candidate) {
        const pc = peersRef.current.get(fromPeerId);
        if (pc) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit));
        }
      }
    };

    socket.on('voice:signal', onSignal);
    return () => {
      socket.off('voice:signal', onSignal);
    };
  }, [createPeerConnection]);

  // Maintain mesh connections with room peers when mic is active
  useEffect(() => {
    if (!room || !myMemberId) {
      for (const peerId of Array.from(peersRef.current.keys())) {
        cleanupPeer(peerId);
      }
      return;
    }

    const peerIds = [
      ...room.players.map((p) => p.id),
      ...(room.allowSpectators ? room.spectators.map((s) => s.id) : []),
    ].filter((id) => id !== myMemberId);

    // Clean up departed peers
    for (const existingPeerId of Array.from(peersRef.current.keys())) {
      if (!peerIds.includes(existingPeerId)) {
        cleanupPeer(existingPeerId);
      }
    }

    // Deterministic offer initiator (lexicographical ID order prevents offer glare)
    if (micEnabled) {
      for (const peerId of peerIds) {
        if (!peersRef.current.has(peerId) && myMemberId < peerId) {
          createPeerConnection(peerId, true);
        }
      }
    }
  }, [room, myMemberId, micEnabled, cleanupPeer, createPeerConnection]);

  const enableMicrophone = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMicState(false, false, 'Microphone API requires HTTPS or localhost.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicState(true, false, null);

      // Voice Activity Detection (VAD)
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      let lastSpeaking = false;

      vadTimerRef.current = window.setInterval(() => {
        const state = useGameStore.getState();
        if (!state.micEnabled || state.micMuted) {
          if (lastSpeaking) {
            lastSpeaking = false;
            socket.emit('voice:speaking', { isSpeaking: false, isMuted: state.micMuted });
          }
          return;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const speaking = avg > 22;
        if (speaking !== lastSpeaking) {
          lastSpeaking = speaking;
          socket.emit('voice:speaking', { isSpeaking: speaking, isMuted: false });
        }
      }, 180);
    } catch {
      setMicState(
        false,
        false,
        'Microphone access was denied. Enable mic permissions in your browser settings to speak.'
      );
    }
  }, [setMicState]);

  const disableMicrophone = useCallback(() => {
    if (vadTimerRef.current !== null) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
      localStreamRef.current = null;
    }
    for (const peerId of Array.from(peersRef.current.keys())) {
      cleanupPeer(peerId);
    }
    socket.emit('voice:speaking', { isSpeaking: false, isMuted: true });
    setMicState(false, false, null);
  }, [cleanupPeer, setMicState]);

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const nextMuted = !micMuted;
    for (const track of localStreamRef.current.getAudioTracks()) {
      track.enabled = !nextMuted;
    }
    socket.emit('voice:speaking', { isSpeaking: false, isMuted: nextMuted });
    setMicState(true, nextMuted, null);
  }, [micMuted, setMicState]);

  return {
    micEnabled,
    micMuted,
    enableMicrophone,
    disableMicrophone,
    toggleMute,
  };
}
