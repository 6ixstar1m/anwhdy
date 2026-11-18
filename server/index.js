import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const MAX_HEARTS = 3;
const MAX_INVENTORY_SLOTS = 4;

const ITEM_NAMES = {
  kevlar: 'แผ่นเกราะเคฟลาร์',
  ricochet: 'โล่สะท้อนกระสุน',
  charm: 'เครื่องรางกันตาย',
  adrenaline: 'เข็มดีดยาอะดรีนาลีน',
  smoke: 'ระเบิดควัน',
  visor: 'แว่นเบี่ยงวิถี',
  scanner: 'เครื่องสแกนรังเพลิง',
  ejector: 'คีมดีดปลอกกระสุน',
};

const ALL_ITEM_IDS = Object.keys(ITEM_NAMES);

function rollRandomItem() {
  return ALL_ITEM_IDS[Math.floor(Math.random() * ALL_ITEM_IDS.length)];
}

function createUid() {
  return Math.random().toString(36).substring(2, 10);
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function generateCylinder(playerCount = 2) {
  const baseShells = Math.min(8, Math.max(3, playerCount + 2 + Math.floor(Math.random() * 3)));
  const liveCount = Math.max(1, Math.min(baseShells - 1, Math.round(baseShells / 2)));
  const blankCount = baseShells - liveCount;
  const shells = [
    ...Array(liveCount).fill('live'),
    ...Array(blankCount).fill('blank'),
  ];
  for (let i = shells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shells[i], shells[j]] = [shells[j], shells[i]];
  }
  return shells;
}

const rooms = new Map();

function sanitizeRoomForClient(room) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    maxPlayers: room.maxPlayers,
    status: room.status,
    hostId: room.hostId,
    roundNumber: room.roundNumber,
    shellsRemaining: room.cylinder.length,
    turnPlayerId: room.turnPlayerId,
    winnerId: room.winnerId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ready: p.ready,
      role: p.role,
      hearts: p.hearts,
      inventory: p.inventory,
      buffs: p.buffs,
      isSpeaking: p.isSpeaking,
    })),
    logs: room.logs,
    chat: room.chat,
  };
}

function broadcastRoomList() {
  const list = [];
  for (const room of rooms.values()) {
    if (room.isPublic) {
      const activePlayers = room.players.filter((p) => p.role === 'player');
      list.push({
        code: room.code,
        name: room.name,
        status: room.status,
        playerCount: activePlayers.length,
        maxPlayers: room.maxPlayers,
        hostName: room.players.find((p) => p.id === room.hostId)?.name || 'Host',
      });
    }
  }
  io.emit('rooms_list', list);
}

function addRoomLog(room, text, tone = 'neutral') {
  room.logs = [{ id: createUid(), text, tone }, ...room.logs.slice(0, 7)];
}

function grantSurvivalDrop(room, player, reason) {
  if (!player || player.hearts <= 0) return;
  if (player.inventory.length >= MAX_INVENTORY_SLOTS) {
    addRoomLog(
      room,
      `${player.name} รอดชีวิต! แต่ช่องเก็บอุปกรณ์เต็ม (4/4) จึงไม่ได้รับไอเทมเพิ่ม`,
      'info'
    );
    return;
  }
  const itemId = rollRandomItem();
  player.inventory.push({ uid: createUid(), itemId });
  addRoomLog(
    room,
    `${player.name} รอดชีวิต (${reason})! สุ่มรับอุปกรณ์: [${ITEM_NAMES[itemId]}]`,
    'item'
  );
  io.to(player.id).emit('survival_drop', { itemId, reason });
}

