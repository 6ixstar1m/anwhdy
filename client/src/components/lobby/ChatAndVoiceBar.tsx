import {
  MessageSquare,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useVoiceChat } from '../../hooks/useVoiceChat';
import { useGameStore } from '../../stores/useGameStore';

export function ChatAndVoiceBar() {
  const room = useGameStore((s) => s.room);
  const messages = useGameStore((s) => s.messages);
  const unreadMessages = useGameStore((s) => s.unreadMessages);
  const chatOpen = useGameStore((s) => s.chatOpen);
  const micPermissionError = useGameStore((s) => s.micPermissionError);
  const mutedPeerIds = useGameStore((s) => s.mutedPeerIds);
  const sendChatMessage = useGameStore((s) => s.sendChatMessage);
  const setChatOpen = useGameStore((s) => s.setChatOpen);
  const togglePeerMute = useGameStore((s) => s.togglePeerMute);

  const { micEnabled, micMuted, enableMicrophone, disableMicrophone, toggleMute } = useVoiceChat();
  const [draft, setDraft] = useState('');
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatOpen) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  if (!room) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    sendChatMessage(draft);
    setDraft('');
  };

  return (
    <>
      {/* Voice Controls Pill (Bottom Left) */}
      <div className="fixed bottom-4 left-4 z-30 flex flex-col gap-2">
        {micPermissionError && (
          <div className="max-w-xs rounded-lg border border-red-800/80 bg-red-950/90 px-3 py-2 text-xs text-red-200 backdrop-blur-md">
            {micPermissionError}
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-zinc-800/90 bg-[#121317]/90 px-3 py-2 shadow-xl backdrop-blur-md">
          {!micEnabled ? (
            <button
              type="button"
              onClick={() => void enableMicrophone()}
              title="Request microphone access for peer-to-peer room voice chat"
              className="flex items-center gap-2 rounded-lg border border-[#8b2635]/70 bg-[#8b2635]/20 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-[#8b2635]/40"
            >
              <Mic className="h-3.5 w-3.5 text-[#e06c7d]" />
              <span>Enable Voice</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={toggleMute}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  micMuted
                    ? 'bg-red-950/80 text-red-300 border border-red-800/70'
                    : 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/60'
                }`}
              >
                {micMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                <span>{micMuted ? 'Muted' : 'Mic Live'}</span>
              </button>
              <button
                type="button"
                onClick={disableMicrophone}
                className="rounded-lg border border-zinc-800 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Disconnect Mic
              </button>
            </>
          )}

          {/* Per-Player Voice Status & Mute Toggles */}
          <div className="ml-1 flex items-center gap-1.5 border-l border-zinc-800 pl-2">
            {room.players.map((p) => {
              const isPeerMuted = Boolean(mutedPeerIds[p.id]);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePeerMute(p.id)}
                  title={`Toggle audio for ${p.displayName}`}
                  className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition ${
                    p.isSpeaking && !isPeerMuted
                      ? 'border-emerald-500/80 bg-emerald-950/60 text-emerald-200'
                      : 'border-zinc-800 bg-black/40 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isPeerMuted || p.isMuted ? (
                    <VolumeX className="h-3 w-3 text-red-400" />
                  ) : (
                    <Volume2 className="h-3 w-3" />
                  )}
                  <span className="max-w-[64px] truncate">{p.displayName}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Collapsible Text Chat Panel (Bottom Right) */}
      <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end">
        {!chatOpen ? (
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#121317]/90 px-4 py-2.5 text-xs font-medium text-zinc-200 shadow-xl backdrop-blur-md transition hover:border-[#8b2635]"
          >
            <MessageSquare className="h-4 w-4 text-[#e06c7d]" />
            <span>Room Chat</span>
            {unreadMessages > 0 && (
              <span className="rounded-full bg-[#b83346] px-1.5 py-0.5 font-mono text-[10px] text-white">
                {unreadMessages}
              </span>
            )}
          </button>
        ) : (
          <div className="flex h-72 w-80 flex-col rounded-xl border border-zinc-800/90 bg-[#121317]/92 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-zinc-800/80 px-3.5 py-2">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-[#e06c7d]" />
                <span className="font-mono text-xs uppercase tracking-wider text-zinc-300">
                  Room Comms
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-3 text-xs">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-zinc-500">
                  No messages yet. Stay sharp.
                </p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="leading-relaxed">
                    <span className="font-mono text-[10px] text-zinc-500">
                      {new Date(m.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                    </span>
                    <span
                      className={
                        m.senderRole === 'SPECTATOR'
                          ? 'font-semibold text-amber-400'
                          : 'font-semibold text-[#e06c7d]'
                      }
                    >
                      {m.senderName}
                      {m.senderRole === 'SPECTATOR' ? ' [SPEC]' : ''}:
                    </span>{' '}
                    <span
                      className="break-words text-zinc-200"
                      dangerouslySetInnerHTML={{ __html: m.content }}
                    />
                  </div>
                ))
              )}
              <div ref={listEndRef} />
            </div>

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-1.5 border-t border-zinc-800/80 p-2"
            >
              <input
                type="text"
                maxLength={240}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border border-zinc-800 bg-black/50 px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-[#8b2635] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-[#8b2635] p-1.5 text-white transition hover:bg-[#b83346]"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
