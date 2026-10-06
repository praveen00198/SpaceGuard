# SpaceGuard AI — Deployment & Production Readiness Audit

> Audit Baseline: Phase 1 Audit
> Assessment Target: Node.js Backend on Render/Railway, React Frontend on Vercel, MongoDB Atlas.

---

## 1. Production Readiness Scorecard

| Area | Status | Critical Blocker |
| :--- | :---: | :--- |
| **Backend Architecture** | 🟡 Partial | Lack of persistent storage; in-memory data lost on restart |
| **Database Connection** | 🔴 Missing | MongoDB connection and schemas are not implemented |
| **Real-time WebSockets** | 🟡 Fragile | Hardcoded `/` socket URL breaks on cross-origin Vercel deployment |
| **Process Lifecycle** | 🟡 Fragile | Missing graceful shutdown handlers (`SIGTERM`, `SIGINT`) |
| **Frontend Production Build** | 🟢 Ready | Builds in 2.8s with 0 errors via `tsc -b && vite build` |
| **Configuration** | 🟢 Ready | Clean `.env.example` and `.env.local` priority loading |
| **Testing** | 🟢 Ready | 10/10 Jest and 12/12 Pytest tests passing |

---

## 2. Deployment Blockers

### Blocker 1: Ephemeral State Loss (BE-DEP-001)
* **Problem**: In-memory storage of satellites, telemetry ring buffers, anomalies, and evidence means every time Render or Railway restarts a container (or deploys a new commit), all operational state is lost.
* **Resolution Required**: Connect Mongoose to MongoDB Atlas in Phase 2.

### Blocker 2: WebSocket Cross-Origin Host Configuration (FE-DEP-001)
* **Problem**: In [`frontend/src/services/socket.ts:8`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/frontend/src/services/socket.ts#L8), `socket = io('/')` assumes frontend and backend are hosted on the same origin (handled in development by Vite's proxy). In production with Vercel (`https://app.vercel.app`) and Render (`https://api.render.com`), this fails.
* **Resolution Required**: Configure `VITE_BACKEND_URL` in frontend.

### Blocker 3: Missing Graceful Process Termination (BE-DEP-002)
* **Problem**: [`backend/src/index.ts`](file:///c:/Users/Aman/OneDrive/Desktop/SpaceGaurd/backend/src/index.ts) does not listen to `SIGTERM` or `SIGINT`. When a deployment platform stops the container, open HTTP connections and Socket.IO clients are abruptly severed without draining.
* **Resolution Required**: Add graceful termination:
  ```typescript
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Draining connections...');
    httpServer.close(() => process.exit(0));
  });
  ```

### Blocker 4: Background Simulation Timer Memory Leak Risk (BE-DEP-003)
* **Problem**: If the simulation ticker is running when the application is shutdown, the timer interval continues until the process is hard-killed.
* **Resolution Required**: Ensure `SimulationService.stop()` is called in the shutdown hook.

---

## 3. Environment Variable Classification

| Variable | Target Service | Classification | Required in Production | Description |
| :--- | :--- | :--- | :---: | :--- |
| `NODE_ENV` | Backend | Public Config | Yes (`production`) | Node environment |
| `PORT` / `BACKEND_PORT` | Backend | Public Config | Yes (Provided by host) | Server listen port |
| `MONGODB_URI` | Backend | **Secret** | Yes | MongoDB Atlas connection string |
| `GEMINI_API_KEY` | Backend | **Secret** | Yes | Google AI Studio Gemini API key |
| `GEMINI_MODEL` | Backend | Public Config | Yes (`gemini-3.8-flash`) | Gemini model identifier |
| `NASA_API_KEY` | Backend | **Secret** | Optional | NASA DONKI API key |
| `SATNOGS_API_TOKEN` | Backend | **Secret** | Optional | SatNOGS ground station API token |
| `CORS_ORIGIN` | Backend | Public Config | Yes | URL of deployed Vercel frontend |
| `VITE_API_URL` | Frontend | Public Config | Yes | Backend URL (e.g. `https://spaceguard-api.onrender.com`) |
| `VITE_WS_URL` | Frontend | Public Config | Yes | WebSocket URL |
