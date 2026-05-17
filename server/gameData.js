const SKINS = [
  {
    id: "default",
    name: "Default Texter",
    price: 0,
    emoji: "💬",
    description: "Classic mystery texter."
  },
  {
    id: "detective",
    name: "Detective",
    price: 10,
    emoji: "🕵️",
    description: "For players who always know who it is."
  },
  {
    id: "ghost",
    name: "Ghost",
    price: 15,
    emoji: "👻",
    description: "Spooky anonymous energy."
  },
  {
    id: "robot",
    name: "Robot",
    price: 20,
    emoji: "🤖",
    description: "Beep boop. Suspicious."
  },
  {
    id: "clown",
    name: "Clown",
    price: 25,
    emoji: "🤡",
    description: "Maximum chaos."
  },
  {
    id: "alien",
    name: "Alien",
    price: 30,
    emoji: "👽",
    description: "Texts from another planet."
  },
  {
    id: "royal",
    name: "Royal",
    price: 40,
    emoji: "👑",
    description: "Fancy, dramatic, exposed."
  },
  {
    id: "fire",
    name: "Fire Texter",
    price: 50,
    emoji: "🔥",
    description: "Too hot to stay anonymous."
  }
];

const GAME_MODES = [
  {
    id: "classic",
    name: "Classic Mode",
    shortName: "Classic",
    description: "90 seconds of mystery texting, guessing, and getting exposed.",
    timerSeconds: 90,
    doublePoints: false,
    randomTwist: false,
    noHints: false,
    vibe: "Standard rules. The texts are suspicious. The friendships survive... probably."
  },
  {
    id: "fast",
    name: "Fast Mode",
    shortName: "Fast",
    description: "45 seconds. Panic typing. Bad lies.",
    timerSeconds: 45,
    doublePoints: false,
    randomTwist: false,
    noHints: false,
    vibe: "Blink and someone gets exposed."
  },
  {
    id: "long",
    name: "Long Chat Mode",
    shortName: "Long Chat",
    description: "Two minutes for bigger groups or dramatic interrogations.",
    timerSeconds: 120,
    doublePoints: false,
    randomTwist: false,
    noHints: false,
    vibe: "More time, more clues, more accidental self-reports."
  },
  {
    id: "chaos",
    name: "Chaos Mode",
    shortName: "Chaos",
    description: "A random twist is picked every round and revealed when chat starts.",
    timerSeconds: 90,
    doublePoints: false,
    randomTwist: true,
    noHints: false,
    vibe: "The rule appears when it is already too late."
  },
  {
    id: "double",
    name: "Double Points Mode",
    shortName: "Double Points",
    description: "All earned points and coins are doubled.",
    timerSeconds: 90,
    doublePoints: true,
    randomTwist: false,
    noHints: false,
    vibe: "Big points. Big coins. Big accusations."
  },
  {
    id: "no-hints",
    name: "No Hints Mode",
    shortName: "No Hints",
    description: "No skins, clues, or previous-round help until the reveal.",
    timerSeconds: 90,
    doublePoints: false,
    randomTwist: false,
    noHints: true,
    vibe: "Just texts. Just suspicion."
  }
];

