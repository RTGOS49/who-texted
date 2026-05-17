import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { io } from "socket.io-client";
import {
  AlertCircle,
  Check,
  Coins,
  Copy,
  Crown,
  DoorOpen,
  Globe2,
  HelpCircle,
  Link2,
  Lock,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Send,
  Settings,
  ShoppingBag,
  Timer,
  UserPlus,
  Users,
  Wand2,
  X
} from "lucide-react";
import "./styles.css";

function getServerUrl() {
  const configuredUrl = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/+$/, "");
  if (configuredUrl) return configuredUrl;

  const isLocalBrowser = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  if (isLocalBrowser) return "http://localhost:3001";

  console.warn("VITE_SERVER_URL is not set. Falling back to same-origin backend.");
  return window.location.origin;
}

const SERVER_URL = getServerUrl();

const STORAGE_KEYS = {
  sessionId: "whoTexted.sessionId",
  nickname: "whoTexted.nickname",
  coins: "whoTexted.coins",
  ownedSkins: "whoTexted.ownedSkins",
  equippedSkin: "whoTexted.equippedSkin",
  customModes: "whoTexted.customModes",
  activeRoom: "whoTexted.activeRoom"
};

const DEFAULT_CUSTOM_JSON = JSON.stringify(
  {
    name: "Royal Mode",
    description: "Every message must sound royal.",
    rules: [
      { type: "mustEndWith", value: "your majesty" },
      { type: "maxLength", value: 80 }
    ],
    settings: {
      timerSeconds: 90,
      doublePoints: false,
      randomTwist: false
    }
  },
  null,
  2
);

function readJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getSessionId() {
  const existing = localStorage.getItem(STORAGE_KEYS.sessionId);
  if (existing) return existing;
  const generated =
    crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(STORAGE_KEYS.sessionId, generated);
  return generated;
}

function loadProfile() {
  return {
    sessionId: getSessionId(),
    nickname: localStorage.getItem(STORAGE_KEYS.nickname) || "",
    coins: Number(localStorage.getItem(STORAGE_KEYS.coins) || 0),
    ownedSkins: readJson(STORAGE_KEYS.ownedSkins, ["default"]),
    skinId: localStorage.getItem(STORAGE_KEYS.equippedSkin) || "default"
  };
}

function saveProfile(profile) {
  localStorage.setItem(STORAGE_KEYS.nickname, profile.nickname || "");
  localStorage.setItem(STORAGE_KEYS.coins, String(Math.max(0, profile.coins || 0)));
  localStorage.setItem(STORAGE_KEYS.ownedSkins, JSON.stringify(profile.ownedSkins || ["default"]));
  localStorage.setItem(STORAGE_KEYS.equippedSkin, profile.skinId || "default");
}

function cleanCode(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function Button({ children, className, icon: Icon, ...props }) {
  return (
    <button className={cx("button", className)} {...props}>
      {Icon ? <Icon size={18} aria-hidden="true" /> : null}
      <span>{children}</span>
    </button>
  );
}

function IconButton({ label, icon: Icon, className, ...props }) {
  return (
    <button className={cx("iconButton", className)} aria-label={label} title={label} {...props}>
      <Icon size={18} aria-hidden="true" />
    </button>
  );
}

function Pill({ children, tone = "plain" }) {
  return <span className={cx("pill", `pill-${tone}`)}>{children}</span>;
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <AlertCircle size={18} aria-hidden="true" />
      <span>{toast}</span>
      <button aria-label="Close message" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
}

function useTick(active) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 350);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

function useSavedCustomModes() {
  const [customModes, setCustomModes] = useState(() => readJson(STORAGE_KEYS.customModes, []));

  const saveCustomMode = (mode) => {
    const next = [
      mode,
      ...customModes.filter((existing) => existing.id !== mode.id && existing.name !== mode.name)
    ].slice(0, 12);
    setCustomModes(next);
    localStorage.setItem(STORAGE_KEYS.customModes, JSON.stringify(next));
  };

  return [customModes, saveCustomMode, setCustomModes];
}

