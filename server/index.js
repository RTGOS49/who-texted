const path = require("path");
const fs = require("fs");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const {
  COMMUNITY_GAMEMODES,
  GAME_MODES,
  SKINS,
  TWIST_MODES,
  ROLEPLAY_PERSONAS
} = require("./gameData");
const {
  applyMessageRules,
  buildPartnerMap,
  buildRoundSettings,
  generateRoomCode,
  makePairs,
  normalizeNickname,
  publicRoom,
  sanitizeCode,
  scoreRound,
  validateCustomGamemode
} = require("./gameLogic");

const PORT = process.env.PORT || 3001;
const DISCONNECT_GRACE_MS = 9000;
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;

const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001"
];

function normalizeOrigin(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return trimmed;
  }
}

function parseOrigins(value) {
  return String(value || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean);
}

const allowedOrigins = new Set([
  ...LOCAL_ORIGINS,
  ...parseOrigins(process.env.FRONTEND_URL),
  ...parseOrigins(process.env.CORS_ORIGINS)
]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  const normalized = normalizeOrigin(origin);
  return allowedOrigins.has(normalized);
}

const corsOptions = {
  origin(origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  methods: ["GET", "POST", "OPTIONS"]
};

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

const rooms = new Map();
const publicQueue = [];

app.use(express.json({ limit: "200kb" }));
app.use((request, response, next) => {
  const origin = request.headers.origin;
  if (isOriginAllowed(origin)) {
    if (origin) response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (request.method === "OPTIONS") {
    response.sendStatus(isOriginAllowed(origin) ? 204 : 403);
    return;
  }
  next();
});

app.get("/health", (request, response) => {
  response.json({
    ok: true,
    message: "Who Texted backend is running",
    name: "Who Texted?",
    rooms: rooms.size,
    publicQueue: publicQueue.length
  });
});

app.get("/api/catalog", (request, response) => {
  response.json({
    skins: SKINS,
    gameModes: GAME_MODES,
    twistModes: TWIST_MODES,
    communityGamemodes: COMMUNITY_GAMEMODES
  });
});

const clientDist = path.join(__dirname, "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get("*", (request, response) => {
    response.sendFile(path.join(clientDist, "index.html"));
  });
} else {
  app.get("/", (request, response) => {
    response.type("text/plain").send("Who Texted backend is running");
  });
}