const TWIST_MODES = [
  {
    id: "none",
    name: "No Twist",
    description: "Plain mystery texting.",
    prompt: "Who is this mystery texter?",
    rules: []
  },
  {
    id: "no-emojis",
    name: "No Emojis",
    description: "Emoji use is blocked.",
    prompt: "No little faces. Just suspicious words.",
    rules: [{ type: "noEmojis" }]
  },
  {
    id: "questions-only",
    name: "Questions Only",
    description: "Every message must end with a question mark.",
    prompt: "Interrogate them. Politely?",
    rules: [{ type: "questionsOnly" }]
  },
  {
    id: "one-word",
    name: "One Word Only",
    description: "Every message must be one word.",
    prompt: "One word. ONE.",
    rules: [{ type: "oneWordOnly" }]
  },
  {
    id: "typo",
    name: "Typo Mode",
    description: "Sent messages get tiny suspicious typos.",
    prompt: "The keyboard is betraying everybody.",
    rules: [{ type: "typoMode" }]
  },
  {
    id: "no-letter-e",
    name: "No Letter E",
    description: "Messages containing e or E are blocked.",
    prompt: "The letter E has left the chat.",
    rules: [{ type: "banLetter", value: "e" }]
  },
  {
    id: "only-emojis",
    name: "Only Emojis",
    description: "Letters, numbers, and normal words are blocked.",
    prompt: "Say it with tiny dramatic pictures.",
    rules: [{ type: "onlyEmojis" }]
  },
  {
    id: "ban-letter",
    name: "Ban a Letter",
    description: "The host picks one banned letter.",
    prompt: "One letter is illegal this round.",
    needsValue: "bannedLetter",
    rules: [{ type: "banLetter", valueFrom: "bannedLetter" }]
  },
  {
    id: "say-over",
    name: "Say “Over”",
    description: "Every message must end with the word over.",
    prompt: "You forgot to say over.",
    rules: [{ type: "mustEndWith", value: "over" }]
  },
  {
    id: "no-vowels",
    name: "No Vowels",
    description: "Messages cannot contain a, e, i, o, or u.",
    prompt: "Vowels are cancelled.",
    rules: [{ type: "noVowels" }]
  },
  {
    id: "too-honest",
    name: "Too Honest Mode",
    description: "Every message must include honestly, truthfully, or seriously.",
    prompt: "Be suspiciously sincere.",
    rules: [{ type: "mustIncludeAny", value: ["honestly", "truthfully", "seriously"] }]
  },
  {
    id: "suspicious",
    name: "Suspicious Mode",
    description: "Every message must include the word sus.",
    prompt: "Everything is sus now.",
    rules: [{ type: "mustInclude", value: "sus" }]
  },
  {
    id: "whisper",
    name: "Whisper Mode",
    description: "Messages are converted to lowercase.",
    prompt: "Keep it quiet. Too quiet.",
    rules: [{ type: "transformLowercase" }]
  },
  {
    id: "shouting",
    name: "Shouting Mode",
    description: "Messages are converted to uppercase.",
    prompt: "WHY ARE WE YELLING?",
    rules: [{ type: "transformUppercase" }]
  },
  {
    id: "tiny-text",
    name: "Tiny Text Mode",
    description: "Messages must be under 20 characters.",
    prompt: "Short texts. Big suspicion.",
    rules: [{ type: "maxLength", value: 19 }]
  },
  {
    id: "long-talker",
    name: "Long Talker Mode",
    description: "Messages must be at least 40 characters.",
    prompt: "Give them a suspicious paragraph.",
    rules: [{ type: "minLength", value: 40 }]
  },
  {
    id: "roleplay",
    name: "Roleplay Mode",
    description: "Players secretly get a silly chat personality.",
    prompt: "Stay in character. Badly.",
    roleplay: true,
    rules: []
  }
];

const COMMUNITY_GAMEMODES = [
  {
    id: "pirate-talk",
    name: "Pirate Talk",
    description: "Every message must include pirate energy.",
    author: "Built-in",
    rules: [{ type: "mustInclude", value: "arr" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "only-emojis",
    name: "Only Emojis",
    description: "No words. Just emoji chaos.",
    author: "Built-in",
    rules: [{ type: "onlyEmojis" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "no-letter-s",
    name: "No Letter S",
    description: "The letter S is banned.",
    author: "Built-in",
    rules: [{ type: "banLetter", value: "s" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "say-over",
    name: "Say Over",
    description: "Every message must end with over.",
    author: "Built-in",
    rules: [{ type: "mustEndWith", value: "over" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "tiny-messages",
    name: "Tiny Messages",
    description: "Messages must be shorter than 20 characters.",
    author: "Built-in",
    rules: [{ type: "maxLength", value: 19 }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "drama-mode",
    name: "Drama Mode",
    description: "Every message must start with gasp.",
    author: "Built-in",
    rules: [{ type: "mustStartWith", value: "gasp" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "royal-mode",
    name: "Royal Mode",
    description: "Every message must end with your majesty.",
    author: "Built-in",
    rules: [
      { type: "mustEndWith", value: "your majesty" },
      { type: "maxLength", value: 80 }
    ],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "robot-mode",
    name: "Robot Mode",
    description: "Messages are loud and must include beep.",
    author: "Built-in",
    rules: [
      { type: "mustInclude", value: "beep" },
      { type: "transformUppercase" }
    ],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "chaos-mode",
    name: "Chaos Mode",
    description: "A random twist is selected when the round starts.",
    author: "Built-in",
    rules: [{ type: "randomTwist" }],
    settings: { timerSeconds: 90, doublePoints: false, randomTwist: true },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "double-points-mode",
    name: "Double Points Mode",
    description: "All points and coins are doubled.",
    author: "Built-in",
    rules: [{ type: "doublePoints" }],
    settings: { timerSeconds: 90, doublePoints: true, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  },
  {
    id: "fast-mode",
    name: "Fast Mode",
    description: "A 45 second sprint round.",
    author: "Built-in",
    rules: [{ type: "customTimer", value: 45 }],
    settings: { timerSeconds: 45, doublePoints: false, randomTwist: false },
    createdAt: "2026-01-01",
    likes: 0,
    uses: 0
  }
];

const ROLEPLAY_PERSONAS = [
  "Pirate",
  "Robot",
  "Detective",
  "Villain",
  "Celebrity",
  "Grandma",
  "Alien"
];

module.exports = {
  SKINS,
  GAME_MODES,
  TWIST_MODES,
  COMMUNITY_GAMEMODES,
  ROLEPLAY_PERSONAS
};
