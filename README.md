# IPFS Drive

A decentralized cloud storage DApp — similar to Google Drive / iCloud — powered by your local IPFS node and built with Vue 3.

## Features

- Upload files via drag & drop or file picker (with progress toasts)
- Create and navigate folders (IPFS MFS)
- Grid and list view toggle
- Live search / filter
- File preview: images, video, audio, text/code, PDF
- Download and rename files
- Copy shareable IPFS CID link
- IPFS node status indicator and storage usage bar

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [IPFS Kubo](https://docs.ipfs.tech/install/command-line/) (`ipfs` CLI)

## Setup

### 1. Configure IPFS CORS

The IPFS HTTP API rejects cross-origin browser requests by default. Run these commands **once** to allow the dev server origin, then restart the daemon:

```bash
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["*"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET","POST","PUT"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Authorization"]'
```

> Using `"*"` is fine for local development. For a more locked-down setup replace `*` with the specific origin, e.g. `"http://localhost:5173"`.

### 2. Start the IPFS daemon

```bash
ipfs daemon
```

Leave this running in a terminal. The API listens on `http://127.0.0.1:5001` and the gateway on `http://127.0.0.1:8080`.

### 3. Install dependencies

```bash
cd dapp-drive
npm install
```

### 4. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser. The status pill in the top-right corner should turn green once the IPFS node is detected.

## How it works

```
Browser  ──►  Vite dev server (localhost:5173)
                  │  proxy /api/v0  ──►  IPFS API   (127.0.0.1:5001)
                  └  proxy /ipfs    ──►  IPFS Gateway (127.0.0.1:8080)
```

Files are stored in the [IPFS Mutable File System (MFS)](https://docs.ipfs.tech/concepts/file-systems/#mutable-file-system-mfs), which gives you a familiar `/folder/file` path structure on top of content-addressed storage.

## Deploying to IPFS

When deployed to IPFS the app is accessed directly from an IPFS gateway — there is no Vite proxy, so the browser calls `http://127.0.0.1:5001` (the user's local IPFS node) directly.

### Why IPNS instead of a bare CID

Every build produces a new CID, so you cannot whitelist a CID in IPFS CORS — it would change with every release.  
**IPNS** maps a stable key to the latest CID, giving you a fixed origin you can lock CORS down to.

---

### Step 1 — Create an IPNS key (once)

```bash
ipfs key gen dapp-drive
# output: k51qzi5uqu5d...  ← save this, it never changes
```

---

### Step 2 — Build and publish

Use the included deployment script — it handles build, add, and IPNS publish in one command:

```powershell
# First deploy: also sets up CORS (run once after creating the key)
.\deploy.ps1 -SetupCors

# Every subsequent release
.\deploy.ps1

# To also broadcast the IPNS record to the DHT network
.\deploy.ps1 -Online
```

Or manually:

```bash
npm run build
ipfs add -r --cid-version=1 dist/           # → CID bafy...
ipfs name publish --key=dapp-drive --allow-offline <CID>   # local
ipfs name publish --key=dapp-drive <CID>                   # DHT broadcast
```

Repeat on every release. The IPNS key stays the same.

---

### Step 3 — Lock CORS to your IPNS origin

The local subdomain gateway serves your app at:

```
http://<IPNS-key>.ipns.localhost:8080
```

Configure IPFS to allow **only** that origin:

**bash / macOS / Linux:**
```bash
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin \
  '["http://<IPNS-key>.ipns.localhost:8080"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods \
  '["GET","POST","PUT"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers \
  '["Authorization"]'
```

**PowerShell (Windows):** single quotes strip the inner `"` when passed to external programs — use backtick escaping instead:
```powershell
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin "[`"http://<IPNS-key>.ipns.localhost:8080`"]"
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods "[`"GET`",`"POST`",`"PUT`"]"
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers "[`"Authorization`"]"
```

Verify the result:
```powershell
ipfs config API.HTTPHeaders
```

Restart the daemon:

```bash
ipfs shutdown
ipfs daemon
```

---

### Step 4 — Open the app

```
http://<IPNS-key>.ipns.localhost:8080
```

Because the origin exactly matches the CORS allowlist, the browser can reach the IPFS API.  
Any other site (different origin) trying to call your local IPFS API will receive **403 Forbidden**.

---

### Why this setup is secure

| Who tries to call your IPFS API | Result |
|---|---|
| Your IPFS Drive app (IPNS subdomain) | ✅ Allowed |
| Any other website | ❌ 403 Forbidden |
| `curl` / server-side tool (no Origin header) | ✅ Allowed |

> **Mixed-content note**: This only works because both the app (`http://...localhost:8080`) and the API (`http://127.0.0.1:5001`) are plain HTTP. If you serve the app over HTTPS (e.g. via a public gateway), the browser will block HTTP API calls. In that case, whitelist the public HTTPS gateway origin and ensure your IPFS node is reachable over HTTPS as well.

## Project structure

```
src/
├── stores/
│   ├── ipfs.js      # IPFS HTTP API wrapper (MFS operations)
│   └── drive.js     # file browser state, upload queue
├── views/
│   └── DriveView.vue
├── components/
│   ├── AppTopbar.vue
│   ├── AppSidebar.vue
│   ├── BreadCrumb.vue
│   ├── FileGrid.vue / FileList.vue
│   ├── FileCard.vue / FileRow.vue
│   ├── FilePreviewModal.vue
│   ├── CreateFolderModal.vue
│   ├── UploadProgress.vue
│   └── NodeStatus.vue
└── utils/
    └── fileType.js  # file type detection, icon mapping, size formatting
```
