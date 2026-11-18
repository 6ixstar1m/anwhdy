import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  Heart,
  Crosshair,
  UserCheck,
  Volume2,
  VolumeX,
  RotateCcw,
  BookOpen,
  X,
  Skull,
  Trophy,
  Sparkles,
  LogOut,
  Mic,
  MicOff,
  Send,
  Copy,
  Check,
  Eye,
  Target,
} from 'lucide-react';
import {
  ActiveBuffs,
  AimTarget,
  AvatarConfig,
  CombatLog,
  InventoryItem,
  ItemId,
  OnlineRoomState,
  PublicRoomSummary,
  ShellType,
  TableOpponent,
} from './types/game';
import {
  ALL_ITEM_IDS,
  ITEM_CATALOG,
  MAX_HEARTS,
  MAX_INVENTORY_SLOTS,
  rollRandomDefensiveItem,
} from './data/items';
import { InterrogationRoomScene } from './scenes/InterrogationRoomScene';
import { ItemBar, renderItemIcon } from './components/ItemBar';
import { OnlineLobbyOverlay } from './components/OnlineLobbyOverlay';
import { soundEngine } from './utils/soundEngine';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

const INITIAL_BUFFS: ActiveBuffs = {
  kevlar: false,
  ricochet: false,
  charm: false,
  visor: false,
  smokedTurns: 0,
};

function createUid() {
  return Math.random().toString(36).substring(2, 10);
}

function generateCylinder(): ShellType[] {
  const totalShells = Math.floor(Math.random() * 4) + 3;
  const liveCount = Math.max(1, Math.min(totalShells - 1, Math.round(totalShells / 2)));
  const blankCount = totalShells - liveCount;
  const shells: ShellType[] = [
    ...Array(liveCount).fill('live'),
    ...Array(blankCount).fill('blank'),
  ];
  for (let i = shells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shells[i], shells[j]] = [shells[j], shells[i]];
  }
  return shells;
}

