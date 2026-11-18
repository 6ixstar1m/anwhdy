import React from 'react';
import { SelfShootPhase } from './SelfShootTurnAction';

export interface SelfShootTurnOverlayProps {
  /** แสดง UI เฉพาะตอนเป็นเทิร์นของเรา */
  isMyTurn: boolean;
  /** สถานะแอนิเมชันปัจจุบัน */
  phase: SelfShootPhase;
  /** ผลลัพธ์: true = โดนยิง, false = รอด */
  didFire: boolean | null;
  /** นัดปัจจุบัน (1 - totalChambers) */
  currentChamber: number;
  /** จำนวนช่องโม่ทั้งหมด (ค่าเริ่มต้น 6) */
  totalChambers?: number;
  /** กดปุ่มหมุนโม่และจ่อปืนยิงตัวเอง */
  onPullTrigger: () => void;
  /** ปุ่มรีเซ็ต/เล่นรอบถัดไป */
  onNextRound?: () => void;
}

export const SelfShootTurnOverlay: React.FC<SelfShootTurnOverlayProps> = ({
  isMyTurn,
  phase,
  didFire,
  currentChamber,
  totalChambers = 6,
  onPullTrigger,
  onNextRound,
}) => {
  if (!isMyTurn) return null;

  const remainingChambers = Math.max(1, totalChambers - currentChamber + 1);
  const dangerPercent = Math.round((1 / remainingChambers) * 100);
  const isBusy = phase === 'spinning' || phase === 'aiming_self' || phase === 'cocking';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 select-none">
      {/* ขอบจอสีแดงเต้นตามชีพจร */}
      <div
        className={`pointer-events-none fixed inset-0 transition-opacity duration-300 ${
          phase === 'cocking' || phase === 'aiming_self' ? 'animate-pulse' : ''
        }`}
        style={{
          background: `radial-gradient(circle at center, transparent 48%, rgba(185, 28, 28, ${
            phase === 'result' && didFire
              ? 0.72
              : phase === 'cocking'
              ? 0.25 + (dangerPercent / 100) * 0.35
              : (dangerPercent / 100) * 0.22
          }) 100%)`,
        }}
      />

      {/* จอมืดลงเมื่อโดนยิง */}
      {phase === 'result' && didFire && (
        <div className="pointer-events-none fixed inset-0 bg-red-950/65 backdrop-blur-[2px] transition-all duration-700" />
      )}

      {/* แถบด้านบน */}
      <div className="relative z-10 flex flex-col items-center gap-3 pt-2">
        <div className="inline-flex items-center gap-3 rounded-full border border-red-500/40 bg-black/80 px-5 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 animate-ping rounded-full bg-red-500" />
          <span className="text-xs font-bold tracking-[0.25em] text-red-400 uppercase">
            YOUR TURN • .357 REVOLVER (1ST PERSON)
          </span>
        </div>

        {/* ตัวแสดงโม่กระสุนและเปอร์เซ็นต์เสี่ยง */}
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/75 px-4 py-2 backdrop-blur-md">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalChambers }).map((_, idx) => {
              const isSpent = idx < currentChamber - 1;
              return (
                <span
                  key={idx}
                  className={`h-3 w-3 rounded-full border transition-all ${
                    isSpent
                      ? 'border-zinc-700 bg-zinc-800 opacity-40'
                      : 'border-amber-400/80 bg-amber-500/35 shadow-[0_0_8px_rgba(245,158,11,0.45)]'
                  }`}
                />
              );
            })}
          </div>
          <div className="h-4 w-[1px] bg-white/15" />
          <span className="text-xs font-semibold tracking-wider text-zinc-200">
            โอกาสลั่น:{' '}
            <span className={dangerPercent >= 50 ? 'text-red-400 font-bold' : 'text-amber-300'}>
              1 / {remainingChambers} ({dangerPercent}%)
            </span>
          </span>
        </div>

        <p className="text-sm font-medium text-zinc-200 drop-shadow">
          {phase === 'idle' && 'ถึงตาคุณแล้ว — กดลั่นไกปืนลูกโม่เพื่อวัดดวง'}
          {phase === 'spinning' && 'แกร๊กๆๆ... กำลังหมุนโม่กระสุน...'}
          {phase === 'aiming_self' && 'หันปากกระบอกปืนลูกโม่เข้าหาตัวเอง...'}
          {phase === 'cocking' && 'กริ๊ก! ง้างนกสับ... กลั้นหายใจ...'}
          {phase === 'result' &&
            (didFire ? '💥 ปัง! กระสุนลั่น คุณโดนยิง!' : '🔫 แชะ! กระสุนด้าน รอดหวุดหวิด')}
        </p>
      </div>

      {/* แบนเนอร์ผลลัพธ์กลางจอ */}
      {phase === 'result' && didFire !== null && (
        <div className="relative z-10 flex flex-col items-center justify-center gap-4">
          <div
            className={`rounded-2xl border px-10 py-5 text-center backdrop-blur-md transition-all ${
              didFire
                ? 'border-red-500/80 bg-red-950/85 text-red-100 shadow-[0_0_50px_rgba(220,38,38,0.6)]'
                : 'border-emerald-500/40 bg-zinc-900/85 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.7)]'
            }`}
          >
            <div className="text-3xl font-black tracking-[0.22em] uppercase">
              {didFire ? 'BANG! YOU ARE SHOT' : 'CLICK... SURVIVED'}
            </div>
            <div className="mt-1.5 text-xs tracking-widest text-zinc-300 uppercase">
              {didFire
                ? 'กระสุนทำงาน — คุณถูกคัดออกจากรอบนี้'
                : `เข็มแทงชนวนสับช่องว่าง — รอดในนัดที่ ${currentChamber}/${totalChambers}`}
            </div>
          </div>

          {onNextRound && (
            <button
              type="button"
              onClick={onNextRound}
              className="pointer-events-auto rounded-xl border border-white/25 bg-black/85 px-5 py-2 text-xs font-semibold tracking-wider text-white hover:bg-white/15"
            >
              {didFire ? 'เริ่มรอบใหม่ (รีเซ็ตโม่ 1/6)' : 'เล่นต่อนัดถัดไป (เพิ่มความเสี่ยง)'}
            </button>
          )}
        </div>
      )}

      {/* ปุ่มลั่นไกด้านล่าง */}
      <div className="relative z-10 mx-auto flex flex-col items-center gap-2 pb-3">
        <button
          type="button"
          disabled={isBusy || phase === 'result'}
          onClick={onPullTrigger}
          className="pointer-events-auto rounded-xl border border-red-500/70 bg-gradient-to-r from-red-800 via-red-600 to-red-800 px-10 py-3.5 text-sm font-black tracking-[0.25em] text-white uppercase shadow-[0_0_30px_rgba(220,38,38,0.5)] transition hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(239,68,68,0.75)] disabled:cursor-not-allowed disabled:scale-100 disabled:border-zinc-700 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {phase === 'idle' && 'หมุนโม่ & ลั่นไกปืนลูกโม่'}
          {phase === 'spinning' && 'กำลังหมุนโม่...'}
          {phase === 'aiming_self' && 'กำลังจ่อปืน...'}
          {phase === 'cocking' && 'กำลังเหนี่ยวไก...'}
          {phase === 'result' && (didFire ? 'สิ้นสุดเกม' : 'รอดชีวิต')}
        </button>
      </div>
    </div>
  );
};

export default SelfShootTurnOverlay;
