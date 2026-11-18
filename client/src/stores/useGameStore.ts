import {
  DEFAULT_AVATAR_CONFIG,
  type AvatarConfig,
  type ChatMessage,
  type GameActionPayload,
  type GameEventPayload,
  type GameRulesConfig,
  type HostControlPayload,
  type RoomState,
} from '@last-round/shared';
import { create } from 'zustand';
import { soundEngine } from '../audio/soundEngine';
import { socket } from '../socket/socketClient';
import { revolverSound } from '../utils/revolverSound';
import {
  getOrCreateSessionId,
  getSavedDisplayName,
  loadSavedAvatar,
  saveAvatarConfig,
  saveDisplayName,
} from '../utils/session';

export type ScreenRoute =
  | 'MENU'
  | 'LOBBY'
  | 'AVATAR'
  | 'GAMEPLAY'
  | 'RESULTS';

export type GraphicsQuality = 'LOW' | 'MEDIUM' | 'HIGH';
export type SpectatorCameraMode = 'OVERVIEW' | 'FOLLOW_PLAYER';
export type FirstPersonAnimPhase =
  | 'IDLE'
  | 'SPINNING'
  | 'AIMING_SELF'
  | 'NERVE_CHECK'
  | 'COCKING'
  | 'RESULT';

export type NerveStatus = 'NORMAL' | 'COLD_BLOODED' | 'PANICKED';

export interface SettingsState {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  voiceVolume: number;
  muteAll: boolean;
}

interface GameStore {
  // Connection & Identity
  connected: boolean;
  sessionId: string;
  displayName: string;
  myMemberId: string | null;
  isSpectator: boolean;
  avatar: AvatarConfig;

  // Navigation & Modals
  screen: ScreenRoute;
  activeModal: 'NONE' | 'CREATE_ROOM' | 'JOIN_ROOM' | 'SETTINGS' | 'HOW_TO_PLAY';
  bannerError: string | null;

  // Room & Match
  room: RoomState | null;
  messages: ChatMessage[];
  unreadMessages: number;
  chatOpen: boolean;
  recentEvent: GameEventPayload | null;

  // 1st-Person Revolver & Challenge State
  fpAnimPhase: FirstPersonAnimPhase;
  hardcoreBlindRisk: boolean;
  nerveCheckEnabled: boolean;
  nerveCursor: number; // 0..1
  nerveTargetStart: number; // 0..1
  nerveTargetWidth: number; // 0..1
  nerveStatus: NerveStatus;
  lastNerveResult: 'PERFECT' | 'MISSED' | null;

  // Voice & Spectator
  micEnabled: boolean;
  micMuted: boolean;
  micPermissionError: string | null;
  mutedPeerIds: Record<string, boolean>;
  spectatorCameraMode: SpectatorCameraMode;
  spectatorTargetPlayerId: string | null;

  // Settings
  settings: SettingsState;

  // Actions
  initSocket: () => void;
  setDisplayName: (name: string) => void;
  setScreen: (screen: ScreenRoute) => void;
  setActiveModal: (modal: GameStore['activeModal']) => void;
  clearError: () => void;
  updateAvatar: (avatar: AvatarConfig) => void;

  createRoom: (params: {
    displayName: string;
    allowSpectators: boolean;
    rules?: Partial<GameRulesConfig>;
  }) => Promise<boolean>;

  joinRoom: (params: {
    roomCode: string;
    displayName: string;
    asSpectator?: boolean;
  }) => Promise<boolean>;

  leaveRoom: () => void;
  toggleReady: () => void;
  startMatch: () => Promise<boolean>;
  sendHostControl: (payload: HostControlPayload) => void;
  submitAction: (actionType: GameActionPayload['actionType']) => void;

  // Challenge Actions
  toggleHardcoreBlindRisk: () => void;
  toggleNerveCheck: () => void;
  startSelfShootSequence: (options?: { spinFirst?: boolean }) => void;
  confirmNerveTrigger: () => void;

  sendChatMessage: (content: string) => void;
  setChatOpen: (open: boolean) => void;

  setMicState: (enabled: boolean, muted: boolean, error?: string | null) => void;
  togglePeerMute: (peerId: string) => void;
  setSpectatorCamera: (mode: SpectatorCameraMode, targetPlayerId?: string | null) => void;
  updateSettings: (partial: Partial<SettingsState>) => void;
}

