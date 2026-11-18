import { Crown, LogOut, RotateCcw, Skull } from 'lucide-react';
import { useGameStore } from '../../stores/useGameStore';

export function ResultsScreen() {
  const room = useGameStore((s) => s.room);
  const myMemberId = useGameStore((s) => s.myMemberId);
  const sendHostControl = useGameStore((s) => s.sendHostControl);
  const leaveRoom = useGameStore((s) => s.leaveRoom);

  if (!room || !room.game) return null;

  const isHost = room.hostId === myMemberId;
  const winner = room.players.find((p) => p.id === room.game?.winnerId);

  return (
    <div className="relative z-20 flex h-full w-full items-center justify-center bg-black/70 p-6 backdrop-blur-md">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-[#121317]/95 p-8 shadow-2xl">
        <div className="text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#e06c7d]">
            Match Concluded • Round {room.game.roundNumber}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/40 px-4 py-1.5 text-amber-300">
            <Crown className="h-4 w-4" />
            <span className="font-mono text-xs font-bold uppercase tracking-wider">
              Last Survivor
            </span>
          </div>
          <h2 className="mt-3 text-3xl font-black tracking-wider text-white">
            {winner ? winner.displayName : 'No Survivor'}
          </h2>
        </div>

        <ul className="mt-6 space-y-2">
          {room.players.map((p) => {
            const isWinner = p.id === winner?.id;
            return (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs ${
                  isWinner
                    ? 'border-amber-500/50 bg-amber-950/20 text-white'
                    : 'border-zinc-800 bg-black/40 text-zinc-400'
                }`}
              >
                <span className="font-semibold">{p.displayName}</span>
                {isWinner ? (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-amber-300">
                    <Crown className="h-3.5 w-3.5" />
                    SURVIVOR
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                    <Skull className="h-3.5 w-3.5" />
                    ELIMINATED
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-6 flex gap-3">
          {isHost ? (
            <button
              type="button"
              onClick={() => sendHostControl({ action: 'REMATCH' })}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#8b2635] py-3 text-xs font-semibold uppercase tracking-widest text-white transition hover:bg-[#b83346]"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Rematch Lobby</span>
            </button>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-zinc-800 bg-black/40 py-3 font-mono text-xs text-zinc-400">
              Waiting for host rematch...
            </div>
          )}

          <button
            type="button"
            onClick={leaveRoom}
            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 text-xs font-medium text-zinc-300 hover:border-red-800 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
}
