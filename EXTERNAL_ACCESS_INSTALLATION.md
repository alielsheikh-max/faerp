# FAERP — External Access Installation Guide

> **Deploy FAERP on your local server and make it accessible to your team or clients over the network/internet.**

---

## Prerequisites

- A server machine (Windows, Linux, or macOS) that stays powered on
- **Node.js v18.0.0 or higher** installed on the server
- The FAERP project files copied to the server

---

## Step 1 — Install Node.js

### Windows
Download and install from [https://nodejs.org](https://nodejs.org) (LTS version recommended).

### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo bash -
sudo apt install -y nodejs
```

### Verify installation
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

---

## Step 2 — Copy the Project to the Server

Transfer all project files (including `src/`, `package.json`, `public/`, etc.) to the server. You can use:
- **USB drive** — copy the folder directly
- **File sharing** — via network share or cloud storage
- **Git** — if you have a repository: `git clone <your-repo-url>`

---

## Step 3 — Install Dependencies & Build

Open a terminal inside the project root directory and run:

```bash
npm install
```

Then build the production bundle:

```bash
npm run build
```

> *The application automatically creates the SQLite database at `data/faerp.sqlite` and seeds the tables with default products, categories, suppliers, and historical quotes on first boot.*

---

## Step 4 — Start the Application

```bash
npm run start
```

The app will start on **port 3000** by default. You should see output confirming the server is running.

Test it locally on the server by opening a browser and navigating to:
```
http://localhost:3000
```

---

## Step 5 — Make It Accessible on Your Local Network

Once the app is running, anyone on the **same Wi-Fi or LAN network** can access it using the server's local IP address.

### Find Your Server's IP Address

**Windows:**
```bash
ipconfig
```
Look for `IPv4 Address` (e.g., `192.168.1.100`)

**Linux/macOS:**
```bash
hostname -I
```

### Access from Other Devices
On any device (phone, tablet, laptop) connected to the same network, open a browser and go to:
```
http://<server-ip>:3000
```
For example: `http://192.168.1.100:3000`

---

## Step 6 — Make It Accessible from the Internet

If you need people **outside your network** (e.g., remote team members, clients) to access the app, you have two options:

### Option A: Use ngrok (Easiest — No Router Config)

1. Sign up for a free account at [https://ngrok.com](https://ngrok.com)
2. Download and install ngrok
3. Authenticate:
   ```bash
   ngrok config add-authtoken <your-token>
   ```
4. Start the tunnel:
   ```bash
   ngrok http 3000
   ```
5. ngrok gives you a **public URL** like `https://abc123.ngrok-free.app` — share this with anyone

> **Note:** Free ngrok URLs change every time you restart the tunnel. For a persistent URL, consider ngrok's paid plan or a custom domain.

### Option B: Port Forwarding (Permanent — Requires Router Access)

1. Log into your router admin panel (usually `http://192.168.1.1`)
2. Find the **Port Forwarding** section
3. Add a rule:
   - **External Port:** `3000` (or `80` for standard HTTP)
   - **Internal IP:** Your server's local IP (e.g., `192.168.1.100`)
   - **Internal Port:** `3000`
   - **Protocol:** TCP
4. Save the rule
5. Find your public IP at [https://whatismyip.com](https://whatismyip.com)
6. Share `http://<your-public-ip>:3000` with your team

> ⚠️ **Security Note:** When exposing to the internet, consider placing a reverse proxy (like Nginx) with HTTPS in front of the app for encrypted connections.

---

## Step 7 — Keep It Running 24/7 with PM2 (Recommended)

By default, if you close the terminal, the app stops. Use **PM2** to keep it running as a background service:

### Install PM2
```bash
npm install -g pm2
```

### Start the App with PM2
```bash
pm2 start npm --name "faerp" -- start
```

### Useful PM2 Commands
```bash
pm2 status              # Check if the app is running
pm2 logs faerp          # View live logs
pm2 restart faerp       # Restart the app
pm2 stop faerp          # Stop the app
```

### Auto-Start on Server Reboot
```bash
pm2 save                # Save current process list
pm2 startup             # Generate startup script (follow the printed instructions)
```

> After running `pm2 startup`, PM2 will print a command — **copy and run that command** to enable auto-start.

---

## Quick Reference

| What | Command / URL |
|------|---------------|
| **Install dependencies** | `npm install` |
| **Build for production** | `npm run build` |
| **Start the app** | `npm run start` |
| **Start with PM2** | `pm2 start npm --name "faerp" -- start` |
| **Local access** | `http://localhost:3000` |
| **Network access** | `http://<server-ip>:3000` |
| **Internet access (ngrok)** | `ngrok http 3000` → use the generated URL |
| **Internet access (port forward)** | `http://<public-ip>:3000` |

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Pricing Control (SC) | `sc` | `sc123` |
| Manager (MG) | `mg` | `mg123` |
| Warehouse (WH) | `wh` | `wh123` |
| Sales Agent (SA) | `sa` | `sa123` |
| System Admin (AD) | `admin` | `admin123` |

---

## Troubleshooting

### Port 3000 is already in use
Change the port by starting with:
```bash
PORT=3001 npm run start
```

### App not accessible from other devices
- Make sure the server's **firewall** allows port 3000
  - **Windows:** Add an inbound rule in Windows Defender Firewall
  - **Linux:** `sudo ufw allow 3000`
- Verify all devices are on the **same network**

### Database errors on first boot
Delete the `data/` folder and restart — the app will recreate and reseed the database automatically.
