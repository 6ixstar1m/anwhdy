import { X } from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

export function Modals() {
  const activeModal = useGameStore((s) => s.activeModal);
  const displayName = useGameStore((s) => s.displayName);
  const bannerError = useGameStore((s) => s.bannerError);
  const settings = useGameStore((s) => s.settings);

  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const createRoom = useGameStore((s) => s.createRoom);
  const joinRoom = useGameStore((s) => s.joinRoom);
  const updateSettings = useGameStore((s) => s.updateSettings);

  const [nameInput, setNameInput] = useState(displayName || 'Player');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [allowSpectators, setAllowSpectators] = useState(true);
  const [allowPassOption, setAllowPassOption] = useState(true);
  const [escalateRisk, setEscalateRisk] = useState(true);
  const [turnSeconds, setTurnSeconds] = useState(20);
  const [joinAsSpectator, setJoinAsSpectator] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (activeModal === 'NONE') return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || submitting) return;
    setSubmitting(true);
    await createRoom({
      displayName: nameInput,
      allowSpectators,
      rules: {
        allowPassOption,
        escalateRiskEachTurn: escalateRisk,
        turnDurationMs: turnSeconds * 1000,
      },
    });
    setSubmitting(false);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim() || roomCodeInput.trim().length !== 6 || submitting) return;
    setSubmitting(true);
    await joinRoom({
      roomCode: roomCodeInput,
      displayName: nameInput,
      asSpectator: joinAsSpectator,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-[#121317]/95 p-6 shadow-2xl">
        <button
          type="button"
          onClick={() => setActiveModal('NONE')}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {bannerError && (
          <div className="mb-4 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {bannerError}
          </div>
        )}

        {activeModal === 'CREATE_ROOM' && (
          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#b83346]">
                Private Match
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Create Room</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Display Name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#8b2635] focus:outline-none"
              />
            </div>

            <div className="space-y-2.5 rounded-xl border border-zinc-800/80 bg-black/40 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Allow Spectators</span>
                <input
                  type="checkbox"
                  checked={allowSpectators}
                  onChange={(e) => setAllowSpectators(e.target.checked)}
                  className="h-4 w-4 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Allow 1 Pass Token per Match</span>
                <input
                  type="checkbox"
                  checked={allowPassOption}
                  onChange={(e) => setAllowPassOption(e.target.checked)}
                  className="h-4 w-4 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Escalate Risk Each Turn</span>
                <input
                  type="checkbox"
                  checked={escalateRisk}
                  onChange={(e) => setEscalateRisk(e.target.checked)}
                  className="h-4 w-4 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-zinc-300">Turn Timer ({turnSeconds}s)</span>
                <input
                  type="range"
                  min={10}
                  max={45}
                  step={5}
                  value={turnSeconds}
                  onChange={(e) => setTurnSeconds(Number(e.target.value))}
                  className="w-28 accent-[#8b2635]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#8b2635] py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#b83346] disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Generate Room Code'}
            </button>
          </form>
        )}

        {activeModal === 'JOIN_ROOM' && (
          <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#b83346]">
                Enter Code
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Join Room</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Display Name</label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={24}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#8b2635] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">
                6-Character Room Code
              </label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="ABC234"
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-lg border border-zinc-800 bg-black/60 px-3 py-2.5 text-center font-mono text-lg uppercase tracking-[0.35em] text-white focus:border-[#8b2635] focus:outline-none"
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-xl border border-zinc-800/80 bg-black/40 px-3.5 py-2.5 text-xs text-zinc-300">
              <span>Join as Spectator (Watch Only)</span>
              <input
                type="checkbox"
                checked={joinAsSpectator}
                onChange={(e) => setJoinAsSpectator(e.target.checked)}
                className="h-4 w-4 accent-[#8b2635]"
              />
            </label>

            <button
              type="submit"
              disabled={submitting || roomCodeInput.trim().length !== 6}
              className="w-full rounded-xl bg-[#8b2635] py-2.5 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#b83346] disabled:opacity-40"
            >
              {submitting ? 'Connecting...' : joinAsSpectator ? 'Join as Spectator' : 'Join Table'}
            </button>
          </form>
        )}

        {activeModal === 'SETTINGS' && (
          <div className="space-y-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#b83346]">
                System Preferences
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">Settings</h2>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400">Graphics Quality</label>
              <div className="mt-1.5 grid grid-cols-3 gap-2">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => updateSettings({ graphicsQuality: tier })}
                    className={`rounded-lg border py-2 font-mono text-xs transition ${
                      settings.graphicsQuality === tier
                        ? 'border-[#b83346] bg-[#8b2635]/30 text-white'
                        : 'border-zinc-800 bg-black/40 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-black/40 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Master Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.masterVolume}
                  onChange={(e) => updateSettings({ masterVolume: Number(e.target.value) })}
                  className="w-32 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Room Ambience</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.ambienceVolume}
                  onChange={(e) => updateSettings({ ambienceVolume: Number(e.target.value) })}
                  className="w-32 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Sound Effects</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.sfxVolume}
                  onChange={(e) => updateSettings({ sfxVolume: Number(e.target.value) })}
                  className="w-32 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">Voice Chat Volume</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.voiceVolume}
                  onChange={(e) => updateSettings({ voiceVolume: Number(e.target.value) })}
                  className="w-32 accent-[#8b2635]"
                />
              </div>
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-zinc-300">Mute All Audio</span>
                <input
                  type="checkbox"
                  checked={settings.muteAll}
                  onChange={(e) => updateSettings({ muteAll: e.target.checked })}
                  className="h-4 w-4 accent-[#8b2635]"
                />
              </div>
            </div>
          </div>
        )}

        {activeModal === 'HOW_TO_PLAY' && (
          <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-widest text-[#b83346]">
                Rules & Protocol
              </p>
              <h2 className="mt-1 text-xl font-bold text-white">How to Play</h2>
            </div>

            <p>
              <strong>1. Gather at the Table:</strong> Create a private room and share the
              6-character code with 2 to 6 players. Extra guests can join as spectators.
            </p>
            <p>
              <strong>2. Take Your Turn:</strong> The server assigns a randomized turn order each
              match. When the spotlight focuses on your seat, choose{' '}
              <span className="font-semibold text-[#e06c7d]">TAKE A CHANCE</span> before the turn
              timer expires—or spend a limited <span className="font-semibold">PASS</span> token to
              defer the risk to the next player.
            </p>
            <p>
              <strong>3. Escalating Odds:</strong> Each safe turn increases the round&apos;s risk
              probability until an elimination event triggers and resets the cycle for the next
              round.
            </p>
            <p>
              <strong>4. Last Survivor Wins:</strong> Eliminated players automatically transition
              into Spectator Mode to watch the finale.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
