import {
  Crosshair,
  Eye,
  EyeOff,
  Flame,
  LogOut,
  RotateCw,
  Shield,
  Skull,
  Zap,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

export function GameplayHud() {
  const room = useGameStore((s) => s.room);
  const myMemberId = useGameStore((s) => s.myMemberId);
  const isSpectator = useGameStore((s) => s.isSpectator);
  const recentEvent = useGameStore((s) => s.recentEvent);
  const spectatorCameraMode = useGameStore((s) => s.spectatorCameraMode);
  const spectatorTargetPlayerId = useGameStore((s) => s.spectatorTargetPlayerId);

  const fpAnimPhase = useGameStore((s) => s.fpAnimPhase);
  const hardcoreBlindRisk = useGameStore((s) => s.hardcoreBlindRisk);
  const nerveCheckEnabled = useGameStore((s) => s.nerveCheckEnabled);
  const nerveCursor = useGameStore((s) => s.nerveCursor);
  const nerveTargetStart = useGameStore((s) => s.nerveTargetStart);
  const nerveTargetWidth = useGameStore((s) => s.nerveTargetWidth);
  const nerveStatus = useGameStore((s) => s.nerveStatus);
  const lastNerveResult = useGameStore((s) => s.lastNerveResult);

  const submitAction = useGameStore((s) => s.submitAction);
  const startSelfShootSequence = useGameStore((s) => s.startSelfShootSequence);
  const confirmNerveTrigger = useGameStore((s) => s.confirmNerveTrigger);
  const toggleHardcoreBlindRisk = useGameStore((s) => s.toggleHardcoreBlindRisk);
  const toggleNerveCheck = useGameStore((s) => s.toggleNerveCheck);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const setSpectatorCamera = useGameStore((s) => s.setSpectatorCamera);

  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  const game = room?.game;

  useEffect(() => {
    if (!game?.turnEndsAt) {
      setSecondsLeft(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((game.turnEndsAt! - Date.now()) / 1000));
      setSecondsLeft(remaining);
    };
    update();
    const timer = window.setInterval(update, 200);
    return () => clearInterval(timer);
  }, [game?.turnEndsAt]);

  // รองรับการกด Spacebar เพื่อเหนี่ยวไกในจังหวะ Nerve Check
  useEffect(() => {
    if (fpAnimPhase !== 'NERVE_CHECK') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        confirmNerveTrigger();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fpAnimPhase, confirmNerveTrigger]);

  if (!room || !game) return null;

  const me = room.players.find((p) => p.id === myMemberId);
  const activePlayer = room.players.find((p) => p.id === game.currentTurnPlayerId);
  const isMyTurn = Boolean(
    me && me.isAlive && !isSpectator && game.phase === 'PLAYER_TURN' && game.currentTurnPlayerId === me.id
  );
  const isBusyAnimating = fpAnimPhase !== 'IDLE';
  const canPass = Boolean(
    isMyTurn && !isBusyAnimating && game.rules.allowPassOption && me && me.passesRemaining > 0
  );

  const riskPercent = Math.round(game.currentRiskFactor * 100);
  const iWasJustEliminated = Boolean(
    me &&
      game.phase === 'EVENT_RESOLUTION' &&
      recentEvent?.actorPlayerId === me.id &&
      recentEvent?.outcome === 'ELIMINATED'
  );

  // เอฟเฟกต์บีบสายตา (Tunnel Vision) เมื่อเสี่ยงสูงหรือตื่นตระหนก
  const tunnelStrength =
    nerveStatus === 'PANICKED'
      ? 62
      : riskPercent >= 67
        ? 55
        : riskPercent >= 50
          ? 44
          : 34;

  return (
    <div className="pointer-events-none relative z-10 flex h-full w-full flex-col justify-between p-6 md:p-8">
      {/* เอฟเฟกต์ขอบจอแดงเต้นตามชีพจร & Tunnel Vision */}
      {(isMyTurn || iWasJustEliminated) && (
        <div
          className={`pointer-events-none fixed inset-0 transition-all duration-300 ${
            fpAnimPhase === 'AIMING_SELF' ||
            fpAnimPhase === 'NERVE_CHECK' ||
            fpAnimPhase === 'COCKING'
              ? 'animate-pulse'
              : ''
          }`}
          style={{
            background: `radial-gradient(circle at center, transparent ${
              100 - tunnelStrength
            }%, rgba(${
              nerveStatus === 'COLD_BLOODED' ? '14, 116, 144' : '153, 27, 27'
            }, ${
              iWasJustEliminated
                ? 0.78
                : fpAnimPhase === 'NERVE_CHECK' || fpAnimPhase === 'COCKING'
                  ? 0.42 + (riskPercent / 100) * 0.35
                  : 0.16 + (riskPercent / 100) * 0.25
            }) 100%)`,
          }}
        />
      )}

      {/* เอฟเฟกต์จอมืดแดงวาบเมื่อโดนยิง */}
      {iWasJustEliminated && (
        <div className="pointer-events-none fixed inset-0 bg-red-950/65 backdrop-blur-[2px] transition-all duration-500" />
      )}

      {/* Top Match Telemetry Bar */}
      <header className="pointer-events-auto relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-zinc-800/90 bg-[#121317]/90 px-5 py-3 shadow-2xl backdrop-blur-md">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">Round</p>
            <p className="font-mono text-2xl font-black text-white">0{game.roundNumber}</p>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Current Risk
            </p>
            <p className="flex items-center gap-1.5 font-mono text-lg font-bold text-[#e06c7d]">
              <Flame className="h-4 w-4" />
              <span>{hardcoreBlindRisk ? '???%' : `${riskPercent}%`}</span>
            </p>
          </div>
          <div className="h-8 w-px bg-zinc-800" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Mental State
            </p>
            <p
              className={`font-mono text-xs font-bold uppercase tracking-wider ${
                nerveStatus === 'COLD_BLOODED'
                  ? 'text-cyan-300'
                  : nerveStatus === 'PANICKED'
                    ? 'text-red-400'
                    : 'text-zinc-200'
              }`}
            >
              {nerveStatus === 'COLD_BLOODED'
                ? 'COLD BLOODED'
                : nerveStatus === 'PANICKED'
                  ? 'PANICKED (SHAKING)'
                  : isMyTurn
                    ? '1ST PERSON • YOUR TURN'
                    : game.phase.replace('_', ' ')}
            </p>
          </div>
        </div>

        {/* Challenge Modifiers & Leave */}
        <div className="flex flex-wrap items-center gap-2">
          {/* สวิตช์เปิด-ปิดโหมดท้าทาย */}
          <button
            type="button"
            onClick={toggleHardcoreBlindRisk}
            title="ซ่อนตัวเลข % ความเสี่ยง ต้องจำจำนวนนัดในโม่เอง"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition backdrop-blur-md ${
              hardcoreBlindRisk
                ? 'border-red-500/70 bg-red-950/75 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                : 'border-zinc-800 bg-[#121317]/90 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {hardcoreBlindRisk ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span>Blind Risk</span>
          </button>

          <button
            type="button"
            onClick={toggleNerveCheck}
            title="เปิดมินิเกมกดจังหวะคุมสติตอนง้างนกสับ"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-semibold transition backdrop-blur-md ${
              nerveCheckEnabled
                ? 'border-amber-500/70 bg-amber-950/65 text-amber-200'
                : 'border-zinc-800 bg-[#121317]/90 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Nerve Check</span>
          </button>

          {/* Spectator Camera Controls */}
          {(isSpectator || (me && !me.isAlive)) && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-800/60 bg-[#171410]/90 px-3 py-2 backdrop-blur-md">
              <span className="font-mono text-xs text-amber-300">SPECTATING</span>
              <button
                type="button"
                onClick={() => setSpectatorCamera('OVERVIEW', null)}
                className={`rounded-lg px-2 py-0.5 text-xs transition ${
                  spectatorCameraMode === 'OVERVIEW'
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-500/50'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Table
              </button>
              {room.players
                .filter((p) => p.isAlive)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSpectatorCamera('FOLLOW_PLAYER', p.id)}
                    className={`rounded-lg px-2 py-0.5 text-xs transition ${
                      spectatorCameraMode === 'FOLLOW_PLAYER' && spectatorTargetPlayerId === p.id
                        ? 'bg-[#8b2635]/40 text-white border border-[#b83346]'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {p.displayName}
                  </button>
                ))}
            </div>
          )}

          <button
            type="button"
            onClick={leaveRoom}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/90 px-3.5 py-2.5 text-xs text-zinc-300 backdrop-blur-md hover:border-red-800 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Center Cinematic Event / Nerve Check Mini-Game */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center">
        {game.phase === 'ROUND_INTRO' && (
          <div className="rounded-2xl border border-[#8b2635]/60 bg-black/75 px-8 py-5 backdrop-blur-md">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#e06c7d]">
              Prepare Yourself
            </p>
            <h2 className="mt-1 text-3xl font-black tracking-[0.2em] text-white">
              ROUND {game.roundNumber}
            </h2>
          </div>
        )}

        {/* มินิเกมคุมสติลั่นไก (Nerve Check Bar) */}
        {fpAnimPhase === 'NERVE_CHECK' && (
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-red-500/80 bg-black/88 p-5 shadow-[0_0_40px_rgba(220,38,38,0.45)] backdrop-blur-md">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-red-300">
              STEADY YOUR HAND — กดหยุดในโซนสีเขียว!
            </p>

            {/* แถบวัดความนิ่ง */}
            <div className="relative mt-3 h-5 w-full overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
              {/* โซนเป้าหมาย */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-500/80 shadow-[0_0_12px_rgba(16,185,129,0.9)]"
                style={{
                  left: `${nerveTargetStart * 100}%`,
                  width: `${nerveTargetWidth * 100}%`,
                }}
              />
              {/* เข็มวิ่ง */}
              <div
                className="absolute top-0 bottom-0 w-1.5 -translate-x-1/2 bg-white shadow-[0_0_8px_#fff]"
                style={{ left: `${nerveCursor * 100}%` }}
              />
            </div>

            <button
              type="button"
              onClick={confirmNerveTrigger}
              className="mt-3.5 w-full rounded-xl border border-red-400 bg-red-600 py-2.5 font-mono text-xs font-black uppercase tracking-[0.22em] text-white shadow-lg transition hover:bg-red-500 active:scale-95"
            >
              SQUEEZE TRIGGER [SPACEBAR]
            </button>
          </div>
        )}

        {/* แจ้งผลความนิ่งตอนง้างนกสับ */}
        {fpAnimPhase === 'COCKING' && lastNerveResult && (
          <div
            className={`rounded-xl border px-5 py-2 font-mono text-xs font-black uppercase tracking-[0.2em] backdrop-blur-md ${
              lastNerveResult === 'PERFECT'
                ? 'border-cyan-400/80 bg-cyan-950/80 text-cyan-200'
                : 'border-red-500/80 bg-red-950/80 text-red-200'
            }`}
          >
            {lastNerveResult === 'PERFECT'
              ? 'COLD BLOODED • มือนิ่งสนิท!'
              : 'PANICKED • มือสั่นเสียสมาธิ!'}
          </div>
        )}

        {game.phase === 'EVENT_RESOLUTION' && recentEvent && (
          <div
            className={`rounded-2xl border px-10 py-6 shadow-2xl backdrop-blur-md ${
              recentEvent.outcome === 'ELIMINATED'
                ? 'border-red-600 bg-red-950/85 text-red-100'
                : recentEvent.outcome === 'PASSED'
                  ? 'border-amber-600 bg-amber-950/85 text-amber-100'
                  : 'border-emerald-600 bg-emerald-950/85 text-emerald-100'
            }`}
          >
            <p className="font-mono text-xs uppercase tracking-[0.3em] opacity-80">
              {recentEvent.actorName}
            </p>
            <h2 className="mt-1 flex items-center justify-center gap-2.5 text-3xl font-black tracking-[0.18em]">
              {recentEvent.outcome === 'ELIMINATED' ? (
                <>
                  <Skull className="h-7 w-7" />
                  <span>BANG! ELIMINATED</span>
                </>
              ) : recentEvent.outcome === 'PASSED' ? (
                <>
                  <Shield className="h-7 w-7" />
                  <span>TURN PASSED</span>
                </>
              ) : (
                <span>CLICK... SURVIVED</span>
              )}
            </h2>
          </div>
        )}
      </div>

      {/* Bottom Turn Action Console */}
      <div className="pointer-events-auto relative z-10 mx-auto mb-14 flex w-full max-w-xl flex-col items-center gap-3 md:mb-4">
        {game.phase === 'PLAYER_TURN' && activePlayer && (
          <div className="w-full rounded-2xl border border-zinc-800/90 bg-[#121317]/92 p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">
                {isMyTurn
                  ? fpAnimPhase === 'SPINNING'
                    ? 'แกร๊กๆๆ... กำลังปั่นโม่กระสุน...'
                    : fpAnimPhase === 'AIMING_SELF'
                      ? 'หันปากกระบอกปืนลูกโม่จ่อตัวเอง...'
                      : fpAnimPhase === 'NERVE_CHECK'
                        ? 'คุมสติ! กด Spacebar หรือปุ่มแดงเพื่อเหนี่ยวไก!'
                        : fpAnimPhase === 'COCKING'
                          ? 'กริ๊ก! ง้างนกสับ... ลุ้นกระสุน!'
                          : fpAnimPhase === 'RESULT'
                            ? 'เหนี่ยวไก!'
                            : 'YOUR TURN — เลือกวิธีวัดดวง'
                  : `${activePlayer.displayName}'s Turn`}
              </span>
              <span
                className={`font-mono font-bold ${
                  secondsLeft <= 5 ? 'animate-ping text-red-400' : 'text-[#e06c7d]'
                }`}
              >
                {secondsLeft}s
              </span>
            </div>

            {isMyTurn ? (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {/* 1. เหนี่ยวไกทันที (ไม่หมุนโม่) */}
                <button
                  type="button"
                  disabled={isBusyAnimating}
                  onClick={() => startSelfShootSequence({ spinFirst: false })}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#b83346] bg-[#8b2635] py-3 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-[0_0_20px_rgba(184,51,70,0.4)] transition hover:bg-[#b83346] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Crosshair className="h-4 w-4" />
                  <span>
                    {hardcoreBlindRisk ? 'Pull Trigger' : `Pull (${riskPercent}%)`}
                  </span>
                </button>

                {/* 2. ปั่นโม่ก่อนยิง */}
                <button
                  type="button"
                  disabled={isBusyAnimating}
                  onClick={() => startSelfShootSequence({ spinFirst: true })}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-amber-700/80 bg-amber-950/60 py-3 text-xs font-bold uppercase tracking-[0.12em] text-amber-200 transition hover:border-amber-500 hover:bg-amber-900/60 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <RotateCw className="h-4 w-4" />
                  <span>Spin & Pull</span>
                </button>

                {/* 3. ข้ามเทิร์น */}
                <button
                  type="button"
                  disabled={!canPass}
                  onClick={() => submitAction('PASS_TURN')}
                  className="rounded-xl border border-zinc-700 bg-zinc-900 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-200 transition hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Pass ({me?.passesRemaining ?? 0})
                </button>
              </div>
            ) : (
              <p className="mt-2 text-center font-mono text-[11px] text-zinc-400">
                Waiting for {activePlayer.displayName} to commit...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