function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [catalog, setCatalog] = useState({
    skins: [],
    gameModes: [],
    twistModes: [],
    communityGamemodes: []
  });
  const [profile, setProfile] = useState(loadProfile);
  const [roomState, setRoomState] = useState(null);
  const [queueState, setQueueState] = useState(null);
  const [view, setView] = useState("home");
  const [joinCode, setJoinCode] = useState(() => cleanCode(new URLSearchParams(location.search).get("room")));
  const [toast, setToast] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [customModes, saveCustomMode] = useSavedCustomModes();

  const skinById = useMemo(
    () => Object.fromEntries((catalog.skins || []).map((skin) => [skin.id, skin])),
    [catalog.skins]
  );

  useEffect(() => {
    saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    const socketClient = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnection: true
    });

    setSocket(socketClient);
    socketClient.on("connect", () => {
      setConnected(true);
      const activeRoom = localStorage.getItem(STORAGE_KEYS.activeRoom);
      if (activeRoom && profile.nickname.trim()) {
        socketClient.emit("joinPrivateRoom", { code: activeRoom, profile }, (response) => {
          if (response?.ok) {
            setView("room");
          } else {
            localStorage.removeItem(STORAGE_KEYS.activeRoom);
          }
        });
      }
    });
    socketClient.on("disconnect", () => setConnected(false));
    socketClient.on("catalog", setCatalog);
    socketClient.on("roomState", (state) => {
      setRoomState(state);
      setQueueState(null);
      setView("room");
      localStorage.setItem(STORAGE_KEYS.activeRoom, state.code);
    });
    socketClient.on("publicWaiting", (state) => {
      setQueueState(state);
      setView("queue");
    });
    socketClient.on("matchedPublicRoom", ({ code }) => {
      setToast(`Public room ${code} found. Mystery loading...`);
      localStorage.setItem(STORAGE_KEYS.activeRoom, code);
    });
    socketClient.on("chatReset", ({ line }) => {
      setChatMessages([{ id: "system", from: "system", text: line || "Say something suspicious." }]);
    });
    socketClient.on("chatMessage", (message) => {
      setChatMessages((messages) => [...messages, message]);
    });
    socketClient.on("toast", ({ message }) => setToast(message));
    socketClient.on("errorMessage", ({ message }) => setToast(message));
    socketClient.on("coinUpdate", ({ coins, earned, message }) => {
      setProfile((current) => ({ ...current, coins }));
      setToast(message || `You earned ${earned} coins.`);
    });

    fetch(`${SERVER_URL}/api/catalog`)
      .then((response) => response.json())
      .then(setCatalog)
      .catch(() => {});

    return () => socketClient.disconnect();
  }, []);

  useEffect(() => {
    if (!roomState?.round || roomState.status !== "chat") return;
    setChatMessages((messages) => (messages.length ? messages : [{ id: "system", from: "system", text: "You have one mystery friend. Find out who." }]));
  }, [roomState?.round?.number, roomState?.status]);

  const emitAck = (event, payload = {}) =>
    new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: "Still connecting to online mode." });
        return;
      }
      socket.emit(event, payload, (response) => resolve(response || { ok: true }));
    });

  const updateProfile = (patch) => {
    setProfile((current) => {
      const next = { ...current, ...patch };
      socket?.emit("updateProfile", { profile: next });
      return next;
    });
  };

  const requireNickname = () => {
    if (!profile.nickname.trim()) {
      setToast("Enter a nickname first. Suspicion needs a name.");
      return false;
    }
    return true;
  };

  const createPrivateRoom = async () => {
    if (!requireNickname()) return;
    const response = await emitAck("createPrivateRoom", { profile });
    if (!response.ok) {
      setToast(response.error);
      return;
    }
    setToast("Online room ready. Send the link.");
  };

  const joinPrivateRoom = async (code = joinCode) => {
    if (!requireNickname()) return;
    const response = await emitAck("joinPrivateRoom", { code: cleanCode(code), profile });
    if (!response.ok) {
      setToast(response.error);
      return;
    }
    setToast("You joined the room. Act natural.");
  };

  const joinPublicQueue = async () => {
    if (!requireNickname()) return;
    const response = await emitAck("joinPublicQueue", { profile });
    if (!response.ok) {
      setToast(response.error);
      return;
    }
    setQueueState({ count: 1, needed: 3, message: "Waiting for more players..." });
    setView("queue");
  };

  const leaveRoom = () => {
    socket?.emit("leaveRoom");
    localStorage.removeItem(STORAGE_KEYS.activeRoom);
    setRoomState(null);
    setQueueState(null);
    setChatMessages([]);
    setView("home");
  };

  const copyText = async (text, message) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(message);
    } catch {
      setToast(text);
    }
  };

  const activeSkin = skinById[profile.skinId] || skinById.default || { emoji: "💬", name: "Default Texter" };

  return (
    <div className="appShell">
      <header className="topbar">
        <button className="brandMark" onClick={() => setView(roomState ? "room" : "home")} aria-label="Who Texted home">
          <span className="brandIcon">?</span>
          <span>Who Texted?</span>
        </button>
        <div className="topbarActions">
          <div className="coinBadge" title="1 point = 1 coin">
            <Coins size={18} aria-hidden="true" />
            <span>{profile.coins}</span>
          </div>
          <button className="skinBadge" onClick={() => setView("shop")} title={activeSkin.name}>
            <span>{activeSkin.emoji}</span>
          </button>
          <span className={cx("connectionDot", connected && "isConnected")} title={connected ? "Online" : "Connecting"} />
        </div>
      </header>

      <main>
        {view === "home" ? (
          <HomeScreen
            profile={profile}
            setProfile={updateProfile}
            joinCode={joinCode}
            setJoinCode={setJoinCode}
            createPrivateRoom={createPrivateRoom}
            joinPrivateRoom={joinPrivateRoom}
            joinPublicQueue={joinPublicQueue}
            openShop={() => setView("shop")}
            openInstructions={() => setView("instructions")}
          />
        ) : null}

        {view === "queue" ? <PublicQueue queueState={queueState} leaveRoom={leaveRoom} /> : null}

        {view === "room" && roomState ? (
          <Room
            roomState={roomState}
            catalog={catalog}
            socket={socket}
            emitAck={emitAck}
            setToast={setToast}
            profile={profile}
            skinById={skinById}
            copyText={copyText}
            leaveRoom={leaveRoom}
            chatMessages={chatMessages}
            setChatMessages={setChatMessages}
            customModes={customModes}
            saveCustomMode={saveCustomMode}
          />
        ) : null}

        {view === "shop" ? (
          <SkinShop
            profile={profile}
            updateProfile={updateProfile}
            skins={catalog.skins}
            close={() => setView(roomState ? "room" : "home")}
            setToast={setToast}
          />
        ) : null}

        {view === "instructions" ? <Instructions close={() => setView("home")} /> : null}
      </main>

      <Toast toast={toast} onClose={() => setToast("")} />
    </div>
  );
}