function loadCylinderForRoom(room, nextRound, grantStarter = true) {
  const alivePlayers = room.players.filter((p) => p.role === 'player' && p.hearts > 0);
  const shells = generateCylinder(alivePlayers.length);
  const live = shells.filter((s) => s === 'live').length;
  const blank = shells.filter((s) => s === 'blank').length;

  room.cylinder = shells;
  room.roundNumber = nextRound;
  addRoomLog(
    room,
    `บรรจุกระสุนรอบที่ ${nextRound}: กระสุนจริง ${live} นัด | กระสุนเปล่า ${blank} นัด`,
    'info'
  );

  if (grantStarter) {
    for (const p of alivePlayers) {
      if (p.inventory.length < MAX_INVENTORY_SLOTS) {
        p.inventory.push({ uid: createUid(), itemId: rollRandomItem() });
      }
    }
  }

  io.to(room.code).emit('cylinder_reloaded', {
    roundNumber: nextRound,
    live,
    blank,
    total: shells.length,
  });
}

function getNextAlivePlayerId(room, currentId) {
  const alive = room.players.filter((p) => p.role === 'player' && p.hearts > 0);
  if (alive.length === 0) return null;
  const idx = alive.findIndex((p) => p.id === currentId);
  const next = alive[(idx + 1) % alive.length];
  return next.id;
}

