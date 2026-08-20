# Discord OAuth Appwrite Function

This function acts as a **server-side OAuth relay** for Discord sign-in, exactly like 3DS-RPC's Flask `/authorize` route. It runs on Appwrite's infrastructure (same domain as the API), so it can:

1. Exchange the Discord code for a token **server-side** (using your client secret)
2. Create an Appwrite session
3. Generate a JWT
4. Redirect to your frontend with the JWT in the URL

**No cookies needed** — the JWT is passed via URL parameter and stored in localStorage.

## Why is this needed?

GitHub Pages is static — there's no server to handle the OAuth callback. Appwrite's built-in OAuth sets a session cookie on `tor.cloud.appwrite.io`, which is cross-origin from your GitHub Pages site. Firefox blocks this cookie (Total Cookie Protection).

This function solves the problem by doing the OAuth exchange **on Appwrite's server** (same domain as the API), then passing the JWT directly to your frontend.

## Setup (5 minutes)

### Step 1: Enable Email/Password Auth

In Appwrite Console → **Auth** → **Settings**:
1. Enable **Email/Password** (toggle ON)
2. Click **Update**

This is needed because the function creates Appwrite users with email/password credentials.

### Step2: Create the Function

1. Appwrite Console → **Functions** → **Create function**
2. Name: `discord-oauth`
3. Runtime: **Node.js 22** (or latest available)
4. Under "Connect Git repository", select your GitHub repo
5. Set the root directory to: `ykw-home/ykw-web/functions/discord-oauth`
6. Click **Create**

### Step3: Set Environment Variables

In your function's **Settings** → **Environment variables**, add:

| Variable | Value |
|----------|-------|
| `DISCORD_CLIENT_ID` | Your Discord app's Client ID |
| `DISCORD_CLIENT_SECRET` | Your Discord app's Client Secret |
| `APPWRITE_ENDPOINT` | `https://tor.cloud.appwrite.io/v1` |
| `APPWRITE_PROJECT` | `6a86504b0033f733c338` |
| `APPWRITE_API_KEY` | Your Appwrite API key (needs `sessions.create` + `users.read` + `jwt.create` permissions) |
| `FRONTEND_URL` | `https://shatter9652.github.io/ykw_cloud` (or `http://localhost:8443` for local testing) |

### Step4: Enable HTTP Execution

1. In your function's **Settings** → **Execution**
2. Enable **Allow execution via HTTP**
3. Note the execution URL (it looks like `https://tor.cloud.appwrite.io/v1/functions/discord-oauth/execution`)

### Step5: Update Discord Redirect URI

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Open your app → **OAuth2** → **Redirects**
3. Add the function's execution URL as a redirect URI:
   ```
   https://tor.cloud.appwrite.io/v1/functions/discord-oauth/execution
   ```
4. Save

### Step6: Create an API Key

1. Appwrite Console → **Overview** → **API Keys** → **Create API Key**
2. Name: `discord-oauth-function`
3. Add these scopes:
   - `users.read`
   - `users.write`
   - `sessions.create`
   - `jwt.create`
4. Copy the key and add it as the `APPWRITE_API_KEY` environment variable

### Step7: Deploy

Push the function code to your Git repo. Appwrite will automatically build and deploy it.

## How it works

```
User clicks "Login with Discord"
        │
        ▼
Frontend → Appwrite Function /login?action=login
        │
        ▼
Function redirects to Discord OAuth
        │
        ▼
User authorizes on Discord
        │
        ▼
Discord redirects back to Function with ?code=...
        │
        ▼
Function (server-side):
  1. Exchanges code for Discord access token
  2. Fetches Discord user profile
  3. Creates Appwrite user (or gets existing)
  4. Creates Appwrite session
  5. Generates JWT
        │
        ▼
Function redirects to Frontend ?token=<JWT>&username=...
        │
        ▼
Frontend reads JWT from URL → stores in localStorage
        │
        ▼
All future requests use Authorization: Bearer <jwt>
```

## Local Testing

For local testing, set `FRONTEND_URL=http://localhost:8443` in the function's environment variables. Also add `http://localhost:8443` to the Discord redirect URIs.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Function not found | Make sure the function is deployed and the execution URL is correct |
| Discord says "Invalid redirect" | The Discord redirect URI must match the function's execution URL exactly |
| `APPWRITE_API_KEY` error | Make sure the API key has `users.read`, `users.write`, `sessions.create`, and `jwt.create` permissions |
| User already exists error | This is normal — the function handles it by getting the existing user |
| JWT expired | JWTs expire after 1 year by default. Click "Login with Discord" again |
