import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export interface TurnTargetPlayer {
  id: string;
  name: string;
  seatIndex: number; // 0 - 5 around the table
  isAlive?: boolean;
}

export type TurnAnimPhase = 'idle' | 'aiming' | 'cocking' | 'result' | 'recovering';

export interface FirstPersonTurnActionProps {
  /** เปิดมุมมองบุคคลที่ 1 เมื่อเป็นเทิร์นของเรา */
  isMyTurn: boolean;
  /** ตำแหน่งที่นั่งของเรา (0 - 5) */
  mySeatIndex: number;
  /** รายชื่อผู้เล่นทั้งหมดบนโต๊ะ */
  players: TurnTargetPlayer[];
  /** ID ของเป้าหมายที่กำลังเล็งอยู่ */
  selectedTargetId: string | null;
  /** สถานะแอนิเมชันปัจจุบัน (ควบคุมจาก Overlay หรือ State ภายนอก) */
  phase: TurnAnimPhase;
  /** ผลสุ่มว่ายิงออกหรือไม่ (true = ยิงออก, false = ยิงไม่ออก) */
  didFire: boolean | null;
  /** รัศมีที่นั่งรอบโต๊ะ (ปรับให้ตรงกับโต๊ะในฉากได้ ค่าเริ่มต้น 2.35) */
  seatRadius?: number;
  /** ความสูงระดับสายตาตอนนั่ง (ค่าเริ่มต้น 1.42) */
  eyeHeight?: number;
  /** เปิด/ปิดเสียงเอฟเฟกต์สังเคราะห์ (ไม่ต้องใช้ไฟล์เสียงภายนอก) */
  enableSound?: boolean;
  /** เรียกเมื่อแอนิเมชันยิง/แชะจบลง */
  onAnimationFinished?: (result: { targetId: string; fired: boolean }) => void;
}

// คำนวณพิกัด XYZ ของแต่ละที่นั่งรอบโต๊ะกลม (6 ที่นั่ง)
export function getSeatPosition(
  seatIndex: number,
  radius = 2.35,
  height = 1.42
): THREE.Vector3 {
  const angle = (seatIndex / 6) * Math.PI * 2;
  return new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

// สร้างเสียงปืน / เสียงนกสับด้วย Web Audio API (ไม่ต้องพึ่งไฟล์ .mp3/.wav)
function playSynthesizedGunSound(type: 'cock' | 'fire' | 'dry') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === 'cock') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.06);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.075);
    } else if (type === 'dry') {
      // เสียง "แชะ" (ยิงไม่ออก)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.045);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.055);
    } else if (type === 'fire') {
      // เสียง "ปัง!" (ยิงออก) - White noise burst + Low punch
      const bufferSize = ctx.sampleRate * 0.45;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.09));
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(180, now + 0.4);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.65, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      whiteNoise.connect(filter).connect(noiseGain).connect(ctx.destination);
      whiteNoise.start(now);

      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(150, now);
      subOsc.frequency.exponentialRampToValueAtTime(32, now + 0.25);
      subGain.gain.setValueAtTime(0.7, now);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      subOsc.connect(subGain).connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.3);
    }
  } catch {
    // ข้ามหากเบราว์เซอร์บล็อกเสียงอัตโนมัติ
  }
}

