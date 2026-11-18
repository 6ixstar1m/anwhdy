import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AimTarget, ActiveBuffs } from '../types/game';

interface RevolverSceneProps {
  aimTarget: AimTarget;
  cylinderSpinTrigger: number;
  fireTrigger: { count: number; isLive: boolean; shooter: 'player' | 'dealer' };
  ejectTrigger: { count: number; isLive: boolean };
  playerHearts: number;
  dealerHearts: number;
  playerBuffs: ActiveBuffs;
  dealerBuffs: ActiveBuffs;
  dealerSmoked: boolean;
}

export const RevolverScene: React.FC<RevolverSceneProps> = ({
  aimTarget,
  cylinderSpinTrigger,
  fireTrigger,
  ejectTrigger,
  playerHearts,
  dealerHearts,
  playerBuffs,
  dealerBuffs,
  dealerSmoked,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  const aimRef = useRef<AimTarget>(aimTarget);
  aimRef.current = aimTarget;

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

  const dealerHeartsRef = useRef(dealerHearts);
  dealerHeartsRef.current = dealerHearts;

  const playerBuffsRef = useRef(playerBuffs);
  playerBuffsRef.current = playerBuffs;

  const dealerBuffsRef = useRef(dealerBuffs);
  dealerBuffsRef.current = dealerBuffs;

  const dealerSmokedRef = useRef(dealerSmoked);
  dealerSmokedRef.current = dealerSmoked;

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
    const tableGeo = new THREE.BoxGeometry(3.4, 0.14, 2.2);
    const tableMat = new THREE.MeshStandardMaterial({
      color: 0x221a16,
      roughness: 0.75,
      metalness: 0.14,
    });
    const table = new THREE.Mesh(tableGeo, tableMat);
    table.position.set(0, 0.72, 0.1);
    table.receiveShadow = true;
    scene.add(table);

    // Table Center Runner Line
    const runnerGeo = new THREE.PlaneGeometry(3.35, 0.04);
    const runnerMat = new THREE.MeshBasicMaterial({ color: 0x5c2424 });
    const runner = new THREE.Mesh(runnerGeo, runnerMat);
    runner.rotation.x = -Math.PI / 2;
    runner.position.set(0, 0.792, 0.1);
    scene.add(runner);

    // Hanging Lamp Shade
    const lampCord = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 1.4, 8),
      new THREE.MeshBasicMaterial({ color: 0x18181b })
    );
    lampCord.position.set(0, 4.1, 0.1);
    scene.add(lampCord);

    const lampShade = new THREE.Mesh(
      new THREE.ConeGeometry(0.32, 0.22, 16, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x27272a,
        side: THREE.DoubleSide,
        metalness: 0.6,
        roughness: 0.3,
      })
    );
    lampShade.position.set(0, 3.35, 0.1);
    scene.add(lampShade);

    // Dealer Figure across the table
    const dealerGroup = new THREE.Group();
    dealerGroup.position.set(0, 1.15, -1.45);
    scene.add(dealerGroup);

    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.44, 0.85, 16),
      new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.85 })
    );
    torso.position.y = -0.1;
    dealerGroup.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 20, 20),
      new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 })
    );
    head.position.y = 0.52;
    dealerGroup.add(head);

    const eyeGeo = new THREE.SphereGeometry(0.028, 10, 10);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.075, 0.54, 0.21);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.075, 0.54, 0.21);
    dealerGroup.add(leftEye, rightEye);

    // Smoke cloud over Dealer
    const smokeCloud = new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 16, 16),
      new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0,
        roughness: 1,
      })
    );
    smokeCloud.position.set(0, 0.35, 0.1);
    dealerGroup.add(smokeCloud);

    // 3D Heart Orbs on the table
    const createHeartOrbs = (xPos: number, zPos: number) => {
      const orbs: THREE.Mesh[] = [];
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
        orb.position.set(xPos + (i - 1) * 0.16, 0.86, zPos);
        scene.add(orb);
        orbs.push(orb);
      }
      return orbs;
    };

    const playerOrbs = createHeartOrbs(-0.95, 0.72);
    const dealerOrbs = createHeartOrbs(0.95, -0.52);

    // Energy Shield Domes
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

    const dealerShieldDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        wireframe: true,
        transparent: true,
        opacity: 0,
      })
    );
    dealerShieldDome.position.set(0, 0.85, -1.35);
    scene.add(dealerShieldDome);

    // 3D Revolver
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

    let frameId = 0;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      overheadLight.intensity = 19.5 + Math.sin(elapsed * 9) * 0.4 + Math.cos(elapsed * 23) * 0.25;

      dealerGroup.position.y = 1.15 + Math.sin(elapsed * 1.8) * 0.018;
      const smokeMat = smokeCloud.material as THREE.MeshStandardMaterial;
      smokeMat.opacity = THREE.MathUtils.lerp(
        smokeMat.opacity,
        dealerSmokedRef.current ? 0.68 : 0,
        0.08
      );
      smokeCloud.rotation.y += dt * 0.7;

      playerOrbs.forEach((orb, idx) => {
        const alive = idx < playerHeartsRef.current;
        orb.visible = alive;
        if (alive) {
          orb.rotation.y += dt * 1.8;
          orb.position.y = 0.86 + Math.sin(elapsed * 3 + idx) * 0.012;
        }
      });

      dealerOrbs.forEach((orb, idx) => {
        const alive = idx < dealerHeartsRef.current;
        orb.visible = alive;
        if (alive) {
          orb.rotation.y -= dt * 1.8;
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

      const dBuff = dealerBuffsRef.current;
      const dHasShield = dBuff.kevlar || dBuff.ricochet || dBuff.visor || dBuff.charm;
      const dShieldMat = dealerShieldDome.material as THREE.MeshBasicMaterial;
      dShieldMat.opacity = THREE.MathUtils.lerp(dShieldMat.opacity, dHasShield ? 0.28 : 0, 0.1);
      dealerShieldDome.rotation.y -= dt * 0.4;

      const targetPos = new THREE.Vector3(0, 0.86, 0.42);
      const targetRot = new THREE.Euler(0, 0, 0);

      if (aimRef.current === 'dealer') {
        targetPos.set(0.18, 1.24, 0.85);
        targetRot.set(0.04, 0.08, 0);
      } else if (aimRef.current === 'player') {
        targetPos.set(0, 1.32, 1.15);
        targetRot.set(-0.22, Math.PI, 0);
      } else {
        targetPos.set(0, 0.84 + Math.sin(elapsed * 1.5) * 0.006, 0.35);
        targetRot.set(0, 0.38, Math.PI / 2 - 0.12);
      }

      if (recoilRef.current > 0.001) {
        targetRot.x += recoilRef.current * 0.42;
        targetPos.z += recoilRef.current * 0.12;
        recoilRef.current = THREE.MathUtils.lerp(recoilRef.current, 0, 0.14);
      }

      gunGroup.position.lerp(targetPos, 0.14);
      gunGroup.rotation.x = THREE.MathUtils.lerp(gunGroup.rotation.x, targetRot.x, 0.14);
      gunGroup.rotation.y = THREE.MathUtils.lerp(gunGroup.rotation.y, targetRot.y, 0.14);
      gunGroup.rotation.z = THREE.MathUtils.lerp(gunGroup.rotation.z, targetRot.z, 0.14);

      if (spinVelocityRef.current > 0.001) {
        cylinderGroup.rotation.z += spinVelocityRef.current;
        spinVelocityRef.current *= 0.94;
      }

      hammer.rotation.x = -hammerAngleRef.current;
      hammerAngleRef.current = THREE.MathUtils.lerp(hammerAngleRef.current, 0, 0.18);

      if (flashIntensityRef.current > 0.05) {
        muzzleLight.position.copy(gunGroup.position);
        muzzleLight.intensity = flashIntensityRef.current;
        (flashMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, flashIntensityRef.current / 6);
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