io.on('connection', (socket) => {
  broadcastRoomList();

  socket.on('get_rooms', () => {
    broadcastRoomList();
  });

  socket.on('create_room', ({ roomName, isPublic, maxPlayers, playerName, avatar }) => {
    let code = generateRoomCode();
    while (rooms.has(code)) code = generateRoomCode();

    const hostPlayer = {
      id: socket.id,
      name: (playerName || 'Player 1').trim().slice(0, 18),
      avatar: avatar || { coatColor: '#1f2937', eyeColor: '#ef4444', maskStyle: 'shadow' },
      ready: true,
      role: 'player',
      hearts: MAX_HEARTS,
      inventory: [],
      buffs: { kevlar: false, ricochet: false, charm: false, visor: false, smokedTurns: 0 },
      isSpeaking: false,
    };

    const room = {
      code,
      name: (roomName || `ห้องของ ${hostPlayer.name}`).trim().slice(0, 28),
      isPublic: Boolean(isPublic),
      maxPlayers: Math.min(6, Math.max(2, Number(maxPlayers) || 2)),
      status: 'lobby',
      hostId: socket.id,
      roundNumber: 1,
      cylinder: [],
      turnPlayerId: null,
      winnerId: null,
      players: [hostPlayer],
      logs: [],
      chat: [
        {
          id: createUid(),
          senderId: 'system',
          senderName: 'SYSTEM',
          text: `สร้างห้อง ${code} สำเร็จ! แชร์รหัสห้องให้เพื่อนเข้าร่วมได้ทันที`,
          timestamp: Date.now(),
        },
      ],
    };

    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;

    socket.emit('room_joined', sanitizeRoomForClient(room));
    broadcastRoomList();
  });

  socket.on('join_room', ({ code, playerName, avatar }) => {
    const cleanCode = String(code || '').trim().toUpperCase();
    const room = rooms.get(cleanCode);
    if (!room) {
      socket.emit('room_error', 'ไม่พบรหัสห้องนี้ กรุณาตรวจสอบรหัสอีกครั้ง');
      return;
    }

    const activePlayers = room.players.filter((p) => p.role === 'player');
    const joinAsSpectator = room.status !== 'lobby' || activePlayers.length >= room.maxPlayers;

    const newPlayer = {
      id: socket.id,
      name: (playerName || `Player ${room.players.length + 1}`).trim().slice(0, 18),
      avatar: avatar || { coatColor: '#27272a', eyeColor: '#38bdf8', maskStyle: 'visor' },
      ready: false,
      role: joinAsSpectator ? 'spectator' : 'player',
      hearts: joinAsSpectator ? 0 : MAX_HEARTS,
      inventory: [],
      buffs: { kevlar: false, ricochet: false, charm: false, visor: false, smokedTurns: 0 },
      isSpeaking: false,
    };

    room.players.push(newPlayer);
    socket.join(cleanCode);
    socket.data.roomCode = cleanCode;

    room.chat.push({
      id: createUid(),
      senderId: 'system',
      senderName: 'SYSTEM',
      text: `${newPlayer.name} เข้าร่วมห้องในฐานะ ${
        joinAsSpectator ? 'ผู้ชม (Spectator)' : 'ผู้เล่น (Player)'
      }`,
      timestamp: Date.now(),
    });

    io.to(cleanCode).emit('room_updated', sanitizeRoomForClient(room));
    socket.emit('room_joined', sanitizeRoomForClient(room));
    broadcastRoomList();
  });

  socket.on('toggle_ready', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'lobby') return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p || p.role !== 'player') return;
    p.ready = !p.ready;
    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
  });

  socket.on('start_match', () => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.hostId !== socket.id) return;

    const activePlayers = room.players.filter((p) => p.role === 'player');
    if (activePlayers.length < 2) {
      socket.emit('room_error', 'ต้องมีผู้เล่นอย่างน้อย 2 คนในห้องจึงจะเริ่มเกมได้');
      return;
    }

    room.status = 'playing';
    room.winnerId = null;
    room.logs = [];
    for (const p of activePlayers) {
      p.hearts = MAX_HEARTS;
      p.inventory = [];
      p.buffs = { kevlar: false, ricochet: false, charm: false, visor: false, smokedTurns: 0 };
    }

    room.turnPlayerId = activePlayers[0].id;
    loadCylinderForRoom(room, 1, true);

    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
    broadcastRoomList();
  });

  // Broadcast live aim preview when current turn player hovers/selects a target
  socket.on('aim_preview', ({ targetId }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'playing' || room.turnPlayerId !== socket.id) return;
    io.to(code).emit('aim_preview', {
      shooterId: socket.id,
      targetId: targetId || null,
    });
  });

  socket.on('use_item', ({ uid }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'playing' || room.turnPlayerId !== socket.id) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player || player.hearts <= 0) return;

    const itemIdx = player.inventory.findIndex((i) => i.uid === uid);
    if (itemIdx === -1) return;

    const [used] = player.inventory.splice(itemIdx, 1);
    const itemId = used.itemId;
    const itemName = ITEM_NAMES[itemId];

    if (itemId === 'kevlar') {
      player.buffs.kevlar = true;
      addRoomLog(room, `${player.name} สวมใส่ [${itemName}] ป้องกันกระสุนจริงนัดถัดไป`, 'item');
    } else if (itemId === 'ricochet') {
      player.buffs.ricochet = true;
      addRoomLog(room, `${player.name} เปิดใช้งาน [${itemName}] เตรียมสะท้อนกระสุนกลับ!`, 'item');
    } else if (itemId === 'charm') {
      player.buffs.charm = true;
      addRoomLog(room, `${player.name} ติดตั้ง [${itemName}] ป้องกันการตาย 1 ครั้ง`, 'item');
    } else if (itemId === 'adrenaline') {
      player.hearts = Math.min(MAX_HEARTS, player.hearts + 1);
      addRoomLog(room, `${player.name} ฉีด [${itemName}] ฟื้นฟู +1 หัวใจ!`, 'success');
    } else if (itemId === 'smoke') {
      const nextId = getNextAlivePlayerId(room, player.id);
      const nextP = room.players.find((p) => p.id === nextId);
      if (nextP) {
        nextP.buffs.smokedTurns += 1;
        addRoomLog(room, `${player.name} ปา [${itemName}] บังคับข้ามเทิร์นของ ${nextP.name}!`, 'item');
      }
    } else if (itemId === 'visor') {
      player.buffs.visor = true;
      addRoomLog(room, `${player.name} เปิดใช้งาน [${itemName}] นัดถัดไปที่ยิงใส่จะพลาดเป้า!`, 'item');
    } else if (itemId === 'scanner') {
      const currentShell = room.cylinder[0];
      socket.emit('scan_result', { shell: currentShell });
      addRoomLog(room, `${player.name} ใช้ [${itemName}] แอบสแกนกระสุนในรังเพลิง...`, 'info');
    } else if (itemId === 'ejector') {
      const ejected = room.cylinder.shift();
      addRoomLog(
        room,
        `${player.name} ใช้ [${itemName}] ดีด "${
          ejected === 'live' ? 'กระสุนจริง' : 'กระสุนเปล่า'
        }" ออกจากรังเพลิง!`,
        'item'
      );
      io.to(code).emit('shell_ejected', { isLive: ejected === 'live' });
      if (room.cylinder.length === 0) {
        loadCylinderForRoom(room, room.roundNumber + 1, true);
      }
    }

    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
  });

  socket.on('fire_shot', ({ targetId }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room || room.status !== 'playing' || room.turnPlayerId !== socket.id) return;
    if (room.cylinder.length === 0) return;

    const shooter = room.players.find((p) => p.id === socket.id);
    const target = room.players.find((p) => p.id === targetId && p.role === 'player' && p.hearts > 0);
    if (!shooter || !target) return;

    const shell = room.cylinder.shift();
    const isSelfShot = shooter.id === target.id;
    let keepTurn = false;

    io.to(code).emit('shot_fired', {
      shooterId: shooter.id,
      targetId: target.id,
      isLive: shell === 'live',
    });

    if (!isSelfShot && target.buffs.visor) {
      target.buffs.visor = false;
      addRoomLog(
        room,
        `[แว่นเบี่ยงวิถี] ของ ${target.name} ทำงาน! กระสุนของ ${shooter.name} ถูกเบี่ยงออกนอกเป้า`,
        'success'
      );
      grantSurvivalDrop(room, target, 'เบี่ยงวิถีกระสุนสำเร็จ');
    } else if (shell === 'blank') {
      if (isSelfShot) {
        keepTurn = true;
        addRoomLog(
          room,
          `${shooter.name} ลั่นไกใส่ตัวเอง... แชะ! กระสุนเปล่า (ได้เล่นต่อ!)`,
          'success'
        );
        grantSurvivalDrop(room, shooter, 'ยิงตัวเองแล้วรอด');
      } else {
        if (target.buffs.ricochet) {
          target.buffs.ricochet = false;
          addRoomLog(room, `โล่สะท้อนกระสุนของ ${target.name} สลายไปเพราะเป็นกระสุนเปล่า`, 'info');
        }
        addRoomLog(room, `${shooter.name} ยิงใส่ ${target.name}... แชะ! กระสุนเปล่า`, 'neutral');
        grantSurvivalDrop(room, target, 'รอดจากการถูกยิง');
      }
    } else {
      if (!isSelfShot && target.buffs.ricochet) {
        target.buffs.ricochet = false;
        addRoomLog(
          room,
          `[โล่สะท้อนกระสุน] สะท้อนกระสุนจริงกลับใส่ ${shooter.name}! (-1 หัวใจ)`,
          'danger'
        );
        applyDamageWithCharm(room, shooter);
        grantSurvivalDrop(room, target, 'สะท้อนกระสุนรอดตาย');
      } else if (target.buffs.kevlar) {
        target.buffs.kevlar = false;
        addRoomLog(
          room,
          `[แผ่นเกราะเคฟลาร์] ของ ${target.name} รับกระสุนจริงเต็ม ๆ! ดาเมจกลายเป็น 0`,
          'success'
        );
        grantSurvivalDrop(room, target, 'เกราะกันกระสุนจริงสำเร็จ');
      } else {
        addRoomLog(room, `ปัง!! กระสุนจริงเข้าเป้า ${target.name} เสีย -1 หัวใจ`, 'danger');
        applyDamageWithCharm(room, target);
      }
    }

    const alivePlayers = room.players.filter((p) => p.role === 'player' && p.hearts > 0);
    if (alivePlayers.length <= 1) {
      room.status = 'ended';
      room.winnerId = alivePlayers[0]?.id || null;
      addRoomLog(
        room,
        `จบการแข่งขัน! ผู้รอดชีวิตคนสุดท้ายคือ ${alivePlayers[0]?.name || 'ไม่มีผู้รอดชีวิต'}`,
        'success'
      );
      io.to(code).emit('room_updated', sanitizeRoomForClient(room));
      broadcastRoomList();
      return;
    }

    let nextTurnId = keepTurn ? shooter.id : getNextAlivePlayerId(room, shooter.id);

    let guard = 0;
    while (guard < 6) {
      const candidate = room.players.find((p) => p.id === nextTurnId);
      if (candidate && candidate.buffs.smokedTurns > 0) {
        candidate.buffs.smokedTurns -= 1;
        addRoomLog(room, `${candidate.name} ติดม่านควัน [ระเบิดควัน]! ข้ามเทิร์นทันที`, 'info');
        nextTurnId = getNextAlivePlayerId(room, candidate.id);
        guard++;
      } else {
        break;
      }
    }

    room.turnPlayerId = nextTurnId;

    if (room.cylinder.length === 0) {
      loadCylinderForRoom(room, room.roundNumber + 1, true);
    }

    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
  });

  function applyDamageWithCharm(room, victim) {
    if (victim.hearts - 1 <= 0 && victim.buffs.charm) {
      victim.buffs.charm = false;
      victim.hearts = 1;
      addRoomLog(room, `[เครื่องรางกันตาย] ช่วยชีวิต ${victim.name} ไว้ที่ 1 หัวใจ!`, 'item');
      grantSurvivalDrop(room, victim, 'รอดตายจากเครื่องราง');
      return;
    }
    victim.hearts = Math.max(0, victim.hearts - 1);
    if (victim.hearts === 0) {
      victim.role = 'spectator';
      addRoomLog(room, `${victim.name} หัวใจหมดและเข้าสู่โหมดผู้ชม (Spectator)`, 'danger');
    }
  }

  socket.on('send_chat', ({ text }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;
    const clean = String(text || '').trim().slice(0, 160);
    if (!clean) return;

    room.chat.push({
      id: createUid(),
      senderId: p.id,
      senderName: p.name,
      text: clean,
      timestamp: Date.now(),
    });
    if (room.chat.length > 40) room.chat = room.chat.slice(-40);
    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
  });

  socket.on('voice_speaking', ({ isSpeaking }) => {
    const code = socket.data.roomCode;
    const room = rooms.get(code);
    if (!room) return;
    const p = room.players.find((x) => x.id === socket.id);
    if (!p) return;
    p.isSpeaking = Boolean(isSpeaking);
    socket.to(code).emit('room_updated', sanitizeRoomForClient(room));
  });

  function handleLeave(sock) {
    const code = sock.data.roomCode;
    if (!code) return;
    const room = rooms.get(code);
    sock.leave(code);
    sock.data.roomCode = null;
    if (!room) return;

    const leaving = room.players.find((p) => p.id === sock.id);
    room.players = room.players.filter((p) => p.id !== sock.id);

    if (room.players.length === 0) {
      rooms.delete(code);
      broadcastRoomList();
      return;
    }

    if (room.hostId === sock.id) {
      room.hostId = room.players[0].id;
    }

    if (leaving) {
      room.chat.push({
        id: createUid(),
        senderId: 'system',
        senderName: 'SYSTEM',
        text: `${leaving.name} ออกจากห้อง`,
        timestamp: Date.now(),
      });
    }

    if (room.status === 'playing') {
      const alive = room.players.filter((p) => p.role === 'player' && p.hearts > 0);
      if (alive.length <= 1) {
        room.status = 'ended';
        room.winnerId = alive[0]?.id || null;
      } else if (room.turnPlayerId === sock.id) {
        room.turnPlayerId = alive[0].id;
      }
    }

    io.to(code).emit('room_updated', sanitizeRoomForClient(room));
    broadcastRoomList();
  }

  socket.on('leave_room', () => handleLeave(socket));
  socket.on('disconnect', () => handleLeave(socket));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`[Last Round Server] Running on http://localhost:${PORT}`);
});
