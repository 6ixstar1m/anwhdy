import React, { useMemo } from 'react';
import * as THREE from 'three';

export interface RealisticRevolverModelProps {
  cylinderRef: React.RefObject<THREE.Group | null>;
  hammerRef: React.RefObject<THREE.Group | null>;
  triggerRef: React.RefObject<THREE.Group | null>;
  muzzleFlashRef: React.RefObject<THREE.Mesh | null>;
  muzzleLightRef: React.RefObject<THREE.PointLight | null>;
  smokeGroupRef: React.RefObject<THREE.Group | null>;
  liveBulletCount?: number;
}

/**
 * โมเดลปืนลูกโม่ 3D ทรงสมจริง (.357 Magnum Style)
 * ลำกล้องร่องระบายความร้อน, ก้านคัดปลอก, โม่กระสุน 6 นัดพร้อมปลอกกระสุนทองเหลืองด้านใน,
 * นกสับทรงหงอนไก, ไกปืนเหนี่ยวได้, ด้ามไม้แกะลาย และไฟสะท้อนโลหะปืนเฉพาะตัว
 */
export const RealisticRevolverModel: React.FC<RealisticRevolverModelProps> = ({
  cylinderRef,
  hammerRef,
  triggerRef,
  muzzleFlashRef,
  muzzleLightRef,
  smokeGroupRef,
  liveBulletCount = 1,
}) => {
  const gunmetalMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#9aa4b4',
        metalness: 0.84,
        roughness: 0.22,
      }),
    []
  );

  const darkSteelMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#2d323b',
        metalness: 0.82,
        roughness: 0.34,
      }),
    []
  );

  const woodGripMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#5c2e14',
        metalness: 0.08,
        roughness: 0.65,
      }),
    []
  );

  const brassMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#facc15',
        metalness: 0.9,
        roughness: 0.18,
      }),
    []
  );

  const primerMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#f87171',
        metalness: 0.7,
        roughness: 0.3,
      }),
    []
  );

  const chambers = useMemo(() => {
    const items: Array<{ x: number; y: number; hasLiveRound: boolean }> = [];
    const ringRadius = 0.0155;
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      items.push({
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
        hasLiveRound: i < liveBulletCount,
      });
    }
    return items;
  }, [liveBulletCount]);

  return (
    <group>
      {/* ไฟส่องประกายโลหะปืนเฉพาะตัว (ช่วยให้เห็นปืนลูกโม่ชัดเจนแม้ห้องสอบสวนมืด) */}
      <pointLight position={[0.18, 0.22, 0.18]} intensity={1.6} distance={1.4} color="#f1f5f9" />
      <pointLight position={[-0.18, -0.05, -0.15]} intensity={0.95} distance={1.2} color="#fda4af" />

      {/* 1. ลำกล้องปืนหลัก */}
      <mesh position={[0, 0.036, -0.155]} rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat} castShadow>
        <cylinderGeometry args={[0.0145, 0.016, 0.23, 24]} />
      </mesh>

      {/* ฝักหุ้มก้านคัดปลอกใต้ลำกล้อง */}
      <mesh position={[0, 0.022, -0.145]} rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat} castShadow>
        <cylinderGeometry args={[0.0085, 0.0095, 0.205, 16]} />
      </mesh>

      {/* ก้านคัดปลอกกระสุน */}
      <mesh position={[0, 0.022, -0.252]} rotation={[Math.PI / 2, 0, 0]} material={darkSteelMat}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.025, 12]} />
      </mesh>

      {/* รางบนลำกล้องแบบมีช่องระบายความร้อน */}
      <mesh position={[0, 0.052, -0.15]} material={gunmetalMat} castShadow>
        <boxGeometry args={[0.011, 0.005, 0.22]} />
      </mesh>
      {[-0.075, -0.125, -0.175, -0.225].map((zPos, i) => (
        <mesh key={i} position={[0, 0.0475, zPos]} material={darkSteelMat}>
          <boxGeometry args={[0.009, 0.005, 0.018]} />
        </mesh>
      ))}

      {/* ศูนย์เล็งหน้า */}
      <mesh position={[0, 0.059, -0.245]} material={darkSteelMat}>
        <boxGeometry args={[0.0035, 0.011, 0.018]} />
      </mesh>
      <mesh position={[0, 0.06, -0.237]}>
        <boxGeometry args={[0.0038, 0.007, 0.004]} />
        <meshStandardMaterial color="#f43f5e" emissive="#e11d48" emissiveIntensity={1.2} />
      </mesh>

      {/* ศูนย์เล็งหลัง */}
      <mesh position={[0, 0.053, 0.028]} material={darkSteelMat}>
        <boxGeometry args={[0.018, 0.008, 0.014]} />
      </mesh>

      {/* รูกลวงปากลำกล้องสีดำลึก */}
      <mesh position={[0, 0.036, -0.2705]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.0088, 0.0088, 0.003, 20]} />
        <meshBasicMaterial color="#030303" />
      </mesh>
      <mesh position={[0, 0.036, -0.2702]} material={darkSteelMat}>
        <torusGeometry args={[0.0115, 0.0028, 10, 24]} />
      </mesh>

      {/* 2. โครงปืนหลัก */}
      <mesh position={[0, 0.048, -0.008]} material={gunmetalMat} castShadow>
        <boxGeometry args={[0.024, 0.007, 0.088]} />
      </mesh>
      <mesh position={[0, 0.004, 0.002]} material={gunmetalMat} castShadow>
        <boxGeometry args={[0.028, 0.026, 0.095]} />
      </mesh>
      <mesh position={[0, 0.024, 0.034]} rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat} castShadow>
        <cylinderGeometry args={[0.027, 0.027, 0.014, 24]} />
      </mesh>

      {/* 3. โม่กระสุน 6 นัดหมุนได้จริง + ลูกกระสุนทองเหลืองด้านใน */}
      <group ref={cylinderRef} position={[0, 0.024, -0.008]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={gunmetalMat} castShadow>
          <cylinderGeometry args={[0.0265, 0.0265, 0.056, 24]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={darkSteelMat}>
          <cylinderGeometry args={[0.006, 0.006, 0.062, 12]} />
        </mesh>

        {chambers.map((ch, idx) => (
          <group key={idx} position={[ch.x, ch.y, 0]}>
            <mesh position={[0, 0, -0.0282]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.0052, 0.0052, 0.002, 12]} />
              <meshBasicMaterial color="#09090b" />
            </mesh>

            {ch.hasLiveRound ? (
              <group position={[0, 0, 0.0282]}>
                <mesh rotation={[Math.PI / 2, 0, 0]} material={brassMat}>
                  <cylinderGeometry args={[0.0054, 0.0054, 0.003, 12]} />
                </mesh>
                <mesh position={[0, 0, 0.001]} rotation={[Math.PI / 2, 0, 0]} material={primerMat}>
                  <cylinderGeometry args={[0.0022, 0.0022, 0.002, 10]} />
                </mesh>
              </group>
            ) : (
              <mesh position={[0, 0, 0.0282]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.005, 0.005, 0.002, 12]} />
                <meshBasicMaterial color="#09090b" />
              </mesh>
            )}
          </group>
        ))}
      </group>

      {/* 4. นกสับทรงหงอนไก */}
      <group ref={hammerRef} position={[0, 0.032, 0.042]}>
        <mesh position={[0, 0.012, 0.004]} rotation={[-0.25, 0, 0]} material={darkSteelMat}>
          <boxGeometry args={[0.008, 0.026, 0.014]} />
        </mesh>
        <mesh position={[0, 0.024, 0.012]} rotation={[0.45, 0, 0]} material={gunmetalMat}>
          <boxGeometry args={[0.009, 0.006, 0.014]} />
        </mesh>
      </group>

      {/* 5. โกร่งไกและไกปืน */}
      <mesh position={[0, -0.014, 0.004]} rotation={[0, Math.PI / 2, 0]} material={gunmetalMat}>
        <torusGeometry args={[0.017, 0.003, 10, 20]} />
      </mesh>
      <group ref={triggerRef} position={[0, -0.004, 0.008]}>
        <mesh position={[0, -0.01, -0.003]} rotation={[0.35, 0, 0]} material={darkSteelMat}>
          <boxGeometry args={[0.0045, 0.018, 0.006]} />
        </mesh>
      </group>

      {/* 6. ด้ามจับไม้ */}
      <group position={[0, -0.046, 0.046]} rotation={[0.34, 0, 0]}>
        <mesh material={woodGripMat} castShadow>
          <boxGeometry args={[0.029, 0.098, 0.042]} />
        </mesh>
        <mesh position={[0, -0.048, 0.002]} material={woodGripMat}>
          <boxGeometry args={[0.031, 0.014, 0.046]} />
        </mesh>
        <mesh position={[0, 0.002, 0]} rotation={[0, 0, Math.PI / 2]} material={brassMat}>
          <cylinderGeometry args={[0.0042, 0.0042, 0.031, 12]} />
        </mesh>
      </group>

      {/* 7. แสงแฟลชปากกระบอกปืนตอนยิงออก */}
      <mesh
        ref={muzzleFlashRef}
        position={[0, 0.036, -0.31]}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      >
        <coneGeometry args={[0.085, 0.22, 10]} />
        <meshBasicMaterial color="#ff9e2c" transparent opacity={0.96} />
      </mesh>
      <pointLight
        ref={muzzleLightRef}
        position={[0, 0.036, -0.34]}
        color="#ff6a00"
        intensity={0}
        distance={6}
      />

      {/* 8. ควันลอยออกจากปากกระบอกปืนหลังยิงออก */}
      <group ref={smokeGroupRef} position={[0, 0.036, -0.28]} visible={false}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.018 * i, 0]}>
            <sphereGeometry args={[0.016 + i * 0.006, 8, 8]} />
            <meshBasicMaterial color="#cbd5e1" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

export default RealisticRevolverModel;
