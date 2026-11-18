import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import {
  HAIR_COLOR_PRESETS,
  OUTFIT_COLOR_PRESETS,
  SKIN_TONE_PRESETS,
  type AvatarConfig,
} from '@last-round/shared';
import { ArrowLeft, Check } from 'lucide-react';
import { useState } from 'react';
import { PlayerAvatar } from '../../characters/PlayerAvatar';
import { useGameStore } from '../../stores/useGameStore';

export function AvatarCustomizationScreen() {
  const savedAvatar = useGameStore((s) => s.avatar);
  const room = useGameStore((s) => s.room);
  const updateAvatar = useGameStore((s) => s.updateAvatar);
  const setScreen = useGameStore((s) => s.setScreen);

  const [draft, setDraft] = useState<AvatarConfig>(savedAvatar);

  const handleSave = () => {
    updateAvatar(draft);
    setScreen(room ? 'LOBBY' : 'MENU');
  };

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-[#0a0a0c] md:flex-row">
      {/* 3D Interactive Character Preview */}
      <div className="relative h-1/2 w-full md:h-full md:w-3/5">
        <div className="absolute left-6 top-6 z-10">
          <button
            type="button"
            onClick={() => setScreen(room ? 'LOBBY' : 'MENU')}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/90 px-4 py-2 text-xs font-medium text-zinc-200 backdrop-blur-md hover:border-[#8b2635]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back</span>
          </button>
        </div>

        <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2 rounded-full border border-zinc-800/80 bg-black/60 px-4 py-1 font-mono text-[11px] text-zinc-400">
          DRAG TO ROTATE • SCROLL TO ZOOM
        </div>

        <Canvas shadows camera={{ position: [0, 0.55, 2.35], fov: 40 }}>
          <color attach="background" args={['#09090b']} />
          <ambientLight intensity={0.45} />
          <spotLight position={[2, 4, 3]} intensity={25} angle={0.5} penumbra={0.8} castShadow />
          <pointLight position={[-2, 1, -2]} intensity={3} color="#8b2635" />
          <Environment preset="night" />
          <PlayerAvatar avatarOverride={draft} seatIndex={0} isPreview />
          <ContactShadows position={[0, -0.85, 0]} opacity={0.6} scale={4} blur={2} />
          <OrbitControls
            enablePan={false}
            minDistance={1.4}
            maxDistance={3.4}
            target={[0, 0.1, 0]}
          />
        </Canvas>
      </div>

      {/* Right Customization Controls Panel */}
      <div className="flex h-1/2 w-full flex-col justify-between overflow-y-auto border-t border-zinc-800/80 bg-[#121317] p-6 md:h-full md:w-2/5 md:border-l md:border-t-0 md:p-8">
        <div className="space-y-5">
          <div>
            <p className="font-mono text-xs uppercase tracking-widest text-[#b83346]">
              Identity & Appearance
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">Avatar Studio</h2>
          </div>

          {/* Body Proportions */}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Frame</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(['masculine', 'feminine'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setDraft({ ...draft, bodyType: type })}
                  className={`rounded-lg border py-2 text-xs font-medium capitalize transition ${
                    draft.bodyType === type
                      ? 'border-[#b83346] bg-[#8b2635]/30 text-white'
                      : 'border-zinc-800 bg-black/40 text-zinc-400'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Skin Tone */}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Skin Tone</label>
            <div className="mt-2 flex gap-2.5">
              {SKIN_TONE_PRESETS.map((tone) => (
                <button
                  key={tone}
                  type="button"
                  onClick={() => setDraft({ ...draft, skinTone: tone })}
                  style={{ backgroundColor: tone }}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    draft.skinTone === tone ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Hairstyle & Hair Color */}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Hairstyle</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(['short', 'slick', 'bob', 'ponytail', 'buzz', 'waves'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setDraft({ ...draft, hairStyle: style })}
                  className={`rounded-lg border py-1.5 text-xs capitalize transition ${
                    draft.hairStyle === style
                      ? 'border-[#b83346] bg-[#8b2635]/30 text-white'
                      : 'border-zinc-800 bg-black/40 text-zinc-400'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2.5">
              {HAIR_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraft({ ...draft, hairColor: color })}
                  style={{ backgroundColor: color }}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    draft.hairColor === color ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Outfit & Outfit Color */}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Attire</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(
                [
                  ['tailored_coat', 'Tailored Coat'],
                  ['turtleneck', 'Turtleneck'],
                  ['leather_jacket', 'Leather Jacket'],
                  ['vest_shirt', 'Vest & Shirt'],
                  ['hoodie_dark', 'Dark Hoodie'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft({ ...draft, outfit: value })}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                    draft.outfit === value
                      ? 'border-[#b83346] bg-[#8b2635]/30 text-white'
                      : 'border-zinc-800 bg-black/40 text-zinc-400'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex gap-2.5">
              {OUTFIT_COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDraft({ ...draft, outfitColor: color })}
                  style={{ backgroundColor: color }}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    draft.outfitColor === color ? 'scale-110 border-white' : 'border-zinc-700'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Accessories */}
          <div>
            <label className="block text-xs font-medium text-zinc-400">Accessory</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(['none', 'glasses', 'earpiece', 'watch', 'scar'] as const).map((acc) => (
                <button
                  key={acc}
                  type="button"
                  onClick={() => setDraft({ ...draft, accessory: acc })}
                  className={`rounded-lg border py-1.5 text-xs capitalize transition ${
                    draft.accessory === acc
                      ? 'border-[#b83346] bg-[#8b2635]/30 text-white'
                      : 'border-zinc-800 bg-black/40 text-zinc-400'
                  }`}
                >
                  {acc}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSave}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[#8b2635] py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#b83346]"
        >
          <Check className="h-4 w-4" />
          <span>Save Appearance</span>
        </button>
      </div>
    </div>
  );
}
