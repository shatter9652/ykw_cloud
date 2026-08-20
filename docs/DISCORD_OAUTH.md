# Discord OAuth Sign-In (via Appwrite)

Users log in to YKW Home with **Discord** (not an Appwrite account). Appwrite is
only used as the backend that stores cloud boxes and save files — the Discord
OAuth adapter in Appwrite Auth handles the "Sign in with Discord" flow.

```
User clicks "Login with Discord"
        │
        ▼
Appwrite createOAuth2Session("discord")  ──►  Discord OAuth consent screen
        ▲                                        │  user authorizes
        │                                        ▼
        └──────────── Appwrite redirects back with a session
                        (account.get() now returns the Discord user)
```

## Step 1 — Register a Discord Developer application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application**, give it a name (e.g. "YKW Home"), create it.
3. Open **OAuth2** → **General** in the left sidebar.
4. Copy the **Client ID** and **Client Secret** (reset the secret if "Reset Secret"
   is shown — that's just the current one).
5. Under **Redirects**, click **Add Redirect** and add **exactly** the callback URI
   Appwrite shows in its Discord adapter settings — it includes your **project ID**
   suffix (this project: `6a86504b0033f733c338`):
   ```
   https://tor.cloud.appwrite.io/v1/account/sessions/oauth2/callback/discord/6a86504b0033f733c338
   ```
   > ⚠️ Use the URI exactly as Appwrite displays it. The host must be **your**
   > Appwrite endpoint region (`tor.cloud.appwrite.io`), **not** `cloud.appwrite.io`
   > and not your GitHub Pages URL. A missing project-ID suffix makes Discord
   > reject the redirect and the login silently fails (you stay a guest → the
   > `401 missing scopes (["account"])` error).

## Step 2 — Add the Discord OAuth adapter to Appwrite

1. Open your project in the [Appwrite Console](https://cloud.appwrite.io).
2. Go to **Auth** → **Settings**.
3. Under **OAuth2 providers**, click **Discord** → **Enable**.
4. Paste the **Client ID** and **Client Secret** from Step 1.
5. Set **Scopes** to: `identify email`
6. Save. Appwrite shows the exact callback URI to keep in Discord — copy it
   verbatim (it ends with `/callback/discord/<projectId>`) and make sure it matches
   Step 1.5. **Discord OAuth automatically creates the Appwrite user account on
   first login** — no account creation code is needed.

## Step 3 — Add a Web Platform (CORS)

Without this, the browser blocks every Appwrite call from GitHub Pages:

1. Appwrite Console → **Settings** → **Platforms** → **Add Platform** → **Web**.
2. Hostname: `shatter9652.github.io` (origin only, no path).
3. Add a second platform for local testing: hostname `localhost`.

## Step 4 — How the app signs in

The app is vanilla HTML/JS and loads the Appwrite **v15** IIFE SDK from a CDN
(`js/cloud.js` initializes it — see the README's troubleshooting section for why
v15 specifically).

`js/cloud.js`:

```js
let _acct=null,_db=null,_sto=null,_user=null;

function initAppwrite(){
  const {Client, Account, Databases, Storage} = Appwrite;
  const c = new Client()
    .setEndpoint(APPWRITE_ENDPOINT)   // "https://tor.cloud.appwrite.io/v1"
    .setProject(APPWRITE_PROJECT);    // your project ID
  _acct = new Account(c);
  _db   = new Databases(c);
  _sto  = new Storage(c);
  return c;
}

function loginDiscord(){
  const s = window.location.origin + window.location.pathname; // back to this page
  _acct.createOAuth2Session("discord", s, s + "?error=auth", ["identify", "email"]);
}
```

- `createOAuth2Session(provider, success, failure, scopes)` redirects the browser
  to Discord's consent screen.
- On success the browser returns to `success` (`https://shatter9652.github.io/ykw_cloud/`)
  with an Appwrite session cookie already set — `account.get()` then returns the
  Discord user.

`loginDiscord()` is wired to the "Login with Discord" button in `index.html`:

```html
<button class="btn primary" id="auth-btn" onclick="loginDiscord()">Login with Discord</button>
```

After the redirect, `app.js` calls `checkAuth()` → `_acct.get()` and updates the
button to "Logout" with the user's Discord name.

## Step 5 — Read the Discord session / fetch the Discord profile

The Appwrite session carries the OAuth provider info. You can read it with
`getSession("current")`:

```js
const session = await _acct.getSession({ sessionId: "current" });
// or v15 positional form:
// const session = await _acct.getSession("current");

console.log(session.provider);              // "discord"
console.log(session.providerUid);           // Discord user ID
console.log(session.providerAccessToken);   // token to call Discord's API
console.log(session.providerAccessTokenExpiry);
```

With `providerAccessToken` you can call Discord's API directly, e.g. fetch the
user's profile:

```js
const res = await fetch("https://discord.com/api/users/@me", {
  headers: { Authorization: `Bearer ${session.providerAccessToken}` }
});
const profile = await res.json();
// profile.id, profile.username, profile.global_name,
// profile.avatar ("hash_<avatar>", build the CDN URL: https://cdn.discordapp.com/avatars/<id>/<avatar>.png)
```

## Step 6 — Refresh the provider session

Discord access tokens expire, even while the Appwrite session stays active.
Refresh the OAuth session when the user visits the app (not before every
request, to avoid rate limits):

```js
if (session.providerAccessTokenExpiry && Date.now() > session.providerAccessTokenExpiry - 60000) {
  await _acct.updateSession({ sessionId: "current" });
}
```

## How the account is created

Appwrite's OAuth2 adapter **auto-creates the user account** the first time someone
signs in with Discord — there is no signup form and no extra code. The returned
user (`account.get()`) is a normal Appwrite user whose `$id` is the per-user key
for cloud boxes and save files.

## How user identity maps to cloud data

`cloud.js` stores each cloud-box row with `user_id: _user.$id` (the Appwrite user
ID created from the Discord login). Queries filter on it:

```js
const rows = await _db.listDocuments(DB_ID, COLLECTION_ID, [
  Appwrite.Query.equal("user_id", _user.$id)
]);
```

Each Discord account is a separate user with its own cloud boxes and save files.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Login with Discord" bounces back with `?error=auth` | Appwrite OAuth redirect URI in Discord (Step 1.5) doesn't match the one shown in Appwrite's Discord adapter (Step 2), or the Web Platform (Step 3) is missing |
| Discord says "Invalid redirect" | Check the exact callback URI — host must be `tor.cloud.appwrite.io` |
| Login works but cloud calls fail with CORS errors | Step 3 — add `shatter9652.github.io` (and `localhost`) as Web Platforms |
| `401`/`403` saving yokai | Collection/bucket permissions must include the `Any` role (see main README steps 4–5) |
| Users logged in as "unknown" | The `identify` scope is missing from the Appwrite Discord adapter |

## Reference

- Appwrite docs: [Auth → Discord OAuth adapter](https://appwrite.io/docs/products/auth)
- Appwrite SDK (v15): [client-web Account reference](https://appwrite.io/docs/references/cloud/client-web/account)
- Discord API: [OAuth2](https://discord.com/developers/docs/topics/oauth2) and
  [Get Current User](https://discord.com/developers/docs/resources/user#get-current-user)
