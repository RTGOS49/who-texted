const {
  GAME_MODES,
  TWIST_MODES,
  COMMUNITY_GAMEMODES,
  ROLEPLAY_PERSONAS
} = require("./gameData");

const SUPPORTED_CUSTOM_RULES = new Set([
  "banLetter",
  "banWord",
  "mustInclude",
  "mustStartWith",
  "mustEndWith",
  "maxLength",
  "minLength",
  "onlyEmojis",
  "noEmojis",
  "oneWordOnly",
  "questionsOnly",
  "transformUppercase",
  "transformLowercase",
  "appendText",
  "randomTwist",
  "doublePoints",
  "customTimer"
]);

const FUNNY_REVEAL_COPY = [
  "You got exposed.",
  "They knew it was you.",
  "Mystery solved.",
  "Absolutely fooled.",
  "That was way too obvious.",
  "You text like yourself."
];

function generateRoomCode(existingRooms) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (existingRooms.has(code));

  return code;
}

function normalizeNickname(nickname) {
  return String(nickname || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 22);
}

function sanitizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function isEmojiOnly(value) {
  const compact = String(value || "").replace(/\s+/g, "");
  if (!compact) return false;
  return /^[\p{Extended_Pictographic}\u200d\ufe0f]+$/u.test(compact);
}

function hasEmoji(value) {
  return /\p{Extended_Pictographic}/u.test(String(value || ""));
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function pairKey(a, b) {
  return [a, b].sort().join(":");
}

function makePairs(playerIds, previousPairKeys = new Set()) {
  if (playerIds.length < 4 || playerIds.length % 2 !== 0) {
    throw new Error("Rounds require an even number of players, minimum 4.");
  }

  let bestPairs = null;
  let bestRepeatCount = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < 160; attempt += 1) {
    const shuffled = shuffle(playerIds);
    const pairs = [];
    let repeatCount = 0;

    for (let index = 0; index < shuffled.length; index += 2) {
      const a = shuffled[index];
      const b = shuffled[index + 1];
      const key = pairKey(a, b);
      if (previousPairKeys.has(key)) repeatCount += 1;
      pairs.push({ a, b, key });
    }

    if (repeatCount < bestRepeatCount) {
      bestPairs = pairs;
      bestRepeatCount = repeatCount;
      if (repeatCount === 0) break;
    }
  }

  return bestPairs;
}

function buildPartnerMap(pairs) {
  return pairs.reduce((map, pair) => {
    map[pair.a] = pair.b;
    map[pair.b] = pair.a;
    return map;
  }, {});
}

function getRandomRevealCopy() {
  return FUNNY_REVEAL_COPY[Math.floor(Math.random() * FUNNY_REVEAL_COPY.length)];
}

function getMode(modeId) {
  return GAME_MODES.find((mode) => mode.id === modeId) || GAME_MODES[0];
}

function getTwist(twistId) {
  return TWIST_MODES.find((twist) => twist.id === twistId) || TWIST_MODES[0];
}

function getCommunityGamemode(gamemodeId) {
  return COMMUNITY_GAMEMODES.find((gamemode) => gamemode.id === gamemodeId) || null;
}

function resolveTwistRules(twist, room) {
  return (twist.rules || []).map((rule) => {
    if (!rule.valueFrom) return { ...rule };
    return { ...rule, value: room[rule.valueFrom] || "" };
  });
}

