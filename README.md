# Who Texted?

Who Texted? is a public browser party game for friends. Players join a room, get paired into anonymous 1-on-1 chats, then guess who they were texting.

## Features

- Public website MVP with React, Express, Node.js, and Socket.io
- Private rooms with room codes and invite links
- Public matchmaking that only starts even player counts
- Reconnect support after refresh
- Host migration when the host disconnects
- Anonymous real-time 1-on-1 chat
- Guess, reveal, scoring, and scoreboard phases
- Coins where `1 point = 1 coin`
- LocalStorage coins, owned skins, equipped skin, and saved custom gamemodes
- Skin shop with built-in cosmetics
- Built-in gamemodes, twist modes, community gamemode examples, and safe JSON-style custom rules

## Even Player Rule

Rounds require an even number of players and at least 4 players.

- Valid: 4, 6, 8, 10, 12 players
- Invalid: 3, 5, 7, 9 players
- No groups of 3 are ever created
- Every active player is assigned exactly one mystery friend
- Every mystery chat is 1-on-1

Public matchmaking also follows this rule. If 5 players are waiting, 4 start and 1 waits. If 7 are waiting, 6 start and 1 waits.

## Running Locally

```bash
npm install
npm run dev
```

The frontend runs at:

```bash
http://localhost:5173
```

The Socket.io backend runs at:

```bash
http://localhost:3001
```

Local development can use the values in `.env.example`:

```bash
PORT=3001
FRONTEND_URL=http://localhost:5173
VITE_SERVER_URL=http://localhost:3001
```

Open multiple browser tabs or devices on the same network to test rooms. For phones on your local network, use your computer's LAN IP with port `5173`.

## Production Build

```bash
npm install
npm run build
npm start
```

After `npm run build`, the Express server serves the built React frontend from `client/dist` and hosts Socket.io from the same origin.

## Public Deployment

The recommended public setup is:

- Frontend on Vercel
- Backend Socket.io server on Render or Railway
- No production `localhost` URLs

### 1. Deploy the backend

Deploy the backend first because the frontend needs the backend URL.

#### Render

1. Push this project to GitHub.
2. Create a new Render Web Service.
3. Select this repository.
4. Use these commands:

```bash
Build Command: npm install
Start Command: npm start
```

5. Add backend environment variables:

```bash
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
```

Render automatically sets `PORT`. The server reads `process.env.PORT`, so do not hard-code a port.

#### Railway

1. Create a Railway project from this repository.
2. Use the default install step or set:

```bash
npm install
```

3. Set the start command:

```bash
npm start
```

4. Add backend environment variables:

```bash
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
```

Railway sets `PORT` automatically. The backend uses `process.env.PORT`.

After deployment, copy the backend public URL. It will look like:

```text
https://who-texted-backend.onrender.com
```

or:

```text
https://who-texted-backend.up.railway.app
```

### 2. Deploy the frontend

1. Create a Vercel project from this repository.
2. Vercel will use `vercel.json`.
3. Confirm these settings:

```bash
Build Command: npm run build
Output Directory: client/dist
```

4. Set the frontend environment variable:

```bash
VITE_SERVER_URL=https://your-backend.example
```

Use the real Render or Railway backend URL. Do not set `VITE_SERVER_URL` to localhost in production.

5. Deploy the frontend.

### 3. Update backend CORS

After Vercel gives you the final public frontend URL, go back to Render or Railway and set:

```bash
FRONTEND_URL=https://your-vercel-app.vercel.app
```

If you want to allow extra Vercel preview deployments, add them as comma-separated origins:

```bash
CORS_ORIGINS=https://preview-one.vercel.app,https://preview-two.vercel.app
```

The backend allows localhost during development and the configured Vercel origins in production. It does not use wildcard CORS.

### 4. Environment variables

Backend variables:

```bash
PORT=provided by Render or Railway
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
CORS_ORIGINS=https://optional-extra-origin.vercel.app
```

Frontend variables:

```bash
VITE_SERVER_URL=https://your-render-or-railway-backend.example
```

Production URLs should always be public `https://` URLs.

### 5. Share the public website

Share the Vercel frontend URL with friends:

```text
https://your-vercel-app.vercel.app
```

Players can create a room and copy the invite link. Room links look like:

```text
https://your-vercel-app.vercel.app/?room=ABCDE
```

The frontend connects to the Render or Railway Socket.io backend through `VITE_SERVER_URL`, so players on different devices and networks can join the same online rooms.

## Custom Gamemode Rules

Custom gamemodes use JSON-style rules. No player JavaScript is executed.

Example:

```json
{
  "name": "Royal Mode",
  "description": "Every message must sound royal.",
  "rules": [
    {
      "type": "mustEndWith",
      "value": "your majesty"
    },
    {
      "type": "maxLength",
      "value": 80
    }
  ]
}
```

Supported rule types:

- `banLetter`
- `banWord`
- `mustInclude`
- `mustStartWith`
- `mustEndWith`
- `maxLength`
- `minLength`
- `onlyEmojis`
- `noEmojis`
- `oneWordOnly`
- `questionsOnly`
- `transformUppercase`
- `transformLowercase`
- `appendText`
- `randomTwist`
- `doublePoints`
- `customTimer`

## Important Files

- `server/index.js`: Express and Socket.io server, rooms, matchmaking, disconnect handling
- `server/gameLogic.js`: pairings, scoring, rule validation, message filtering
- `server/gameData.js`: skins, gamemodes, twist modes, community gamemodes
- `client/src/main.jsx`: React app and game UI
- `client/src/styles.css`: mobile-first styling
- `vite.config.mjs`: frontend build config

## MVP Storage Notes

This MVP intentionally avoids a database.

- Rooms, matchmaking, chats, and round state are stored in server memory.
- Coins, owned skins, equipped skin, and saved custom modes are also saved in browser localStorage.
- Restarting the server clears active online rooms.
