import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  CHAIR_DISTANCE,
  SEAT_ANGLES_RAD,
  type AvatarConfig,
  type PlayerState,
} from '@last-round/shared';
import { useRef } from 'react';
import * as THREE from 'three';

interface PlayerAvatarProps {
  player?: PlayerState;
  avatarOverride?: AvatarConfig;
  seatIndex: number;
  isCurrentTurn?: boolean;
  isPreview?: boolean;
  eventOutcome?: 'SAFE' | 'ELIMINATED' | 'PASSED' | null;
}

/**
 * Articulated 3D human character seated around the interrogation table
 * (or standing/rotating in the Avatar Customization preview).
 * Supports procedural breathing, idle head look-around, active-turn leaning,
 * and elimination reaction animations.
 */
export function PlayerAvatar({
  player,
  avatarOverride,
  seatIndex,
  isCurrentTurn = false,
  isPreview = false,
  eventOutcome = null,
}: PlayerAvatarProps) {
  const avatar = avatarOverride ?? player?.avatar;
  const rootRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);

  const angle = SEAT_ANGLES_RAD[seatIndex % SEAT_ANGLES_RAD.length] ?? 0;
  const posX = isPreview ? 0 : Math.sin(angle) * CHAIR_DISTANCE;
  const posZ = isPreview ? 0 : Math.cos(angle) * CHAIR_DISTANCE;
  const rotY = isPreview ? 0 : angle + Math.PI;

  const isAlive = player ? player.isAlive : true;
  const isFeminine = avatar?.bodyType === 'feminine';
  const shoulderWidth = isFeminine ? 0.36 : 0.44;
  const torsoWidth = isFeminine ? 0.28 : 0.34;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (isPreview && rootRef.current) {
      rootRef.current.rotation.y = Math.sin(t * 0.45) * 0.45;
    }

    if (torsoRef.current) {
      // Subtle breathing
      const breath = Math.sin(t * 2.1 + seatIndex) * 0.012;
      torsoRef.current.position.y = 0.88 + breath;

      // Lean forward on active turn, slump if eliminated
      const targetPitch = !isAlive
        ? 0.48
        : isCurrentTurn
          ? 0.14 + Math.sin(t * 6) * (eventOutcome ? 0.02 : 0)
          : 0.02;

      torsoRef.current.rotation.x = THREE.MathUtils.lerp(
        torsoRef.current.rotation.x,
        targetPitch,
        0.08
      );
    }

    if (headRef.current) {
      if (!isAlive) {
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, 0.45, 0.08);
        headRef.current.rotation.z = THREE.MathUtils.lerp(headRef.current.rotation.z, 0.22, 0.08);
      } else {
        const lookYaw = Math.sin(t * 0.7 + seatIndex * 1.7) * 0.16;
        const lookPitch = isCurrentTurn ? -0.06 : Math.cos(t * 0.5 + seatIndex) * 0.05;
        headRef.current.rotation.y = THREE.MathUtils.lerp(headRef.current.rotation.y, lookYaw, 0.06);
        headRef.current.rotation.x = THREE.MathUtils.lerp(headRef.current.rotation.x, lookPitch, 0.06);
      }
    }
  });

  if (!avatar) return null;

  return (
    <group ref={rootRef} position={[posX, isPreview ? -0.85 : 0, posZ]} rotation={[0, rotY, 0]}>
      {/* Seated Legs */}
      <group position={[0, 0.48, 0.12]}>
        <mesh position={[-0.1, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.34, 6, 12]} />
          <meshStandardMaterial color="#141518" roughness={0.85} />
        </mesh>
        <mesh position={[0.1, 0, 0.16]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.34, 6, 12]} />
          <meshStandardMaterial color="#141518" roughness={0.85} />
        </mesh>
        {/* Lower shins */}
        <mesh position={[-0.1, -0.22, 0.34]} castShadow>
          <capsuleGeometry args={[0.055, 0.36, 6, 12]} />
          <meshStandardMaterial color="#141518" roughness={0.85} />
        </mesh>
        <mesh position={[0.1, -0.22, 0.34]} castShadow>
          <capsuleGeometry args={[0.055, 0.36, 6, 12]} />
          <meshStandardMaterial color="#141518" roughness={0.85} />
        </mesh>
      </group>

      {/* Upper Torso & Arms */}
      <group ref={torsoRef} position={[0, 0.88, 0]}>
        <mesh castShadow>
          <boxGeometry args={[torsoWidth, 0.48, 0.22]} />
          <meshStandardMaterial
            color={avatar.outfitColor}
            roughness={avatar.outfit === 'leather_jacket' ? 0.35 : 0.78}
            metalness={avatar.outfit === 'leather_jacket' ? 0.2 : 0.05}
          />
        </mesh>

        {/* Collar / Turtleneck detail */}
        <mesh position={[0, 0.26, 0]} castShadow>
          <cylinderGeometry args={[0.068, 0.078, 0.12, 16]} />
          <meshStandardMaterial
            color={avatar.outfit === 'turtleneck' ? avatar.outfitColor : avatar.skinTone}
            roughness={0.65}
          />
        </mesh>

        {/* Left & Right Arms resting forward toward table */}
        <mesh
          position={[-shoulderWidth * 0.56, 0.02, 0.14]}
          rotation={[0.68, 0, 0.12]}
          castShadow
        >
          <capsuleGeometry args={[0.052, 0.38, 6, 12]} />
          <meshStandardMaterial color={avatar.outfitColor} roughness={0.75} />
        </mesh>
        <mesh
          position={[shoulderWidth * 0.56, 0.02, 0.14]}
          rotation={[0.68, 0, -0.12]}
          castShadow
        >
          <capsuleGeometry args={[0.052, 0.38, 6, 12]} />
          <meshStandardMaterial color={avatar.outfitColor} roughness={0.75} />
        </mesh>

        {/* Hands */}
        <mesh position={[-shoulderWidth * 0.48, -0.12, 0.32]} castShadow>
          <sphereGeometry args={[0.048, 12, 12]} />
          <meshStandardMaterial color={avatar.skinTone} roughness={0.6} />
        </mesh>
        <mesh position={[shoulderWidth * 0.48, -0.12, 0.32]} castShadow>
          <sphereGeometry args={[0.048, 12, 12]} />
          <meshStandardMaterial color={avatar.skinTone} roughness={0.6} />
        </mesh>

        {/* Watch Accessory */}
        {avatar.accessory === 'watch' && (
          <mesh position={[-shoulderWidth * 0.5, -0.09, 0.27]}>
            <torusGeometry args={[0.048, 0.012, 8, 16]} />
            <meshStandardMaterial color="#c8b07a" metalness={0.85} roughness={0.2} />
          </mesh>
        )}

        {/* Head & Hair */}
        <group ref={headRef} position={[0, 0.43, 0.02]}>
          <mesh castShadow>
            <sphereGeometry args={[0.135, 24, 24]} />
            <meshStandardMaterial color={avatar.skinTone} roughness={0.58} />
          </mesh>

          {/* Eyes */}
          <mesh position={[-0.045, 0.02, 0.12]}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <meshStandardMaterial color="#101012" roughness={0.2} />
          </mesh>
          <mesh position={[0.045, 0.02, 0.12]}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <meshStandardMaterial color="#101012" roughness={0.2} />
          </mesh>

          {/* Glasses Accessory */}
          {avatar.accessory === 'glasses' && (
            <group position={[0, 0.02, 0.132]}>
              <mesh position={[-0.046, 0, 0]}>
                <torusGeometry args={[0.028, 0.004, 8, 20]} />
                <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0.046, 0, 0]}>
                <torusGeometry args={[0.028, 0.004, 8, 20]} />
                <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.036, 0.004, 0.004]} />
                <meshStandardMaterial color="#d4d4d8" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          )}

          {/* Earpiece Accessory */}
          {avatar.accessory === 'earpiece' && (
            <mesh position={[0.136, -0.01, 0]}>
              <boxGeometry args={[0.018, 0.04, 0.024]} />
              <meshStandardMaterial
                color="#b83346"
                emissive="#b83346"
                emissiveIntensity={0.6}
              />
            </mesh>
          )}

          {/* Hair Styles */}
          {avatar.hairStyle !== 'buzz' && (
            <mesh position={[0, 0.045, -0.015]} castShadow>
              <sphereGeometry args={[0.142, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
              <meshStandardMaterial color={avatar.hairColor} roughness={0.82} />
            </mesh>
          )}
          {avatar.hairStyle === 'ponytail' && (
            <mesh position={[0, 0.02, -0.15]} rotation={[0.45, 0, 0]} castShadow>
              <capsuleGeometry args={[0.038, 0.16, 6, 12]} />
              <meshStandardMaterial color={avatar.hairColor} roughness={0.82} />
            </mesh>
          )}
          {(avatar.hairStyle === 'bob' || avatar.hairStyle === 'waves') && (
            <mesh position={[0, -0.02, -0.03]} castShadow>
              <cylinderGeometry args={[0.145, 0.155, 0.18, 20]} />
              <meshStandardMaterial color={avatar.hairColor} roughness={0.82} />
            </mesh>
          )}
        </group>
      </group>

      {/* Active Turn Overhead Highlight Ring */}
      {isCurrentTurn && !isPreview && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.52, 0.6, 32]} />
          <meshBasicMaterial color="#b83346" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Diegetic Player Nameplate */}
      {player && !isPreview && (
        <Html position={[0, 1.65, 0]} center distanceFactor={7}>
          <div
            className={`pointer-events-none flex flex-col items-center whitespace-nowrap rounded-md border px-2.5 py-1 text-xs backdrop-blur-md transition-all ${
              !player.isAlive
                ? 'border-zinc-800/70 bg-black/70 text-zinc-500 line-through'
                : isCurrentTurn
                  ? 'border-[#b83346] bg-[#1a0d10]/90 text-white shadow-[0_0_15px_rgba(184,51,70,0.45)]'
                  : 'border-zinc-800/80 bg-[#121317]/85 text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold">
              {player.isSpeaking && (
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              )}
              <span>{player.displayName}</span>
              {player.isHost && (
                <span className="rounded bg-[#8b2635]/40 px-1 py-0.2 font-mono text-[10px] text-[#e06c7d]">
                  HOST
                </span>
              )}
            </div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              {!player.isAlive
                ? 'ELIMINATED'
                : player.connectionStatus === 'RECONNECTING'
                  ? 'RECONNECTING...'
                  : isCurrentTurn
                    ? 'ACTIVE TURN'
                    : player.isReady
                      ? 'READY'
                      : 'WAITING'}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
