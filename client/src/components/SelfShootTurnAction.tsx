import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RealisticRevolverModel } from './RealisticRevolverModel';
import { revolverSound } from '../utils/revolverSound';

export type SelfShootPhase =
  | 'idle'        // ถือปืนลูกโม่รอตัดสินใจ (มุมมองบุคคลที่ 1)
  | 'spinning'    // หมุนโม่กระสุน
  | 'aiming_self' // หันปากกระบอกปืนเข้าหาตัวเอง
  | 'cocking'     // ง้างนกสับค้างไว้ลุ้น
  | 'result';     // เหนี่ยวไก: ยิงออก (ปัง + ควัน + ฟุบโต๊ะ) หรือ ยิงไม่ออก (แชะ)

export interface SelfShootTurnActionProps {
  /** เปิดมุมมองบุคคลที่ 1 เมื่อเป็นเทิร์นของเรา */
  isMyTurn: boolean;
  /** ตำแหน่งที่นั่งของเรา (0 - 5) */
  mySeatIndex: number;
  /** สถานะแอนิเมชันปัจจุบัน */
  phase: SelfShootPhase;
  /** ผลลัพธ์: true = โดนยิง (ยิงออก), false = รอด (ยิงไม่ออก), null = ยังไม่ลั่นไก */
  didFire: boolean | null;
  /** นัดที่เท่าไหร่แล้ว (1 ถึง totalChambers) ยิ่งสูงยิ่งสั่นและกดดันขึ้น */
  currentChamber: number;
  /** จำนวนช่องโม่ทั้งหมด (ค่าเริ่มต้น 6) */
  totalChambers?: number;
  /** รัศมีที่นั่งรอบโต๊ะ (ปรับให้ตรงกับโต๊ะในฉากได้ ค่าเริ่มต้น 2.35) */
  seatRadius?: number;
  /** ความสูงระดับสายตาตอนนั่ง (ค่าเริ่มต้น 1.42) */
  eyeHeight?: number;
  /** เปิด/ปิดเสียงปืนลูกโม่ทั้งหมด */
  enableSound?: boolean;
  /** เรียกเมื่อแอนิเมชันยิง/แชะจบลง */
  onAnimationFinished?: (result: { fired: boolean }) => void;
}

