import { HelpCircle, Play, Plus, Settings, UserCheck, Users } from 'lucide-react';
import { soundEngine } from '../../audio/soundEngine';
import { useGameStore } from '../../stores/useGameStore';

export function MainMenuScreen() {
  const connected = useGameStore((s) => s.connected);
  const displayName = useGameStore((s) => s.displayName);
  const setActiveModal = useGameStore((s) => s.setActiveModal);
  const setScreen = useGameStore((s) => s.setScreen);
  const createRoom = useGameStore((s) => s.createRoom);

  const handlePlayOnline = () => {
    soundEngine.startAmbience();
    if (!displayName.trim()) {
      setActiveModal('CREATE_ROOM');
      return;
    }
    void createRoom({
      displayName,
      allowSpectators: true,
    });
  };

  return (
    <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 md:p-14">
      {/* Top Status Bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 rounded-full border border-zinc-800/80 bg-[#121317]/80 px-3.5 py-1.5 backdrop-blur-md">
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400 animate-pulse'
            }`}
          />
          <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-300">
            {connected ? 'Server Online' : 'Connecting...'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setScreen('AVATAR')}
          onMouseEnter={() => soundEngine.playUiHover()}
          className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/85 px-4 py-2 text-xs font-medium uppercase tracking-wider text-zinc-200 backdrop-blur-md transition hover:border-[#8b2635] hover:text-white"
        >
          <UserCheck className="h-4 w-4 text-[#e06c7d]" />
          <span>Customize Avatar</span>
        </button>
      </header>

      {/* Center / Left Hero Logo & Navigation */}
      <div className="my-auto max-w-md">
        <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#b83346]">
          2–6 Players • Psychological Party
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-[0.2em] text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] md:text-6xl">
          LAST ROUND
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">
          Six chairs. Escalating odds. Watch the table, read the room, and survive the final
          round.
        </p>

        <nav className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            disabled={!connected}
            onClick={handlePlayOnline}
            onMouseEnter={() => soundEngine.playUiHover()}
            className="group flex items-center justify-between rounded-xl border border-[#8b2635] bg-[#8b2635]/25 px-5 py-3.5 text-left text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-[0_0_25px_rgba(139,38,53,0.25)] backdrop-blur-md transition hover:bg-[#8b2635]/45 hover:shadow-[0_0_30px_rgba(184,51,70,0.45)] disabled:opacity-40"
          >
            <span className="flex items-center gap-3">
              <Play className="h-4 w-4 text-[#e06c7d] transition-transform group-hover:translate-x-0.5" />
              PLAY ONLINE
            </span>
            <span className="font-mono text-[10px] text-zinc-400">HOST LOBBY</span>
          </button>

          <button
            type="button"
            disabled={!connected}
            onClick={() => setActiveModal('CREATE_ROOM')}
            onMouseEnter={() => soundEngine.playUiHover()}
            className="flex items-center gap-3 rounded-xl border border-zinc-800/90 bg-[#121317]/85 px-5 py-3 text-left text-sm font-medium uppercase tracking-[0.16em] text-zinc-200 backdrop-blur-md transition hover:border-[#8b2635]/80 hover:bg-[#191a20] hover:text-white disabled:opacity-40"
          >
            <Plus className="h-4 w-4 text-[#e06c7d]" />
            <span>CREATE ROOM</span>
          </button>

          <button
            type="button"
            disabled={!connected}
            onClick={() => setActiveModal('JOIN_ROOM')}
            onMouseEnter={() => soundEngine.playUiHover()}
            className="flex items-center gap-3 rounded-xl border border-zinc-800/90 bg-[#121317]/85 px-5 py-3 text-left text-sm font-medium uppercase tracking-[0.16em] text-zinc-200 backdrop-blur-md transition hover:border-[#8b2635]/80 hover:bg-[#191a20] hover:text-white disabled:opacity-40"
          >
            <Users className="h-4 w-4 text-[#e06c7d]" />
            <span>JOIN ROOM</span>
          </button>

          <div className="mt-1 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setActiveModal('HOW_TO_PLAY')}
              onMouseEnter={() => soundEngine.playUiHover()}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800/80 bg-[#121317]/75 px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-zinc-300 backdrop-blur-md transition hover:border-zinc-700 hover:text-white"
            >
              <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
              <span>HOW TO PLAY</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveModal('SETTINGS')}
              onMouseEnter={() => soundEngine.playUiHover()}
              className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800/80 bg-[#121317]/75 px-4 py-2.5 text-xs font-medium uppercase tracking-widest text-zinc-300 backdrop-blur-md transition hover:border-zinc-700 hover:text-white"
            >
              <Settings className="h-3.5 w-3.5 text-zinc-400" />
              <span>SETTINGS</span>
            </button>
          </div>
        </nav>
      </div>

      <footer className="flex items-center justify-between font-mono text-[11px] text-zinc-500">
        <span>AUTHORITATIVE MULTIPLAYER ENGINE</span>
        <span>WEBRTC VOICE • 3D R3F</span>
      </footer>
    </div>
  );
}
