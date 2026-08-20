# YKW Home — Web Cloud Version

## What is this?

A **pure client-side** Yo-kai Watch save viewer with cloud storage, modeled after [Unbound Cloud](https://unboundcloud.net). Users login via Discord, and their yokai/save files are stored persistently via Appwrite.

## Features

- **Client-side decryption** — IeCCode + AES-CCM in JavaScript (no server needed for saves)
- **Discord OAuth login** — users authenticate via Discord (see [docs/DISCORD_OAUTH.md](docs/DISCORD_OAUTH.md))
- **Cloud boxes** — 100 boxes × 30 yokai = 3,000 capacity per user (Appwrite database)
- **Save file storage** — upload/download .yw files to Appwrite cloud storage
- **Export yokai** — right-click (desktop) or double-tap (mobile) to export as .yk1/.yk2/.yk3/.ykb/.ykb2
- **Import yokai** — right-click blank spot to import a .yk file
- **Game version detection** — auto-detects Bony Spirits, Fleshy Souls, Psychic Specters, etc.
- **Cross-game icons** — every yokai shows its correct sprite regardless of game
- **Game icons** — each game version shows its own icon (Red Cat Corps, White Dog Squad, etc.)
- **Mobile-friendly** — works on iPhone, Android, desktop

## Setup Guide

### Step 1: Create an Appwrite Cloud Project

1. Go to [cloud.appwrite.io](https://cloud.appwrite.io) and create an account
2. Create a new project (name it "YKW Home" or similar)
3. Note your **Project ID** from the Overview page

### Step 2: Add a Web Platform (required for CORS)

**This step is required** — without it the browser blocks all API calls from your GitHub Pages domain.

1. Appwrite Console → **Settings** → **Platforms** → **Add Platform** → **Web**
2. Enter your GitHub Pages hostname (origin only, **no path**):
   ```
   shatter9652.github.io
   ```
3. Save. Repeat for `localhost` while developing:
   ```
   localhost
   ```

### Step 3: Enable Discord OAuth

> Full walkthrough with code: **[docs/DISCORD_OAUTH.md](docs/DISCORD_OAUTH.md)**
> (Discord Developer Portal app, Appwrite adapter, redirect URI, scopes,
> session/profile access, token refresh).

1. In Appwrite Console → **Auth** → **OAuth2**
2. Find **Discord** and click **Enable**
3. Go to [Discord Developer Portal](https://discord.com/developers/applications)
4. Create a new application (or use existing)
5. Go to **OAuth2** → **Redirects** and add:
   ```
   https://tor.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord
   ```
6. Copy the **Client ID** and **Client Secret** from Discord into Appwrite
7. In Appwrite OAuth2 settings for Discord, set **Scopes** to: `identify email`

### Step 4: Create Database + Collection

1. Appwrite Console → **Databases** → **Create Database** (name: "ykw-home")
2. Note the **Database ID**
3. Inside the database → **Create Collection** (name: "cloud_boxes")
4. Note the **Collection ID**
5. Add these **attributes** to the collection:
   | Attribute   | Type    | Size  |
   |-------------|---------|-------|
   | user_id     | String  | 255   |
   | box_num     | Integer | —     |
   | slot        | Integer | —     |
   | yokai_id    | Integer | —     |
   | level       | Integer | —     |
   | name        | String  | 100   |
   | raw_hex     | String  | 500   |
   | game        | String  | 10    |
   | is_team     | Boolean | —     |
6. Set **Permissions** → Add role `Any` with `Create`, `Read`, `Update`, `Delete`

### Step 5: Create Storage Bucket

1. Appwrite Console → **Storage** → **Create Bucket** (name: "save_files")
2. Note the **Bucket ID**
3. Settings → **Permissions** → Add role `Any` with `Create`, `Read`, `Delete`

### Step 6: Configure the Web App

Edit `js/config.js` and replace the placeholder values:

```javascript
const APPWRITE_PROJECT  = "your-project-id-here";
const DB_ID             = "your-database-id-here";
const COLLECTION_ID     = "your-collection-id-here";
const BUCKET_ID         = "your-bucket-id-here";
```

### Step 7: Deploy to GitHub Pages

1. Push the contents of `ykw-home/ykw-web/` to your GitHub repo
2. In GitHub → **Settings** → **Pages** → Source: "Deploy from a branch"
3. Either deploy from the repo root, or from a subfolder (e.g. `/ykw-web`) — **all asset paths are relative**, so sub-path deployments just work (this repo deploys to `https://shatter9652.github.io/ykw_cloud/`)
4. Your site will be at `https://<username>.github.io/<repo>/` (or the subfolder)

### Step 8: Update Discord Redirect URI

After deploying, confirm the Discord OAuth redirect URI in the Discord Developer Portal points at **your** Appwrite endpoint:
```
https://tor.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord
```
(This stays the same — Appwrite handles the redirect back to your site)

### Step 9: Test

1. Open your GitHub Pages URL
2. Click "Login with Discord"
3. Authorize the app on Discord
4. You should be logged in and see your cloud boxes

## File Structure

```
ykw-web/
├── index.html              ← Main page (loads all JS/CSS)
├── css/
│   └── style.css           ← OpenHome-style dark theme
├── js/
│   ├── config.js           ← Appwrite + Discord config
│   ├── crypto.js           ← IeCCode + AES-CCM encryption
│   ├── icons.js            ← Icon resolution + version detection
│   ├── cloud.js            ← Appwrite DB/Storage + Discord OAuth
│   ├── contextmenu.js      ← Right-click/double-tap export+import
│   └── app.js              ← Main UI (boxes, grid, detail panel)
├── icons/                  ← Game icons (13 PNGs, 48×48)
├── YoKaiIcons/             ← Yokai sprites (1,926 PNGs)
│   ├── YKW2/pngs/         ← 412 icons
│   ├── YKW3/pngs/         ← 1,018 icons
│   └── YKWB/base_png/     ← 496 icons
├── resources/data/
│   ├── crc32_to_icon.json  ← CRC32 → icon filename mapping
│   ├── crc32_yokai_map.json← CRC32 → yokai name mapping
│   └── yokai_names.json    ← Sequential ID → name mapping
└── README.md
```

## How It Works

### Decryption (client-side)
- **IeCCode**: Xorshift128 stream cipher (all .yw files)
- **AES-CCM**: Additional layer for YW2+ game*.yw files
- **Section tree parser**: Binary tree with MAGIC_OPEN/MAGIC_CLOSE markers

### Game Version Detection
The app detects the specific game version from:
- File name (e.g., "bony_spirits.sav" → YW2 Bony Spirits)
- Header bytes (CCM nonce presence)
- Path hints (yw3, blasters, etc.)

Each version gets its own icon from the `icons/` directory.

### Icon System
1. CRC32 save ID → look up in `crc32_to_icon.json` (908 entries)
2. Get filename (e.g., "y152000" → "y152000.00.png")
3. Search icon folders: preferred game → fallback order (yw3 → yw2 → ykb → b2)
4. If not found, generate a colored placeholder with initials

### Loading Saves (multi-file + mobile)

- **Desktop**: select `game1.yw` (or `gameN.yw`) — the app auto-detects the game
  (tries YW1 → YW2 → YW3 → Blasters 1 → Blasters 2 until one decrypts).
- **Select `head.yw` together** with the game file (multi-select) so YW2/YW3/Blasters
  saves can derive their AES key. Both `head.yw` and `head.yw_g` are accepted.
- **iOS / Android (single-file pickers)**: pick the game file first. If it needs a
  `head.yw`, the app reopens the file picker and asks for it — just pick `head.yw`
  (or `head.yw_g`) on the second step. `game*.yw_g` files work the same way.

### Context Menus
- **Desktop**: Right-click a yokai cell → Export/Copy/Details
- **Desktop**: Right-click blank spot → Import .yk file
- **Mobile**: Double-tap → same menu
- **Export**: Downloads binary .yk1/.yk2/.yk3/.ykb/.ykb2 file
- **Import**: File picker for .yk files, parses raw bytes

## .yk File Format

Individual yokai files are raw binary copies of the yokai's entry from section 0x07:

| File    | Game           | Size   |
|---------|----------------|--------|
| .yk1    | Yo-kai Watch 1 | 92 B   |
| .yk2    | Yo-kai Watch 2 | 92 B   |
| .yk3    | Yo-kai Watch 3 | 84 B   |
| .ykb    | Blasters 1     | 76 B   |
| .ykb2   | Blasters 2     | 76 B   |

## Troubleshooting

**`Failed to decrypt: v.test is not a function`**

Old bug: the version-detection loop called a regex object as if it were a function
(`v.test(hint)` instead of `v.match.test(hint)`). Fixed — redeploy the current files.

**`Failed to decrypt: CCM auth failed` / wrong yokai / section errors**

The browser crypto port had three bugs, all fixed and verified against real saves
(YW2, YW3, Blasters 2 — counts match the Python reference):

1. `Xorshift` seeding used 64-bit `*` instead of 32-bit `Math.imul` — broke every
   decryption for seeds above ~2^21.
2. The CCM keystream counter only incremented byte 15 — saves larger than 65 KB
   (most real saves) decrypted wrong.
3. The section-tree parser mishandled container nodes and the wrong 32-byte offset.

If you still see this, you're running stale files — re-copy the `js/` folder to your
GitHub Pages repo.

**`Appwrite is not defined` / script blocked due to MIME type mismatch**

The CDN URL must be the **IIFE build** (`dist/iife/sdk.min.js`), not `dist/sdk.min.js`. A wrong path returns a 404 page as `text/plain`, which the browser blocks with `nosniff`:
```html
<script src="https://cdn.jsdelivr.net/npm/appwrite@15.0.0/dist/iife/sdk.min.js"></script>
```

**Cloud calls fail with CORS errors in the console**

You forgot Step 2 — the Web Platform. Add `shatter9652.github.io` (and `localhost` for local testing) under **Settings → Platforms → Add Platform → Web**.

**`401` / `403` when saving yokai to the cloud**

Check collection and bucket **Permissions** — they must include the `Any` role with Create/Read/Update/Delete (see Steps 4–5). Also make sure the user is logged in via Discord.

**Using the wrong SDK version breaks everything**

This project pins `appwrite@15.0.0` on purpose — the v15 SDK uses the classic `collections/documents` API, which is what this Appwrite backend serves. Newer SDK versions (v26+) dropped those methods in favor of the tables/rows API, which this backend does not support.

## Comparison to Unbound Cloud

| Feature | Unbound Cloud | YKW Home Web |
|---------|--------------|--------------|
| Framework | React + Node.js | Plain HTML/JS |
| Encryption | Server-side | Client-side |
| GitHub Pages | ❌ (needs server) | ✅ |
| Auth | Email/password | Discord OAuth |
| Cloud storage | Server DB | Appwrite |
| Game support | Single ROM hack | All YW games |
| Export .yk files | ❌ | ✅ |
| Import .yk files | ❌ | ✅ |
| Game version icons | ❌ | ✅ |
| Mobile | ✅ | ✅ |

## License

MIT
