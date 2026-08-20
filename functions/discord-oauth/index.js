/**
 * Appwrite Function: Discord OAuth Relay
 *
 * This function acts as a server-side OAuth handler, just like 3DS-RPC's
 * Flask `/authorize` route. It runs on Appwrite's infrastructure (same
 * domain as the API), so it can:
 * 1. Exchange the Discord code for a token (server-side, with client_secret)
 * 2. Create an Appwrite session
 * 3. Generate a JWT
 * 4. Redirect to the frontend with the JWT (no cookies needed!)
 *
 * Environment variables (set in Appwrite Console → Functions → Settings):
 *   DISCORD_CLIENT_ID      - Discord app client ID
 *   DISCORD_CLIENT_SECRET  - Discord app client secret
 *   APPWRITE_ENDPOINT      - Appwrite API endpoint
 *   APPWRITE_PROJECT       - Appwrite project ID
 *   APPWRITE_API_KEY       - Appwrite API key (with sessions.create permission)
 *   FRONTEND_URL           - Your GitHub Pages URL (e.g., https://shatter9652.github.io/ykw_cloud)
 */

module.exports = async ({ req, res, log, error }) => {
  const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT;
  const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT;
  const APPWRITE_API_KEY = process.env.APPWRITE_API_KEY;
  const FRONTEND_URL = process.env.FRONTEND_URL || 'https://shatter9652.github.io/ykw_cloud';

  // ── Handle OAuth callback (GET /?code=...&state=...) ───────
  if (req.method === 'GET' && req.query.code) {
    const code = req.query.code;
    const state = req.query.state || '{}';

    log(`OAuth callback received, code: ${code.substring(0, 8)}...`);

    try {
      // Step 1: Exchange Discord code for access token (server-side!)
      const tokenRes = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: DISCORD_CLIENT_ID,
          client_secret: DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: `${APPWRITE_ENDPOINT}/functions/discord-oauth/execution`,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        error(`Discord token exchange failed: ${err}`);
        return res.redirect(`${FRONTEND_URL}?error=discord_token_exchange`);
      }

      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;

      // Step 2: Fetch Discord user profile
      const userRes = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userRes.ok) {
        error('Failed to fetch Discord user profile');
        return res.redirect(`${FRONTEND_URL}?error=discord_profile`);
      }

      const discordUser = await userRes.json();
      log(`Discord user: ${discordUser.username} (${discordUser.id})`);

      // Step3: Create or get Appwrite user
      const email = `${discordUser.id}@discord.local`;  // Internal email
      const password = `discord_${discordUser.id}_${DISCORD_CLIENT_ID}`;  // Stable password

      let appwriteUser;
      try {
        // Try to create user (first time)
        const createRes = await fetch(`${APPWRITE_ENDPOINT}/users`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Appwrite-Project': APPWRITE_PROJECT,
            'X-Appwrite-Key': APPWRITE_API_KEY,
          },
          body: JSON.stringify({
            userId: discordUser.id,
            email: email,
            password: password,
            name: discordUser.username,
          }),
        });

        if (createRes.ok) {
          appwriteUser = await createRes.json();
          log(`Created Appwrite user: ${appwriteUser.$id}`);
        } else {
          // User already exists — that's fine
          log(`User ${discordUser.id} already exists, getting it...`);
          const getRes = await fetch(`${APPWRITE_ENDPOINT}/users/${discordUser.id}`, {
            headers: {
              'X-Appwrite-Project': APPWRITE_PROJECT,
              'X-Appwrite-Key': APPWRITE_API_KEY,
            },
          });
          if (getRes.ok) {
            appwriteUser = await getRes.json();
          } else {
            throw new Error('Failed to get existing user');
          }
        }
      } catch (e) {
        error(`Appwrite user creation failed: ${e.message}`);
        return res.redirect(`${FRONTEND_URL}?error=appwrite_user`);
      }

      // Step4: Create Appwrite session using email/password
      // Uses the public /account/sessions/email endpoint (no API key needed)
      const sessionRes = await fetch(`${APPWRITE_ENDPOINT}/account/sessions/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_PROJECT,
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      if (!sessionRes.ok) {
        const err = await sessionRes.text();
        error(`Session creation failed: ${err}`);
        return res.redirect(`${FRONTEND_URL}?error=appwrite_session`);
      }

      const session = await sessionRes.json();
      log(`Session created: ${session.$id}`);

      // Step 5: Generate JWT using the session secret
      // Uses /account/jwt with X-Appwrite-Session header to authenticate
      const jwtRes = await fetch(`${APPWRITE_ENDPOINT}/account/jwt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Project': APPWRITE_PROJECT,
          'X-Appwrite-Session': session.secret,
        },
        body: JSON.stringify({}),
      });

      if (!jwtRes.ok) {
        error('JWT creation failed');
        return res.redirect(`${FRONTEND_URL}?error=jwt_creation`);
      }

      const jwtData = await jwtRes.json();
      const jwt = jwtData.jwt;

      log(`JWT generated, redirecting to frontend`);

      // Step 6: Redirect to frontend with JWT in URL
      const frontendUrl = `${FRONTEND_URL}?token=${encodeURIComponent(jwt)}&username=${encodeURIComponent(discordUser.username)}&avatar=${encodeURIComponent(discordUser.avatar || '')}`;
      return res.redirect(frontendUrl);

    } catch (e) {
      error(`OAuth handler error: ${e.message}`);
      return res.redirect(`${FRONTEND_URL}?error=server_error`);
    }
  }

  // ── Handle OAuth initiation (GET /login) ───────────────────
  if (req.method === 'GET' && req.query.action === 'login') {
    const redirectUri = `${APPWRITE_ENDPOINT.replace('/v1', '')}/functions/discord-oauth/execution`;
    const discordUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify+email`;
    return res.redirect(discordUrl);
  }

  // ── Default: show instructions ──────────────────────────────
  return res.send(`
    <html><body style="font-family:sans-serif;padding:40px;">
      <h2>YKW Home — Discord OAuth</h2>
      <p>This is the OAuth relay endpoint for YKW Home.</p>
      <p>To login, use the <a href="/login?action=login">Login with Discord</a> link.</p>
    </body></html>
  `);
};
