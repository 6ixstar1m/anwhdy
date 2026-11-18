import React, { useState } from 'react';
import {
  Users,
  PlusCircle,
  LogIn,
  Bot,
  Copy,
  Check,
  Crown,
  Play,
  LogOut,
  Mic,
  MicOff,
  Send,
  Globe,
  Lock,
  Eye,
  Wifi,
  WifiOff,
  User,
} from 'lucide-react';
import {
  AvatarConfig,
  OnlineRoomState,
  PublicRoomSummary,
} from '../types/game';

interface OnlineLobbyOverlayProps {
  connected: boolean;
  mySocketId: string;
  playerName: string;
  setPlayerName: (name: string) => void;
  avatar: AvatarConfig;
  setAvatar: (av: AvatarConfig) => void;
  publicRooms: PublicRoomSummary[];
  currentRoom: OnlineRoomState | null;
  roomError: string | null;
  micEnabled: boolean;
  onToggleMic: () => void;
  onCreateRoom: (roomName: string, isPublic: boolean, maxPlayers: number) => void;
  onJoinRoom: (code: string) => void;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onLeaveRoom: () => void;
  onSendChat: (text: string) => void;
  onStartSoloMode: () => void;
}

const COAT_COLORS = ['#18181b', '#3f1d1d', '#1e293b', '#14532d', '#3b0764', '#78350f'];
const EYE_COLORS = ['#ef4444', '#38bdf8', '#f59e0b', '#10b981', '#a855f7', '#ffffff'];

