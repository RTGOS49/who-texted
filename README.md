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

Use this public setup:

- Frontend on Vercel
- Backend Socket.io server on Render or Railway
- No production `localhost` URLs

Your GitHub repository:

```text
https://github.com/RTGOS49/who-texted
```

### My exact deployment values

Backend URL:

```text
https://who-texted-backend.onrender.com
```

Frontend Vercel environment variable:

```bash
VITE_SERVER_URL=https://who-texted-backend.onrender.com
```

Backend Render environment variable:

```bash
FRONTEND_URL=https://YOUR-VERCEL-LINK.vercel.app
```

Replace `https://YOUR-VERCEL-LINK.vercel.app` with the real Vercel URL after Vercel creates it.

### 1. Deploy the backend on Render

Deploy the backend first because the frontend needs the backend URL.

#### Option A: Render Blueprint

This repo includes `render.yaml`, so Render can read the backend setup.

1. Go to [Render](https://render.com).
2. Sign in.
3. Click **New +**.
4. Click **Blueprint**.
5. Connect your GitHub account if Render asks.
6. Select `RTGOS49/who-texted`.
7. Render should detect `render.yaml`.
8. Click **Apply** or **Create New Resources**.
9. In the service environment variables, add:

```bash
FRONTEND_URL=https://YOUR-VERCEL-LINK.vercel.app
```

You can set the final Vercel URL later if you do not have it yet. Until then, localhost still works for development.

#### Option B: Manual Render Web Service

1. Go to [Render](https://render.com).
2. Sign in.
3. Click **New +**.
4. Click **Web Service**.
5. Connect your GitHub account if needed.
6. Select `RTGOS49/who-texted`.
7. Use these settings:

```bash
Name: who-texted-backend
Runtime: Node
Build Command: npm install
Start Command: npm start
Health Check Path: /health
```

8. Add these environment variables:

```bash
NODE_ENV=production
FRONTEND_URL=https://YOUR-VERCEL-LINK.vercel.app
```

Render automatically sets `PORT`. The backend uses `process.env.PORT`, so do not add a hard-coded port.

9. Click **Create Web Service**.
10. Wait for the deploy to finish.
11. Open:

```text
https://who-texted-backend.onrender.com
```

You should see:

```text
Who Texted backend is running
```

Also test:

```text
https://who-texted-backend.onrender.com/health
```

You should see a JSON response with `"message": "Who Texted backend is running"`.

### 2. Deploy the backend on Railway instead

Use this only if you prefer Railway over Render.

1. Go to [Railway](https://railway.app).
2. Click **New Project**.
3. Click **Deploy from GitHub repo**.
4. Select `RTGOS49/who-texted`.
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
FRONTEND_URL=https://YOUR-VERCEL-LINK.vercel.app
```

Railway sets `PORT` automatically. The backend uses `process.env.PORT`.

Copy the Railway backend URL when deployment finishes. It will look like:

```text
https://who-texted-backend.up.railway.app
```

If you use Railway, set Vercel's `VITE_SERVER_URL` to the Railway URL instead of the Render URL.

### 3. Deploy the frontend on Vercel

This repo includes `vercel.json`, so Vercel knows it is a Vite frontend and should output `client/dist`.

1. Go to [Vercel](https://vercel.com).
2. Sign in.
3. Click **Add New...**.
4. Click **Project**.
5. Import `RTGOS49/who-texted`.
6. In **Build and Output Settings**, Vercel should use:

```bash
Build Command: npm run build
Output Directory: client/dist
```

7. Open **Environment Variables**.
8. Add:

```bash
Name: VITE_SERVER_URL
Value: https://who-texted-backend.onrender.com
Environment: Production
```

9. Click **Deploy**.
10. Wait for Vercel to finish.
11. Copy your Vercel website URL. It will look like:

```text
https://who-texted-yourname.vercel.app
```

Do not use localhost in Vercel production settings.

### 4. Update backend CORS after Vercel deploys

After Vercel gives you the final public website URL, go back to Render and update:

```bash
FRONTEND_URL=https://YOUR-REAL-VERCEL-LINK.vercel.app
```

Render steps:

1. Open your `who-texted-backend` service on Render.
2. Click **Environment**.
3. Find `FRONTEND_URL`.
4. Paste your real Vercel URL.
5. Click **Save Changes**.
6. Let Render redeploy.

If you want to allow extra Vercel preview deployments, add them as comma-separated origins:

```bash
CORS_ORIGINS=https://preview-one.vercel.app,https://preview-two.vercel.app
```

The backend allows localhost during development and the configured Vercel origins in production. It does not use wildcard CORS.

### 5. Environment variables

Backend variables:

```bash
PORT=provided automatically by Render or Railway
NODE_ENV=production
FRONTEND_URL=https://YOUR-VERCEL-LINK.vercel.app
CORS_ORIGINS=https://optional-extra-preview-link.vercel.app
```

Frontend variables:

```bash
VITE_SERVER_URL=https://who-texted-backend.onrender.com
```

Production URLs should always be public `https://` URLs.

### 6. Deploy the frontend with Vercel CLI from CMD

Open CMD in the project folder, then run:

```cmd
npm install -g vercel
vercel login
vercel env add VITE_SERVER_URL production
vercel --prod
```

When Vercel asks for the value of `VITE_SERVER_URL`, paste:

```text
https://who-texted-backend.onrender.com
```

If Vercel asks project setup questions:

- Link to existing project: choose **No** the first time
- Project name: use `who-texted`
- Framework: Vite
- Build command: `npm run build`
- Output directory: `client/dist`

### 7. Test with friends

1. Open your Vercel website URL.
2. Enter a nickname.
3. Click **Create Private Room**.
4. Click the copy invite link button.
5. Send that Vercel invite link to friends.
6. Ask friends to open the link in their browser.
7. Wait for 4, 6, 8, 10, or another even number of players.
8. Start the game.

Share the Vercel frontend URL, not the Render backend URL:

```text
https://YOUR-VERCEL-LINK.vercel.app
```

Players can create a room and copy the invite link. Room links look like:

```text
https://YOUR-VERCEL-LINK.vercel.app/?room=ABCDE
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