function normalizeCustomRule(rule) {
  if (!rule || typeof rule !== "object") {
    return { ok: false, error: "Each rule must be an object." };
  }

  const type = String(rule.type || "").trim();
  if (!SUPPORTED_CUSTOM_RULES.has(type)) {
    return { ok: false, error: `Unsupported custom rule: ${type || "blank"}.` };
  }

  const needsString = [
    "banLetter",
    "banWord",
    "mustInclude",
    "mustStartWith",
    "mustEndWith",
    "appendText"
  ];
  const needsNumber = ["maxLength", "minLength", "customTimer"];

  if (needsString.includes(type)) {
    const value = String(rule.value || "").trim();
    if (!value) return { ok: false, error: `${type} needs a value.` };
    if (type === "banLetter" && !/^[a-z]$/i.test(value)) {
      return { ok: false, error: "banLetter must be one letter." };
    }
    if (value.length > 80) {
      return { ok: false, error: `${type} value is too long.` };
    }
    return { ok: true, rule: { type, value } };
  }

  if (needsNumber.includes(type)) {
    const value = Number(rule.value);
    if (!Number.isInteger(value)) return { ok: false, error: `${type} needs a whole number.` };
    if ((type === "maxLength" || type === "minLength") && (value < 1 || value > 500)) {
      return { ok: false, error: `${type} must be between 1 and 500.` };
    }
    if (type === "customTimer" && (value < 15 || value > 300)) {
      return { ok: false, error: "customTimer must be between 15 and 300 seconds." };
    }
    return { ok: true, rule: { type, value } };
  }

  return { ok: true, rule: { type } };
}

