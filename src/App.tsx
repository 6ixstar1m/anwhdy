import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import {
  ActiveBuffs,
  AimTarget,
  CombatLog,
  InventoryItem,
  ItemId,
  ShellType,
  TurnOwner,
} from './types/game';
import {
  ALL_ITEM_IDS,
  ITEM_CATALOG,
  MAX_HEARTS,
  MAX_INVENTORY_SLOTS,
  rollRandomDefensiveItem,
} from './data/items';
import { RevolverScene } from './components/RevolverScene';
import { ItemBar, renderItemIcon } from './components/ItemBar';
import { soundEngine } from './utils/soundEngine';

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
  const [playerHearts, setPlayerHearts] = useState<number>(MAX_HEARTS);
  const [dealerHearts, setDealerHearts] = useState<number>(MAX_HEARTS);

  const [cylinder, setCylinder] = useState<ShellType[]>([]);
  const [reloadSummary, setReloadSummary] = useState<{ live: number; blank: number } | null>(null);
  const [roundNumber, setRoundNumber] = useState<number>(1);

  const [turn, setTurn] = useState<TurnOwner>('player');
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [winner, setWinner] = useState<'player' | 'dealer' | null>(null);

  const [playerInv, setPlayerInv] = useState<InventoryItem[]>([]);
  const [dealerInv, setDealerInv] = useState<InventoryItem[]>([]);
  const [playerBuffs, setPlayerBuffs] = useState<ActiveBuffs>({ ...INITIAL_BUFFS });
  const [dealerBuffs, setDealerBuffs] = useState<ActiveBuffs>({ ...INITIAL_BUFFS });

  const [scannedShell, setScannedShell] = useState<ShellType | null>(null);
  const [dropBanner, setDropBanner] = useState<{ owner: TurnOwner; itemId: ItemId } | null>(null);

  const [aimTarget, setAimTarget] = useState<AimTarget>('idle');
  const [spinTrigger, setSpinTrigger] = useState<number>(0);
  const [fireTrigger, setFireTrigger] = useState<{
    count: number;
    isLive: boolean;
    shooter: TurnOwner;
  }>({ count: 0, isLive: false, shooter: 'player' });
  const [ejectTrigger, setEjectTrigger] = useState<{ count: number; isLive: boolean }>({
    count: 0,
    isLive: false,
  });

  const [logs, setLogs] = useState<CombatLog[]>([]);
  const [muted, setMuted] = useState<boolean>(false);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  const addLog = useCallback((text: string, tone: CombatLog['tone'] = 'neutral') => {
    setLogs((prev) => [{ id: createUid(), text, tone }, ...prev.slice(0, 6)]);
  }, []);

  const grantSurvivalReward = useCallback(
    (target: TurnOwner, reason: string) => {
      const rolledId = rollRandomDefensiveItem();
      const def = ITEM_CATALOG[rolledId];

      if (target === 'player') {
        setPlayerInv((prev) => {
          if (prev.length >= MAX_INVENTORY_SLOTS) {
            addLog(`รอดชีวิต! แต่ช่องเก็บอุปกรณ์เต็ม (4/4) จึงไม่ได้รับไอเทมเพิ่ม`, 'info');
            return prev;
          }
          soundEngine.playRewardDrop();
          setDropBanner({ owner: 'player', itemId: rolledId });
          addLog(`รอดชีวิต (${reason})! สุ่มได้รับอุปกรณ์เสริม: [${def.nameTh}]`, 'item');
          return [...prev, { uid: createUid(), itemId: rolledId }];
        });
      } else {
        setDealerInv((prev) => {
          if (prev.length >= MAX_INVENTORY_SLOTS) return prev;
          addLog(`ผู้คุมรอดชีวิต (${reason}) และสุ่มได้รับ [${def.nameTh}]`, 'info');
          return [...prev, { uid: createUid(), itemId: rolledId }];
        });
      }
    },
    [addLog]
  );

  const loadNewCylinder = useCallback(
    (nextRound: number, grantStarterItems = true) => {
      const newShells = generateCylinder();
      const live = newShells.filter((s) => s === 'live').length;
      const blank = newShells.filter((s) => s === 'blank').length;

      setCylinder(newShells);
      setScannedShell(null);
      setRoundNumber(nextRound);
      setReloadSummary({ live, blank });
      setSpinTrigger((c) => c + 1);
      soundEngine.playCylinderSpin();

      addLog(
        `บรรจุกระสุนรอบที่ ${nextRound}: กระสุนจริง ${live} นัด | กระสุนเปล่า ${blank} นัด`,
        'info'
      );

      if (grantStarterItems) {
        const pItem = rollRandomDefensiveItem();
        const dItem = rollRandomDefensiveItem();
        setPlayerInv((prev) =>
          prev.length < MAX_INVENTORY_SLOTS ? [...prev, { uid: createUid(), itemId: pItem }] : prev
        );
        setDealerInv((prev) =>
          prev.length < MAX_INVENTORY_SLOTS ? [...prev, { uid: createUid(), itemId: dItem }] : prev
        );
      }

      setTimeout(() => {
        setReloadSummary(null);
      }, 2800);
    },
    [addLog]
  );

  const startNewGame = useCallback(() => {
    setPlayerHearts(MAX_HEARTS);
    setDealerHearts(MAX_HEARTS);
    setPlayerInv([]);
    setDealerInv([]);
    setPlayerBuffs({ ...INITIAL_BUFFS });
    setDealerBuffs({ ...INITIAL_BUFFS });
    setWinner(null);
    setTurn('player');
    setIsBusy(false);
    setAimTarget('idle');
    setDropBanner(null);
    setLogs([]);
    loadNewCylinder(1, true);
  }, [loadNewCylinder]);

  useEffect(() => {
    startNewGame();
  }, [startNewGame]);

  useEffect(() => {
    if (!dropBanner) return;
    const t = setTimeout(() => setDropBanner(null), 3000);
    return () => clearTimeout(t);
  }, [dropBanner]);

  const resolveShotImpact = useCallback(
    (
      shooter: TurnOwner,
      target: TurnOwner,
      shell: ShellType,
      currentPlayerHearts: number,
      currentDealerHearts: number,
      currentPlayerBuffs: ActiveBuffs,
      currentDealerBuffs: ActiveBuffs
    ) => {
      let nextPHearts = currentPlayerHearts;
      let nextDHearts = currentDealerHearts;
      const nextPBuffs = { ...currentPlayerBuffs };
      const nextDBuffs = { ...currentDealerBuffs };

      const targetBuffs = target === 'player' ? nextPBuffs : nextDBuffs;
      const shooterBuffs = shooter === 'player' ? nextPBuffs : nextDBuffs;

      if (shooter !== target && targetBuffs.visor) {
        targetBuffs.visor = false;
        soundEngine.playBlankClick();
        addLog(
          `[แว่นเบี่ยงวิถี] ทำงาน! กระสุนของ${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ถูกเบี่ยงออกนอกเป้า`,
          'success'
        );
        grantSurvivalReward(target, 'เบี่ยงวิถีกระสุนสำเร็จ');
        return { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs };
      }

      if (shell === 'blank') {
        soundEngine.playBlankClick();
        if (shooter === target) {
          addLog(
            `${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ลั่นไกใส่ตัวเอง... แชะ! กระสุนเปล่า (ได้เล่นต่อ!)`,
            'success'
          );
          grantSurvivalReward(shooter, 'ยิงตัวเองแล้วรอด');
        } else {
          if (targetBuffs.ricochet) {
            targetBuffs.ricochet = false;
            addLog(`โล่สะท้อนกระสุนสลายไปเพราะเป็นกระสุนเปล่า`, 'info');
          }
          addLog(
            `${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}ยิงใส่${
              target === 'player' ? 'คุณ' : 'ผู้คุม'
            }... แชะ! กระสุนเปล่า`,
            'neutral'
          );
          grantSurvivalReward(target, 'รอดจากการถูกยิง');
        }
        return { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs };
      }

      soundEngine.playLiveGunshot();

      if (shooter !== target && targetBuffs.ricochet) {
        targetBuffs.ricochet = false;
        addLog(
          `[โล่สะท้อนกระสุน] สะท้อนกระสุนจริงกลับใส่${shooter === 'player' ? 'คุณ' : 'ผู้คุม'}! (-1 หัวใจ)`,
          'danger'
        );
        if (shooter === 'player') {
          if (nextPHearts - 1 <= 0 && shooterBuffs.charm) {
            shooterBuffs.charm = false;
            nextPHearts = 1;
            addLog(`[เครื่องรางกันตาย] ช่วยชีวิตคุณไว้ที่ 1 หัวใจ!`, 'item');
          } else {
            nextPHearts = Math.max(0, nextPHearts - 1);
          }
        } else {
          if (nextDHearts - 1 <= 0 && shooterBuffs.charm) {
            shooterBuffs.charm = false;
            nextDHearts = 1;
            addLog(`[เครื่องรางกันตาย] ช่วยชีวิตผู้คุมไว้ที่ 1 หัวใจ!`, 'item');
          } else {
            nextDHearts = Math.max(0, nextDHearts - 1);
          }
        }
        grantSurvivalReward(target, 'สะท้อนกระสุนรอดตาย');
        return { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs };
      }

      if (targetBuffs.kevlar) {
        targetBuffs.kevlar = false;
        addLog(
          `[แผ่นเกราะเคฟลาร์] รับกระสุนจริงเต็ม ๆ! ดาเมจกลายเป็น 0 (เกราะแตก)`,
          'success'
        );
        grantSurvivalReward(target, 'เกราะกันกระสุนจริงสำเร็จ');
        return { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs };
      }

      if (target === 'player') {
        if (nextPHearts - 1 <= 0 && nextPBuffs.charm) {
          nextPBuffs.charm = false;
          nextPHearts = 1;
          addLog(`[เครื่องรางกันตาย] แตกสลายเพื่อรักษาหัวใจดวงสุดท้ายของคุณไว้!`, 'item');
          grantSurvivalReward('player', 'รอดตายจากเครื่องราง');
        } else {
          nextPHearts = Math.max(0, nextPHearts - 1);
          addLog(`ปัง!! กระสุนจริงเข้าเป้า คุณเสีย -1 หัวใจ (เหลือ ${nextPHearts}/3)`, 'danger');
        }
      } else {
        if (nextDHearts - 1 <= 0 && nextDBuffs.charm) {
          nextDBuffs.charm = false;
          nextDHearts = 1;
          addLog(`[เครื่องรางกันตาย] ของผู้คุมทำงาน! รอดตายที่ 1 หัวใจ`, 'item');
        } else {
          nextDHearts = Math.max(0, nextDHearts - 1);
          addLog(`ปัง!! กระสุนจริงเข้าเป้า ผู้คุมเสีย -1 หัวใจ (เหลือ ${nextDHearts}/3)`, 'danger');
        }
      }

      return { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs };
    },
    [addLog, grantSurvivalReward]
  );

  const executeShot = useCallback(
    (shooter: TurnOwner, target: TurnOwner) => {
      if (isBusy || winner || cylinder.length === 0) return;
      setIsBusy(true);
      setScannedShell(null);
      setAimTarget(target);
      soundEngine.playHammerCock();

      const currentShell = cylinder[0];
      const remainingShells = cylinder.slice(1);

      setTimeout(() => {
        setFireTrigger((prev) => ({
          count: prev.count + 1,
          isLive: currentShell === 'live',
          shooter,
        }));

        const { nextPHearts, nextDHearts, nextPBuffs, nextDBuffs } = resolveShotImpact(
          shooter,
          target,
          currentShell,
          playerHearts,
          dealerHearts,
          playerBuffs,
          dealerBuffs
        );

        setPlayerHearts(nextPHearts);
        setDealerHearts(nextDHearts);
        setPlayerBuffs(nextPBuffs);
        setDealerBuffs(nextDBuffs);
        setCylinder(remainingShells);

        setTimeout(() => {
          setAimTarget('idle');

          if (nextPHearts <= 0) {
            setWinner('dealer');
            setIsBusy(false);
            return;
          }
          if (nextDHearts <= 0) {
            setWinner('player');
            setIsBusy(false);
            return;
          }

          let nextTurn: TurnOwner = shooter === 'player' ? 'dealer' : 'player';

          if (shooter === target && currentShell === 'blank') {
            nextTurn = shooter;
          }

          if (nextTurn === 'dealer' && nextDBuffs.smokedTurns > 0) {
            nextDBuffs.smokedTurns -= 1;
            setDealerBuffs({ ...nextDBuffs });
            addLog(`ผู้คุมติดม่านควัน [ระเบิดควัน]! ข้ามเทิร์นกลับมาที่คุณทันที`, 'info');
            nextTurn = 'player';
          } else if (nextTurn === 'player' && nextPBuffs.smokedTurns > 0) {
            nextPBuffs.smokedTurns -= 1;
            setPlayerBuffs({ ...nextPBuffs });
            addLog(`คุณติดม่านควัน! เสียสิทธิ์ยิง 1 เทิร์น`, 'danger');
            nextTurn = 'dealer';
          }

          if (remainingShells.length === 0) {
            loadNewCylinder(roundNumber + 1, true);
          }

          setTurn(nextTurn);
          setIsBusy(false);
        }, 900);
      }, 520);
    },
    [
      isBusy,
      winner,
      cylinder,
      playerHearts,
      dealerHearts,
      playerBuffs,
      dealerBuffs,
      resolveShotImpact,
      addLog,
      loadNewCylinder,
      roundNumber,
    ]
  );

  const handleUseItem = useCallback(
    (owner: TurnOwner, uid: string) => {
      if (isBusy || winner) return;
      const inv = owner === 'player' ? playerInv : dealerInv;
      const found = inv.find((i) => i.uid === uid);
      if (!found) return;

      const itemId = found.itemId;
      const def = ITEM_CATALOG[itemId];
      const userLabel = owner === 'player' ? 'คุณ' : 'ผู้คุม';

      if (owner === 'player') {
        setPlayerInv((prev) => prev.filter((i) => i.uid !== uid));
      } else {
        setDealerInv((prev) => prev.filter((i) => i.uid !== uid));
      }

      if (itemId === 'kevlar') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setPlayerBuffs((b) => ({ ...b, kevlar: true }));
        else setDealerBuffs((b) => ({ ...b, kevlar: true }));
        addLog(`${userLabel}สวมใส่ [${def.nameTh}] ป้องกันกระสุนจริงนัดถัดไป`, 'item');
      } else if (itemId === 'ricochet') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setPlayerBuffs((b) => ({ ...b, ricochet: true }));
        else setDealerBuffs((b) => ({ ...b, ricochet: true }));
        addLog(`${userLabel}เปิดใช้งาน [${def.nameTh}] เตรียมสะท้อนกระสุนกลับ!`, 'item');
      } else if (itemId === 'charm') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setPlayerBuffs((b) => ({ ...b, charm: true }));
        else setDealerBuffs((b) => ({ ...b, charm: true }));
        addLog(`${userLabel}ติดตั้ง [${def.nameTh}] ป้องกันการตาย 1 ครั้ง`, 'item');
      } else if (itemId === 'adrenaline') {
        soundEngine.playItemUse('heal');
        if (owner === 'player') {
          setPlayerHearts((h) => Math.min(MAX_HEARTS, h + 1));
        } else {
          setDealerHearts((h) => Math.min(MAX_HEARTS, h + 1));
        }
        addLog(`${userLabel}ฉีด [${def.nameTh}] ฟื้นฟู +1 หัวใจ!`, 'success');
      } else if (itemId === 'smoke') {
        soundEngine.playItemUse('tech');
        if (owner === 'player') {
          setDealerBuffs((b) => ({ ...b, smokedTurns: b.smokedTurns + 1 }));
        } else {
          setPlayerBuffs((b) => ({ ...b, smokedTurns: b.smokedTurns + 1 }));
        }
        addLog(`${userLabel}ปา [${def.nameTh}] บังคับข้ามเทิร์นของอีกฝ่าย 1 เทิร์น!`, 'item');
      } else if (itemId === 'visor') {
        soundEngine.playItemUse('shield');
        if (owner === 'player') setPlayerBuffs((b) => ({ ...b, visor: true }));
        else setDealerBuffs((b) => ({ ...b, visor: true }));
        addLog(`${userLabel}เปิดใช้งาน [${def.nameTh}] การยิงถัดไปของอีกฝ่ายจะพลาดเป้า!`, 'item');
      } else if (itemId === 'scanner') {
        soundEngine.playItemUse('tech');
        const current = cylinder[0];
        if (owner === 'player') {
          setScannedShell(current);
          addLog(
            `[เครื่องสแกนรังเพลิง] ตรวจพบ: นัดปัจจุบันคือ "${
              current === 'live' ? 'กระสุนจริง (LIVE)' : 'กระสุนเปล่า (BLANK)'
            }"`,
            'item'
          );
        } else {
          addLog(`ผู้คุมใช้ [เครื่องสแกนรังเพลิง] แอบดูลูกกระสุนในโม่...`, 'info');
        }
      } else if (itemId === 'ejector') {
        soundEngine.playItemUse('eject');
        const ejected = cylinder[0];
        const rest = cylinder.slice(1);
        setScannedShell(null);
        setEjectTrigger((e) => ({ count: e.count + 1, isLive: ejected === 'live' }));
        addLog(
          `${userLabel}ใช้ [${def.nameTh}] ดีด "${
            ejected === 'live' ? 'กระสุนจริง' : 'กระสุนเปล่า'
          }" ออกจากรังเพลิง!`,
          'item'
        );
        setCylinder(rest);
        if (rest.length === 0) {
          setTimeout(() => loadNewCylinder(roundNumber + 1, true), 650);
        }
      }
    },
    [
      isBusy,
      winner,
      playerInv,
      dealerInv,
      cylinder,
      addLog,
      loadNewCylinder,
      roundNumber,
    ]
  );

  const dealerKnownShellRef = useRef<ShellType | null>(null);

  useEffect(() => {
    if (turn !== 'dealer' || isBusy || winner || cylinder.length === 0) return;

    const timer = setTimeout(() => {
      const healItem = dealerInv.find((i) => i.itemId === 'adrenaline');
      if (dealerHearts < MAX_HEARTS && healItem) {
        handleUseItem('dealer', healItem.uid);
        return;
      }

      const shieldItem = dealerInv.find(
        (i) =>
          (i.itemId === 'kevlar' && !dealerBuffs.kevlar) ||
          (i.itemId === 'ricochet' && !dealerBuffs.ricochet) ||
          (i.itemId === 'visor' && !dealerBuffs.visor) ||
          (i.itemId === 'charm' && !dealerBuffs.charm)
      );
      if (shieldItem) {
        handleUseItem('dealer', shieldItem.uid);
        return;
      }

      const smokeItem = dealerInv.find((i) => i.itemId === 'smoke');
      if (smokeItem && dealerBuffs.smokedTurns === 0) {
        handleUseItem('dealer', smokeItem.uid);
        return;
      }

      const scannerItem = dealerInv.find((i) => i.itemId === 'scanner');
      if (scannerItem && !dealerKnownShellRef.current) {
        dealerKnownShellRef.current = cylinder[0];
        handleUseItem('dealer', scannerItem.uid);
        return;
      }

      const liveCount = cylinder.filter((s) => s === 'live').length;
      const blankCount = cylinder.length - liveCount;
      const known = dealerKnownShellRef.current;
      dealerKnownShellRef.current = null;

      let target: TurnOwner = 'player';
      if (known === 'blank') {
        target = 'dealer';
      } else if (known === 'live') {
        target = 'player';
      } else if (blankCount > liveCount && !playerBuffs.ricochet) {
        target = 'dealer';
      } else {
        target = 'player';
      }

      executeShot('dealer', target);
    }, 1050);

    return () => clearTimeout(timer);
  }, [
    turn,
    isBusy,
    winner,
    cylinder,
    dealerInv,
    dealerHearts,
    dealerBuffs,
    playerBuffs,
    handleUseItem,
    executeShot,
  ]);

  const toggleMute = () => {
    soundEngine.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div
      className={`relative w-screen h-screen overflow-hidden bg-black ${
        playerHearts === 1 && !winner ? 'low-hp-vignette' : ''
      }`}
    >
      <RevolverScene
        aimTarget={aimTarget}
        cylinderSpinTrigger={spinTrigger}
        fireTrigger={fireTrigger}
        ejectTrigger={ejectTrigger}
        playerHearts={playerHearts}
        dealerHearts={dealerHearts}
        playerBuffs={playerBuffs}
        dealerBuffs={dealerBuffs}
        dealerSmoked={dealerBuffs.smokedTurns > 0}
      />

      {/* TOP HUD */}
      <div className="relative z-10 w-full p-4 flex items-start justify-between pointer-events-none">
        <div className="pointer-events-auto bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-3 backdrop-blur-md shadow-xl">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
            หัวใจของคุณ (PLAYER)
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: MAX_HEARTS }).map((_, i) => {
              const active = i < playerHearts;
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
              {playerHearts}/{MAX_HEARTS}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 pointer-events-auto">
          <div className="flex items-center gap-2 bg-zinc-950/90 border border-zinc-800 px-4 py-2 rounded-full backdrop-blur-md shadow-xl">
            <span className="text-xs font-semibold text-amber-400">รอบที่ {roundNumber}</span>
            <span className="text-zinc-600">|</span>
            <span className="text-xs text-zinc-300">
              กระสุนในโม่: <strong className="text-white">{cylinder.length}</strong> นัด
            </span>
            <span className="text-zinc-600">|</span>
            <span
              className={`text-xs font-bold ${
                turn === 'player' ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {turn === 'player' ? 'เทิร์นของคุณ' : 'เทิร์นของผู้คุม...'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowGuide(true)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-xs text-zinc-200 flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen size={14} className="text-amber-400" /> คู่มืออุปกรณ์ 8 ชนิด
            </button>
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
              title="เปิด/ปิดเสียง"
            >
              {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
            <button
              onClick={startNewGame}
              className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 cursor-pointer"
              title="เริ่มเกมใหม่"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>

        <div className="pointer-events-auto bg-zinc-950/85 border border-zinc-800 rounded-xl px-4 py-3 backdrop-blur-md shadow-xl text-right">
          <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">
            หัวใจผู้คุม (DEALER)
          </div>
          <div className="flex items-center justify-end gap-2">
            <span className="mr-2 text-sm font-bold text-zinc-200">
              {dealerHearts}/{MAX_HEARTS}
            </span>
            {Array.from({ length: MAX_HEARTS }).map((_, i) => {
              const active = i < dealerHearts;
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
          {dealerInv.length > 0 && (
            <div className="mt-1.5 text-[11px] text-zinc-400">
              อุปกรณ์ผู้คุม: {dealerInv.map((i) => ITEM_CATALOG[i.itemId].nameTh).join(', ')}
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
      {dropBanner && dropBanner.owner === 'player' && (
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
        {logs.map((log, idx) => (
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

      {/* BOTTOM HUD */}
      <div className="fixed bottom-0 inset-x-0 z-10 p-4 flex flex-col items-center gap-3 pointer-events-none">
        {turn === 'player' && !winner && (
          <div className="pointer-events-auto flex items-center gap-4">
            <button
              disabled={isBusy}
              onClick={() => executeShot('player', 'dealer')}
              className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm flex items-center gap-2 shadow-[0_0_25px_rgba(220,38,38,0.45)] transition-all cursor-pointer"
            >
              <Crosshair size={18} />
              ยิงผู้คุม (SHOOT DEALER)
            </button>

            <button
              disabled={isBusy}
              onClick={() => executeShot('player', 'player')}
              className="px-6 py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-amber-500/60 disabled:opacity-40 text-amber-200 font-bold text-sm flex items-center gap-2 shadow-xl transition-all cursor-pointer"
            >
              <UserCheck size={18} className="text-amber-400" />
              ยิงตัวเอง (รอด = เล่นต่อ + สุ่มของ!)
            </button>
          </div>
        )}

        <div className="pointer-events-auto">
          <ItemBar
            inventory={playerInv}
            buffs={playerBuffs}
            disabled={turn !== 'player' || isBusy || Boolean(winner)}
            onUseItem={(uid) => handleUseItem('player', uid)}
          />
        </div>
      </div>

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
      {winner && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl max-w-md w-full p-8 text-center shadow-2xl animate-pop-in">
            {winner === 'player' ? (
              <>
                <Trophy size={54} className="mx-auto text-amber-400 mb-3" />
                <h2 className="text-2xl font-extrabold text-white mb-2">คุณรอดชีวิต! (VICTORY)</h2>
                <p className="text-sm text-zinc-400 mb-6">
                  หัวใจของผู้คุมหมดลงแล้ว คุณเอาชนะเกมรูเล็ตลูกโม่ในรอบที่ {roundNumber}
                </p>
              </>
            ) : (
              <>
                <Skull size={54} className="mx-auto text-red-500 mb-3" />
                <h2 className="text-2xl font-extrabold text-red-400 mb-2">คุณพ่ายแพ้ (GAME OVER)</h2>
                <p className="text-sm text-zinc-400 mb-6">
                  หัวใจทั้ง 3 ดวงของคุณหมดลงแล้ว ต้องการแก้มือใหม่อีกครั้งหรือไม่?
                </p>
              </>
            )}
            <button
              onClick={startNewGame}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition-all cursor-pointer"
            >
              เล่นใหม่อีกครั้ง (PLAY AGAIN)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
