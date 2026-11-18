import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AimTarget, ActiveBuffs, TableOpponent } from '../types/game';

interface InterrogationRoomSceneProps {
  aimTarget: AimTarget;
  selectedOpponentIndex: number;
  canSelectTarget: boolean;
  onSelectOpponentIndex?: (idx: number) => void;
  cylinderSpinTrigger: number;
  fireTrigger: { count: number; isLive: boolean };
  ejectTrigger: { count: number; isLive: boolean };
  playerHearts: number;
  playerBuffs: ActiveBuffs;
  opponents: TableOpponent[];
}

// Seat coordinates around the interrogation table for up to 5 opponents
function getSeatPosition(index: number, total: number): THREE.Vector3 {
  if (total <= 1) return new THREE.Vector3(0, 1.15, -1.45);
  if (total === 2) {
    return index === 0
      ? new THREE.Vector3(-0.78, 1.15, -1.38)
      : new THREE.Vector3(0.78, 1.15, -1.38);
  }
  if (total === 3) {
    const positions = [
      new THREE.Vector3(-1.05, 1.15, -1.25),
      new THREE.Vector3(0, 1.15, -1.48),
      new THREE.Vector3(1.05, 1.15, -1.25),
    ];
    return positions[index] || positions[1];
  }
  const spread = Math.PI * 0.72;
  const startAngle = -spread / 2;
  const step = spread / Math.max(1, total - 1);
  const angle = startAngle + index * step;
  return new THREE.Vector3(Math.sin(angle) * 1.38, 1.15, -Math.cos(angle) * 1.45);
}