function validateCustomGamemode(input) {
  if (!input) {
    return { ok: true, gamemode: null };
  }

  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch (error) {
      return { ok: false, error: "Custom gamemode JSON is not valid." };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "Custom gamemode must be an object." };
  }

  const name = String(parsed.name || "").trim().slice(0, 32);
  if (!name) return { ok: false, error: "Custom gamemode needs a name." };

  const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
  if (rules.length > 12) return { ok: false, error: "Custom gamemodes can use up to 12 rules." };

  const normalizedRules = [];
  for (const rule of rules) {
    const result = normalizeCustomRule(rule);
    if (!result.ok) return result;
    normalizedRules.push(result.rule);
  }

  const settings = parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
  const timerFromSettings = Number(settings.timerSeconds);

  return {
    ok: true,
    gamemode: {
      id: String(parsed.id || `custom-${Date.now()}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
      name,
      description: String(parsed.description || "").trim().slice(0, 140),
      author: String(parsed.author || "You").trim().slice(0, 32),
      rules: normalizedRules,
      settings: {
        timerSeconds:
          Number.isInteger(timerFromSettings) && timerFromSettings >= 15 && timerFromSettings <= 300
            ? timerFromSettings
            : undefined,
        doublePoints: settings.doublePoints === true,
        randomTwist: settings.randomTwist === true
      },
      createdAt: String(parsed.createdAt || new Date().toISOString().slice(0, 10)),
      likes: Number.isInteger(parsed.likes) ? parsed.likes : 0,
      uses: Number.isInteger(parsed.uses) ? parsed.uses : 0
    }
  };
}

function deriveCustomSettings(rules) {
  return rules.reduce(
    (settings, rule) => {
      if (rule.type === "customTimer") settings.timerSeconds = rule.value;
      if (rule.type === "doublePoints") settings.doublePoints = true;
      if (rule.type === "randomTwist") settings.randomTwist = true;
      return settings;
    },
    { timerSeconds: undefined, doublePoints: false, randomTwist: false }
  );
}

function buildRoundSettings(room) {
  const mode = getMode(room.modeId);
  const community = getCommunityGamemode(room.communityGamemodeId);
  const custom = room.customGamemode || null;
  const customRuleSettings = custom ? deriveCustomSettings(custom.rules || []) : {};
  const shouldPickRandomTwist =
    mode.randomTwist ||
    community?.settings?.randomTwist ||
    custom?.settings?.randomTwist ||
    customRuleSettings.randomTwist;
  const possibleTwists = TWIST_MODES.filter((twist) => twist.id !== "none");
  const activeTwist = shouldPickRandomTwist
    ? possibleTwists[Math.floor(Math.random() * possibleTwists.length)]
    : getTwist(room.twistId);

  const timerSeconds =
    customRuleSettings.timerSeconds ||
    custom?.settings?.timerSeconds ||
    community?.settings?.timerSeconds ||
    mode.timerSeconds;
  const doublePoints =
    mode.doublePoints ||
    community?.settings?.doublePoints ||
    custom?.settings?.doublePoints ||
    customRuleSettings.doublePoints;

  return {
    mode,
    community,
    custom,
    activeTwist,
    timerSeconds,
    doublePoints,
    noHints: Boolean(mode.noHints),
    rules: [
      ...resolveTwistRules(activeTwist, room),
      ...(community?.rules || []),
      ...(custom?.rules || []).filter(
        (rule) => !["customTimer", "doublePoints", "randomTwist"].includes(rule.type)
      )
    ],
    randomTwist: shouldPickRandomTwist
  };
}

function injectTypo(text) {
  if (text.length < 4) return text;
  const index = Math.floor(Math.random() * (text.length - 1));
  if (/\s/.test(text[index]) || /\s/.test(text[index + 1])) return text;
  return `${text.slice(0, index)}${text[index + 1]}${text[index]}${text.slice(index + 2)}`;
}

function applyMessageRules(originalText, rules) {
  let text = String(originalText || "").trim();
  if (!text) {
    return { ok: false, error: "Say something suspicious first." };
  }

  if (text.length > 280) {
    return { ok: false, error: "That message is doing too much. Keep it under 280 characters." };
  }

  for (const rule of rules) {
    const value = typeof rule.value === "string" ? rule.value : rule.value;
    const lowerText = text.toLowerCase();

    if (rule.type === "banLetter" && value && lowerText.includes(String(value).toLowerCase())) {
      return { ok: false, error: `That message is illegal this round. No letter ${String(value).toUpperCase()}.` };
    }
    if (rule.type === "banWord" && value && lowerText.includes(String(value).toLowerCase())) {
      return { ok: false, error: `That word is banned this round: ${value}.` };
    }
    if (rule.type === "mustInclude" && value && !lowerText.includes(String(value).toLowerCase())) {
      return { ok: false, error: `This round needs "${value}" in every message.` };
    }
    if (rule.type === "mustIncludeAny") {
      const options = Array.isArray(value) ? value : [];
      if (!options.some((option) => lowerText.includes(String(option).toLowerCase()))) {
        return { ok: false, error: `This round needs one of: ${options.join(", ")}.` };
      }
    }
    if (rule.type === "mustStartWith" && value && !lowerText.startsWith(String(value).toLowerCase())) {
      return { ok: false, error: `Start with "${value}".` };
    }
    if (rule.type === "mustEndWith" && value && !lowerText.endsWith(String(value).toLowerCase())) {
      const overCopy = String(value).toLowerCase() === "over" ? "You forgot to say over." : `End with "${value}".`;
      return { ok: false, error: overCopy };
    }
    if (rule.type === "maxLength" && text.length > Number(value)) {
      return { ok: false, error: `Tiny Text Mode says ${value} characters max.` };
    }
    if (rule.type === "minLength" && text.length < Number(value)) {
      return { ok: false, error: `Long Talker Mode needs at least ${value} characters.` };
    }
    if (rule.type === "onlyEmojis" && !isEmojiOnly(text)) {
      return { ok: false, error: "Only emojis this round. Words are suspiciously illegal." };
    }
    if (rule.type === "noEmojis" && hasEmoji(text)) {
      return { ok: false, error: "No emojis this round. That little face is evidence." };
    }
    if (rule.type === "oneWordOnly" && text.split(/\s+/).filter(Boolean).length !== 1) {
      return { ok: false, error: "One word. ONE." };
    }
    if (rule.type === "questionsOnly" && !text.endsWith("?")) {
      return { ok: false, error: "Questions only. Add a ?" };
    }
    if (rule.type === "noVowels" && /[aeiou]/i.test(text)) {
      return { ok: false, error: "No vowels. That message is too readable." };
    }
    if (rule.type === "transformUppercase") {
      text = text.toUpperCase();
    }
    if (rule.type === "transformLowercase") {
      text = text.toLowerCase();
    }
    if (rule.type === "appendText" && value) {
      text = `${text} ${value}`.trim();
    }
    if (rule.type === "typoMode") {
      text = injectTypo(text);
    }
  }

  return { ok: true, text };
}

function scoreRound(room) {
  const round = room.round;
  const multiplier = round.settings.doublePoints ? 2 : 1;
  const points = {};
  const coins = {};
  const details = {};

  round.activePlayerIds.forEach((playerId) => {
    points[playerId] = 0;
    details[playerId] = {
      correctGuess: false,
      fooledMysteryFriend: false,
      mutualBonus: false,
      copy: getRandomRevealCopy()
    };
  });

  round.activePlayerIds.forEach((playerId) => {
    const partnerId = round.partnerByPlayer[playerId];
    const guessId = round.guesses[playerId];
    if (guessId === partnerId) {
      points[playerId] += 2;
      details[playerId].correctGuess = true;
    }
  });

  round.activePlayerIds.forEach((playerId) => {
    const partnerId = round.partnerByPlayer[playerId];
    if (round.guesses[partnerId] !== playerId) {
      points[playerId] += 1;
      details[playerId].fooledMysteryFriend = true;
    }
  });

  round.pairs.forEach((pair) => {
    const aCorrect = round.guesses[pair.a] === pair.b;
    const bCorrect = round.guesses[pair.b] === pair.a;
    if (aCorrect && bCorrect) {
      points[pair.a] += 1;
      points[pair.b] += 1;
      details[pair.a].mutualBonus = true;
      details[pair.b].mutualBonus = true;
    }
  });

  round.activePlayerIds.forEach((playerId) => {
    points[playerId] *= multiplier;
    coins[playerId] = points[playerId];

    const player = room.players.get(playerId);
    if (player) {
      player.score += points[playerId];
      player.coins += coins[playerId];
      player.roundPoints = points[playerId];
      player.roundCoins = coins[playerId];
    }
  });

  return { points, coins, details, multiplier };
}

function publicPlayer(player) {
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

function publicRoom(room, viewerId = null) {
  const players = Array.from(room.players.values()).map(publicPlayer);
  const connectedCount = players.filter((player) => player.connected).length;
  const canStart = connectedCount >= 4 && connectedCount % 2 === 0;
  const viewer = viewerId ? room.players.get(viewerId) : null;
  const roleplayPersona = room.round?.roleplay?.[viewerId] || null;

  return {
    code: room.code,
    type: room.type,
    status: room.status,
    hostId: room.hostId,
    players,
    connectedCount,
    canStart,
    startBlockReason:
      connectedCount < 4
        ? "Need at least 4 players."
        : connectedCount % 2 !== 0
          ? "Need one more player so everyone gets paired."
          : "",
    modeId: room.modeId,
    twistId: room.twistId,
    bannedLetter: room.bannedLetter,
    communityGamemodeId: room.communityGamemodeId,
    customGamemode: room.customGamemode,
    viewerId,
    viewerIsHost: Boolean(viewer?.isHost),
    round: room.round
      ? {
          number: room.round.number,
          phaseEndsAt: room.round.phaseEndsAt,
          activePlayerIds: room.round.activePlayerIds,
          mode: room.round.settings.mode,
          activeTwist: room.round.settings.activeTwist,
          timerSeconds: room.round.settings.timerSeconds,
          doublePoints: room.round.settings.doublePoints,
          noHints: room.round.settings.noHints,
          randomTwist: room.round.settings.randomTwist,
          community: room.round.settings.community,
          custom: room.round.settings.custom,
          roleplayPersona,
          guessed: viewerId ? Boolean(room.round.guesses[viewerId]) : false,
          viewerGuess: viewerId ? room.round.guesses[viewerId] || null : null,
          allGuessed:
            room.round.activePlayerIds.length > 0 &&
            room.round.activePlayerIds.every((playerId) => Boolean(room.round.guesses[playerId])),
          reveal: room.round.reveal || null
        }
      : null
  };
}

module.exports = {
  applyMessageRules,
  buildPartnerMap,
  buildRoundSettings,
  generateRoomCode,
  getCommunityGamemode,
  getMode,
  getTwist,
  makePairs,
  normalizeNickname,
  publicRoom,
  sanitizeCode,
  scoreRound,
  validateCustomGamemode
};