export function getSeatPosition(
  seatIndex: number,
  radius = 2.35,
  height = 1.42
): THREE.Vector3 {
  const angle = (seatIndex / 6) * Math.PI * 2;
  return new THREE.Vector3(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
}

export const SelfShootTurnAction: React.FC<SelfShootTurnActionProps> = ({
  isMyTurn,
  mySeatIndex,
  phase,
  didFire,
  currentChamber,
  totalChambers = 6,
  seatRadius = 2.35,
  eyeHeight = 1.42,
  enableSound = true,
  onAnimationFinished,
}) => {
  const { camera, controls } = useThree();

  const gunGroupRef = useRef<THREE.Group>(null);
  const cylinderRef = useRef<THREE.Group>(null);
  const hammerRef = useRef<THREE.Group>(null);
  const triggerRef = useRef<THREE.Group>(null);
  const muzzleFlashRef = useRef<THREE.Mesh>(null);
  const muzzleLightRef = useRef<THREE.PointLight>(null);
  const smokeGroupRef = useRef<THREE.Group>(null);

  // เก็บค่ากล้องเดิมตอนมุมมองบุคคลที่ 3
  const savedThirdPersonPos = useRef<THREE.Vector3 | null>(null);
  const savedThirdPersonQuat = useRef<THREE.Quaternion | null>(null);
  const savedFov = useRef<number>(50);
  const wasMyTurnRef = useRef(false);

  // ตัวแปรคุมแอนิเมชันและเอฟเฟกต์
  const phaseTimerRef = useRef(0);
  const heartbeatTimerRef = useRef(0);
  const playedPhaseRef = useRef<string>('');
  const finishedRef = useRef(false);

  const recoilOffsetRef = useRef(0);
  const recoilPitchRef = useRef(0);
  const screenShakeRef = useRef(0);
  const flashIntensityRef = useRef(0);
  const smokeOpacityRef = useRef(0);
  const deathFallProgressRef = useRef(0);

  const dangerRatio = Math.min(1, Math.max(0.15, currentChamber / totalChambers));

  const tempCamPos = useMemo(() => new THREE.Vector3(), []);
  const tempLookTarget = useMemo(() => new THREE.Vector3(), []);
  const tempDummyObj = useMemo(() => new THREE.Object3D(), []);
  const tempGunLocalPos = useMemo(() => new THREE.Vector3(), []);
  const tempGunEuler = useMemo(() => new THREE.Euler(), []);
  const tempGunQuat = useMemo(() => new THREE.Quaternion(), []);

  useEffect(() => {
    phaseTimerRef.current = 0;
    if (phase === 'idle' || phase === 'spinning') {
      finishedRef.current = false;
      playedPhaseRef.current = '';
      deathFallProgressRef.current = 0;
    }
  }, [phase]);

  // สลับเข้า/ออกมุมมองบุคคลที่ 1
  useEffect(() => {
    const orbitCtrl = controls as unknown as { enabled?: boolean } | null;
    const perspCam = camera as THREE.PerspectiveCamera;

    if (isMyTurn && !wasMyTurnRef.current) {
      savedThirdPersonPos.current = camera.position.clone();
      savedThirdPersonQuat.current = camera.quaternion.clone();
      if (perspCam.isPerspectiveCamera) {
        savedFov.current = perspCam.fov;
      }
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
    const perspCam = camera as THREE.PerspectiveCamera;

    // 1. คืนกล้องกลับสู่มุมมองบุคคลที่ 3 เมื่อไม่ใช่เทิร์นของเรา
    if (!isMyTurn) {
      if (savedThirdPersonPos.current && savedThirdPersonQuat.current) {
        camera.position.lerp(savedThirdPersonPos.current, 1 - Math.exp(-6 * dt));
        camera.quaternion.slerp(savedThirdPersonQuat.current, 1 - Math.exp(-6 * dt));
        if (perspCam.isPerspectiveCamera) {
          perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, savedFov.current, 1 - Math.exp(-6 * dt));
          perspCam.updateProjectionMatrix();
        }
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

    // 2. เสียงหัวใจเต้นเร่งจังหวะระหว่างกำลังเล็ง/ง้างนกสับ
    if (enableSound && (phase === 'aiming_self' || phase === 'cocking')) {
      const beatInterval = THREE.MathUtils.lerp(0.85, 0.42, dangerRatio);
      heartbeatTimerRef.current += dt;
      if (heartbeatTimerRef.current >= beatInterval) {
        heartbeatTimerRef.current = 0;
        revolverSound.playHeartbeat(dangerRatio);
      }
    } else {
      heartbeatTimerRef.current = 0;
    }

    // 3. คำนวณตำแหน่งกล้องบุคคลที่ 1 ณ เก้าอี้ของเรา
    const myHeadPos = getSeatPosition(mySeatIndex, seatRadius, eyeHeight);
    tempCamPos.copy(myHeadPos);
    tempLookTarget.set(0, eyeHeight - 0.22, 0);

    // เอฟเฟกต์ FOV Tunnel Vision
    if (perspCam.isPerspectiveCamera) {
      const targetFov =
        phase === 'cocking'
          ? savedFov.current - 9
          : phase === 'aiming_self'
          ? savedFov.current - 4
          : savedFov.current;
      perspCam.fov = THREE.MathUtils.lerp(perspCam.fov, targetFov, 1 - Math.exp(-7 * dt));
      perspCam.updateProjectionMatrix();
    }

    // เอฟเฟกต์กล้องร่วงฟุบลงโต๊ะเมื่อโดนยิง
    if (phase === 'result' && didFire) {
      deathFallProgressRef.current = Math.min(1, deathFallProgressRef.current + dt * 1.4);
      const fallEase = deathFallProgressRef.current * deathFallProgressRef.current;
      tempCamPos.y -= fallEase * 0.58;
      tempLookTarget.y -= fallEase * 0.75;
    }

    // เอฟเฟกต์จอสั่นตอนปืนลั่น
    if (screenShakeRef.current > 0.001) {
      tempCamPos.x += (Math.random() - 0.5) * screenShakeRef.current;
      tempCamPos.y += (Math.random() - 0.5) * screenShakeRef.current;
      tempCamPos.z += (Math.random() - 0.5) * screenShakeRef.current;
      screenShakeRef.current = THREE.MathUtils.lerp(screenShakeRef.current, 0, 1 - Math.exp(-12 * dt));
    }

    camera.position.lerp(tempCamPos, 1 - Math.exp(-9 * dt));
    tempDummyObj.position.copy(camera.position);
    tempDummyObj.lookAt(tempLookTarget);
    if (phase === 'result' && didFire) {
      tempDummyObj.rotateZ(deathFallProgressRef.current * 0.45);
    }
    camera.quaternion.slerp(tempDummyObj.quaternion, 1 - Math.exp(-9 * dt));

    // 4. อัปเดตตำแหน่งและท่าทางของปืนลูกโม่หน้ากล้อง
    const gun = gunGroupRef.current;
    if (!gun) return;
    gun.visible = true;
    gun.position.copy(camera.position);
    gun.quaternion.copy(camera.quaternion);

    phaseTimerRef.current += dt;
    const t = phaseTimerRef.current;

    // ท่าถือปืนลูกโม่ตอนรอตัดสินใจ (โชว์ด้านข้างลำกล้องและโม่กระสุนชัดเจน)
    let localX = 0.19;
    let localY = -0.18;
    let localZ = -0.42;
    let rotX = 0.08;
    let rotY = -0.38;
    let rotZ = 0.06;
    let hammerAngle = 0;
    let triggerAngle = 0;

    // แรงสั่นของมือตามระดับความเสี่ยง
    const tremorAmp =
      (phase === 'aiming_self' || phase === 'cocking' ? 0.0025 : 0.0008) * (0.5 + dangerRatio * 1.8);
    const tremorX = (Math.random() - 0.5) * tremorAmp + Math.sin(elapsed * 2.2) * 0.003;
    const tremorY = (Math.random() - 0.5) * tremorAmp + Math.cos(elapsed * 1.8) * 0.003;

    if (phase === 'spinning') {
      // เอียงโม่ปืนลูกโม่เข้าหาสายตาแล้วปั่นโม่กระสุน
      localX = 0.05;
      localY = -0.13;
      localZ = -0.37;
      rotX = 0.14;
      rotY = -0.82;
      rotZ = -0.35;

      if (cylinderRef.current) {
        // หมุนเร็วตอนแรกแล้วค่อยๆ ชะลอเข้าล็อก
        const spinSpeed = Math.max(3, 28 * Math.exp(-t * 2.2));
        cylinderRef.current.rotation.z += dt * spinSpeed;
      }
      if (enableSound && playedPhaseRef.current !== 'spinning') {
        revolverSound.playSpin();
        playedPhaseRef.current = 'spinning';
      }
    } else if (phase === 'aiming_self' || phase === 'cocking') {
      // หันปากกระบอกปืนลูกโม่เข้าหาตัวเอง (เห็นทั้งรูกลำกล้อง โม่กระสุนทองเหลือง และนกสับ)
      localX = 0.03;
      localY = -0.11;
      localZ = -0.33;
      rotX = 0.22;
      rotY = Math.PI - 0.32;
      rotZ = -0.12;

      if (phase === 'cocking') {
        hammerAngle = -0.62; // ง้างนกสับถอยหลังสุด
        localZ = -0.31;
        if (enableSound && playedPhaseRef.current !== 'cocking') {
          revolverSound.playCock();
          playedPhaseRef.current = 'cocking';
        }
      }
    } else if (phase === 'result') {
      localX = 0.03;
      localY = -0.11;
      localZ = -0.31;
      rotX = 0.22;
      rotY = Math.PI - 0.32;
      rotZ = -0.12;
      hammerAngle = 0.06; // นกสับฟาดลง
      triggerAngle = -0.45; // เหนี่ยวไกปืนเข้าด้านใน

      if (playedPhaseRef.current !== 'result') {
        playedPhaseRef.current = 'result';
        // หมุนโม่เลื่อนไปอีก 1 ช่องตอนเหนี่ยวไก
        if (cylinderRef.current) {
          cylinderRef.current.rotation.z += Math.PI / 3;
        }
        if (didFire) {
          recoilOffsetRef.current = 0.14;
          recoilPitchRef.current = -0.44;
          screenShakeRef.current = 0.095;
          flashIntensityRef.current = 1.0;
          smokeOpacityRef.current = 0.9;
          if (enableSound) revolverSound.playLiveFire();
        } else {
          recoilOffsetRef.current = 0.012;
          recoilPitchRef.current = -0.04;
          screenShakeRef.current = 0.008;
          if (enableSound) revolverSound.playDryFire();
        }
      }

      if (t >= 1.8 && !finishedRef.current && didFire !== null) {
        finishedRef.current = true;
        onAnimationFinished?.({ fired: didFire });
      }
    }

    recoilOffsetRef.current = THREE.MathUtils.lerp(recoilOffsetRef.current, 0, 1 - Math.exp(-12 * dt));
    recoilPitchRef.current = THREE.MathUtils.lerp(recoilPitchRef.current, 0, 1 - Math.exp(-10 * dt));
    flashIntensityRef.current = THREE.MathUtils.lerp(flashIntensityRef.current, 0, 1 - Math.exp(-26 * dt));
    smokeOpacityRef.current = THREE.MathUtils.lerp(smokeOpacityRef.current, 0, 1 - Math.exp(-1.5 * dt));

    const modelRoot = gun.children[0];
    if (modelRoot) {
      tempGunLocalPos.set(
        localX + tremorX,
        localY + tremorY,
        localZ - recoilOffsetRef.current
      );
      modelRoot.position.lerp(tempGunLocalPos, 1 - Math.exp(-16 * dt));

      tempGunEuler.set(rotX + recoilPitchRef.current, rotY, rotZ);
      tempGunQuat.setFromEuler(tempGunEuler);
      modelRoot.quaternion.slerp(tempGunQuat, 1 - Math.exp(-16 * dt));
    }

    if (hammerRef.current) {
      hammerRef.current.rotation.x = THREE.MathUtils.lerp(
        hammerRef.current.rotation.x,
        hammerAngle,
        1 - Math.exp(-25 * dt)
      );
    }

    if (triggerRef.current) {
      triggerRef.current.rotation.x = THREE.MathUtils.lerp(
        triggerRef.current.rotation.x,
        triggerAngle,
        1 - Math.exp(-25 * dt)
      );
    }

    if (muzzleFlashRef.current) {
      const s = flashIntensityRef.current;
      muzzleFlashRef.current.visible = s > 0.05;
      muzzleFlashRef.current.scale.set(s * 1.4, s * 1.4, s * 2.0);
      muzzleFlashRef.current.rotation.z += dt * 45;
    }
    if (muzzleLightRef.current) {
      muzzleLightRef.current.intensity = flashIntensityRef.current * 10;
    }

    if (smokeGroupRef.current) {
      const op = smokeOpacityRef.current;
      smokeGroupRef.current.visible = op > 0.03;
      smokeGroupRef.current.children.forEach((puff, idx) => {
        const mesh = puff as THREE.Mesh;
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = op * (0.55 - idx * 0.11);
        mesh.position.y = 0.035 + (1 - op) * (0.08 + idx * 0.04);
        mesh.position.x = Math.sin(elapsed * 3 + idx) * 0.015;
        const scale = 1 + (1 - op) * (1.5 + idx * 0.5);
        mesh.scale.setScalar(scale);
      });
    }
  });

  return (
    <group ref={gunGroupRef} visible={false}>
      <group position={[0.19, -0.18, -0.42]}>
        <RealisticRevolverModel
          cylinderRef={cylinderRef}
          hammerRef={hammerRef}
          triggerRef={triggerRef}
          muzzleFlashRef={muzzleFlashRef}
          muzzleLightRef={muzzleLightRef}
          smokeGroupRef={smokeGroupRef}
          liveBulletCount={1}
        />
      </group>
    </group>
  );
};

export default SelfShootTurnAction;
