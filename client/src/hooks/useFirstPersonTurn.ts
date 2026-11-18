import { useCallback, useRef, useState } from 'react';
import { TurnAnimPhase } from '../components/FirstPersonTurnAction';

export interface UseFirstPersonTurnOptions {
  /** โอกาสยิงออก (ค่าเริ่มต้น 1/6 = 0.1667 เหมือนลูกโม่ 6 นัด) */
  fireProbability?: number;
  /** เรียกเมื่อแอนิเมชันยิง/แชะจบลง */
  onComplete?: (result: { targetId: string; fired: boolean }) => void;
}

/**
 * Hook สำเร็จรูปสำหรับคุมจังหวะ เลือกเป้าหมาย -> ยกปืนจ่อ -> ง้างนกสับ -> สุ่มยิงออก/ไม่ออก
 * แยกขาดจากระบบอื่น 100%
 */
export function useFirstPersonTurn(options: UseFirstPersonTurnOptions = {}) {
  const { fireProbability = 1 / 6, onComplete } = options;

  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [phase, setPhase] = useState<TurnAnimPhase>('idle');
  const [didFire, setDidFire] = useState<boolean | null>(null);

  const timersRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const resetTurnAction = useCallback(() => {
    clearAllTimers();
    setPhase('idle');
    setDidFire(null);
  }, [clearAllTimers]);

  const triggerShootSequence = useCallback(
    (forcedOutcome?: boolean) => {
      if (!selectedTargetId || phase !== 'idle') return;

      clearAllTimers();
      setDidFire(null);
      setPhase('aiming'); // 1. ยกปืนไปจ่อเป้าหมาย

      const t1 = window.setTimeout(() => {
        setPhase('cocking'); // 2. ง้างนกสับลุ้นกระสุน
      }, 650);

      const t2 = window.setTimeout(() => {
        const outcome =
          typeof forcedOutcome === 'boolean'
            ? forcedOutcome
            : Math.random() < fireProbability;
        setDidFire(outcome);
        setPhase('result'); // 3. แสดงผลแอนิเมชันยิงออก (ปัง) หรือ ไม่ออก (แชะ)
      }, 1250);

      timersRef.current.push(t1, t2);
    },
    [selectedTargetId, phase, clearAllTimers, fireProbability]
  );

  const handleAnimationFinished = useCallback(
    (result: { targetId: string; fired: boolean }) => {
      onComplete?.(result);
    },
    [onComplete]
  );

  return {
    selectedTargetId,
    setSelectedTargetId,
    phase,
    didFire,
    triggerShootSequence,
    resetTurnAction,
    handleAnimationFinished,
  };
}
