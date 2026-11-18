import {
  Check,
  Copy,
  Crown,
  Eye,
  LogOut,
  Play,
  ShieldAlert,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { useGameStore } from '../../stores/useGameStore';

export function LobbyScreen() {
  const room = useGameStore((s) => s.room);
  const myMemberId = useGameStore((s) => s.myMemberId);
  const isSpectator = useGameStore((s) => s.isSpectator);
  const bannerError = useGameStore((s) => s.bannerError);

  const toggleReady = useGameStore((s) => s.toggleReady);
  const startMatch = useGameStore((s) => s.startMatch);
  const sendHostControl = useGameStore((s) => s.sendHostControl);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const setScreen = useGameStore((s) => s.setScreen);

  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const isHost = room.hostId === myMemberId;
  const me = room.players.find((p) => p.id === myMemberId);
  const readyCount = room.players.filter((p) => p.isReady).length;
  const canStart = isHost && room.players.length >= 2 && readyCount === room.players.length;

  const copyCode = () => {
    void navigator.clipboard.writeText(room.roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pointer-events-none relative z-10 flex h-full w-full flex-col justify-between p-6 md:p-10">
      {/* Top Bar: Room Code & Leave */}
      <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 rounded-xl border border-zinc-800/90 bg-[#121317]/90 px-4 py-2.5 shadow-xl backdrop-blur-md">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-400">
              Private Room Code
            </p>
            <p className="font-mono text-xl font-bold tracking-[0.25em] text-white">
              {room.roomCode}
            </p>
          </div>
          <button
            type="button"
            onClick={copyCode}
            className="rounded-lg border border-zinc-700 bg-black/50 p-2 text-zinc-300 transition hover:border-[#8b2635] hover:text-white"
            title="Copy Room Code"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          {!isSpectator && (
            <button
              type="button"
              onClick={() => setScreen('AVATAR')}
              className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/90 px-4 py-2.5 text-xs font-medium text-zinc-200 backdrop-blur-md hover:border-[#8b2635]"
            >
              <UserCheck className="h-4 w-4 text-[#e06c7d]" />
              <span>Avatar</span>
            </button>
          )}
          <button
            type="button"
            onClick={leaveRoom}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/90 px-4 py-2.5 text-xs font-medium text-zinc-300 backdrop-blur-md hover:border-red-800 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Leave</span>
          </button>
        </div>
      </header>

      {/* Left Sidebar: Roster & Host Controls */}
      <div className="pointer-events-auto my-auto w-full max-w-sm rounded-2xl border border-zinc-800/90 bg-[#121317]/90 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Table Roster ({room.players.length}/6)
            </h2>
            <p className="font-mono text-[11px] text-zinc-400">
              {readyCount}/{room.players.length} Ready
            </p>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-black/40 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
            <Eye className="h-3.5 w-3.5 text-[#e06c7d]" />
            <span>{room.spectators.length}</span>
          </div>
        </div>

        {bannerError && (
          <div className="mt-3 rounded-lg border border-red-900/70 bg-red-950/50 px-3 py-2 text-xs text-red-200">
            {bannerError}
          </div>
        )}

        <ul className="mt-3 space-y-2">
          {room.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-black/45 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 rounded-full border border-white/30"
                  style={{ backgroundColor: p.avatar.outfitColor }}
                />
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span>{p.displayName}</span>
                    {p.isHost && <Crown className="h-3.5 w-3.5 text-amber-400" />}
                  </div>
                  <span className="font-mono text-[10px] text-zinc-500">
                    SEAT #{p.seatIndex + 1} • {p.connectionStatus}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-semibold ${
                    p.isReady
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60'
                      : 'bg-zinc-900 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  {p.isReady ? 'READY' : 'NOT READY'}
                </span>

                {isHost && !p.isHost && (
                  <button
                    type="button"
                    onClick={() =>
                      sendHostControl({ action: 'KICK_PLAYER', targetPlayerId: p.id })
                    }
                    title="Remove Player"
                    className="rounded p-1 text-zinc-500 hover:bg-red-950/60 hover:text-red-300"
                  >
                    <UserX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {/* Host Controls & Ready Button */}
        <div className="mt-4 space-y-2 border-t border-zinc-800/80 pt-4">
          {isHost ? (
            <>
              <button
                type="button"
                disabled={!canStart}
                onClick={() => void startMatch()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#8b2635] py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#b83346] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Play className="h-4 w-4" />
                <span>
                  {room.players.length < 2
                    ? 'Need 2+ Players'
                    : !canStart
                      ? 'Waiting for Ready'
                      : 'Start Match'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => sendHostControl({ action: 'TOGGLE_SPECTATORS' })}
                  className="rounded-lg border border-zinc-800 bg-black/50 py-2 text-[11px] font-medium text-zinc-300 hover:border-zinc-700"
                >
                  Spectators: {room.allowSpectators ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => sendHostControl({ action: 'CLOSE_ROOM' })}
                  className="flex items-center justify-center gap-1 rounded-lg border border-red-950 bg-red-950/30 py-2 text-[11px] font-medium text-red-300 hover:bg-red-950/60"
                >
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>Close Room</span>
                </button>
              </div>
            </>
          ) : !isSpectator && me ? (
            <button
              type="button"
              onClick={toggleReady}
              className={`w-full rounded-xl py-3 text-xs font-semibold uppercase tracking-widest transition ${
                me.isReady
                  ? 'border border-zinc-700 bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800'
                  : 'bg-[#8b2635] text-white hover:bg-[#b83346]'
              }`}
            >
              {me.isReady ? 'Cancel Ready' : 'Ready Up'}
            </button>
          ) : (
            <div className="rounded-xl border border-amber-800/50 bg-amber-950/30 px-3 py-2.5 text-center font-mono text-xs text-amber-200">
              SPECTATING LOBBY — WAITING FOR HOST
            </div>
          )}
        </div>
      </div>

      <div />
    </div>
  );
}
