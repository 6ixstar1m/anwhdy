import React from 'react';
import { TurnAnimPhase, TurnTargetPlayer } from './FirstPersonTurnAction';

export interface FirstPersonTurnOverlayProps {
  /** แสดง UI เฉพาะตอนเป็นเทิร์นของเรา */
  isMyTurn: boolean;
  /** ID ของผู้เล่นฝั่งเรา */
  myPlayerId: string;
  /** รายชื่อผู้เล่นทั้งหมดบนโต๊ะ */
  players: TurnTargetPlayer[];
  /** ID ของเป้าหมายที่เลือกอยู่ */
  selectedTargetId: string | null;
  /** เปลี่ยนเป้าหมายที่เลือก */
  onSelectTarget: (targetId: string) => void;
  /** สถานะแอนิเมชันปัจจุบัน */
  phase: TurnAnimPhase;
  /** ผลสุ่มว่ายิงออกหรือไม่ (true = ยิงออก, false = ยิงไม่ออก) */
  didFire: boolean | null;
  /** กดปุ่มเล็งและสุ่มลั่นไก */
  onPullTrigger: () => void;
  /** กดรีเซ็ตเพื่อทดสอบ/เล่นรอบถัดไป (ใช้กรณีทดสอบ Standalone) */
  onResetTurn?: () => void;
}

export const FirstPersonTurnOverlay: React.FC<FirstPersonTurnOverlayProps> = ({
  isMyTurn,
  myPlayerId,
  players,
  selectedTargetId,
  onSelectTarget,
  phase,
  didFire,
  onPullTrigger,
  onResetTurn,
}) => {
  if (!isMyTurn) return null;

  const alivePlayers = players.filter((p) => p.isAlive !== false);
  const selectedPlayer = alivePlayers.find((p) => p.id === selectedTargetId) || null;
  const isBusy = phase === 'aiming' || phase === 'cocking';

  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between p-6 select-none">
      {/* แถบแจ้งเตือนด้านบน: มุมมองบุคคลที่ 1 */}
      <div className="flex flex-col items-center gap-2 pt-2">
        <div className="inline-flex items-center gap-2.5 rounded-full border border-red-500/40 bg-black/75 px-4 py-1.5 backdrop-blur-md">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-semibold tracking-[0.25em] text-red-400 uppercase">
            YOUR TURN • FIRST-PERSON VIEW
          </span>
        </div>
        <p className="text-sm text-zinc-300 drop-shadow">
          {phase === 'idle' && 'เลือกเป้าหมายบนโต๊ะที่ต้องการจ่อปืน แล้วกดลั่นไก'}
          {phase === 'aiming' && `กำลังยกปืนเล็งไปที่ ${selectedPlayer?.name ?? 'เป้าหมาย'}...`}
          {phase === 'cocking' && 'ง้างนกสับ... ลุ้นกระสุน!'}
          {phase === 'result' && (didFire ? '💥 ปัง! กระสุนลั่น!' : '🔫 แชะ! กระสุนด้าน (ยิงไม่ออก)')}
        </p>
      </div>

      {/* เอฟเฟกต์ขอบจอแดงวาบตอนยิงออก */}
      {phase === 'result' && didFire && (
        <div className="pointer-events-none fixed inset-0 animate-pulse bg-red-600/20" />
      )}

      {/* แบนเนอร์ผลลัพธ์ตรงกลางจอ */}
      {phase === 'result' && didFire !== null && (
        <div className="flex flex-col items-center justify-center gap-3">
          <div
            className={`rounded-xl border px-8 py-4 text-center backdrop-blur-md transition-all ${
              didFire
                ? 'border-red-500/70 bg-red-950/80 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.45)]'
                : 'border-zinc-500/60 bg-zinc-900/85 text-zinc-100 shadow-[0_0_30px_rgba(0,0,0,0.6)]'
            }`}
          >
            <div className="text-2xl font-black tracking-[0.2em] uppercase">
              {didFire ? 'BANG! ยิงออก' : 'CLICK... ยิงไม่ออก'}
            </div>
            <div className="mt-1 text-xs tracking-wider text-zinc-300">
              เป้าหมาย: <span className="font-semibold text-white">{selectedPlayer?.name}</span>
            </div>
          </div>

          {onResetTurn && (
            <button
              type="button"
              onClick={onResetTurn}
              className="pointer-events-auto rounded-lg border border-white/20 bg-black/80 px-4 py-1.5 text-xs font-medium tracking-wider text-zinc-200 hover:bg-white/10"
            >
              รีเซ็ตจังหวะยิง
            </button>
          )}
        </div>
      )}

      {/* แผงเลือกเป้าหมาย + ปุ่มลั่นไกด้านล่าง */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 pb-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/80 p-3 backdrop-blur-md">
          {alivePlayers.map((player) => {
            const isSelected = player.id === selectedTargetId;
            const isMe = player.id === myPlayerId;
            return (
              <button
                key={player.id}
                type="button"
                disabled={isBusy || phase === 'result'}
                onClick={() => onSelectTarget(player.id)}
                className={`rounded-xl border px-4 py-2 text-left transition-all ${
                  isSelected
                    ? 'border-red-500 bg-red-600/25 text-white shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                    : 'border-white/10 bg-white/5 text-zinc-300 hover:border-white/30 hover:bg-white/10'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <div className="text-[10px] tracking-widest text-zinc-400 uppercase">
                  SEAT #{player.seatIndex + 1} {isMe ? '(ตัวเอง)' : ''}
                </div>
                <div className="text-sm font-semibold">{player.name}</div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selectedTargetId || isBusy || phase === 'result'}
          onClick={onPullTrigger}
          className="pointer-events-auto rounded-xl border border-red-500/60 bg-gradient-to-r from-red-700 to-red-600 px-8 py-3 text-sm font-bold tracking-[0.2em] text-white uppercase shadow-[0_0_25px_rgba(220,38,38,0.45)] transition hover:from-red-600 hover:to-red-500 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {isBusy
            ? 'กำลังเล็งปืน...'
            : selectedPlayer
            ? `เล็ง & ลั่นไกใส่ ${selectedPlayer.name}`
            : 'เลือกเป้าหมายก่อนยิง'}
        </button>
      </div>
    </div>
  );
};

export default FirstPersonTurnOverlay;