export const OnlineLobbyOverlay: React.FC<OnlineLobbyOverlayProps> = ({
  connected,
  mySocketId,
  playerName,
  setPlayerName,
  avatar,
  setAvatar,
  publicRooms,
  currentRoom,
  roomError,
  micEnabled,
  onToggleMic,
  onCreateRoom,
  onJoinRoom,
  onToggleReady,
  onStartMatch,
  onLeaveRoom,
  onSendChat,
  onStartSoloMode,
}) => {
  const [newRoomName, setNewRoomName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');

  const handleCopyCode = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendChat(chatInput);
    setChatInput('');
  };

  if (currentRoom && currentRoom.status === 'lobby') {
    const isHost = currentRoom.hostId === mySocketId;
    const me = currentRoom.players.find((p) => p.id === mySocketId);
    const activePlayers = currentRoom.players.filter((p) => p.role === 'player');
    const spectators = currentRoom.players.filter((p) => p.role === 'spectator');

    return (
      <div className="fixed inset-0 z-30 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl grid grid-cols-1 lg:grid-cols-3 gap-6 animate-pop-in">
          <div className="lg:col-span-2 flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-red-500/20 text-red-400 border border-red-500/40">
                      ONLINE LOBBY
                    </span>
                    <span className="text-xs text-zinc-400 flex items-center gap-1">
                      {currentRoom.isPublic ? <Globe size={13} /> : <Lock size={13} />}
                      {currentRoom.isPublic ? 'ห้องสาธารณะ' : 'ห้องส่วนตัว'}
                    </span>
                  </div>
                  <h2 className="text-xl font-extrabold text-white mt-1">{currentRoom.name}</h2>
                </div>

                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 px-3.5 py-2 rounded-xl">
                  <div>
                    <div className="text-[10px] text-zinc-400 uppercase">รหัสห้อง (ROOM CODE)</div>
                    <div className="text-lg font-mono font-extrabold tracking-widest text-amber-400">
                      {currentRoom.code}
                    </div>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                    title="คัดลอกรหัสห้อง"
                  >
                    {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              {roomError && (
                <div className="mt-3 p-2.5 rounded-lg bg-red-950/80 border border-red-700 text-xs text-red-200">
                  {roomError}
                </div>
              )}

              <div className="mt-4">
                <div className="text-xs font-semibold text-zinc-400 mb-2 flex items-center justify-between">
                  <span>
                    ผู้เล่นในโต๊ะ ({activePlayers.length}/{currentRoom.maxPlayers} คน) — เริ่มต้นคนละ 3 หัวใจ
                  </span>
                  <span>สุ่มอุปกรณ์ป้องกันเมื่อรอดชีวิต</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {Array.from({ length: currentRoom.maxPlayers }).map((_, idx) => {
                    const p = activePlayers[idx];
                    if (!p) {
                      return (
                        <div
                          key={`slot-${idx}`}
                          className="p-3.5 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 flex items-center justify-center text-xs text-zinc-600 h-20"
                        >
                          รอผู้เล่นเข้าร่วม... (แชร์รหัส {currentRoom.code})
                        </div>
                      );
                    }

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between h-20 ${
                          p.id === mySocketId
                            ? 'bg-zinc-900 border-amber-500/60'
                            : 'bg-zinc-900/80 border-zinc-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-inner"
                            style={{
                              backgroundColor: p.avatar.coatColor,
                              borderColor: p.avatar.eyeColor,
                            }}
                          >
                            <div className="flex gap-1.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: p.avatar.eyeColor }}
                              />
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: p.avatar.eyeColor }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-bold text-white flex items-center gap-1.5">
                              {p.name}
                              {p.id === currentRoom.hostId && (
                                <Crown size={14} className="text-amber-400" />
                              )}
                              {p.isSpeaking && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-400">
                              {p.id === mySocketId ? 'คุณ (You)' : 'ผู้เล่นออนไลน์'}
                            </div>
                          </div>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            p.id === currentRoom.hostId || p.ready
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {p.id === currentRoom.hostId ? 'หัวหน้าห้อง' : p.ready ? 'พร้อมแล้ว' : 'ยังไม่พร้อม'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {spectators.length > 0 && (
                  <div className="mt-3 text-xs text-zinc-400 flex items-center gap-1.5">
                    <Eye size={14} className="text-sky-400" />
                    ผู้ชมในห้อง ({spectators.length}): {spectators.map((s) => s.name).join(', ')}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={onLeaveRoom}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-bold text-zinc-300 flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={15} /> ออกจากห้อง
                </button>
                <button
                  onClick={onToggleMic}
                  className={`px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                    micEnabled
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                  }`}
                >
                  {micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
                  {micEnabled ? 'เปิดไมค์อยู่' : 'ปิดไมค์'}
                </button>
              </div>

              {isHost ? (
                <button
                  onClick={onStartMatch}
                  className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm flex items-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.45)] cursor-pointer"
                >
                  <Play size={16} /> เริ่มเกมทันที (START MATCH)
                </button>
              ) : (
                me?.role === 'player' && (
                  <button
                    onClick={onToggleReady}
                    className={`px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer ${
                      me.ready
                        ? 'bg-zinc-800 text-zinc-200 border border-zinc-600'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {me.ready ? 'ยกเลิกสถานะพร้อม' : 'กดพร้อม (READY)'}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-3.5 flex flex-col h-80 lg:h-auto">
            <div className="text-xs font-bold text-zinc-300 pb-2 border-b border-zinc-800">
              แชทภายในห้อง (ROOM CHAT)
            </div>
            <div className="flex-1 overflow-y-auto py-2 space-y-2 text-xs">
              {currentRoom.chat.map((msg) => (
                <div key={msg.id} className="leading-relaxed">
                  {msg.senderId === 'system' ? (
                    <span className="text-amber-400/90 italic">{msg.text}</span>
                  ) : (
                    <>
                      <span className="font-bold text-zinc-200">{msg.senderName}: </span>
                      <span className="text-zinc-300">{msg.text}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <form onSubmit={handleChatSubmit} className="flex gap-1.5 pt-2 border-t border-zinc-800">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="พิมพ์ข้อความคุยกับเพื่อน..."
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                className="p-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-30 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-zinc-950/95 border border-zinc-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl animate-pop-in">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-zinc-800">
          <div>
            <h1 className="text-2xl font-black tracking-wider text-white">
              LAST ROUND <span className="text-red-500">ONLINE</span>
            </h1>
            <p className="text-xs text-zinc-400">
              เกมรูเล็ตลูกโม่ 3D • ระบบสร้างห้องออนไลน์ • 3 หัวใจ • สุ่มอุปกรณ์ป้องกัน 8 ชนิดเมื่อรอดชีวิต
            </p>
          </div>

          <div
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border ${
              connected
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-300'
                : 'bg-amber-950/70 border-amber-600/50 text-amber-300'
            }`}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {connected ? 'เชื่อมต่อเซิร์ฟเวอร์ออนไลน์แล้ว' : 'โหมดออฟไลน์ (รัน server เพื่อเล่นออนไลน์)'}
          </div>
        </div>

        {roomError && (
          <div className="mt-3 p-3 rounded-xl bg-red-950/85 border border-red-700 text-xs text-red-200">
            {roomError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
          <div className="bg-zinc-900/75 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5 mb-3">
                <User size={14} /> ตัวละครของคุณ (AVATAR)
              </div>

              <div className="flex items-center gap-3 bg-zinc-950 p-3 rounded-xl border border-zinc-800 mb-3">
                <div
                  className="w-14 h-14 rounded-full border-2 flex items-center justify-center shrink-0 shadow-lg"
                  style={{
                    backgroundColor: avatar.coatColor,
                    borderColor: avatar.eyeColor,
                  }}
                >
                  <div className="flex gap-2">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: avatar.eyeColor }}
                    />
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: avatar.eyeColor }}
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-zinc-400 block mb-1">ชื่อในเกม</label>
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    maxLength={18}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="mb-3">
                <div className="text-[11px] text-zinc-400 mb-1.5">สีชุดคลุม</div>
                <div className="flex gap-2">
                  {COAT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAvatar({ ...avatar, coatColor: c })}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        avatar.coatColor === c ? 'border-amber-400 scale-110' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] text-zinc-400 mb-1.5">สีดวงตาเรืองแสง</div>
                <div className="flex gap-2">
                  {EYE_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAvatar({ ...avatar, eyeColor: c })}
                      className={`w-6 h-6 rounded-full border-2 cursor-pointer ${
                        avatar.eyeColor === c ? 'border-white scale-110' : 'border-zinc-700'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={onStartSoloMode}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 text-zinc-100 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              <Bot size={16} className="text-amber-400" />
              เล่นคนเดียวกับผู้คุม AI (SOLO MODE)
            </button>
          </div>

          <div className="bg-zinc-900/75 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5 mb-3">
                <PlusCircle size={14} /> สร้างห้องออนไลน์ (CREATE ROOM)
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">ชื่อห้อง</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder={`ห้องของ ${playerName}`}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-red-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">จำนวนผู้เล่นสูงสุด</label>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[2, 3, 4, 5, 6].map((num) => (
                      <button
                        key={num}
                        onClick={() => setMaxPlayers(num)}
                        className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                          maxPlayers === num
                            ? 'bg-red-600 border-red-400 text-white'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {num} คน
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">ประเภทห้อง</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setIsPublic(true)}
                      className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        isPublic
                          ? 'bg-zinc-800 border-amber-400 text-amber-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Globe size={13} /> สาธารณะ
                    </button>
                    <button
                      onClick={() => setIsPublic(false)}
                      className={`py-2 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer ${
                        !isPublic
                          ? 'bg-zinc-800 border-amber-400 text-amber-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-500'
                      }`}
                    >
                      <Lock size={13} /> ส่วนตัว (ใช้รหัส)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <button
              disabled={!connected}
              onClick={() =>
                onCreateRoom(newRoomName || `ห้องของ ${playerName}`, isPublic, maxPlayers)
              }
              className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] cursor-pointer transition-all"
            >
              <PlusCircle size={16} />
              สร้างห้องออนไลน์ทันที
            </button>
          </div>

          <div className="bg-zinc-900/75 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5 mb-3">
                <LogIn size={14} /> เข้าร่วมห้องออนไลน์ (JOIN ROOM)
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="ใส่รหัสห้อง 6 หลัก..."
                  maxLength={6}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono uppercase tracking-widest text-white focus:outline-none focus:border-sky-400"
                />
                <button
                  disabled={!connected || joinCode.trim().length < 4}
                  onClick={() => onJoinRoom(joinCode)}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                >
                  เข้าร่วม
                </button>
              </div>

              <div className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 mb-2">
                <Users size={13} /> ห้องสาธารณะที่เปิดอยู่ ({publicRooms.length})
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {publicRooms.length === 0 ? (
                  <div className="text-xs text-zinc-600 bg-zinc-950/70 border border-zinc-800/80 rounded-lg p-4 text-center">
                    ยังไม่มีห้องสาธารณะเปิดอยู่
                    <br />
                    กด "สร้างห้องออนไลน์ทันที" เพื่อเริ่มเล่นได้เลย
                  </div>
                ) : (
                  publicRooms.map((r) => (
                    <div
                      key={r.code}
                      className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-xs font-bold text-zinc-100">{r.name}</div>
                        <div className="text-[10px] text-zinc-400">
                          รหัส: <span className="text-amber-400 font-mono">{r.code}</span> •{' '}
                          {r.playerCount}/{r.maxPlayers} คน
                        </div>
                      </div>
                      <button
                        onClick={() => onJoinRoom(r.code)}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-sky-600 text-xs font-bold text-white cursor-pointer"
                      >
                        {r.status === 'lobby' ? 'เข้าห้อง' : 'เข้าชม'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