export const FirstPersonTurnAction: React.FC<FirstPersonTurnActionProps> = ({
  isMyTurn,
  mySeatIndex,
  players,
  selectedTargetId,
  phase,
  didFire,
  seatRadius = 2.35,
  eyeHeight = 1.42,
  enableSound = true,
  onAnimationFinished,
}) => {
  const { camera, controls } = useThree();

  const gunGroupRef = useRef<THREE.Group>(null);
  const hammerRef = useRef<THREE.Mesh>(null);
  const cylinderRef = useRef<THREE.Mesh>(null);
  const muzzleFlashRef = useRef<THREE.Mesh>(null);
  const muzzleLightRef = useRef<THREE.PointLight>(null);

  // เก็บตำแหน่งกล้องมุมมองบุคคลที่ 3 เดิมไว้คืนค่าเมื่อจบเทิร์น
  const savedThirdPersonPos = useRef<THREE.Vector3 | null>(null);
  const savedThirdPersonQuat = useRef<THREE.Quaternion | null>(null);
  const wasMyTurnRef = useRef(false);

  // ตัวแปรคุมจังหวะแอนิเมชัน
  const phaseTimerRef = useRef(0);
  const soundPlayedForPhaseRef = useRef<string>('');
  const finishedTriggeredRef = useRef(false);
  const recoilOffsetRef = useRef(0);
  const recoilPitchRef = useRef(0);
  const screenShakeRef = useRef(0);
  const flashIntensityRef = useRef(0);

  // เวกเตอร์ช่วยคำนวณ (ลด GC allocation ใน useFrame)
  const tempCamPos = useMemo(() => new THREE.Vector3(), []);
  const tempLookTarget = useMemo(() => new THREE.Vector3(), []);
  const tempDummyObj = useMemo(() => new THREE.Object3D(), []);
  const tempGunTargetLocal = useMemo(() => new THREE.Vector3(), []);
  const tempGunEuler = useMemo(() => new THREE.Euler(), []);
  const tempGunQuat = useMemo(() => new THREE.Quaternion(), []);

  // รีเซ็ตตัวจับเวลาเมื่อเปลี่ยน phase
  useEffect(() => {
    phaseTimerRef.current = 0;
    if (phase === 'idle' || phase === 'aiming') {
      finishedTriggeredRef.current = false;
      soundPlayedForPhaseRef.current = '';
    }
  }, [phase, selectedTargetId]);

  // จัดการสลับเข้า/ออกโหมดมุมมองบุคคลที่ 1 และปิด OrbitControls ชั่วคราว
  useEffect(() => {
    const orbitCtrl = controls as unknown as { enabled?: boolean } | null;

    if (isMyTurn && !wasMyTurnRef.current) {
      savedThirdPersonPos.current = camera.position.clone();
      savedThirdPersonQuat.current = camera.quaternion.clone();
      if (orbitCtrl && typeof orbitCtrl.enabled === 'boolean') {
        orbitCtrl.enabled = false;
      }
    } else if (!isMyTurn && wasMyTurnRef.current) {
      if (orbitCtrl && typeof orbitCtrl.enabled === 'boolean') {
        orbitCtrl.enabled = true;
      }
    }

    wasMyTurnRef.current = isMyTurn;
  }, [isMyTurn, camera, controls]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const elapsed = state.clock.getElapsedTime();

    // 1. คืนค่ากล้องกลับสู่มุมมองบุคคลที่ 3 เมื่อไม่ใช่เทิร์นของเรา
    if (!isMyTurn) {
      if (savedThirdPersonPos.current && savedThirdPersonQuat.current) {
        camera.position.lerp(savedThirdPersonPos.current, 1 - Math.exp(-6 * dt));
        camera.quaternion.slerp(savedThirdPersonQuat.current, 1 - Math.exp(-6 * dt));
        if (camera.position.distanceTo(savedThirdPersonPos.current) < 0.02) {
          savedThirdPersonPos.current = null;
          savedThirdPersonQuat.current = null;
        }
      }
      if (gunGroupRef.current) {
        gunGroupRef.current.visible = false;
      }
      return;
    }

    // 2. คำนวณตำแหน่งหัวของผู้เล่นในมุมมองบุคคลที่ 1
    const myHeadPos = getSeatPosition(mySeatIndex, seatRadius, eyeHeight);
    tempCamPos.copy(myHeadPos);

    // หาเป้าหมายที่กำลังเลือก (ถ้ายังไม่เลือก ให้มองไปกลางโต๊ะ)
    const targetPlayer = players.find((p) => p.id === selectedTargetId) || null;
    const isSelfTarget = targetPlayer ? targetPlayer.seatIndex === mySeatIndex : false;

    if (targetPlayer && !isSelfTarget) {
      const targetPos = getSeatPosition(targetPlayer.seatIndex, seatRadius, eyeHeight - 0.08);
      tempLookTarget.copy(targetPos);
    } else {
      // มองไปที่กลางโต๊ะ
      tempLookTarget.set(0, eyeHeight - 0.25, 0);
    }

    // ใส่แรงสั่นกล้อง (Camera Shake) ตอนปืนลั่น
    if (screenShakeRef.current > 0.001) {
      tempCamPos.x += (Math.random() - 0.5) * screenShakeRef.current;
      tempCamPos.y += (Math.random() - 0.5) * screenShakeRef.current;
      tempCamPos.z += (Math.random() - 0.5) * screenShakeRef.current;
      screenShakeRef.current = THREE.MathUtils.lerp(screenShakeRef.current, 0, 1 - Math.exp(-14 * dt));
    }

    // เลื่อนกล้องเข้าสู่มุมมองบุคคลที่ 1 อย่างนุ่มนวล
    camera.position.lerp(tempCamPos, 1 - Math.exp(-8 * dt));
    tempDummyObj.position.copy(camera.position);
    tempDummyObj.lookAt(tempLookTarget);
    camera.quaternion.slerp(tempDummyObj.quaternion, 1 - Math.exp(-8 * dt));

    // 3. อัปเดตตำแหน่งและแอนิเมชันปืน 3D หน้ากล้อง
    const gun = gunGroupRef.current;
    if (!gun) return;
    gun.visible = true;

    // ผูกฐานปืนไว้กับตำแหน่งและมุมมองกล้อง
    gun.position.copy(camera.position);
    gun.quaternion.copy(camera.quaternion);

    // คุมจังหวะแอนิเมชันตาม Phase
    phaseTimerRef.current += dt;
    const t = phaseTimerRef.current;

    // ค่าพื้นฐานของปืนใน Local Space ของกล้อง
    // idle = ถือปืนระดับอกด้านขวา | aiming = ยกปืนเล็งตรงกลาง | selfTarget = หันปากกระบอกเข้าหาตัวเอง
    let localX = 0.24;
    let localY = -0.22;
    let localZ = -0.46;
    let rotX = 0.08;
    let rotY = -0.12;
    let rotZ = 0.0;
    let hammerAngle = 0;

    // ลมหายใจขยับมือเบาๆ
    const swayX = Math.sin(elapsed * 2.1) * 0.004;
    const swayY = Math.cos(elapsed * 1.7) * 0.004;

    if (phase === 'idle') {
      localX = targetPlayer ? 0.14 : 0.25;
      localY = targetPlayer ? -0.16 : -0.24;
      localZ = -0.45;
      rotY = targetPlayer ? -0.04 : -0.18;
    } else if (phase === 'aiming' || phase === 'cocking') {
      if (isSelfTarget) {
        // หันปืนเข้าหาตัวเอง
        localX = 0.0;
        localY = -0.14;
        localZ = -0.34;
        rotX = 0.22;
        rotY = Math.PI - 0.15;
        rotZ = -0.18;
      } else {
        // ยกปืนเล็งตรงไปที่เป้าหมาย
        localX = 0.04;
        localY = -0.12;
        localZ = -0.42;
        rotX = 0.02;
        rotY = 0.0;
        rotZ = 0.0;
      }

      // ง้างนกสับในจังหวะ cocking
      if (phase === 'cocking') {
        hammerAngle = -0.55;
        // สั่นมือเล็กน้อยตอนลุ้น
        localX += (Math.random() - 0.5) * 0.004;
        localY += (Math.random() - 0.5) * 0.004;

        if (enableSound && soundPlayedForPhaseRef.current !== 'cocking') {
          playSynthesizedGunSound('cock');
          soundPlayedForPhaseRef.current = 'cocking';
        }
      }

      // หมุนโม่ปืนช้าๆ ตอนเล็ง
      if (cylinderRef.current) {
        cylinderRef.current.rotation.z += dt * 4.5;
      }
    } else if (phase === 'result') {
      // ตำแหน่งฐานตอนเหนี่ยวไก
      if (isSelfTarget) {
        localX = 0.0;
        localY = -0.14;
        localZ = -0.34;
        rotX = 0.22;
        rotY = Math.PI - 0.15;
        rotZ = -0.18;
      } else {
        localX = 0.04;
        localY = -0.12;
        localZ = -0.42;
        rotX = 0.02;
        rotY = 0.0;
        rotZ = 0.0;
      }

      // ทริกเกอร์เอฟเฟกต์ครั้งเดียวตอนเริ่ม phase 'result'
      if (soundPlayedForPhaseRef.current !== 'result') {
        soundPlayedForPhaseRef.current = 'result';
        if (didFire) {
          recoilOffsetRef.current = 0.14;
          recoilPitchRef.current = 0.48;
          screenShakeRef.current = 0.075;
          flashIntensityRef.current = 1.0;
          if (enableSound) playSynthesizedGunSound('fire');
        } else {
          // ยิงไม่ออก ("แชะ") - กระตุกนิดเดียว
          recoilOffsetRef.current = 0.015;
          recoilPitchRef.current = 0.05;
          screenShakeRef.current = 0.008;
          if (enableSound) playSynthesizedGunSound('dry');
        }
      }

      // แจ้ง Callback เมื่อเล่นแอนิเมชันครบ 1.25 วินาที
      if (t >= 1.25 && !finishedTriggeredRef.current && selectedTargetId && didFire !== null) {
        finishedTriggeredRef.current = true;
        onAnimationFinished?.({ targetId: selectedTargetId, fired: didFire });
      }
    }

    // ลดแรงดีดกลับ (Recoil decay)
    recoilOffsetRef.current = THREE.MathUtils.lerp(recoilOffsetRef.current, 0, 1 - Math.exp(-12 * dt));
    recoilPitchRef.current = THREE.MathUtils.lerp(recoilPitchRef.current, 0, 1 - Math.exp(-10 * dt));
    flashIntensityRef.current = THREE.MathUtils.lerp(flashIntensityRef.current, 0, 1 - Math.exp(-28 * dt));

    // นำค่าไปจัดวางตัวโมเดลปืนลูกโม่ด้านใน gunGroup
    const modelRoot = gun.children[0];
    if (modelRoot) {
      tempGunTargetLocal.set(
        localX + swayX,
        localY + swayY,
        localZ + (isSelfTarget ? -recoilOffsetRef.current : recoilOffsetRef.current)
      );
      modelRoot.position.lerp(tempGunTargetLocal, 1 - Math.exp(-16 * dt));

      tempGunEuler.set(rotX + recoilPitchRef.current, rotY, rotZ);
      tempGunQuat.setFromEuler(tempGunEuler);
      modelRoot.quaternion.slerp(tempGunQuat, 1 - Math.exp(-16 * dt));
    }

    // อัปเดตนกสับ (Hammer)
    if (hammerRef.current) {
      hammerRef.current.rotation.x = THREE.MathUtils.lerp(
        hammerRef.current.rotation.x,
        hammerAngle,
        1 - Math.exp(-20 * dt)
      );
    }

    // อัปเดตแสงแฟลชปากกระบอกปืน (Muzzle Flash)
    if (muzzleFlashRef.current) {
      const s = flashIntensityRef.current;
      muzzleFlashRef.current.visible = s > 0.05;
      muzzleFlashRef.current.scale.set(s * 1.2, s * 1.2, s * 1.8);
      muzzleFlashRef.current.rotation.z += dt * 40;
    }
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = flashIntensityRef.current * 8;
    }
  });

  return (
    <group ref={gunGroupRef} visible={false}>
      {/* โมเดลปืนลูกโม่ 3D แบบ Procedural (ไม่ต้องโหลดไฟล์ .glb) */}
      <group position={[0.24, -0.22, -0.46]}>
        {/* ลำกล้องปืน (Barrel) */}
        <mesh position={[0, 0.032, -0.14]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.014, 0.016, 0.22, 16]} />
          <meshStandardMaterial color="#2a2d34" metalness={0.88} roughness={0.25} />
        </mesh>

        {/* รางบนลำกล้อง (Top Rib) */}
        <mesh position={[0, 0.047, -0.14]} castShadow>
          <boxGeometry args={[0.012, 0.008, 0.21]} />
          <meshStandardMaterial color="#1f2228" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* ศูนย์เล็งหน้า (Front Sight) */}
        <mesh position={[0, 0.055, -0.23]}>
          <boxGeometry args={[0.004, 0.01, 0.014]} />
          <meshStandardMaterial color="#e11d48" emissive="#881337" emissiveIntensity={0.6} />
        </mesh>

        {/* โครงปืน (Frame) */}
        <mesh position={[0, 0.018, -0.01]} castShadow>
          <boxGeometry args={[0.032, 0.046, 0.09]} />
          <meshStandardMaterial color="#23262d" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* โม่กระสุน (Cylinder) */}
        <mesh
          ref={cylinderRef}
          position={[0, 0.022, -0.015]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.024, 0.024, 0.055, 12]} />
          <meshStandardMaterial color="#3b404b" metalness={0.92} roughness={0.2} />
        </mesh>

        {/* นกสับ (Hammer) */}
        <mesh ref={hammerRef} position={[0, 0.042, 0.035]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.01, 0.022, 0.016]} />
          <meshStandardMaterial color="#525866" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* ด้ามจับไม้ (Grip) */}
        <mesh position={[0, -0.045, 0.042]} rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.03, 0.095, 0.042]} />
          <meshStandardMaterial color="#4a2511" metalness={0.1} roughness={0.75} />
        </mesh>

        {/* โกร่งไก (Trigger Guard) */}
        <mesh position={[0, -0.012, -0.005]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.016, 0.003, 8, 16]} />
          <meshStandardMaterial color="#23262d" metalness={0.85} roughness={0.3} />
        </mesh>

        {/* เปลวไฟปากกระบอกปืนตอนยิงออก (Muzzle Flash) */}
        <mesh
          ref={muzzleFlashRef}
          position={[0, 0.032, -0.28]}
          rotation={[-Math.PI / 2, 0, 0]}
          visible={false}
        >
          <coneGeometry args={[0.065, 0.18, 8]} />
          <meshBasicMaterial color="#ff9e2c" transparent opacity={0.92} />
        </mesh>
        <pointLight
          ref={muzzleLightRef}
          position={[0, 0.032, -0.3]}
          color="#ff7b00"
          intensity={0}
          distance={4}
        />
      </group>
    </group>
  );
};

export default FirstPersonTurnAction;
