# FAERP — Install on Local Server

> Get FAERP running on your server and share it with your team in 10 minutes.

---

## What You Need

- A Windows PC or laptop that stays on
- Internet connection

---

## Step 1 — Install Node.js

1. Go to **https://nodejs.org**
2. Download the **LTS** version (green button)
3. Run the installer → click Next through everything → Finish
4. Open **Command Prompt** and verify:
   ```
   node --version
   ```
   You should see `v18` or higher. You're good.

---

## Step 2 — Install the App

1. Copy the FAERP project folder to the server (e.g., `C:\FAERP`)
2. Open **Command Prompt**
3. Navigate to the folder:
   ```
   cd C:\FAERP
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Build the app:
   ```
   npm run build
   ```
6. Start the app:
   ```
   npm run start
   ```
7. Open a browser on the server → go to **http://localhost:3000** → you should see the login page ✅

---

## Step 3 — Share with Your Team (Remote Access)

We'll use **ngrok** — it gives you a public link in 30 seconds, no router setup needed.

1. Go to **https://ngrok.com** → Sign up (free)
2. Download ngrok for Windows → extract the `ngrok.exe` file
3. From your ngrok dashboard, copy your **auth token**
4. Open a **new Command Prompt** (keep the app running in the other one) and run:
   ```
   ngrok config add-authtoken YOUR_TOKEN_HERE
   ```
5. Start the tunnel:
   ```
   ngrok http 3000
   ```
6. ngrok will show a public URL like:
   ```
   https://abc123.ngrok-free.app
   ```
7. **Send this link to your team** — they can open it from anywhere in the world ✅

---

## Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Pricing Control (SC) | `sc` | `sc123` |
| Manager (MG) | `mg` | `mg123` |
| Warehouse (WH) | `wh` | `wh123` |
| Sales Agent (SA) | `sa` | `sa123` |
| System Admin (AD) | `admin` | `admin123` |

---

## Daily Usage

Every time you restart the server, just open Command Prompt and run:

```
cd C:\FAERP
npm run start
```

Then in a second Command Prompt:

```
ngrok http 3000
```

Share the new ngrok link with your team.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm run start` fails | Run `npm run build` first |
| Port 3000 in use | Close other apps or use `set PORT=3001 && npm run start` |
| Team can't access the link | Make sure both `npm run start` AND `ngrok` are running |
| Database errors | Delete the `data` folder → restart the app (it recreates automatically) |
