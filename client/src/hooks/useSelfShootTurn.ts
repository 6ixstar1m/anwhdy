import { useCallback, useRef, useState } from 'react';
import { SelfShootPhase } from '../components/SelfShootTurnAction';

export interface UseSelfShootTurnOptions {
  /** จำนวนช่องโม่กระสุนทั้งหมด (ค่าเริ่มต้น 6 ช่อง) */
  totalChambers?: number;
  /** เรียกเมื่อแอนิเมชันยิง/แชะจบลง */
  onComplete?: (result: { fired: boolean; chamberUsed: number }) => void;
}

export function useSelfShootTurn(options: UseSelfShootTurnOptions = {}) {
  const { totalChambers = 6, onComplete } = options;

  const [currentChamber, setCurrentChamber] = useState<number>(1);
  const [phase, setPhase] = useState<SelfShootPhase>('idle');
  const [didFire, setDidFire] = useState<boolean | null>(null);

  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const pullSelfTrigger = useCallback(
    (forcedOutcome?: boolean) => {
      if (phase !== 'idle') return;
      clearTimers();
      setDidFire(null);

      // 1. หมุนโม่กระสุนพร้อมเสียงเฟืองเหล็ก
      setPhase('spinning');

      // 2. หันปากกระบอกปืนเข้าหาตัวเอง
      const t1 = window.setTimeout(() => {
        setPhase('aiming_self');
      }, 680);

      // 3. ง้างนกสับ 2 จังหวะ + ซูม FOV
      const t2 = window.setTimeout(() => {
        setPhase('cocking');
      }, 1380);

      // 4. เหนี่ยวไกสุ่มผลลัพธ์
      const t3 = window.setTimeout(() => {
        const remaining = Math.max(1, totalChambers - currentChamber + 1);
        const outcome =
          typeof forcedOutcome === 'boolean'
            ? forcedOutcome
            : Math.random() < 1 / remaining;

        setDidFire(outcome);
        setPhase('result');
      }, 2480);

      timersRef.current.push(t1, t2, t3);
    },
    [phase, clearTimers, totalChambers, currentChamber]
  );

  const advanceOrResetRound = useCallback(() => {
    clearTimers();
    if (didFire) {
      setCurrentChamber(1);
    } else {
      setCurrentChamber((prev) => (prev >= totalChambers ? 1 : prev + 1));
    }
    setDidFire(null);
    setPhase('idle');
  }, [clearTimers, didFire, totalChambers]);

  const handleAnimationFinished = useCallback(
    (result: { fired: boolean }) => {
      onComplete?.({ fired: result.fired, chamberUsed: currentChamber });
    },
    [onComplete, currentChamber]
  );

  return {
    currentChamber,
    totalChambers,
    phase,
    didFire,
    pullSelfTrigger,
    advanceOrResetRound,
    handleAnimationFinished,
  };
}