let socketInitialized = false;
let fpTimers: number[] = [];
let nerveRafId: number | null = null;

function clearFpTimers() {
  fpTimers.forEach((id) => window.clearTimeout(id));
  fpTimers = [];
  if (nerveRafId !== null) {
    window.cancelAnimationFrame(nerveRafId);
    nerveRafId = null;
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  connected: false,
  sessionId: getOrCreateSessionId(),
  displayName: getSavedDisplayName(),
  myMemberId: null,
  isSpectator: false,
  avatar: loadSavedAvatar<AvatarConfig>(DEFAULT_AVATAR_CONFIG),

  screen: 'MENU',
  activeModal: 'NONE',
  bannerError: null,

  room: null,
  messages: [],
  unreadMessages: 0,
  chatOpen: true,
  recentEvent: null,

  fpAnimPhase: 'IDLE',
  hardcoreBlindRisk: false,
  nerveCheckEnabled: true,
  nerveCursor: 0,
  nerveTargetStart: 0.4,
  nerveTargetWidth: 0.22,
  nerveStatus: 'NORMAL',
  lastNerveResult: null,

  micEnabled: false,
  micMuted: false,
  micPermissionError: null,
  mutedPeerIds: {},
  spectatorCameraMode: 'OVERVIEW',
  spectatorTargetPlayerId: null,

  settings: {
    graphicsQuality: 'HIGH',
    masterVolume: 0.8,
    ambienceVolume: 0.45,
    sfxVolume: 0.75,
    voiceVolume: 0.9,
    muteAll: false,
  },

  initSocket: () => {
    if (socketInitialized) return;
    socketInitialized = true;

    socket.on('connect', () => {
      set({ connected: true, bannerError: null });
    });

    socket.on('disconnect', () => {
      clearFpTimers();
      set({ connected: false, fpAnimPhase: 'IDLE' });
    });

    socket.on('room:updated', ({ room }) => {
      const state = get();
      const phase = room.game?.phase ?? 'WAITING';
      let nextScreen = state.screen;

      if (phase === 'RESULTS') {
        nextScreen = 'RESULTS';
      } else if (phase !== 'WAITING' && state.screen === 'LOBBY') {
        nextScreen = 'GAMEPLAY';
      } else if (phase === 'WAITING' && (state.screen === 'RESULTS' || state.screen === 'GAMEPLAY')) {
        nextScreen = 'LOBBY';
      }

      const meAsPlayer = room.players.find((p) => p.id === state.myMemberId);
      const becameEliminatedSpectator = Boolean(meAsPlayer && !meAsPlayer.isAlive);

      const shouldResetFp =
        phase === 'WAITING' ||
        phase === 'RESULTS' ||
        (phase === 'PLAYER_TURN' && room.game?.currentTurnPlayerId !== state.myMemberId);

      if (shouldResetFp) {
        clearFpTimers();
      }

      set({
        room,
        screen: nextScreen,
        isSpectator: state.isSpectator || becameEliminatedSpectator,
        fpAnimPhase: shouldResetFp ? 'IDLE' : state.fpAnimPhase,
        nerveStatus: phase === 'WAITING' ? 'NORMAL' : state.nerveStatus,
      });
    });

    socket.on('room:closed', ({ reason }) => {
      clearFpTimers();
      set({
        room: null,
        myMemberId: null,
        isSpectator: false,
        messages: [],
        screen: 'MENU',
        activeModal: 'NONE',
        bannerError: reason,
        fpAnimPhase: 'IDLE',
        nerveStatus: 'NORMAL',
      });
    });

    socket.on('room:error', ({ message }) => {
      set({ bannerError: message });
    });

    socket.on('game:started', ({ room }) => {
      clearFpTimers();
      soundEngine.playTurnAlert();
      set({
        room,
        screen: 'GAMEPLAY',
        recentEvent: null,
        fpAnimPhase: 'IDLE',
        nerveStatus: 'NORMAL',
        lastNerveResult: null,
      });
    });

    socket.on('game:turn', ({ currentTurnPlayerId }) => {
      clearFpTimers();
      if (currentTurnPlayerId === get().myMemberId) {
        soundEngine.playTurnAlert();
      }
      set({ fpAnimPhase: 'IDLE', lastNerveResult: null });
    });

    socket.on('game:event', (event) => {
      if (event.outcome === 'ELIMINATED') {
        soundEngine.playEliminationEvent();
      } else {
        soundEngine.playSafeEvent();
      }
      set({ recentEvent: event });
    });

    socket.on('game:finished', ({ room }) => {
      clearFpTimers();
      soundEngine.playVictory();
      set({ room, fpAnimPhase: 'IDLE' });
    });

    socket.on('chat:message', (msg) => {
      const state = get();
      set({
        messages: [...state.messages.slice(-99), msg],
        unreadMessages: state.chatOpen ? 0 : state.unreadMessages + 1,
      });
    });

    socket.connect();
  },

  setDisplayName: (name) => {
    saveDisplayName(name);
    set({ displayName: name });
  },

  setScreen: (screen) => {
    soundEngine.playUiClick();
    set({ screen, activeModal: 'NONE' });
  },

  setActiveModal: (activeModal) => {
    soundEngine.playUiClick();
    set({ activeModal, bannerError: null });
  },

  clearError: () => set({ bannerError: null }),

  updateAvatar: (avatar) => {
    saveAvatarConfig(avatar);
    set({ avatar });
    if (socket.connected && get().room) {
      socket.emit('avatar:update', avatar);
    }
  },

  createRoom: ({ displayName, allowSpectators, rules }) => {
    return new Promise((resolve) => {
      soundEngine.startAmbience();
      const trimmed = displayName.trim();
      saveDisplayName(trimmed);
      set({ displayName: trimmed, bannerError: null });

      socket.emit(
        'room:create',
        {
          requestId: crypto.randomUUID(),
          sessionId: get().sessionId,
          displayName: trimmed,
          avatar: get().avatar,
          allowSpectators,
          rules,
        },
        (res) => {
          if (!res.ok || !res.data) {
            set({ bannerError: res.error?.message ?? 'Failed to create room.' });
            resolve(false);
            return;
          }
          set({
            room: res.data.room,
            myMemberId: res.data.playerId,
            isSpectator: false,
            messages: [],
            screen: 'LOBBY',
            activeModal: 'NONE',
            fpAnimPhase: 'IDLE',
            nerveStatus: 'NORMAL',
          });
          resolve(true);
        }
      );
    });
  },

  joinRoom: ({ roomCode, displayName, asSpectator = false }) => {
    return new Promise((resolve) => {
      soundEngine.startAmbience();
      const trimmed = displayName.trim();
      const cleanCode = roomCode.trim().toUpperCase();
      saveDisplayName(trimmed);
      set({ displayName: trimmed, bannerError: null });

      if (asSpectator) {
        socket.emit(
          'spectator:join',
          {
            requestId: crypto.randomUUID(),
            sessionId: get().sessionId,
            roomCode: cleanCode,
            displayName: trimmed,
          },
          (res) => {
            if (!res.ok || !res.data) {
              set({ bannerError: res.error?.message ?? 'Failed to join as spectator.' });
              resolve(false);
              return;
            }
            const phase = res.data.room.game?.phase ?? 'WAITING';
            set({
              room: res.data.room,
              myMemberId: res.data.spectatorId,
              isSpectator: true,
              messages: [],
              screen: phase === 'WAITING' ? 'LOBBY' : 'GAMEPLAY',
              activeModal: 'NONE',
              fpAnimPhase: 'IDLE',
              nerveStatus: 'NORMAL',
            });
            resolve(true);
          }
        );
        return;
      }

      socket.emit(
        'room:join',
        {
          requestId: crypto.randomUUID(),
          sessionId: get().sessionId,
          roomCode: cleanCode,
          displayName: trimmed,
          avatar: get().avatar,
        },
        (res) => {
          if (!res.ok || !res.data) {
            set({ bannerError: res.error?.message ?? 'Failed to join room.' });
            resolve(false);
            return;
          }
          const phase = res.data.room.game?.phase ?? 'WAITING';
          set({
            room: res.data.room,
            myMemberId: res.data.playerId,
            isSpectator: false,
            messages: [],
            screen: phase === 'WAITING' ? 'LOBBY' : 'GAMEPLAY',
            activeModal: 'NONE',
            fpAnimPhase: 'IDLE',
            nerveStatus: 'NORMAL',
          });
          resolve(true);
        }
      );
    });
  },

  leaveRoom: () => {
    clearFpTimers();
    soundEngine.playUiClick();
    if (get().isSpectator) {
      socket.emit('spectator:leave');
    } else {
      socket.emit('room:leave');
    }
    set({
      room: null,
      myMemberId: null,
      isSpectator: false,
      messages: [],
      screen: 'MENU',
      activeModal: 'NONE',
      recentEvent: null,
      fpAnimPhase: 'IDLE',
      nerveStatus: 'NORMAL',
    });
  },

  toggleReady: () => {
    const state = get();
    const me = state.room?.players.find((p) => p.id === state.myMemberId);
    if (!me || me.isHost) return;
    soundEngine.playUiClick();
    socket.emit('room:ready', { isReady: !me.isReady });
  },

  startMatch: () => {
    return new Promise((resolve) => {
      soundEngine.playUiClick();
      socket.emit('room:start', (res) => {
        if (res && !res.ok) {
          set({ bannerError: res.error?.message ?? 'Cannot start match yet.' });
          resolve(false);
          return;
        }
        resolve(true);
      });
    });
  },

  sendHostControl: (payload) => {
    soundEngine.playUiClick();
    socket.emit('room:host-control', payload);
  },

  submitAction: (actionType) => {
    soundEngine.playUiClick();
    socket.emit(
      'game:action',
      {
        actionId: crypto.randomUUID(),
        actionType,
      },
      (res: any) => {
        if (res && !res.ok) {
          set({ bannerError: res.error?.message ?? 'Action rejected.' });
        }
      }
    );
  },

  toggleHardcoreBlindRisk: () => {
    soundEngine.playUiClick();
    set((s) => ({ hardcoreBlindRisk: !s.hardcoreBlindRisk }));
  },

  toggleNerveCheck: () => {
    soundEngine.playUiClick();
    set((s) => ({ nerveCheckEnabled: !s.nerveCheckEnabled }));
  },

  startSelfShootSequence: (options) => {
    const state = get();
    const game = state.room?.game;
    const me = state.room?.players.find((p) => p.id === state.myMemberId);

    if (
      !me ||
      !me.isAlive ||
      state.isSpectator ||
      !game ||
      game.phase !== 'PLAYER_TURN' ||
      game.currentTurnPlayerId !== me.id ||
      state.fpAnimPhase !== 'IDLE'
    ) {
      return;
    }

    clearFpTimers();

    const spinFirst = options?.spinFirst ?? true;
    const msLeft = game.turnEndsAt ? Math.max(400, game.turnEndsAt - Date.now()) : 15000;
    const riskFactor = Math.min(1, Math.max(0.16, game.currentRiskFactor || 0.17));

    // ถ้าเหลือเวลาน้อยกว่า 2.8 วิ ให้ข้ามมินิเกมแล้วยิงทันทีเพื่อไม่ให้หมดเวลาเทิร์น
    const allowNerveMiniGame = state.nerveCheckEnabled && msLeft > 2800;

    if (spinFirst) {
      set({ fpAnimPhase: 'SPINNING', lastNerveResult: null });
    } else {
      set({ fpAnimPhase: 'AIMING_SELF', lastNerveResult: null });
    }

    const tAim = spinFirst ? 520 : 0;
    const tNext = spinFirst ? 1020 : 480;

    if (spinFirst) {
      const timerAim = window.setTimeout(() => {
        set({ fpAnimPhase: 'AIMING_SELF' });
      }, tAim);
      fpTimers.push(timerAim);
    }

    if (allowNerveMiniGame) {
      // โซนเป้าหมายจะแคบลงและวิ่งเร็วขึ้นตามความเสี่ยง + สถานะจิตใจ
      const baseWidth =
        state.nerveStatus === 'COLD_BLOODED'
          ? 0.28
          : state.nerveStatus === 'PANICKED'
            ? 0.14
            : 0.21;
      const targetWidth = Math.max(0.11, baseWidth - riskFactor * 0.08);
      const targetStart = 0.22 + Math.random() * (0.72 - targetWidth);

      const timerNerve = window.setTimeout(() => {
        set({
          fpAnimPhase: 'NERVE_CHECK',
          nerveCursor: 0,
          nerveTargetStart: targetStart,
          nerveTargetWidth: targetWidth,
        });

        const startTime = performance.now();
        // ความเร็วแถบวิ่ง: ยิ่งเสี่ยงสูงยิ่งเร็ว (1.25 - 2.1 รอบต่อวินาที)
        const speed = 1.25 + riskFactor * 0.85 + (state.nerveStatus === 'PANICKED' ? 0.35 : 0);
        const autoTimeoutMs = Math.min(1750, Math.max(850, msLeft - 950));

        const tick = (now: number) => {
          if (get().fpAnimPhase !== 'NERVE_CHECK') return;
          const elapsedSec = (now - startTime) / 1000;
          // วิ่งไป-กลับ (ping-pong 0..1)
          const raw = elapsedSec * speed;
          const cycle = raw % 2;
          const cursor = cycle <= 1 ? cycle : 2 - cycle;
          set({ nerveCursor: cursor });
          nerveRafId = window.requestAnimationFrame(tick);
        };
        nerveRafId = window.requestAnimationFrame(tick);

        // หากไม่กดภายในเวลาที่กำหนด ปืนจะลั่นเองแบบตื่นตระหนก
        const timerAutoFire = window.setTimeout(() => {
          if (get().fpAnimPhase === 'NERVE_CHECK') {
            get().confirmNerveTrigger();
          }
        }, autoTimeoutMs);
        fpTimers.push(timerAutoFire);
      }, tNext);

      fpTimers.push(timerNerve);
    } else {
      // โหมดยิงเร็ว (ไม่มีมินิเกม)
      const timerCock = window.setTimeout(() => {
        set({ fpAnimPhase: 'COCKING' });
      }, tNext);

      const timerFire = window.setTimeout(() => {
        set({ fpAnimPhase: 'RESULT' });
        get().submitAction('TAKE_CHANCE');
      }, tNext + 580);

      fpTimers.push(timerCock, timerFire);
    }
  },

  confirmNerveTrigger: () => {
    const state = get();
    if (state.fpAnimPhase !== 'NERVE_CHECK') return;

    if (nerveRafId !== null) {
      window.cancelAnimationFrame(nerveRafId);
      nerveRafId = null;
    }

    const { nerveCursor, nerveTargetStart, nerveTargetWidth } = state;
    const hitPerfect =
      nerveCursor >= nerveTargetStart - 0.015 &&
      nerveCursor <= nerveTargetStart + nerveTargetWidth + 0.015;

    set({
      fpAnimPhase: 'COCKING',
      lastNerveResult: hitPerfect ? 'PERFECT' : 'MISSED',
      nerveStatus: hitPerfect ? 'COLD_BLOODED' : 'PANICKED',
    });

    const timerFire = window.setTimeout(() => {
      set({ fpAnimPhase: 'RESULT' });
      get().submitAction('TAKE_CHANCE');
    }, 460);

    fpTimers.push(timerFire);
  },

  sendChatMessage: (content) => {
    const trimmed = content.trim();
    if (!trimmed) return;
    socket.emit('chat:send', { content: trimmed });
  },

  setChatOpen: (chatOpen) => {
    set({
      chatOpen,
      unreadMessages: chatOpen ? 0 : get().unreadMessages,
    });
  },

  setMicState: (micEnabled, micMuted, micPermissionError = null) => {
    set({ micEnabled, micMuted, micPermissionError });
  },

  togglePeerMute: (peerId) => {
    const current = get().mutedPeerIds;
    set({
      mutedPeerIds: {
        ...current,
        [peerId]: !current[peerId],
      },
    });
  },

  setSpectatorCamera: (spectatorCameraMode, spectatorTargetPlayerId = null) => {
    set({ spectatorCameraMode, spectatorTargetPlayerId });
  },

  updateSettings: (partial) => {
    const next = { ...get().settings, ...partial };
    const effectiveSfx = next.masterVolume * next.sfxVolume;
    revolverSound.setOutputConfig(effectiveSfx, next.muteAll);
    soundEngine.setVolumes({
      master: next.masterVolume,
      ambience: next.ambienceVolume,
      sfx: next.sfxVolume,
      muted: next.muteAll,
    });
    set({ settings: next });
  },
}));