function createRoom(type = "private") {
  const code = generateRoomCode(rooms);
  const room = {
    code,
    type,
    status: "lobby",
    players: new Map(),
    hostId: null,
    modeId: "classic",
    twistId: "none",
    bannedLetter: "x",
    communityGamemodeId: "",
    customGamemode: null,
    round: null,
    roundNumber: 0,
    previousPairKeys: new Set(),
    timers: new Set(),
    disconnectTimers: new Map(),
    emptyRoomTimer: null,
    autoStartTimer: null
  };
  rooms.set(code, room);
  return room;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizeProfile(profile = {}) {
  const nickname = normalizeNickname(profile.nickname) || "Mystery Guest";
  const ownedSkins = Array.isArray(profile.ownedSkins)
    ? [...new Set(["default", ...profile.ownedSkins.map(String)])]
    : ["default"];
  const skinExists = SKINS.some((skin) => skin.id === profile.skinId);
  const skinId = skinExists && ownedSkins.includes(profile.skinId) ? profile.skinId : "default";
  const sessionId =
    typeof profile.sessionId === "string" && profile.sessionId.trim()
      ? profile.sessionId.trim().slice(0, 80)
      : `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    sessionId,
    nickname,
    coins: safeNumber(profile.coins, 0),
    ownedSkins,
    skinId
  };
}

function nicknameTaken(room, nickname, sessionId) {
  return Array.from(room.players.values()).some(
    (player) => player.id !== sessionId && player.nickname.toLowerCase() === nickname.toLowerCase()
  );
}

function publicQueueNicknameTaken(nickname, sessionId) {
  return publicQueue.some(
    (entry) => entry.sessionId !== sessionId && entry.profile.nickname.toLowerCase() === nickname.toLowerCase()
  );
}

function socketForPlayer(player) {
  return player?.socketId ? io.sockets.sockets.get(player.socketId) : null;
}

function clearRoomTimers(room) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers.clear();
  if (room.autoStartTimer) {
    clearTimeout(room.autoStartTimer);
    room.autoStartTimer = null;
  }
}

function scheduleRoomCleanup(room) {
  if (room.emptyRoomTimer) clearTimeout(room.emptyRoomTimer);
  const hasConnectedPlayers = Array.from(room.players.values()).some((player) => player.connected);
  if (hasConnectedPlayers) return;
  room.emptyRoomTimer = setTimeout(() => {
    const stillEmpty = Array.from(room.players.values()).every((player) => !player.connected);
    if (stillEmpty) {
      clearRoomTimers(room);
      rooms.delete(room.code);
    }
  }, EMPTY_ROOM_TTL_MS);
}

function migrateHost(room) {
  const currentHost = room.players.get(room.hostId);
  if (currentHost?.connected) return;

  const nextHost = Array.from(room.players.values()).find((player) => player.connected);
  room.hostId = nextHost?.id || null;
  room.players.forEach((player) => {
    player.isHost = player.id === room.hostId;
  });
}

function broadcastRoom(room) {
  migrateHost(room);
  room.players.forEach((player) => {
    const socket = socketForPlayer(player);
    if (socket) socket.emit("roomState", publicRoom(room, player.id));
  });
}

function emitRoomToast(room, message) {
  io.to(room.code).emit("toast", { message });
}

function addPlayerToRoom(room, socket, profile, allowInProgressReconnect = false) {
  const normalized = normalizeProfile(profile);
  const existing = room.players.get(normalized.sessionId);
  const isReconnect = Boolean(existing);

  if (room.status !== "lobby" && !isReconnect && !allowInProgressReconnect) {
    return { ok: false, error: "Room is already in progress. Try the next round." };
  }

  if (nicknameTaken(room, normalized.nickname, normalized.sessionId)) {
    return { ok: false, error: "Duplicate nickname. Add a tiny disguise." };
  }

  if (existing) {
    existing.nickname = normalized.nickname;
    existing.connected = true;
    existing.socketId = socket.id;
    existing.skinId = normalized.skinId;
    existing.ownedSkins = normalized.ownedSkins;
    existing.coins = Math.max(existing.coins, normalized.coins);
  } else {
    const shouldBeHost = !room.hostId;
    room.players.set(normalized.sessionId, {
      id: normalized.sessionId,
      socketId: socket.id,
      nickname: normalized.nickname,
      connected: true,
      isHost: shouldBeHost,
      score: 0,
      coins: normalized.coins,
      roundPoints: 0,
      roundCoins: 0,
      skinId: normalized.skinId,
      ownedSkins: normalized.ownedSkins
    });
    if (shouldBeHost) room.hostId = normalized.sessionId;
  }

  if (room.disconnectTimers.has(normalized.sessionId)) {
    clearTimeout(room.disconnectTimers.get(normalized.sessionId));
    room.disconnectTimers.delete(normalized.sessionId);
  }

  if (room.emptyRoomTimer) {
    clearTimeout(room.emptyRoomTimer);
    room.emptyRoomTimer = null;
  }

  socket.join(room.code);
  socket.data.roomCode = room.code;
  socket.data.sessionId = normalized.sessionId;
  socket.data.publicQueued = false;
  return { ok: true, player: room.players.get(normalized.sessionId), reconnected: isReconnect };
}

function activeConnectedPlayers(room) {
  return Array.from(room.players.values()).filter((player) => player.connected);
}

function canStartRound(room) {
  const connected = activeConnectedPlayers(room);
  if (connected.length < 4) return { ok: false, error: "Need at least 4 players." };
  if (connected.length % 2 !== 0) {
    return { ok: false, error: "Need one more player so everyone gets paired." };
  }
  return { ok: true, players: connected };
}

function assignRoleplay(playerIds) {
  return playerIds.reduce((roles, playerId) => {
    roles[playerId] = ROLEPLAY_PERSONAS[Math.floor(Math.random() * ROLEPLAY_PERSONAS.length)];
    return roles;
  }, {});
}

function startRound(room, reason = "host") {
  const startCheck = canStartRound(room);
  if (!startCheck.ok) {
    emitRoomToast(room, startCheck.error);
    broadcastRoom(room);
    return false;
  }

  clearRoomTimers(room);
  const activePlayers = startCheck.players;
  const activePlayerIds = activePlayers.map((player) => player.id);
  const pairs = makePairs(activePlayerIds, room.previousPairKeys);
  const partnerByPlayer = buildPartnerMap(pairs);
  const settings = buildRoundSettings(room);
  const phaseEndsAt = Date.now() + settings.timerSeconds * 1000;

  activePlayers.forEach((player) => {
    player.roundPoints = 0;
    player.roundCoins = 0;
  });

  room.previousPairKeys = new Set([...room.previousPairKeys, ...pairs.map((pair) => pair.key)]);
  room.roundNumber += 1;
  room.status = "chat";
  room.round = {
    number: room.roundNumber,
    activePlayerIds,
    pairs,
    partnerByPlayer,
    phaseEndsAt,
    settings,
    messages: {},
    guesses: {},
    reveal: null,
    roleplay: settings.activeTwist.roleplay ? assignRoleplay(activePlayerIds) : {},
    startedBy: reason
  };

  pairs.forEach((pair) => {
    room.round.messages[pair.key] = [];
  });

  broadcastRoom(room);
  io.to(room.code).emit("chatReset", {
    line: settings.activeTwist.prompt || "You have one mystery friend. Find out who."
  });

  const timer = setTimeout(() => transitionToGuess(room), settings.timerSeconds * 1000);
  room.timers.add(timer);
  return true;
}

function transitionToGuess(room) {
  if (!rooms.has(room.code) || room.status !== "chat" || !room.round) return;
  room.status = "guess";
  clearRoomTimers(room);
  broadcastRoom(room);
  emitRoomToast(room, "Who was that mystery texter?");
}

function buildReveal(room, scoring) {
  const players = Object.fromEntries(Array.from(room.players.values()).map((player) => [player.id, publicPlayerSnapshot(player)]));
  return {
    scoring,
    pairs: room.round.pairs.map((pair) => {
      const aGuess = room.round.guesses[pair.a] || null;
      const bGuess = room.round.guesses[pair.b] || null;
      return {
        id: pair.key,
        a: players[pair.a],
        b: players[pair.b],
        aGuess: aGuess ? players[aGuess] : null,
        bGuess: bGuess ? players[bGuess] : null,
        aCorrect: aGuess === pair.b,
        bCorrect: bGuess === pair.a,
        aFooled: bGuess !== pair.a,
        bFooled: aGuess !== pair.b
      };
    }),
    scoreboard: Array.from(room.players.values())
      .map(publicPlayerSnapshot)
      .sort((a, b) => b.score - a.score || a.nickname.localeCompare(b.nickname))
  };
}

function publicPlayerSnapshot(player) {
  return {
    id: player.id,
    nickname: player.nickname,
    connected: player.connected,
    isHost: player.isHost,
    score: player.score,
    coins: player.coins,
    roundPoints: player.roundPoints || 0,
    roundCoins: player.roundCoins || 0,
    skinId: player.skinId || "default"
  };
}

function transitionToReveal(room) {
  if (!rooms.has(room.code) || room.status !== "guess" || !room.round) return;
  const scoring = scoreRound(room);
  room.round.reveal = buildReveal(room, scoring);
  room.status = "reveal";
  room.round.activePlayerIds.forEach((playerId) => {
    const player = room.players.get(playerId);
    const socket = socketForPlayer(player);
    if (socket) {
      socket.emit("coinUpdate", {
        coins: player.coins,
        earned: scoring.coins[playerId],
        message: `You earned ${scoring.coins[playerId]} coins. Points became coins.`
      });
    }
  });
  broadcastRoom(room);
}

function abortRound(room, message) {
  clearRoomTimers(room);
  room.status = "lobby";
  room.round = null;
  emitRoomToast(room, message || "A player left, so the round returned to lobby.");
  broadcastRoom(room);
}

function findRoomForSocket(socket) {
  const code = socket.data.roomCode;
  if (!code) return null;
  return rooms.get(code) || null;
}

function leavePublicQueue(socket, silent = false) {
  const before = publicQueue.length;
  for (let index = publicQueue.length - 1; index >= 0; index -= 1) {
    if (publicQueue[index].socketId === socket.id || publicQueue[index].sessionId === socket.data.sessionId) {
      publicQueue.splice(index, 1);
    }
  }
  socket.data.publicQueued = false;
  if (!silent && before !== publicQueue.length) {
    updatePublicQueueClients();
  }
}

function updatePublicQueueClients() {
  publicQueue.forEach((entry) => {
    const socket = io.sockets.sockets.get(entry.socketId);
    if (socket) {
      const needed = publicQueue.length < 4 ? 4 - publicQueue.length : publicQueue.length % 2 === 0 ? 0 : 1;
      socket.emit("publicWaiting", {
        count: publicQueue.length,
        needed,
        message:
          needed > 0
            ? needed === 1
              ? "Waiting for one more player..."
              : `Waiting for ${needed} more players...`
            : "Online room ready. Send the link."
      });
    }
  });
}

function runPublicMatchmaking() {
  while (publicQueue.length >= 4) {
    let takeCount = Math.min(publicQueue.length, 8);
    if (takeCount % 2 !== 0) takeCount -= 1;
    if (takeCount < 4) break;

    const entries = publicQueue.splice(0, takeCount);
    const room = createRoom("public");
    room.modeId = "classic";
    room.twistId = "none";

    entries.forEach((entry) => {
      const socket = io.sockets.sockets.get(entry.socketId);
      if (!socket) return;
      addPlayerToRoom(room, socket, entry.profile, true);
      socket.emit("matchedPublicRoom", { code: room.code });
    });

    broadcastRoom(room);
    emitRoomToast(room, "Online room ready. Send the link.");
    room.autoStartTimer = setTimeout(() => {
      startRound(room, "public-matchmaking");
    }, 3500);
  }

  updatePublicQueueClients();
}

function handleRoundDisconnect(room, playerId) {
  if (!room.round?.activePlayerIds.includes(playerId)) return;
  emitRoomToast(room, "A mystery texter disconnected. Holding the room for a few seconds...");

  const timer = setTimeout(() => {
    const player = room.players.get(playerId);
    if (player && !player.connected && room.round?.activePlayerIds.includes(playerId)) {
      abortRound(room, "A mystery chat lost a player, so everyone is back in the lobby.");
    }
  }, DISCONNECT_GRACE_MS);
  room.disconnectTimers.set(playerId, timer);
}

function wireSocket(socket) {
  socket.emit("catalog", {
    skins: SKINS,
    gameModes: GAME_MODES,
    twistModes: TWIST_MODES,
    communityGamemodes: COMMUNITY_GAMEMODES
  });

  socket.on("createPrivateRoom", (payload = {}, callback) => {
    leavePublicQueue(socket, true);
    const room = createRoom("private");
    const result = addPlayerToRoom(room, socket, payload.profile);
    if (!result.ok) {
      rooms.delete(room.code);
      callback?.({ ok: false, error: result.error });
      return;
    }

    callback?.({ ok: true, code: room.code });
    broadcastRoom(room);
  });

  socket.on("joinPrivateRoom", (payload = {}, callback) => {
    leavePublicQueue(socket, true);
    const code = sanitizeCode(payload.code);
    const room = rooms.get(code);
    if (!room) {
      callback?.({ ok: false, error: "Room not found. Check the code and try again." });
      return;
    }

    const isReconnect = room.players.has(normalizeProfile(payload.profile).sessionId);
    const result = addPlayerToRoom(room, socket, payload.profile, isReconnect);
    if (!result.ok) {
      callback?.({ ok: false, error: result.error });
      return;
    }

    callback?.({ ok: true, code: room.code });
    if (result.reconnected && room.status !== "lobby") {
      socket.emit("toast", { message: "Reconnected. Try not to make it obvious." });
    }
    broadcastRoom(room);
  });

  socket.on("joinPublicQueue", (payload = {}, callback) => {
    const profile = normalizeProfile(payload.profile);
    leavePublicQueue(socket, true);
    if (publicQueueNicknameTaken(profile.nickname, profile.sessionId)) {
      callback?.({ ok: false, error: "That nickname is already waiting. Add a tiny disguise." });
      return;
    }

    socket.data.roomCode = null;
    socket.data.sessionId = profile.sessionId;
    socket.data.publicQueued = true;
    publicQueue.push({
      socketId: socket.id,
      sessionId: profile.sessionId,
      profile,
      joinedAt: Date.now()
    });

    callback?.({ ok: true });
    updatePublicQueueClients();
    runPublicMatchmaking();
  });

  socket.on("leaveRoom", () => {
    leavePublicQueue(socket);
    const room = findRoomForSocket(socket);
    const player = room?.players.get(socket.data.sessionId);
    if (room && player) {
      player.connected = false;
      player.socketId = null;
      socket.leave(room.code);
      migrateHost(room);
      broadcastRoom(room);
      scheduleRoomCleanup(room);
    }
    socket.data.roomCode = null;
  });

  socket.on("updateProfile", (payload = {}) => {
    const room = findRoomForSocket(socket);
    const player = room?.players.get(socket.data.sessionId);
    if (!room || !player) return;

    const profile = normalizeProfile(payload.profile);
    if (nicknameTaken(room, profile.nickname, player.id)) {
      socket.emit("errorMessage", { message: "Duplicate nickname. Add a tiny disguise." });
      return;
    }

    player.nickname = profile.nickname;
    player.skinId = profile.skinId;
    player.ownedSkins = profile.ownedSkins;
    player.coins = profile.coins;
    broadcastRoom(room);
  });

  socket.on("updateRoomSettings", (payload = {}, callback) => {
    const room = findRoomForSocket(socket);
    const player = room?.players.get(socket.data.sessionId);
    if (!room || !player?.isHost) {
      callback?.({ ok: false, error: "Only the host can change the mystery rules." });
      return;
    }
    if (room.status !== "lobby" && room.status !== "reveal") {
      callback?.({ ok: false, error: "Settings are locked during the round." });
      return;
    }

    if (payload.modeId && GAME_MODES.some((mode) => mode.id === payload.modeId)) {
      room.modeId = payload.modeId;
    }
    if (typeof payload.twistId === "string" && TWIST_MODES.some((twist) => twist.id === payload.twistId)) {
      room.twistId = payload.twistId;
    }
    if (typeof payload.bannedLetter === "string" && /^[a-z]$/i.test(payload.bannedLetter.trim())) {
      room.bannedLetter = payload.bannedLetter.trim().toLowerCase();
    }
    if (typeof payload.communityGamemodeId === "string") {
      room.communityGamemodeId = COMMUNITY_GAMEMODES.some((mode) => mode.id === payload.communityGamemodeId)
        ? payload.communityGamemodeId
        : "";
    }
    if (Object.prototype.hasOwnProperty.call(payload, "customGamemode")) {
      const validated = validateCustomGamemode(payload.customGamemode);
      if (!validated.ok) {
        callback?.({ ok: false, error: validated.error });
        return;
      }
      room.customGamemode = validated.gamemode;
    }

    callback?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("startGame", (payload = {}, callback) => {
    const room = findRoomForSocket(socket);
    const player = room?.players.get(socket.data.sessionId);
    if (!room || !player?.isHost) {
      callback?.({ ok: false, error: "Only the host can start the drama." });
      return;
    }
    if (room.status !== "lobby" && room.status !== "reveal") {
      callback?.({ ok: false, error: "A round is already in progress." });
      return;
    }
    const ok = startRound(room, "host");
    callback?.(ok ? { ok: true } : { ok: false, error: "Need an even player count, minimum 4." });
  });

  socket.on("sendChatMessage", (payload = {}, callback) => {
    const room = findRoomForSocket(socket);
    const playerId = socket.data.sessionId;
    const player = room?.players.get(playerId);
    if (!room || room.status !== "chat" || !room.round || !player) {
      callback?.({ ok: false, error: "Chat is not open right now." });
      return;
    }
    if (!room.round.activePlayerIds.includes(playerId)) {
      callback?.({ ok: false, error: "You are watching this round from the lobby." });
      return;
    }

    const result = applyMessageRules(payload.text, room.round.settings.rules);
    if (!result.ok) {
      callback?.({ ok: false, error: result.error || "That message is illegal this round." });
      return;
    }

    const partnerId = room.round.partnerByPlayer[playerId];
    const partner = room.players.get(partnerId);
    const message = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: result.text,
      sentAt: Date.now()
    };

    const key = [playerId, partnerId].sort().join(":");
    room.round.messages[key]?.push({ ...message, from: playerId });

    const senderSocket = socketForPlayer(player);
    const partnerSocket = socketForPlayer(partner);
    senderSocket?.emit("chatMessage", { ...message, from: "you" });
    partnerSocket?.emit("chatMessage", { ...message, from: "mystery" });
    callback?.({ ok: true, text: result.text });
  });

  socket.on("submitGuess", (payload = {}, callback) => {
    const room = findRoomForSocket(socket);
    const playerId = socket.data.sessionId;
    if (!room || room.status !== "guess" || !room.round) {
      callback?.({ ok: false, error: "Guessing is not open right now." });
      return;
    }
    if (!room.round.activePlayerIds.includes(playerId)) {
      callback?.({ ok: false, error: "You are not guessing this round." });
      return;
    }
    if (room.round.guesses[playerId]) {
      callback?.({ ok: false, error: "Guess already locked. No take-backs." });
      return;
    }

    const guessId = String(payload.guessId || "");
    if (guessId === playerId || !room.round.activePlayerIds.includes(guessId)) {
      callback?.({ ok: false, error: "Pick another player from this round." });
      return;
    }

    room.round.guesses[playerId] = guessId;
    callback?.({ ok: true });
    broadcastRoom(room);

    const everyoneGuessed = room.round.activePlayerIds.every((id) => Boolean(room.round.guesses[id]));
    if (everyoneGuessed) {
      transitionToReveal(room);
    }
  });

  socket.on("nextRound", (payload = {}, callback) => {
    const room = findRoomForSocket(socket);
    const player = room?.players.get(socket.data.sessionId);
    if (!room || !player?.isHost) {
      callback?.({ ok: false, error: "Only the host can cue the next mystery." });
      return;
    }
    if (room.status !== "reveal") {
      callback?.({ ok: false, error: "Finish the reveal first." });
      return;
    }
    room.status = "lobby";
    room.round = null;
    callback?.({ ok: true });
    broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    leavePublicQueue(socket);
    const room = findRoomForSocket(socket);
    if (!room) return;

    const player = room.players.get(socket.data.sessionId);
    if (!player) return;

    player.connected = false;
    player.socketId = null;
    migrateHost(room);

    if (room.status === "chat" || room.status === "guess") {
      handleRoundDisconnect(room, player.id);
    }

    broadcastRoom(room);
    scheduleRoomCleanup(room);
  });
}

io.on("connection", wireSocket);

server.listen(PORT, () => {
  console.log(`Who Texted? server listening on port ${PORT}`);
  if (process.env.NODE_ENV !== "production") {
    console.log(`Local backend URL: http://localhost:${PORT}`);
  }
});