export default function App() {
  const [mode, setMode] = useState<'menu' | 'online' | 'solo'>('menu');

  const [playerName, setPlayerName] = useState<string>(
    () => `Player_${Math.floor(100 + Math.random() * 899)}`
  );
  const [avatar, setAvatar] = useState<AvatarConfig>({
    coatColor: '#18181b',
    eyeColor: '#ef4444',
    maskStyle: 'shadow',
  });

  // Socket.io Online State
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [mySocketId, setMySocketId] = useState<string>('');
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);
  const [onlineRoom, setOnlineRoom] = useState<OnlineRoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [chatInput, setChatInput] = useState<string>('');

  const [micEnabled, setMicEnabled] = useState<boolean>(false);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Solo Mode State
  const [soloPlayerHearts, setSoloPlayerHearts] = useState<number>(MAX_HEARTS);
  const [soloDealerHearts, setSoloDealerHearts] = useState<number>(MAX_HEARTS);
  const [soloCylinder, setSoloCylinder] = useState<ShellType[]>([]);
  const [soloRound, setSoloRound] = useState<number>(1);
  const [soloTurn, setSoloTurn] = useState<'player' | 'dealer'>('player');
  const [soloBusy, setSoloBusy] = useState<boolean>(false);
  const [soloWinner, setSoloWinner] = useState<'player' | 'dealer' | null>(null);
  const [soloPlayerInv, setSoloPlayerInv] = useState<InventoryItem[]>([]);
  const [soloDealerInv, setSoloDealerInv] = useState<InventoryItem[]>([]);
  const [soloPlayerBuffs, setSoloPlayerBuffs] = useState<ActiveBuffs>({ ...INITIAL_BUFFS });
  const [soloDealerBuffs, setSoloDealerBuffs] = useState<ActiveBuffs>({ ...INITIAL_BUFFS });
  const [soloLogs, setSoloLogs] = useState<CombatLog[]>([]);

  // 3D Scene & HUD State
  const [reloadSummary, setReloadSummary] = useState<{ live: number; blank: number } | null>(null);
  const [scannedShell, setScannedShell] = useState<ShellType | null>(null);
  const [dropBanner, setDropBanner] = useState<{ itemId: ItemId } | null>(null);

  // Active shot animation lock vs hover/selected aim preview
  const [firingAimTarget, setFiringAimTarget] = useState<AimTarget | null>(null);
  const [hoverAimTarget, setHoverAimTarget] = useState<AimTarget>('idle');

  const [spinTrigger, setSpinTrigger] = useState<number>(0);
  const [fireTrigger, setFireTrigger] = useState<{ count: number; isLive: boolean }>({
    count: 0,
    isLive: false,
  });
  const [ejectTrigger, setEjectTrigger] = useState<{ count: number; isLive: boolean }>({
    count: 0,
    isLive: false,
  });
  const [muted, setMuted] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const onlineRoomRef = useRef<OnlineRoomState | null>(null);
  onlineRoomRef.current = onlineRoom;

  // Compute all opponents seated across the table
  const isOnlinePlaying =
    mode === 'online' &&
    onlineRoom !== null &&
    (onlineRoom.status === 'playing' || onlineRoom.status === 'ended');

  const tableOpponents: TableOpponent[] = useMemo(() => {
    if (isOnlinePlaying && onlineRoom) {
      return onlineRoom.players
        .filter((p) => p.id !== mySocketId && (p.role === 'player' || p.hearts > 0))
        .map((p) => ({
          id: p.id,
          name: p.name,
          hearts: p.hearts,
          buffs: p.buffs,
          avatar: p.avatar,
          inventory: p.inventory,
          isTurn: onlineRoom.turnPlayerId === p.id,
        }));
    }
    return [
      {
        id: 'dealer',
        name: 'ผู้คุม (DEALER)',
        hearts: soloDealerHearts,
        buffs: soloDealerBuffs,
        inventory: soloDealerInv,
        isTurn: soloTurn === 'dealer',
      },
    ];
  }, [
    isOnlinePlaying,
    onlineRoom,
    mySocketId,
    soloDealerHearts,
    soloDealerBuffs,
    soloDealerInv,
    soloTurn,
  ]);

  const tableOpponentsRef = useRef<TableOpponent[]>(tableOpponents);
  tableOpponentsRef.current = tableOpponents;

  // Keep selectedTargetId valid (pointing to an alive opponent)
  useEffect(() => {
    if (!isOnlinePlaying) {
      setSelectedTargetId('dealer');
      return;
    }
    const aliveOpps = tableOpponents.filter((o) => o.hearts > 0);
    if (aliveOpps.length > 0 && !aliveOpps.some((o) => o.id === selectedTargetId)) {
      setSelectedTargetId(aliveOpps[0].id);
    }
  }, [isOnlinePlaying, tableOpponents, selectedTargetId]);

  const selectedOpponentIndex = useMemo(() => {
    const idx = tableOpponents.findIndex((o) => o.id === selectedTargetId);
    return idx >= 0 ? idx : 0;
  }, [tableOpponents, selectedTargetId]);

  const focusedOpponent = tableOpponents[selectedOpponentIndex] || tableOpponents[0];

  // ==========================================
  // SOCKET.IO CONNECTION
  // ==========================================
  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id || '');
      socket.emit('get_rooms');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('rooms_list', (list: PublicRoomSummary[]) => {
      setPublicRooms(list);
    });

    socket.on('room_error', (msg: string) => {
      setRoomError(msg);
      setTimeout(() => setRoomError(null), 4000);
    });

    socket.on('room_joined', (room: OnlineRoomState) => {
      setOnlineRoom(room);
      setMode('online');
      setRoomError(null);
    });

    socket.on('room_updated', (room: OnlineRoomState) => {
      setOnlineRoom(room);
    });

    socket.on(
      'cylinder_reloaded',
      ({ live, blank }: { roundNumber: number; live: number; blank: number }) => {
        setScannedShell(null);
        setReloadSummary({ live, blank });
        setSpinTrigger((c) => c + 1);
        soundEngine.playCylinderSpin();
        setTimeout(() => setReloadSummary(null), 2800);
      }
    );

    socket.on('scan_result', ({ shell }: { shell: ShellType }) => {
      setScannedShell(shell);
      soundEngine.playItemUse('tech');
    });

    socket.on('survival_drop', ({ itemId }: { itemId: ItemId }) => {
      soundEngine.playRewardDrop();
      setDropBanner({ itemId });
    });

    socket.on('shell_ejected', ({ isLive }: { isLive: boolean }) => {
      soundEngine.playItemUse('eject');
      setScannedShell(null);
      setEjectTrigger((e) => ({ count: e.count + 1, isLive }));
    });

    // Live gun rotation when current turn player selects/hovers a target
    socket.on(
      'aim_preview',
      ({ shooterId, targetId }: { shooterId: string; targetId: string | null }) => {
        if (shooterId === socket.id) return; // local player controls their own hover directly
        if (!targetId) {
          setHoverAimTarget('idle');
          return;
        }
        if (targetId === socket.id) {
          setHoverAimTarget('self');
          return;
        }
        const idx = tableOpponentsRef.current.findIndex((o) => o.id === targetId);
        setHoverAimTarget(idx >= 0 ? idx : 0);
      }
    );

    // Gun turns toward target, cocks hammer, and fires
    socket.on(
      'shot_fired',
      ({
        targetId,
        isLive,
      }: {
        shooterId: string;
        targetId: string;
        isLive: boolean;
      }) => {
        setScannedShell(null);
        soundEngine.playHammerCock();

        let resolvedAim: AimTarget = 'idle';
        if (targetId === socket.id) {
          resolvedAim = 'self';
        } else {
          const idx = tableOpponentsRef.current.findIndex((o) => o.id === targetId);
          resolvedAim = idx >= 0 ? idx : 0;
        }

        setFiringAimTarget(resolvedAim);

        setTimeout(() => {
          if (isLive) soundEngine.playLiveGunshot();
          else soundEngine.playBlankClick();
          setFireTrigger((f) => ({ count: f.count + 1, isLive }));
          setTimeout(() => {
            setFiringAimTarget(null);
            setHoverAimTarget('idle');
          }, 850);
        }, 480);
      }
    );

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!dropBanner) return;
    const t = setTimeout(() => setDropBanner(null), 3000);
    return () => clearTimeout(t);
  }, [dropBanner]);

  const handleToggleMic = async () => {
    if (micEnabled) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      setMicEnabled(false);
      socketRef.current?.emit('voice_speaking', { isSpeaking: false });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicEnabled(true);
      socketRef.current?.emit('voice_speaking', { isSpeaking: true });
    } catch {
      setRoomError('ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาอนุญาตการใช้ไมค์ในเบราว์เซอร์');
      setTimeout(() => setRoomError(null), 3500);
    }
  };

  const handleCreateRoom = (roomName: string, isPublic: boolean, maxPlayers: number) => {
    socketRef.current?.emit('create_room', {
      roomName,
      isPublic,
      maxPlayers,
      playerName,
      avatar,
    });
  };

  const handleJoinRoom = (code: string) => {
    socketRef.current?.emit('join_room', {
      code,
      playerName,
      avatar,
    });
  };

  const handleLeaveRoom = () => {
    socketRef.current?.emit('leave_room');
    setOnlineRoom(null);
    setMode('menu');
    setScannedShell(null);
  };

  // ==========================================
  // SOLO MODE LOGIC
  // ==========================================
  const addSoloLog = useCallback((text: string, tone: CombatLog['tone'] = 'neutral') => {
    setSoloLogs((prev) => [{ id: createUid(), text, tone }, ...prev.slice(0, 6)]);
  }, []);

  const grantSoloSurvivalReward = useCallback(
    (target: 'player' | 'dealer', reason: string) => {
      const rolledId = rollRandomDefensiveItem();
      const def = ITEM_CATALOG[rolledId];
      if (target === 'player') {
        setSoloPlayerInv((prev) => {
          if (prev.length >= MAX_INVENTORY_SLOTS) {
            addSoloLog(`รอดชีวิต! แต่ช่องเก็บอุปกรณ์เต็ม (4/4) จึงไม่ได้รับไอเทมเพิ่ม`, 'info');
            return prev;
          }
          soundEngine.playRewardDrop();
          setDropBanner({ itemId: rolledId });
          addSoloLog(`รอดชีวิต (${reason})! สุ่มได้รับอุปกรณ์เสริม: [${def.nameTh}]`, 'item');
          return [...prev, { uid: createUid(), itemId: rolledId }];
        });
      } else {
        setSoloDealerInv((prev) => {
          if (prev.length >= MAX_INVENTORY_SLOTS) return prev;
          addSoloLog(`ผู้คุมรอดชีวิต (${reason}) และสุ่มได้รับ [${def.nameTh}]`, 'info');
          return [...prev, { uid: createUid(), itemId: rolledId }];
        });
      }
    },
    [addSoloLog]
  );

  const loadSoloCylinder = useCallback(
    (nextRound: number) => {
      const shells = generateCylinder();
      const live = shells.filter((s) => s === 'live').length;
      const blank = shells.filter((s) => s === 'blank').length;
      setSoloCylinder(shells);
      setScannedShell(null);
      setSoloRound(nextRound);
      setReloadSummary({ live, blank });
      setSpinTrigger((c) => c + 1);
      soundEngine.playCylinderSpin();
      addSoloLog(
        `บรรจุกระสุนรอบที่ ${nextRound}: กระสุนจริง ${live} นัด | กระสุนเปล่า ${blank} นัด`,
        'info'
      );

      const pItem = rollRandomDefensiveItem();
      const dItem = rollRandomDefensiveItem();
      setSoloPlayerInv((prev) =>
        prev.length < MAX_INVENTORY_SLOTS ? [...prev, { uid: createUid(), itemId: pItem }] : prev
      );
      setSoloDealerInv((prev) =>
        prev.length < MAX_INVENTORY_SLOTS ? [...prev, { uid: createUid(), itemId: dItem }] : prev
      );
      setTimeout(() => setReloadSummary(null), 2800);
    },
    [addSoloLog]
  );

  const startSoloMode = useCallback(() => {
    setMode('solo');
    setSoloPlayerHearts(MAX_HEARTS);
    setSoloDealerHearts(MAX_HEARTS);
    setSoloPlayerInv([]);
    setSoloDealerInv([]);
    setSoloPlayerBuffs({ ...INITIAL_BUFFS });
    setSoloDealerBuffs({ ...INITIAL_BUFFS });
    setSoloWinner(null);
    setSoloTurn('player');
    setSoloBusy(false);
    setFiringAimTarget(null);
    setHoverAimTarget('idle');
    setDropBanner(null);
    setSoloLogs([]);
    loadSoloCylinder(1);
  }, [loadSoloCylinder]);

  const executeSoloShot = useCallback(
    (shooter: 'player' | 'dealer', target: 'player' | 'dealer') => {
      if (soloBusy || soloWinner || soloCylinder.length === 0) return;
      setSoloBusy(true);
      setScannedShell(null);
      setFiringAimTarget(target === 'player' ? 'self' : 0);
      soundEngine.playHammerCock();

      const currentShell = soloCylinder[0];
      const remaining = soloCylinder.slice(1);

      setTimeout(() => {
        setFireTrigger((f) => ({ count: f.count + 1, isLive: currentShell === 'live' }));

        let nextPHearts = soloPlayerHearts;
        let nextDHearts = soloDealerHearts;
        const nextPBuffs = { ...soloPlayerBuffs };
        const nextDBuffs = { ...soloDealerBuffs };
        const targetBuffs = target === 'player' ? nextPBuffs : nextDBuffs;
        const shooterBuffs = shooter === 'player' ? nextPBuffs : nextDBuffs;

        if (shooter !== target && targetBuffs.visor) {
          targetBuffs.visor = false;
          soundEngine.playBlankClick();
          addSoloLog(
            `[แว่นเบี่ยงวิถี] ทำงาน! กระสุนของ${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ถูกเบี่ยงออกนอกเป้า`,
            'success'
          );
          grantSoloSurvivalReward(target, 'เบี่ยงวิถีกระสุนสำเร็จ');
        } else if (currentShell === 'blank') {
          soundEngine.playBlankClick();
          if (shooter === target) {
            addSoloLog(
              `${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ลั่นไกใส่ตัวเอง... แชะ! กระสุนเปล่า (ได้เล่นต่อ!)`,
              'success'
            );
            grantSoloSurvivalReward(shooter, 'ยิงตัวเองแล้วรอด');
          } else {
            if (targetBuffs.ricochet) {
              targetBuffs.ricochet = false;
              addSoloLog(`โล่สะท้อนกระสุนสลายไปเพราะเป็นกระสุนเปล่า`, 'info');
            }
            addSoloLog(
              `${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ยิงใส่${
                target === 'player' ? 'คุณ' : 'ผู้คุม'
              }... แชะ! กระสุนเปล่า`,
              'neutral'
            );
            grantSoloSurvivalReward(target, 'รอดจากการถูกยิง');
          }
        } else {
          soundEngine.playLiveGunshot();
          if (shooter !== target && targetBuffs.ricochet) {
            targetBuffs.ricochet = false;
            addSoloLog(
              `[โล่สะท้อนกระสุน] สะท้อนกระสุนจริงกลับใส่${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}! (-1 หัวใจ)`,
              'danger'
            );
            if (shooter === 'player') {
              if (nextPHearts - 1 <= 0 && shooterBuffs.charm) {
                shooterBuffs.charm = false;
                nextPHearts = 1;
                addSoloLog(`[เครื่องรางกันตาย] ช่วยชีวิตคุณไว้ที่ 1 หัวใจ!`, 'item');
              } else nextPHearts = Math.max(0, nextPHearts - 1);
            } else {
              if (nextDHearts - 1 <= 0 && shooterBuffs.charm) {
                shooterBuffs.charm = false;
                nextDHearts = 1;
                addSoloLog(`[เครื่องรางกันตาย] ช่วยชีวิตผู้คุมไว้ที่ 1 หัวใจ!`, 'item');
              } else nextDHearts = Math.max(0, nextDHearts - 1);
            }
            grantSoloSurvivalReward(target, 'สะท้อนกระสุนรอดตาย');
          } else if (targetBuffs.kevlar) {
            targetBuffs.kevlar = false;
            addSoloLog(`[แผ่นเกราะเคฟลาร์] รับกระสุนจริงเต็ม ๆ! ดาเมจกลายเป็น 0`, 'success');
            grantSoloSurvivalReward(target, 'เกราะกันกระสุนจริงสำเร็จ');
          } else if (target === 'player') {
            if (nextPHearts - 1 <= 0 && nextPBuffs.charm) {
              nextPBuffs.charm = false;
              nextPHearts = 1;
              addSoloLog(`[เครื่องรางกันตาย] แตกสลายเพื่อรักษาหัวใจดวงสุดท้ายของคุณไว้!`, 'item');
              grantSoloSurvivalReward('player', 'รอดตายจากเครื่องราง');
            } else {
              nextPHearts = Math.max(0, nextPHearts - 1);
              addSoloLog(`ปัง!! กระสุนจริงเข้าเป้า คุณเสีย -1 หัวใจ (เหลือ ${nextPHearts}/3)`, 'danger');
            }
          } else {
            if (nextDHearts - 1 <= 0 && nextDBuffs.charm) {
              nextDBuffs.charm = false;
              nextDHearts = 1;
              addSoloLog(`[เครื่องรางกันตาย] ของผู้คุมทำงาน! รอดตายที่ 1 หัวใจ`, 'item');
            } else {
              nextDHearts = Math.max(0, nextDHearts - 1);
              addSoloLog(`ปัง!! กระสุนจริงเข้าเป้า ผู้คุมเสีย -1 หัวใจ (เหลือ ${nextDHearts}/3)`, 'danger');
            }
          }
        }

        setSoloPlayerHearts(nextPHearts);
        setSoloDealerHearts(nextDHearts);
        setSoloPlayerBuffs(nextPBuffs);
        setSoloDealerBuffs(nextDBuffs);
        setSoloCylinder(remaining);

        setTimeout(() => {
          setFiringAimTarget(null);
          setHoverAimTarget('idle');
          if (nextPHearts <= 0) {
            setSoloWinner('dealer');
            setSoloBusy(false);
            return;
          }
          if (nextDHearts <= 0) {
            setSoloWinner('player');
            setSoloBusy(false);
            return;
          }

          let nextTurn: 'player' | 'dealer' = shooter === 'player' ? 'dealer' : 'player';
          if (shooter === target && currentShell === 'blank') {
            nextTurn = shooter;
          }

          if (nextTurn === 'dealer' && nextDBuffs.smokedTurns > 0) {
            nextDBuffs.smokedTurns -= 1;
            setSoloDealerBuffs({ ...nextDBuffs });
            addSoloLog(`ผู้คุมติดม่านควัน [ระเบิดควัน]! ข้ามเทิร์นกลับมาที่คุณทันที`, 'info');
            nextTurn = 'player';
          } else if (nextTurn === 'player' && nextPBuffs.smokedTurns > 0) {
            nextPBuffs.smokedTurns -= 1;
            setSoloPlayerBuffs({ ...nextPBuffs });
            addSoloLog(`คุณติดม่านควัน! เสียสิทธิ์ยิง 1 เทิร์น`, 'danger');
            nextTurn = 'dealer';
          }

          if (remaining.length === 0) {
            loadSoloCylinder(soloRound + 1);
          }
          setSoloTurn(nextTurn);
          setSoloBusy(false);
        }, 850);
      }, 480);
    },
    [
      soloBusy,
      soloWinner,
      soloCylinder,
      soloPlayerHearts,
      soloDealerHearts,
      soloPlayerBuffs,
      soloDealerBuffs,
      addSoloLog,
      grantSoloSurvivalReward,
      loadSoloCylinder,
      soloRound,
    ]
  );

  const handleSoloUseItem = useCallback(
    (owner: 'player' | 'dealer', uid: string) => {
      if (soloBusy || soloWinner) return;
      const inv = owner === 'player' ? soloPlayerInv : soloDealerInv;
      const found = inv.find((i) => i.uid === uid);
      if (!found) return;

      const itemId = found.itemId;
      const def = ITEM_CATALOG[itemId];
      const userLabel = owner === 'player' ? 'คุณ' : 'ผู้คุม';

      if (owner === 'player') setSoloPlayerInv((p) => p.filter((i) => i.uid !== uid));
      else setSoloDealerInv((p) => p.filter((i) => i.uid !== uid));

      if (itemId === 'kevlar') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setSoloPlayerBuffs((b) => ({ ...b, kevlar: true }));
        else setSoloDealerBuffs((b) => ({ ...b, kevlar: true }));
        addSoloLog(`${userLabel}สวมใส่ [${def.nameTh}] ป้องกันกระสุนจริงนัดถัดไป`, 'item');
      } else if (itemId === 'ricochet') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setSoloPlayerBuffs((b) => ({ ...b, ricochet: true }));
        else setSoloDealerBuffs((b) => ({ ...b, ricochet: true }));
        addSoloLog(`${userLabel}เปิดใช้งาน [${def.nameTh}] เตรียมสะท้อนกระสุนกลับ!`, 'item');
      } else if (itemId === 'charm') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setSoloPlayerBuffs((b) => ({ ...b, charm: true }));
        else setSoloDealerBuffs((b) => ({ ...b, charm: true }));
        addSoloLog(`${userLabel}ติดตั้ง [${def.nameTh}] ป้องกันการตาย 1 ครั้ง`, 'item');
      } else if (itemId === 'adrenaline') {
        soundEngine.playItemUse('heal');
        if (owner === 'player') setSoloPlayerHearts((h) => Math.min(MAX_HEARTS, h + 1));
        else setSoloDealerHearts((h) => Math.min(MAX_HEARTS, h + 1));
        addSoloLog(`${userLabel}ฉีด [${def.nameTh}] ฟื้นฟู +1 หัวใจ!`, 'success');
      } else if (itemId === 'smoke') {
        soundEngine.playItemUse('tech');
        if (owner === 'player')
          setSoloDealerBuffs((b) => ({ ...b, smokedTurns: b.smokedTurns + 1 }));
        else setSoloPlayerBuffs((b) => ({ ...b, smokedTurns: b.smokedTurns + 1 }));
        addSoloLog(`${userLabel}ปา [${def.nameTh}] บังคับข้ามเทิร์นของอีกฝ่าย 1 เทิร์น!`, 'item');
      } else if (itemId === 'visor') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setSoloPlayerBuffs((b) => ({ ...b, visor: true }));
        else setSoloDealerBuffs((b) => ({ ...b, visor: true }));
        addSoloLog(`${userLabel}เปิดใช้งาน [${def.nameTh}] การยิงถัดไปของอีกฝ่ายจะพลาดเป้า!`, 'item');
      } else if (itemId === 'scanner') {
        soundEngine.playItemUse('tech');
        const current = soloCylinder[0];
        if (owner === 'player') {
          setScannedShell(current);
          addSoloLog(
            `[เครื่องสแกนรังเพลิง] ตรวจพบ: นัดปัจจุบันคือ "${
              current === 'live' ? 'กระสุนจริง (LIVE)' : 'กระสุนเปล่า (BLANK)'
            }"`,
            'item'
          );
        } else {
          addSoloLog(`ผู้คุมใช้ [เครื่องสแกนรังเพลิง] แอบดูลูกกระสุนในโม่...`, 'info');
        }
      } else if (itemId === 'ejector') {
        soundEngine.playItemUse('eject');
        const ejected = soloCylinder[0];
        const rest = soloCylinder.slice(1);
        setScannedShell(null);
        setEjectTrigger((e) => ({ count: e.count + 1, isLive: ejected === 'live' }));
        addSoloLog(
          `${userLabel}ใช้ [${def.nameTh}] ดีด "${
            ejected === 'live' ? 'กระสุนจริง' : 'กระสุนเปล่า'
          }" ออกจากรังเพลิง!`,
          'item'
        );
        setSoloCylinder(rest);
        if (rest.length === 0) {
          setTimeout(() => loadSoloCylinder(soloRound + 1), 650);
        }
      }
    },
    [
      soloBusy,
      soloWinner,
      soloPlayerInv,
      soloDealerInv,
      soloCylinder,
      addSoloLog,
      loadSoloCylinder,
      soloRound,
    ]
  );

  // Solo AI Turn
  const dealerKnownRef = useRef<ShellType | null>(null);
  useEffect(() => {
    if (mode !== 'solo' || soloTurn !== 'dealer' || soloBusy || soloWinner || soloCylinder.length === 0)
      return;

    const timer = setTimeout(() => {
      const heal = soloDealerInv.find((i) => i.itemId === 'adrenaline');
      if (soloDealerHearts < MAX_HEARTS && heal) {
        handleSoloUseItem('dealer', heal.uid);
        return;
      }
      const shield = soloDealerInv.find(
        (i) =>
          (i.itemId === 'kevlar' && !soloDealerBuffs.kevlar) ||
          (i.itemId === 'ricochet' && !soloDealerBuffs.ricochet) ||
          (i.itemId === 'visor' && !soloDealerBuffs.visor) ||
          (i.itemId === 'charm' && !soloDealerBuffs.charm)
      );
      if (shield) {
        handleSoloUseItem('dealer', shield.uid);
        return;
      }
      const smoke = soloDealerInv.find((i) => i.itemId === 'smoke');
      if (smoke && soloDealerBuffs.smokedTurns === 0) {
        handleSoloUseItem('dealer', smoke.uid);
        return;
      }
      const scan = soloDealerInv.find((i) => i.itemId === 'scanner');
      if (scan && !dealerKnownRef.current) {
        dealerKnownRef.current = soloCylinder[0];
        handleSoloUseItem('dealer', scan.uid);
        return;
      }

      const liveCount = soloCylinder.filter((s) => s === 'live').length;
      const blankCount = soloCylinder.length - liveCount;
      const known = dealerKnownRef.current;
      dealerKnownRef.current = null;

      let target: 'player' | 'dealer' = 'player';
      if (known === 'blank') target = 'dealer';
      else if (known === 'live') target = 'player';
      else if (blankCount > liveCount && !soloPlayerBuffs.ricochet) target = 'dealer';
      executeSoloShot('dealer', target);
    }, 1050);

    return () => clearTimeout(timer);
  }, [
    mode,
    soloTurn,
    soloBusy,
    soloWinner,
    soloCylinder,
    soloDealerInv,
    soloDealerHearts,
    soloDealerBuffs,
    soloPlayerBuffs,
    handleSoloUseItem,
    executeSoloShot,
  ]);

  // ==========================================
  // UNIFIED VIEW METRICS
  // ==========================================
  const meOnline = isOnlinePlaying
    ? onlineRoom.players.find((p) => p.id === mySocketId)
    : undefined;

  const displayMyHearts = isOnlinePlaying ? meOnline?.hearts ?? 0 : soloPlayerHearts;
  const displayMyInv = isOnlinePlaying ? meOnline?.inventory ?? [] : soloPlayerInv;
  const displayMyBuffs = isOnlinePlaying ? meOnline?.buffs ?? INITIAL_BUFFS : soloPlayerBuffs;
  const displayMyLabel = isOnlinePlaying
    ? `หัวใจของคุณ (${meOnline?.name || playerName})`
    : 'หัวใจของคุณ (PLAYER)';

  const displayOppHearts = focusedOpponent?.hearts ?? 0;
  const displayOppName = focusedOpponent?.name || 'คู่แข่ง (OPPONENT)';
  const displayOppItems = focusedOpponent?.inventory ?? [];

  const displayRound = isOnlinePlaying ? onlineRoom.roundNumber : soloRound;
  const displayShellsLeft = isOnlinePlaying ? onlineRoom.shellsRemaining : soloCylinder.length;

  const isMyTurn = isOnlinePlaying
    ? onlineRoom.status === 'playing' &&
      onlineRoom.turnPlayerId === mySocketId &&
      (meOnline?.hearts ?? 0) > 0
    : soloTurn === 'player' && !soloWinner;

  const currentTurnName = isOnlinePlaying
    ? onlineRoom.players.find((p) => p.id === onlineRoom.turnPlayerId)?.name || '...'
    : soloTurn === 'player'
    ? 'คุณ'
    : 'ผู้คุม';

  const displayLogs = isOnlinePlaying ? onlineRoom.logs : soloLogs;

  const isGameEnded = isOnlinePlaying ? onlineRoom.status === 'ended' : Boolean(soloWinner);
  const didIWin = isOnlinePlaying
    ? onlineRoom.winnerId === mySocketId
    : soloWinner === 'player';

  const winnerName = isOnlinePlaying
    ? onlineRoom.players.find((p) => p.id === onlineRoom.winnerId)?.name || 'ผู้รอดชีวิต'
    : soloWinner === 'player'
    ? 'คุณ'
    : 'ผู้คุม';

  const isSpectating =
    isOnlinePlaying && (meOnline?.role === 'spectator' || (meOnline?.hearts ?? 0) <= 0);

  // Effective 3D gun aim: active firing shot overrides hover/selected target preview
  const effectiveAimTarget: AimTarget = useMemo(() => {
    if (firingAimTarget !== null) return firingAimTarget;
    if (isMyTurn && !isGameEnded && !isSpectating) {
      if (hoverAimTarget !== 'idle') return hoverAimTarget;
      return selectedOpponentIndex;
    }
    return hoverAimTarget;
  }, [
    firingAimTarget,
    isMyTurn,
    isGameEnded,
    isSpectating,
    hoverAimTarget,
    selectedOpponentIndex,
  ]);

  // Select a target opponent & broadcast aim rotation to the room
  const handleSelectTarget = (targetId: string, seatIndex: number) => {
    setSelectedTargetId(targetId);
    setHoverAimTarget(seatIndex);
    if (isOnlinePlaying && isMyTurn) {
      socketRef.current?.emit('aim_preview', { targetId });
    }
  };

  const toggleMute = () => {
    soundEngine.muted = !muted;
    setMuted(!muted);
  };

  const handleCopyRoomCode = () => {
    if (!onlineRoom) return;
    navigator.clipboard.writeText(onlineRoom.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleInGameChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('send_chat', { text: chatInput });
    setChatInput('');
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-black ${
        displayMyHearts === 1 && !isGameEnded && !isSpectating ? 'low-hp-vignette' : ''
      }`}
    >
      {/* 3D WebGL Interrogation Room Scene */}
      <InterrogationRoomScene
        aimTarget={effectiveAimTarget}
        selectedOpponentIndex={selectedOpponentIndex}
        canSelectTarget={isMyTurn && !soloBusy && !isGameEnded && !isSpectating}
        onSelectOpponentIndex={(seatIdx) => {
          const opp = tableOpponents[seatIdx];
          if (opp && opp.hearts > 0) {
            handleSelectTarget(opp.id, seatIdx);
          }
        }}
        cylinderSpinTrigger={spinTrigger}
        fireTrigger={fireTrigger}
        ejectTrigger={ejectTrigger}
        playerHearts={displayMyHearts}
        playerBuffs={displayMyBuffs}
        opponents={tableOpponents}
      />

      {/* MENU OR ONLINE LOBBY OVERLAY */}
      {(mode === 'menu' || (mode === 'online' && onlineRoom?.status === 'lobby')) && (
        <OnlineLobbyOverlay
          connected={connected}
          mySocketId={mySocketId}
          playerName={playerName}
          setPlayerName={setPlayerName}
          avatar={avatar}
          setAvatar={setAvatar}
          publicRooms={publicRooms}
          currentRoom={onlineRoom}
          roomError={roomError}
          micEnabled={micEnabled}
          onToggleMic={handleToggleMic}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onToggleReady={() => socketRef.current?.emit('toggle_ready')}
          onStartMatch={() => socketRef.current?.emit('start_match')}
          onLeaveRoom={handleLeaveRoom}
          onSendChat={(text) => socketRef.current?.emit('send_chat', { text })}
          onStartSoloMode={startSoloMode}
        />
      )}

      {/* IN-GAME HUD */}
      {(mode === 'solo' || isOnlinePlaying) && (
        <>
          {/* TOP HUD */}
          <div className="relative z-10 w-full p-4 flex items-start justify-between pointer-events-none">
            {/* Top-Left: Player 3 Hearts */}
            <div className="pointer-events-auto bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-3 backdrop-blur-md shadow-xl">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1 flex items-center gap-2">
                <span>{displayMyLabel}</span>
                {isSpectating && (
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold flex items-center gap-1">
                    <Eye size={11} /> โหมดผู้ชม
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {Array.from({ length: MAX_HEARTS }).map((_, i) => {
                  const active = i < displayMyHearts;
                  return (
                    <Heart
                      key={i}
                      size={24}
                      className={`transition-all duration-300 ${
                        active
                          ? 'text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-100'
                          : 'text-zinc-700 fill-zinc-900 scale-90'
                      }`}
                    />
                  );
                })}
                <span className="ml-2 text-sm font-bold text-zinc-200">
                  {displayMyHearts}/{MAX_HEARTS}
                </span>
              </div>
            </div>

            {/* Top-Center: Round, Shell Counter, Turn & Controls */}
            <div className="flex flex-col items-center gap-2 pointer-events-auto">
              <div className="flex flex-wrap items-center justify-center gap-2 bg-zinc-950/90 border border-zinc-800 px-4 py-2 rounded-full backdrop-blur-md shadow-xl">
                {isOnlinePlaying && (
                  <>
                    <button
                      onClick={handleCopyRoomCode}
                      className="text-xs font-mono font-bold text-sky-400 flex items-center gap-1 hover:text-sky-300 cursor-pointer"
                      title="คลิกเพื่อคัดลอกรหัสห้อง"
                    >
                      ห้อง: {onlineRoom.code}
                      {copiedCode ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                    <span className="text-zinc-600">|</span>
                  </>
                )}
                <span className="text-xs font-semibold text-amber-400">รอบที่ {displayRound}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-xs text-zinc-300">
                  กระสุนในโม่: <strong className="text-white">{displayShellsLeft}</strong> นัด
                </span>
                <span className="text-zinc-600">|</span>
                <span
                  className={`text-xs font-bold ${
                    isMyTurn ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isMyTurn ? 'เทิร์นของคุณ' : `เทิร์นของ ${currentTurnName}...`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowGuide(true)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen size={14} className="text-amber-400" /> คู่มืออุปกรณ์ 8 ชนิด
                </button>

                {isOnlinePlaying && (
                  <button
                    onClick={handleToggleMic}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      micEnabled
                        ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                        : 'bg-zinc-900/90 border-zinc-700 text-zinc-400'
                    }`}
                    title="เปิด/ปิดไมโครโฟน"
                  >
                    {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                  </button>
                )}

                <button
                  onClick={toggleMute}
                  className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
                  title="เปิด/ปิดเสียงเอฟเฟกต์"
                >
                  {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>

                {mode === 'solo' ? (
                  <>
                    <button
                      onClick={startSoloMode}
                      className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
                      title="เริ่มเกมใหม่"
                    >
                      <RotateCcw size={16} />
                    </button>
                    <button
                      onClick={() => setMode('menu')}
                      className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut size={14} /> เมนูหลัก
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleLeaveRoom}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 flex items-center gap-1 cursor-pointer"
                  >
                    <LogOut size={14} /> ออกจากห้อง
                  </button>
                )}
              </div>
            </div>

            {/* Top-Right: Selected Target Hearts & Items */}
            <div className="pointer-events-auto bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-3 backdrop-blur-md shadow-xl text-right">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
                หัวใจ{displayOppName}
              </div>
              <div className="flex items-center justify-end gap-2">
                <span className="mr-2 text-sm font-bold text-zinc-200">
                  {displayOppHearts}/{MAX_HEARTS}
                </span>
                {Array.from({ length: MAX_HEARTS }).map((_, i) => {
                  const active = i < displayOppHearts;
                  return (
                    <Heart
                      key={i}
                      size={24}
                      className={`transition-all duration-300 ${
                        active
                          ? 'text-red-500 fill-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] scale-100'
                          : 'text-zinc-700 fill-zinc-900 scale-90'
                      }`}
                    />
                  );
                })}
              </div>

              {displayOppItems.length > 0 && (
                <div className="mt-1.5 text-[11px] text-zinc-400">
                  อุปกรณ์{displayOppName}:{' '}
                  {displayOppItems.map((i) => ITEM_CATALOG[i.itemId].nameTh).join(', ')}
                </div>
              )}
            </div>
          </div>

          {/* Reload Announcement Banner */}
          {reloadSummary && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-20 animate-pop-in pointer-events-none">
              <div className="bg-zinc-950/95 border border-amber-500/50 px-6 py-3.5 rounded-2xl shadow-2xl text-center backdrop-blur-md">
                <div className="text-xs uppercase tracking-widest text-amber-400 font-bold mb-1.5">
                  บรรจุกระสุนเข้าโม่ใหม่!
                </div>
                <div className="flex items-center justify-center gap-4 text-sm font-bold">
                  <span className="flex items-center gap-1.5 text-red-400">
                    <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                    กระสุนจริง: {reloadSummary.live} นัด
                  </span>
                  <span className="flex items-center gap-1.5 text-sky-400">
                    <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
                    กระสุนเปล่า: {reloadSummary.blank} นัด
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Chamber Scanner Result Toast */}
          {scannedShell && (
            <div className="fixed top-28 left-1/2 -translate-x-1/2 z-20 animate-pop-in pointer-events-none">
              <div
                className={`px-5 py-2.5 rounded-xl border font-bold text-sm shadow-2xl backdrop-blur-md ${
                  scannedShell === 'live'
                    ? 'bg-red-950/90 border-red-500 text-red-200'
                    : 'bg-sky-950/90 border-sky-400 text-sky-200'
                }`}
              >
                ผลสแกนรังเพลิง: นัดปัจจุบันคือ{' '}
                {scannedShell === 'live' ? 'กระสุนจริง (LIVE)!' : 'กระสุนเปล่า (BLANK)'}
              </div>
            </div>
          )}

          {/* Survival Random Defensive Item Drop Toast */}
          {dropBanner && (
            <div className="fixed top-44 left-1/2 -translate-x-1/2 z-20 animate-pop-in pointer-events-none">
              <div className="bg-amber-950/95 border border-amber-400/80 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3">
                <Sparkles className="text-amber-400 shrink-0" size={22} />
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                    รอดชีวิต! สุ่มรับอุปกรณ์ป้องกัน 1 ชิ้น
                  </div>
                  <div className="text-sm font-bold text-white flex items-center gap-1.5 mt-0.5">
                    {renderItemIcon(dropBanner.itemId, 16)}
                    {ITEM_CATALOG[dropBanner.itemId].nameTh}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Left Combat Log Feed */}
          <div className="fixed left-4 bottom-48 z-10 w-80 pointer-events-none flex flex-col gap-1.5">
            {displayLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{ opacity: Math.max(0.35, 1 - idx * 0.13) }}
                className={`text-xs px-3 py-1.5 rounded-lg border backdrop-blur-sm ${
                  log.tone === 'danger'
                    ? 'bg-red-950/75 border-red-800/70 text-red-200'
                    : log.tone === 'success'
                    ? 'bg-emerald-950/75 border-emerald-800/70 text-emerald-200'
                    : log.tone === 'item'
                    ? 'bg-amber-950/75 border-amber-700/70 text-amber-200'
                    : 'bg-zinc-950/75 border-zinc-800/80 text-zinc-300'
                }`}
              >
                {log.text}
              </div>
            ))}
          </div>

          {/* Right Compact Online Chat Panel */}
          {isOnlinePlaying && (
            <div className="fixed right-4 bottom-48 z-10 w-72 bg-zinc-950/80 border border-zinc-800/90 rounded-xl p-2.5 backdrop-blur-md shadow-xl flex flex-col">
              <div className="text-[11px] font-bold text-zinc-400 pb-1.5 border-b border-zinc-800 flex items-center justify-between">
                <span>แชทในห้อง ({onlineRoom.players.length} คน)</span>
                <span className="text-amber-400 font-mono">{onlineRoom.code}</span>
              </div>
              <div className="h-28 overflow-y-auto py-1.5 space-y-1 text-[11px]">
                {onlineRoom.chat.slice(-12).map((m) => (
                  <div key={m.id}>
                    {m.senderId === 'system' ? (
                      <span className="text-amber-400/85 italic">{m.text}</span>
                    ) : (
                      <>
                        <span className="font-bold text-zinc-200">{m.senderName}: </span>
                        <span className="text-zinc-300">{m.text}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <form
                onSubmit={handleInGameChatSubmit}
                className="flex gap-1 pt-1.5 border-t border-zinc-800"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="พิมพ์แชท..."
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-[11px] text-white focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black cursor-pointer"
                >
                  <Send size={12} />
                </button>
              </form>
            </div>
          )}

          {/* BOTTOM HUD: Target Selector + Shoot Buttons + 4-Slot Defensive Equipment Bar */}
          <div className="fixed bottom-0 inset-x-0 z-10 p-4 flex flex-col items-center gap-2.5 pointer-events-none">
            {isMyTurn && !isGameEnded && !isSpectating && (
              <>
                {/* Opponent Target Selector Pills (Holds & turns gun toward chosen opponent!) */}
                {isOnlinePlaying && tableOpponents.filter((o) => o.hearts > 0).length > 1 && (
                  <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 bg-zinc-950/90 border border-zinc-800 px-3 py-1.5 rounded-full backdrop-blur-md shadow-lg">
                    <span className="text-[11px] text-zinc-400 flex items-center gap-1 mr-1">
                      <Target size={13} className="text-red-400" /> เล็งเป้าไปที่:
                    </span>
                    {tableOpponents.map((opp, idx) => {
                      if (opp.hearts <= 0) return null;
                      const active = opp.id === focusedOpponent?.id;
                      return (
                        <button
                          key={opp.id}
                          onMouseEnter={() => handleSelectTarget(opp.id, idx)}
                          onClick={() => handleSelectTarget(opp.id, idx)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                            active
                              ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.6)]'
                              : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-700'
                          }`}
                        >
                          {opp.name} ({opp.hearts}♥)
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Shoot Action Buttons */}
                <div className="pointer-events-auto flex items-center gap-4">
                  <button
                    disabled={soloBusy}
                    onMouseEnter={() => {
                      setHoverAimTarget(selectedOpponentIndex);
                      if (isOnlinePlaying && focusedOpponent) {
                        socketRef.current?.emit('aim_preview', { targetId: focusedOpponent.id });
                      }
                    }}
                    onClick={() => {
                      if (isOnlinePlaying && focusedOpponent) {
                        socketRef.current?.emit('fire_shot', { targetId: focusedOpponent.id });
                      } else {
                        executeSoloShot('player', 'dealer');
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-2 shadow-[0_0_25px_rgba(220,38,38,0.45)] transition-all cursor-pointer"
                  >
                    <Crosshair size={18} />
                    {isOnlinePlaying
                      ? `ยิง ${focusedOpponent?.name || 'คู่แข่ง'} (SHOOT)`
                      : 'ยิงผู้คุม (SHOOT DEALER)'}
                  </button>

                  <button
                    disabled={soloBusy}
                    onMouseEnter={() => {
                      setHoverAimTarget('self');
                      if (isOnlinePlaying) {
                        socketRef.current?.emit('aim_preview', { targetId: mySocketId });
                      }
                    }}
                    onMouseLeave={() => {
                      setHoverAimTarget(selectedOpponentIndex);
                      if (isOnlinePlaying && focusedOpponent) {
                        socketRef.current?.emit('aim_preview', { targetId: focusedOpponent.id });
                      }
                    }}
                    onClick={() => {
                      if (isOnlinePlaying) {
                        socketRef.current?.emit('fire_shot', { targetId: mySocketId });
                      } else {
                        executeSoloShot('player', 'player');
                      }
                    }}
                    className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/60 disabled:opacity-40 text-amber-200 font-bold text-sm flex items-center gap-2 shadow-xl transition-all cursor-pointer"
                  >
                    <UserCheck size={18} className="text-amber-400" />
                    ยิงตัวเอง (รอด = เล่นต่อ + สุ่มของ!)
                  </button>
                </div>
              </>
            )}

            {!isSpectating && (
              <div className="pointer-events-auto">
                <ItemBar
                  inventory={displayMyInv}
                  buffs={displayMyBuffs}
                  disabled={!isMyTurn || soloBusy || isGameEnded}
                  onUseItem={(uid) => {
                    if (isOnlinePlaying) {
                      socketRef.current?.emit('use_item', { uid });
                    } else {
                      handleSoloUseItem('player', uid);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Item Encyclopedia Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">
                รายการอุปกรณ์เสริมสายป้องกัน & เอาตัวรอด (8 ชนิด)
              </h2>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-xs text-zinc-400 mt-2 mb-4">
              เงื่อนไขสุ่มรับอุปกรณ์: เมื่อ <strong>ยิงตัวเองแล้วรอด (กระสุนเปล่า)</strong> หรือ{' '}
              <strong>รอดชีวิตจากการถูกคู่แข่งยิงใส่</strong> จะสุ่มรับอุปกรณ์ 1 ชิ้นทันที (สูงสุด 4 ช่อง)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {ALL_ITEM_IDS.map((id) => {
                const item = ITEM_CATALOG[id];
                return (
                  <div
                    key={id}
                    className="p-3 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-3"
                  >
                    <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 shrink-0">
                      {renderItemIcon(id, 20)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-zinc-100">{item.nameTh}</div>
                      <div className="text-[11px] text-zinc-500 mb-1">{item.nameEn}</div>
                      <p className="text-xs text-zinc-300 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Game Over Modal */}
      {isGameEnded && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl animate-pop-in">
            {didIWin ? (
              <>
                <Trophy size={54} className="mx-auto text-amber-400 mb-3" />
                <h2 className="text-2xl font-extrabold text-white mb-2">คุณรอดชีวิต! (VICTORY)</h2>
                <p className="text-sm text-zinc-400 mb-6">
                  คุณคือผู้รอดชีวิตคนสุดท้ายในรอบที่ {displayRound}
                </p>
              </>
            ) : (
              <>
                <Skull size={54} className="mx-auto text-red-500 mb-3" />
                <h2 className="text-2xl font-extrabold text-red-400 mb-2">จบการแข่งขัน (GAME OVER)</h2>
                <p className="text-sm text-zinc-400 mb-6">
                  ผู้ชนะในเกมนี้คือ <strong className="text-white">{winnerName}</strong>
                </p>
              </>
            )}

            {isOnlinePlaying ? (
              <div className="flex flex-col gap-2.5">
                {onlineRoom.hostId === mySocketId && (
                  <button
                    onClick={() => socketRef.current?.emit('start_match')}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all cursor-pointer"
                  >
                    เริ่มรอบใหม่ทั้งห้อง (REMATCH)
                  </button>
                )}
                <button
                  onClick={handleLeaveRoom}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer"
                >
                  กลับหน้าสร้างห้องออนไลน์
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={startSoloMode}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all cursor-pointer"
                >
                  เล่นใหม่อีกครั้ง (PLAY AGAIN)
                </button>
                <button
                  onClick={() => setMode('menu')}
                  className="w-full py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs cursor-pointer"
                >
                  กลับหน้าเมนู / สร้างห้องออนไลน์
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