export const InterrogationRoomScene: React.FC<InterrogationRoomSceneProps> = ({
  aimTarget,
  selectedOpponentIndex,
  canSelectTarget,
  onSelectOpponentIndex,
  cylinderSpinTrigger,
  fireTrigger,
  ejectTrigger,
  playerHearts,
  playerBuffs,
  opponents,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const aimRef = useRef<AimTarget>(aimTarget);
  aimRef.current = aimTarget;

  const selectedOppIdxRef = useRef<number>(selectedOpponentIndex);
  selectedOppIdxRef.current = selectedOpponentIndex;

  const canSelectRef = useRef<boolean>(canSelectTarget);
  canSelectRef.current = canSelectTarget;

  const onSelectCallbackRef = useRef(onSelectOpponentIndex);
  onSelectCallbackRef.current = onSelectOpponentIndex;

  const opponentsRef = useRef<TableOpponent[]>(opponents);
  opponentsRef.current = opponents;

  const spinVelocityRef = useRef<number>(0);
  const recoilRef = useRef<number>(0);
  const flashIntensityRef = useRef<number>(0);
  const hammerAngleRef = useRef<number>(0);
  const cameraShakeRef = useRef<number>(0);

  const ejectedShellRef = useRef<{
    active: boolean;
    progress: number;
    isLive: boolean;
  }>({ active: false, progress: 0, isLive: false });

  const playerHeartsRef = useRef(playerHearts);
  playerHeartsRef.current = playerHearts;

  const playerBuffsRef = useRef(playerBuffs);
  playerBuffsRef.current = playerBuffs;

  useEffect(() => {
    if (cylinderSpinTrigger > 0) {
      spinVelocityRef.current = 0.55;
    }
  }, [cylinderSpinTrigger]);

  useEffect(() => {
    if (fireTrigger.count > 0) {
      hammerAngleRef.current = 0.65;
      recoilRef.current = fireTrigger.isLive ? 1.0 : 0.25;
      spinVelocityRef.current = 0.22;
      if (fireTrigger.isLive) {
        flashIntensityRef.current = 12;
        cameraShakeRef.current = 0.24;
      } else {
        cameraShakeRef.current = 0.04;
      }
    }
  }, [fireTrigger]);

  useEffect(() => {
    if (ejectTrigger.count > 0) {
      ejectedShellRef.current = {
        active: true,
        progress: 0,
        isLive: ejectTrigger.isLive,
      };
      spinVelocityRef.current = 0.35;
    }
  }, [ejectTrigger]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060608);
    scene.fog = new THREE.FogExp2(0x060608, 0.075);

    const camera = new THREE.PerspectiveCamera(52, width / height, 0.1, 50);
    const baseCamPos = new THREE.Vector3(0, 1.55, 2.35);
    camera.position.copy(baseCamPos);
    camera.lookAt(0, 1.05, -1.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x323848, 1.35);
    scene.add(ambientLight);

    const overheadLight = new THREE.SpotLight(0xffe6b3, 20, 12, Math.PI / 4, 0.55, 1.2);
    overheadLight.position.set(0, 3.6, 0.1);
    overheadLight.castShadow = true;
    scene.add(overheadLight);

    const rimLight = new THREE.PointLight(0xdc2626, 3.0, 8);
    rimLight.position.set(0, 1.8, -2.8);
    scene.add(rimLight);

    const muzzleLight = new THREE.PointLight(0xff9922, 0, 7);
    scene.add(muzzleLight);

    // Interrogation Table
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.14, 2.2),
      new THREE.MeshStandardMaterial({
        color: 0x221a16,
        roughness: 0.75,
        metalness: 0.14,
      })
    );
    table.position.set(0, 0.72, 0.1);
    table.receiveShadow = true;
    scene.add(table);

    // Table Center Runner Line
    const runner = new THREE.Mesh(
      new THREE.PlaneGeometry(3.35, 0.04),
      new THREE.MeshBasicMaterial({ color: 0x5c2424 })
    );
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.792, 0.1);
    scene.add(runner);

    // Build 5 Opponent Seat Slots around the table
    interface SeatRig {
      group: THREE.Group;
      hitBox: THREE.Mesh;
      torsoMat: THREE.MeshStandardMaterial;
      eyeMat: THREE.MeshBasicMaterial;
      smokeCloud: THREE.Mesh;
      shieldDome: THREE.Mesh;
      targetRing: THREE.Mesh;
      heartOrbs: THREE.Mesh[];
    }

    const seatRigs: SeatRig[] = [];
    const clickableMeshes: THREE.Object3D[] = [];

    for (let s = 0; s < 5; s++) {
      const group = new THREE.Group();
      group.visible = false;
      scene.add(group);

      const torsoMat = new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.85 });
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 0.82, 16), torsoMat);
      torso.position.y = -0.1;
      group.add(torso);

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.23, 20, 20),
        new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 })
      );
      head.position.y = 0.5;
      group.add(head);

      const eyeGeo = new THREE.SphereGeometry(0.026, 10, 10);
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
      const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
      leftEye.position.set(-0.072, 0.52, 0.2);
      const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
      rightEye.position.set(0.072, 0.52, 0.2);
      group.add(leftEye, rightEye);

      // Invisible larger hitbox so clicking on an opponent in 3D is effortless
      const hitBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.85, 1.35, 0.75),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      hitBox.position.set(0, 0.2, 0);
      hitBox.userData = { seatIndex: s };
      group.add(hitBox);
      clickableMeshes.push(hitBox);

      // Smoke cloud over Opponent
      const smokeCloud = new THREE.Mesh(
        new THREE.SphereGeometry(0.58, 16, 16),
        new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0,
          roughness: 1,
        })
      );
      smokeCloud.position.set(0, 0.35, 0.1);
      group.add(smokeCloud);

      // Defensive Shield Dome over Opponent
      const shieldDome = new THREE.Mesh(
        new THREE.SphereGeometry(0.58, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0xa855f7,
          wireframe: true,
          transparent: true,
          opacity: 0,
        })
      );
      shieldDome.position.set(0, -0.25, 0.15);
      group.add(shieldDome);

      // Target Reticle Ring on table in front of selected opponent
      const targetRing = new THREE.Mesh(
        new THREE.RingGeometry(0.24, 0.29, 28),
        new THREE.MeshBasicMaterial({
          color: 0xef4444,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0,
        })
      );
      targetRing.rotation.x = -Math.PI / 2;
      targetRing.position.set(0, -0.354, 0.55);
      group.add(targetRing);

      // 3 Heart Orbs on table in front of this opponent
      const heartOrbs: THREE.Mesh[] = [];
      for (let h = 0; h < 3; h++) {
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.048, 1),
          new THREE.MeshStandardMaterial({
            color: 0xef4444,
            emissive: 0xdc2626,
            emissiveIntensity: 0.9,
            roughness: 0.2,
          })
        );
        orb.position.set((h - 1) * 0.13, -0.29, 0.55);
        group.add(orb);
        heartOrbs.push(orb);
      }

      seatRigs.push({
        group,
        hitBox,
        torsoMat,
        eyeMat,
        smokeCloud,
        shieldDome,
        targetRing,
        heartOrbs,
      });
    }

    // Player 3 Heart Orbs on bottom-left of table
    const playerOrbs: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.055, 1),
        new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xdc2626,
          emissiveIntensity: 0.9,
          roughness: 0.2,
        })
      );
      orb.position.set(-0.95 + (i - 1) * 0.16, 0.86, 0.72);
      scene.add(orb);
      playerOrbs.push(orb);
    }

    // Player Defensive Shield Dome
    const playerShieldDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        wireframe: true,
        transparent: true,
        opacity: 0,
      })
    );
    playerShieldDome.position.set(0, 0.85, 1.55);
    scene.add(playerShieldDome);

    // 3D Revolver (Barrel points along -Z in local space)
    const gunGroup = new THREE.Group();
    gunGroup.position.set(0, 0.92, 0.45);
    scene.add(gunGroup);

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.85,
      roughness: 0.22,
    });
    const darkSteelMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      metalness: 0.8,
      roughness: 0.35,
    });
    const woodGripMat = new THREE.MeshStandardMaterial({
      color: 0x5c2d16,
      roughness: 0.7,
    });

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.036, 0.04, 0.52, 16),
      steelMat
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, -0.32);
    gunGroup.add(barrel);

    const underlug = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.036, 0.46),
      darkSteelMat
    );
    underlug.position.set(0, 0.048, -0.3);
    gunGroup.add(underlug);

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.068, 0.11, 0.24),
      steelMat
    );
    frame.position.set(0, 0.065, 0.02);
    gunGroup.add(frame);

    const cylinderGroup = new THREE.Group();
    cylinderGroup.position.set(0, 0.062, 0.01);
    gunGroup.add(cylinderGroup);

    const cylinderBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.072, 0.16, 20),
      darkSteelMat
    );
    cylinderBody.rotation.x = Math.PI / 2;
    cylinderGroup.add(cylinderBody);

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.85,
      roughness: 0.25,
    });
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.165, 10),
        brassMat
      );
      rim.rotation.x = Math.PI / 2;
      rim.position.set(Math.cos(angle) * 0.04, Math.sin(angle) * 0.04, 0);
      cylinderGroup.add(rim);
    }

    const hammer = new THREE.Mesh(
      new THREE.BoxGeometry(0.022, 0.055, 0.045),
      steelMat
    );
    hammer.position.set(0, 0.11, 0.14);
    gunGroup.add(hammer);

    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.058, 0.24, 0.11),
      woodGripMat
    );
    grip.position.set(0, -0.06, 0.16);
    grip.rotation.x = 0.28;
    gunGroup.add(grip);

    const flashMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.14, 0),
      new THREE.MeshBasicMaterial({
        color: 0xffaa33,
        transparent: true,
        opacity: 0,
      })
    );
    flashMesh.position.set(0, 0.08, -0.62);
    gunGroup.add(flashMesh);

    const ejectedShell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.018, 0.075, 12),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x7f1d1d,
        metalness: 0.5,
      })
    );
    ejectedShell.visible = false;
    scene.add(ejectedShell);

    // Raycaster so clicking on any 3D opponent directly selects them as target!
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const handlePointerDown = (ev: PointerEvent) => {
      if (!canSelectRef.current || !onSelectCallbackRef.current) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const visibleHitboxes = seatRigs
        .filter((r) => r.group.visible)
        .map((r) => r.hitBox);
      const hits = raycaster.intersectObjects(visibleHitboxes, false);
      if (hits.length > 0) {
        const seatIndex = hits[0].object.userData.seatIndex as number;
        const opp = opponentsRef.current[seatIndex];
        if (opp && opp.hearts > 0) {
          onSelectCallbackRef.current(seatIndex);
        }
      }
    };
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      overheadLight.intensity = 19.5 + Math.sin(elapsed * 9) * 0.4 + Math.cos(elapsed * 23) * 0.25;

      const opps = opponentsRef.current;
      const totalOpps = Math.min(5, opps.length);

      // Update each opponent seat rig
      seatRigs.forEach((rig, idx) => {
        if (idx >= totalOpps) {
          rig.group.visible = false;
          return;
        }
        const opp = opps[idx];
        rig.group.visible = true;

        const baseSeat = getSeatPosition(idx, totalOpps);
        rig.group.position.set(
          baseSeat.x,
          baseSeat.y + Math.sin(elapsed * 1.8 + idx) * 0.016,
          baseSeat.z
        );
        // Face slightly toward table center
        rig.group.lookAt(0, 1.15, 0.6);

        rig.torsoMat.color.set(opp.avatar?.coatColor || '#121218');
        rig.eyeMat.color.set(opp.avatar?.eyeColor || '#ef4444');

        // Smoke cloud
        const smokeMat = rig.smokeCloud.material as THREE.MeshStandardMaterial;
        smokeMat.opacity = THREE.MathUtils.lerp(
          smokeMat.opacity,
          opp.buffs.smokedTurns > 0 ? 0.68 : 0,
          0.08
        );
        rig.smokeCloud.rotation.y += dt * 0.7;

        // Defensive shield dome
        const hasShield =
          opp.buffs.kevlar || opp.buffs.ricochet || opp.buffs.visor || opp.buffs.charm;
        const shieldMat = rig.shieldDome.material as THREE.MeshBasicMaterial;
        shieldMat.opacity = THREE.MathUtils.lerp(shieldMat.opacity, hasShield ? 0.32 : 0, 0.1);
        if (opp.buffs.ricochet) shieldMat.color.setHex(0xa855f7);
        else if (opp.buffs.visor) shieldMat.color.setHex(0x06b6d4);
        else if (opp.buffs.charm) shieldMat.color.setHex(0xf59e0b);
        else shieldMat.color.setHex(0x3b82f6);
        rig.shieldDome.rotation.y -= dt * 0.45;

        // Target reticle ring under selected opponent
        const isSelected = idx === selectedOppIdxRef.current && opp.hearts > 0;
        const ringMat = rig.targetRing.material as THREE.MeshBasicMaterial;
        ringMat.opacity = THREE.MathUtils.lerp(
          ringMat.opacity,
          isSelected ? 0.75 + Math.sin(elapsed * 6) * 0.2 : 0,
          0.15
        );

        // Hearts
        rig.heartOrbs.forEach((orb, hIdx) => {
          const alive = hIdx < opp.hearts;
          orb.visible = alive;
          if (alive) {
            orb.rotation.y -= dt * 1.8;
            orb.position.y = -0.29 + Math.sin(elapsed * 3 + hIdx) * 0.01;
          }
        });
      });

      // Player Hearts & Shield
      playerOrbs.forEach((orb, idx) => {
        const alive = idx < playerHeartsRef.current;
        orb.visible = alive;
        if (alive) {
          orb.rotation.y += dt * 1.8;
          orb.position.y = 0.86 + Math.sin(elapsed * 3 + idx) * 0.012;
        }
      });

      const pBuff = playerBuffsRef.current;
      const pHasShield = pBuff.kevlar || pBuff.ricochet || pBuff.visor || pBuff.charm;
      const pShieldMat = playerShieldDome.material as THREE.MeshBasicMaterial;
      pShieldMat.opacity = THREE.MathUtils.lerp(pShieldMat.opacity, pHasShield ? 0.28 : 0, 0.1);
      if (pBuff.ricochet) pShieldMat.color.setHex(0xa855f7);
      else if (pBuff.visor) pShieldMat.color.setHex(0x06b6d4);
      else if (pBuff.charm) pShieldMat.color.setHex(0xf59e0b);
      else pShieldMat.color.setHex(0x3b82f6);
      playerShieldDome.rotation.y += dt * 0.4;

      // ========================================================
      // GUN ROTATION & AIMING TOWARD SELECTED TARGET OR SELF
      // ========================================================
      const targetPos = new THREE.Vector3(0, 0.86, 0.42);
      const targetRot = new THREE.Euler(0, 0, 0);

      if (aimRef.current === 'self') {
        // Point barrel directly at player (camera)
        targetPos.set(0, 1.32, 1.15);
        targetRot.set(-0.22, Math.PI, 0);
      } else if (typeof aimRef.current === 'number') {
        // Rotate gun horizontally & vertically straight toward that opponent's seat!
        const seatIdx = Math.max(0, Math.min(totalOpps - 1, aimRef.current));
        const seatPos = getSeatPosition(seatIdx, totalOpps);
        const yawAngle = Math.atan2(-seatPos.x, -seatPos.z + 0.85);
        targetPos.set(seatPos.x * 0.24, 1.24, 0.82);
        targetRot.set(0.05, yawAngle, 0);
      } else {
        // Idle on table
        targetPos.set(0, 0.84 + Math.sin(elapsed * 1.5) * 0.006, 0.35);
        targetRot.set(0, 0.38, Math.PI / 2 - 0.12);
      }

      // Apply Recoil
      if (recoilRef.current > 0.001) {
        targetRot.x += recoilRef.current * 0.42;
        targetPos.z += recoilRef.current * 0.12;
        recoilRef.current = THREE.MathUtils.lerp(recoilRef.current, 0, 0.14);
      }

      gunGroup.position.lerp(targetPos, 0.16);
      gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetRot.x, 0.16);
      gunGroup.rotation.y = THREE.MathUtils.lerp(gunGroup.rotation.y, targetRot.y, 0.16);
      gunGroup.rotation.z = THREE.MathUtils.lerp(gunGroup.rotation.z, targetRot.z, 0.16);

      if (spinVelocityRef.current > 0.001) {
        cylinderGroup.rotation.z += spinVelocityRef.current;
        spinVelocityRef.current *= 0.94;
      }

      hammer.rotation.x = -hammerAngleRef.current;
      hammerAngleRef.current = THREE.MathUtils.lerp(hammerAngleRef.current, 0, 0.18);

      if (flashIntensityRef.current > 0.05) {
        muzzleLight.position.copy(gunGroup.position);
        muzzleLight.intensity = flashIntensityRef.current;
        (flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(
          1,
          flashIntensityRef.current / 6
        );
        flashMesh.rotation.z += 0.6;
        flashIntensityRef.current *= 0.65;
      } else {
        muzzleLight.intensity = 0;
        (flashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }

      if (ejectedShellRef.current.active) {
        ejectedShellRef.current.progress += dt * 1.9;
        const p = ejectedShellRef.current.progress;
        ejectedShell.visible = true;
        const shellMat = ejectedShell.material as THREE.MeshStandardMaterial;
        shellMat.color.setHex(ejectedShellRef.current.isLive ? 0xdc2626 : 0x3b82f6);
        ejectedShell.position.set(
          gunGroup.position.x + p * 0.75,
          gunGroup.position.y + 0.12 + Math.sin(p * Math.PI) * 0.35 - p * 0.25,
          gunGroup.position.z
        );
        ejectedShell.rotation.x += dt * 14;
        ejectedShell.rotation.z += dt * 10;
        if (p >= 1) {
          ejectedShellRef.current.active = false;
          ejectedShell.visible = false;
        }
      }

      if (cameraShakeRef.current > 0.002) {
        camera.position.set(
          baseCamPos.x + (Math.random() - 0.5) * cameraShakeRef.current,
          baseCamPos.y + (Math.random() - 0.5) * cameraShakeRef.current,
          baseCamPos.z
        );
        cameraShakeRef.current *= 0.85;
      } else {
        camera.position.lerp(baseCamPos, 0.2);
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: 0 }}
    />
  );
};