function HomeScreen({
  profile,
  setProfile,
  joinCode,
  setJoinCode,
  createPrivateRoom,
  joinPrivateRoom,
  joinPublicQueue,
  openShop,
  openInstructions
}) {
  return (
    <section className="homeGrid">
      <div className="heroPanel">
        <div className="heroPhone" aria-hidden="true">
          <div className="phoneNotch" />
          <div className="bubble ghostBubble">who is this?</div>
          <div className="bubble youBubble">definitely not me</div>
          <div className="bubble ghostBubble small">sus</div>
          <div className="typingDots">
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className="heroCopy">
          <Pill tone="hot">Public browser party game</Pill>
          <h1>Who Texted?</h1>
          <p>Chat with a mystery friend. Guess who it was. Try not to get exposed.</p>
        </div>
      </div>

      <div className="homeCard">
        <label className="fieldLabel" htmlFor="nickname">
          Nickname
        </label>
        <input
          id="nickname"
          className="textInput"
          value={profile.nickname}
          maxLength={22}
          placeholder="Suspicious name"
          onChange={(event) => setProfile({ nickname: event.target.value })}
        />

        <div className="actionGrid">
          <Button className="primary" icon={Lock} onClick={createPrivateRoom}>
            Create Private Room
          </Button>
          <Button className="secondary" icon={Globe2} onClick={joinPublicQueue}>
            Online Public Match
          </Button>
        </div>

        <div className="joinRow">
          <input
            className="textInput codeInput"
            value={joinCode}
            placeholder="ROOM CODE"
            onChange={(event) => setJoinCode(cleanCode(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") joinPrivateRoom();
            }}
          />
          <Button className="primary compact" icon={UserPlus} onClick={() => joinPrivateRoom()}>
            Join
          </Button>
        </div>

        <div className="homeSecondary">
          <Button className="ghost" icon={ShoppingBag} onClick={openShop}>
            View Skins
          </Button>
          <Button className="ghost" icon={HelpCircle} onClick={openInstructions}>
            Simple Instructions
          </Button>
        </div>
      </div>
    </section>
  );
}

function PublicQueue({ queueState, leaveRoom }) {
  return (
    <section className="centerPanel queuePanel">
      <Pill tone="cool">Online Mode</Pill>
      <h2>Public matchmaking</h2>
      <div className="queueCounter">
        <Users size={30} aria-hidden="true" />
        <strong>{queueState?.count || 1}</strong>
        <span>waiting</span>
      </div>
      <p>{queueState?.message || "Waiting for one more player..."}</p>
      <p className="subtle">Public rooms start with 4, 6, or 8 players. Odd player out waits for the next room.</p>
      <Button className="ghost" icon={DoorOpen} onClick={leaveRoom}>
        Leave Queue
      </Button>
    </section>
  );
}

function Room(props) {
  const { roomState } = props;
  if (roomState.status === "chat") return <ChatPhase {...props} />;
  if (roomState.status === "guess") return <GuessPhase {...props} />;
  if (roomState.status === "reveal") return <RevealPhase {...props} />;
  return <Lobby {...props} />;
}

function Lobby({
  roomState,
  catalog,
  emitAck,
  setToast,
  skinById,
  copyText,
  leaveRoom,
  customModes,
  saveCustomMode
}) {
  const [customDraft, setCustomDraft] = useState(DEFAULT_CUSTOM_JSON);
  const [selectedSavedCustom, setSelectedSavedCustom] = useState("");
  const inviteUrl = `${location.origin}${location.pathname}?room=${roomState.code}`;
  const selectedTwist = catalog.twistModes.find((twist) => twist.id === roomState.twistId);
  const isBanLetter = selectedTwist?.needsValue === "bannedLetter";
  const oddPlayers = roomState.connectedCount >= 4 && roomState.connectedCount % 2 !== 0;

  const updateSettings = async (patch) => {
    const response = await emitAck("updateRoomSettings", patch);
    if (!response.ok) setToast(response.error);
  };

  const startGame = async () => {
    const response = await emitAck("startGame");
    if (!response.ok) setToast(response.error || "Need an even player count, minimum 4.");
  };

  const saveDraft = async () => {
    try {
      const parsed = JSON.parse(customDraft);
      const normalized = {
        id: parsed.id || `custom-${Date.now()}`,
        author: parsed.author || "You",
        createdAt: parsed.createdAt || new Date().toISOString().slice(0, 10),
        likes: parsed.likes || 0,
        uses: parsed.uses || 0,
        ...parsed
      };
      const response = await emitAck("updateRoomSettings", { customGamemode: normalized });
      if (!response.ok) {
        setToast(response.error);
        return;
      }
      saveCustomMode(normalized);
      setSelectedSavedCustom(normalized.id);
      setToast("Custom gamemode saved and selected.");
    } catch {
      setToast("Invalid gamemode JSON. The mystery parser is judging you.");
    }
  };

  const selectSavedCustom = async (customId) => {
    setSelectedSavedCustom(customId);
    const mode = customModes.find((custom) => custom.id === customId);
    const response = await emitAck("updateRoomSettings", { customGamemode: mode || null });
    if (!response.ok) setToast(response.error);
    if (mode) setCustomDraft(JSON.stringify(mode, null, 2));
  };

  return (
    <section className="roomLayout">
      <div className="roomHeader">
        <div>
          <Pill tone={roomState.type === "public" ? "cool" : "hot"}>
            {roomState.type === "public" ? "Public Room Mode" : "Private Room Mode"}
          </Pill>
          <h2>Room {roomState.code}</h2>
          <p>{roomState.type === "public" ? "Public matchmaking room" : "Only players with the code or link can join"}</p>
        </div>
        <div className="roomHeaderActions">
          <IconButton label="Copy room code" icon={Copy} onClick={() => copyText(roomState.code, "Room code copied.")} />
          <IconButton label="Copy invite link" icon={Link2} onClick={() => copyText(inviteUrl, "Invite link copied.")} />
          <IconButton label="Leave room" icon={DoorOpen} onClick={leaveRoom} />
        </div>
      </div>

      <div className="lobbyGrid">
        <section className="panel playerPanel">
          <div className="panelTitle">
            <Users size={20} />
            <h3>Players</h3>
            <Pill tone={roomState.canStart ? "good" : "warn"}>{roomState.connectedCount} online</Pill>
          </div>
          <div className="playerList">
            {roomState.players.map((player) => {
              const skin = skinById[player.skinId] || skinById.default || { emoji: "💬", name: "Default" };
              return (
                <div className={cx("playerCard", !player.connected && "isMuted")} key={player.id}>
                  <div className="avatar" title={skin.name}>
                    {skin.emoji}
                  </div>
                  <div>
                    <strong>{player.nickname}</strong>
                    <span>{player.connected ? `${player.score} pts · ${player.coins} coins` : "Disconnected"}</span>
                  </div>
                  {player.isHost ? (
                    <Pill tone="gold">
                      <Crown size={13} /> Host
                    </Pill>
                  ) : null}
                </div>
              );
            })}
          </div>

          {!roomState.canStart ? (
            <div className="ruleWarning">
              <AlertCircle size={18} />
              <span>
                {oddPlayers
                  ? "Need one more player so everyone gets a mystery friend."
                  : roomState.startBlockReason || "Need at least 4 players."}
              </span>
            </div>
          ) : (
            <div className="ruleGood">
              <Check size={18} />
              <span>Even player count. Every mystery chat will be 1-on-1.</span>
            </div>
          )}

          {roomState.viewerIsHost ? (
            <Button className="primary wide" icon={Play} onClick={startGame} disabled={!roomState.canStart}>
              Start Game
            </Button>
          ) : (
            <p className="subtle">Waiting for the host to start the round.</p>
          )}
        </section>

        <section className="panel settingsPanel">
          <div className="panelTitle">
            <Settings size={20} />
            <h3>Round Setup</h3>
          </div>
          <div className="settingsGrid">
            <label>
              <span>Gamemode</span>
              <select
                value={roomState.modeId}
                disabled={!roomState.viewerIsHost}
                onChange={(event) => updateSettings({ modeId: event.target.value })}
              >
                {catalog.gameModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Twist Mode</span>
              <select
                value={roomState.twistId}
                disabled={!roomState.viewerIsHost}
                onChange={(event) => updateSettings({ twistId: event.target.value })}
              >
                {catalog.twistModes.map((twist) => (
                  <option key={twist.id} value={twist.id}>
                    {twist.name}
                  </option>
                ))}
              </select>
            </label>
            {isBanLetter ? (
              <label>
                <span>Banned letter</span>
                <input
                  maxLength={1}
                  value={roomState.bannedLetter}
                  disabled={!roomState.viewerIsHost}
                  onChange={(event) => updateSettings({ bannedLetter: event.target.value })}
                />
              </label>
            ) : null}
            <label>
              <span>Community Gamemode</span>
              <select
                value={roomState.communityGamemodeId || ""}
                disabled={!roomState.viewerIsHost}
                onChange={(event) => updateSettings({ communityGamemodeId: event.target.value })}
              >
                <option value="">None selected</option>
                {catalog.communityGamemodes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Saved Custom</span>
              <select
                value={selectedSavedCustom}
                disabled={!roomState.viewerIsHost}
                onChange={(event) => selectSavedCustom(event.target.value)}
              >
                <option value="">No custom mode</option>
                {customModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="selectedRules">
            <Pill tone="plain">Selected: {catalog.gameModes.find((mode) => mode.id === roomState.modeId)?.shortName || "Classic"}</Pill>
            <Pill tone="plain">Twist: {selectedTwist?.name || "No Twist"}</Pill>
            {roomState.communityGamemodeId ? (
              <Pill tone="cool">
                Community: {catalog.communityGamemodes.find((mode) => mode.id === roomState.communityGamemodeId)?.name}
              </Pill>
            ) : null}
            {roomState.customGamemode ? <Pill tone="gold">Custom: {roomState.customGamemode.name}</Pill> : null}
          </div>

          {roomState.viewerIsHost ? (
            <details className="customEditor">
              <summary>
                <Wand2 size={18} /> Custom Gamemode JSON
              </summary>
              <textarea value={customDraft} onChange={(event) => setCustomDraft(event.target.value)} spellCheck="false" />
              <div className="editorActions">
                <Button className="secondary" icon={Save} onClick={saveDraft}>
                  Save and Use
                </Button>
                <Button className="ghost" icon={X} onClick={() => updateSettings({ customGamemode: null })}>
                  Clear Custom
                </Button>
              </div>
            </details>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function ChatPhase({ roomState, emitAck, setToast, chatMessages }) {
  const [message, setMessage] = useState("");
  const now = useTick(true);
  const remaining = Math.max(0, Math.ceil(((roomState.round?.phaseEndsAt || now) - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = String(remaining % 60).padStart(2, "0");
  const twist = roomState.round?.activeTwist;
  const roleplayPersona = roomState.round?.roleplayPersona;

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessage("");
    const response = await emitAck("sendChatMessage", { text });
    if (!response.ok) {
      setToast(response.error || "That message is illegal this round.");
      setMessage(text);
    }
  };

  return (
    <section className="chatShell">
      <div className="chatHeader">
        <div>
          <Pill tone="hot">Anonymous Chat</Pill>
          <h2>Mystery Friend</h2>
          <p>{twist?.prompt || "Don't make it obvious."}</p>
        </div>
        <div className="timerBadge">
          <Timer size={20} />
          <strong>
            {minutes}:{seconds}
          </strong>
        </div>
      </div>

      <div className="chatRuleBar">
        <Pill tone="plain">{roomState.round?.mode?.name}</Pill>
        <Pill tone={roomState.round?.randomTwist ? "warn" : "cool"}>{twist?.name || "No Twist"}</Pill>
        {roomState.round?.doublePoints ? <Pill tone="gold">Double points</Pill> : null}
        {roleplayPersona ? <Pill tone="hot">You are: {roleplayPersona}</Pill> : null}
      </div>

      <div className="messages">
        {chatMessages.map((chat) => (
          <div key={chat.id} className={cx("message", chat.from === "you" && "fromYou", chat.from === "system" && "systemMessage")}>
            <span>{chat.from === "you" ? "You" : chat.from === "system" ? "Round" : "Mystery Friend"}</span>
            <p>{chat.text}</p>
          </div>
        ))}
      </div>

      <form className="chatComposer" onSubmit={sendMessage}>
        <input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={280}
          placeholder="Say something suspicious."
        />
        <IconButton label="Send message" icon={Send} className="sendButton" />
      </form>
    </section>
  );
}

function GuessPhase({ roomState, emitAck, setToast, skinById }) {
  const [guessId, setGuessId] = useState(roomState.round?.viewerGuess || "");
  const activePlayers = roomState.players.filter((player) => roomState.round?.activePlayerIds.includes(player.id));
  const choices = activePlayers.filter((player) => player.id !== roomState.viewerId);
  const locked = roomState.round?.guessed;

  const submitGuess = async () => {
    if (!guessId) {
      setToast("Pick a mystery suspect first.");
      return;
    }
    const response = await emitAck("submitGuess", { guessId });
    if (!response.ok) setToast(response.error);
  };

  return (
    <section className="centerPanel guessPanel">
      <Pill tone="cool">Guess Phase</Pill>
      <h2>Who was that mystery texter?</h2>
      <p>Lock in one guess. No take-backs. Very dramatic.</p>

      <div className="guessGrid">
        {choices.map((player) => {
          const skin = skinById[player.skinId] || skinById.default || { emoji: "💬" };
          return (
            <button
              key={player.id}
              className={cx("guessCard", guessId === player.id && "selected")}
              disabled={locked}
              onClick={() => setGuessId(player.id)}
            >
              {!roomState.round?.noHints ? <span className="avatar">{skin.emoji}</span> : <span className="avatar">?</span>}
              <strong>{player.nickname}</strong>
            </button>
          );
        })}
      </div>

      <Button className="primary wide" icon={Check} disabled={locked} onClick={submitGuess}>
        {locked ? "Guess Locked" : "Lock Guess"}
      </Button>

      <p className="subtle">
        {roomState.round?.allGuessed ? "Everyone guessed. Reveal incoming." : "Waiting until everyone guesses."}
      </p>
    </section>
  );
}

function RevealPhase({ roomState, emitAck, setToast, skinById }) {
  const reveal = roomState.round?.reveal;
  const viewerScore = reveal?.scoreboard?.find((player) => player.id === roomState.viewerId);
  const nextRound = async () => {
    const response = await emitAck("nextRound");
    if (!response.ok) setToast(response.error);
  };

  return (
    <section className="revealLayout">
      <div className="roomHeader">
        <div>
          <Pill tone="gold">Reveal Phase</Pill>
          <h2>You got exposed.</h2>
          <p>Cha-ching. Mystery money earned. 1 point = 1 coin.</p>
        </div>
        {roomState.viewerIsHost ? (
          <Button className="primary" icon={RefreshCw} onClick={nextRound}>
            Next Round
          </Button>
        ) : (
          <Pill tone="plain">Waiting for host</Pill>
        )}
      </div>

      {viewerScore ? (
        <div className="earningsBanner">
          <Coins size={24} />
          <strong>You earned {viewerScore.roundCoins} coins.</strong>
          <span>Points became coins.</span>
        </div>
      ) : null}

      <div className="revealGrid">
        {reveal?.pairs?.map((pair) => (
          <PairReveal key={pair.id} pair={pair} skinById={skinById} details={reveal.scoring.details} />
        ))}
      </div>

      <section className="panel scoreboard">
        <div className="panelTitle">
          <Crown size={20} />
          <h3>Scoreboard</h3>
        </div>
        <div className="scoreRows">
          {reveal?.scoreboard?.map((player, index) => {
            const skin = skinById[player.skinId] || skinById.default || { emoji: "💬" };
            return (
              <div className="scoreRow" key={player.id}>
                <span className="rank">#{index + 1}</span>
                <span className="avatar">{skin.emoji}</span>
                <strong>{player.nickname}</strong>
                <span>+{player.roundPoints} pts</span>
                <span>{player.score} total</span>
                <span>+{player.roundCoins} coins</span>
                <span>{player.coins} coins</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

function PairReveal({ pair, skinById, details }) {
  const aSkin = skinById[pair.a.skinId] || skinById.default || { emoji: "💬" };
  const bSkin = skinById[pair.b.skinId] || skinById.default || { emoji: "💬" };
  const aDetails = details?.[pair.a.id];
  const bDetails = details?.[pair.b.id];

  return (
    <article className="pairCard">
      <div className="pairNames">
        <div>
          <span className="avatar">{aSkin.emoji}</span>
          <strong>{pair.a.nickname}</strong>
        </div>
        <MessageCircle size={22} />
        <div>
          <span className="avatar">{bSkin.emoji}</span>
          <strong>{pair.b.nickname}</strong>
        </div>
      </div>
      <div className="pairFacts">
        <p>
          <strong>{pair.a.nickname}</strong> guessed {pair.aGuess?.nickname || "nobody"}.
          <span className={pair.aCorrect ? "goodText" : "badText"}>{pair.aCorrect ? " Mystery solved." : " Absolutely fooled."}</span>
        </p>
        <p>
          <strong>{pair.b.nickname}</strong> guessed {pair.bGuess?.nickname || "nobody"}.
          <span className={pair.bCorrect ? "goodText" : "badText"}>{pair.bCorrect ? " They knew it." : " That disguise worked."}</span>
        </p>
      </div>
      <div className="miniScores">
        <Pill tone={aDetails?.correctGuess ? "good" : "plain"}>{pair.a.nickname}: +{pair.a.roundPoints} pts</Pill>
        <Pill tone={bDetails?.correctGuess ? "good" : "plain"}>{pair.b.nickname}: +{pair.b.roundPoints} pts</Pill>
      </div>
    </article>
  );
}

function SkinShop({ profile, updateProfile, skins, close, setToast }) {
  const owned = new Set(profile.ownedSkins || ["default"]);

  const buyOrEquip = (skin) => {
    if (owned.has(skin.id)) {
      updateProfile({ skinId: skin.id });
      setToast("Equipped.");
      return;
    }
    if (profile.coins < skin.price) {
      setToast("Not enough coins. Win rounds to earn more coins.");
      return;
    }
    updateProfile({
      coins: profile.coins - skin.price,
      ownedSkins: [...owned, skin.id],
      skinId: skin.id
    });
    setToast("Skin unlocked. Looking suspicious.");
  };

  return (
    <section className="shopLayout">
      <div className="roomHeader">
        <div>
          <Pill tone="gold">Skin Shop</Pill>
          <h2>No coins? No drip.</h2>
          <p>Skins stay hidden during anonymous chat and show up in lobbies, reveals, and scoreboards.</p>
        </div>
        <div className="roomHeaderActions">
          <div className="coinBadge big">
            <Coins size={20} />
            <span>{profile.coins}</span>
          </div>
          <IconButton label="Close shop" icon={X} onClick={close} />
        </div>
      </div>
      <div className="shopGrid">
        {skins.map((skin) => {
          const isOwned = owned.has(skin.id);
          const equipped = profile.skinId === skin.id;
          return (
            <article className={cx("shopCard", equipped && "equipped")} key={skin.id}>
              <div className="shopEmoji">{skin.emoji}</div>
              <h3>{skin.name}</h3>
              <p>{skin.description}</p>
              <div className="shopFooter">
                <Pill tone={skin.price === 0 ? "good" : "gold"}>{skin.price} coins</Pill>
                <Button className={equipped ? "ghost" : "secondary"} icon={equipped ? Check : ShoppingBag} onClick={() => buyOrEquip(skin)}>
                  {equipped ? "Equipped" : isOwned ? "Equip" : "Buy"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Instructions({ close }) {
  return (
    <section className="centerPanel instructions">
      <Pill tone="hot">Simple Instructions</Pill>
      <h2>Text. Guess. Get exposed.</h2>
      <ol>
        <li>Create a room or join with a code.</li>
        <li>Wait for an even number of players, minimum 4.</li>
        <li>Chat 1-on-1 with one mystery friend.</li>
        <li>Guess who it was, then watch the reveal.</li>
        <li>Earn points. Points become coins. Buy suspicious skins.</li>
      </ol>
      <Button className="primary" icon={Check} onClick={close}>
        Got It
      </Button>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
