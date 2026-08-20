/**
 * cloud.js — Appwrite DB/Storage + Authentication
 * Auth options: Discord OAuth2 (primary), Email/Password (fallback)
 * Uses Appwrite SDK v23 (IIFE build, classic documents API).
 *
 * Discord OAuth flow (NO COOKIES NEEDED):
 * 1. Use createOAuth2Token (NOT createOAuth2Session)
 * 2. After Discord auth, Appwrite redirects to success URL with
 *    ?userId=...&secret=... in the query string
 * 3. Frontend reads userId + secret from URL
 * 4. Frontend calls account.createSession({userId, secret})
 * 5. Session is created! Promote to JWT for all future requests.
 *
 * This bypasses Firefox's Total Cookie Protection entirely because
 * the auth data is passed via URL parameters, not cookies.
 */
let _acct=null,_user=null,_discordProfile=null;
const _JWT_KEY="ykw_jwt";
const _SESSION_KEY="ykw_session";  // stores {userId, secret} for session restore
const _EMAIL_KEY="ykw_email";      // stores email for pre-fill
const _REMEMBER_KEY="ykw_remember"; // flag: user wants to be remembered

function _log(...args){console.log("[auth]",...args);}

// ── Session storage for "Remember Me" ───────────────────────
function _storeSession(session,remember,email){
  if(remember&&session&&session.$id&&session.secret){
    localStorage.setItem(_SESSION_KEY,JSON.stringify({userId:session.userId||_user?.$id,secret:session.secret}));
    localStorage.setItem(_REMEMBER_KEY,"1");
  }
  if(email)localStorage.setItem(_EMAIL_KEY,email);
}
function _storedSession(){
  try{return JSON.parse(localStorage.getItem(_SESSION_KEY));}catch(_){return null;}
}
function _clearSession(){
  localStorage.removeItem(_SESSION_KEY);
  localStorage.removeItem(_REMEMBER_KEY);
  localStorage.removeItem(_EMAIL_KEY);
}
function _storedEmail(){return localStorage.getItem(_EMAIL_KEY)||"";}

function _makeClient(token){
  const{Client,Account}=Appwrite;
  const c=new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
  if(token)c.setJWT(token);
  _acct=new Account(c);
}

function initAppwrite(){
  const savedJwt=localStorage.getItem(_JWT_KEY);
  _makeClient(savedJwt);
}

// ── Check for OAuth token in URL ────────────────────────────
// After createOAuth2Token, Appwrite redirects with ?userId=...&secret=...
// We read these and create a session client-side (no cookies!)
function _checkOAuthToken(){
  const params=new URLSearchParams(window.location.search);
  const userId=params.get("userId");
  const secret=params.get("secret");
  const error=params.get("error");

  if(error){
    _log("OAuth error:",error);
    window.history.replaceState({},document.title,window.location.pathname+window.location.hash);
    return false;
  }

  if(userId&&secret){
    _log("Got OAuth token from URL, creating session...");
    // Clean URL immediately
    window.history.replaceState({},document.title,window.location.pathname+window.location.hash);
    return{userId,secret};
  }
  return false;
}

// ── Create session from OAuth token ──────────────────────────
async function _createSessionFromToken(userId,secret){
  try{
    _log("Creating session from token...");
    // Delete any existing sessions first (fixes "session is prohibited when active")
    try{await _acct.deleteSessions();}catch(_){}
    const session=await _acct.createSession({userId,secret});
    _log("Session created:",session.$id);
    // Get the user
    _user=await _acct.get();
    _log("User:",_user.name||_user.email);
    // Discord logins always remember — store session for restoration
    _storeSession(session,true,_user.email);
    // Promote to JWT
    await _promoteToJwt();
    return _user;
  }catch(e){
    _log("Session creation failed:",e.message);
    return null;
  }
}

// ── JWT promotion ────────────────────────────────────────────
async function _promoteToJwt(){
  try{
    const res=await _acct.createJWT({duration:3600});  // Max 1 hour
    if(res&&res.jwt){
      localStorage.setItem(_JWT_KEY,res.jwt);
      localStorage.removeItem("cookieFallback");
      _makeClient(res.jwt);
      _log("Promoted to JWT ✓ (1h duration)");
    }
  }catch(e){
    _log("JWT promotion failed:",e.message);
  }
}

// ── Check auth on page load ──────────────────────────────────
async function checkAuth(){
  // 1. Check if we just came back from OAuth with userId+secret in URL
  const tokenData=_checkOAuthToken();
  if(tokenData){
    const user=await _createSessionFromToken(tokenData.userId,tokenData.secret);
    if(user)return user;
  }

  // 2. Try saved JWT
  const savedJwt=localStorage.getItem(_JWT_KEY);
  if(savedJwt){
    try{
      _user=await _acct.get();
      _log("JWT auth OK:",_user.name||_user.email);
      return _user;
    }catch(_){
      localStorage.removeItem(_JWT_KEY);
      _user=null;
    }
  }

  // 3. Try restoring from stored session secret ("Remember Me")
  const stored=_storedSession();
  if(stored&&stored.userId&&stored.secret){
    try{
      _log("Restoring session from stored secret...");
      _makeClient(null);
      const session=await _acct.createSession({userId:stored.userId,secret:stored.secret});
      _user=await _acct.get();
      _log("Session restored:",_user.name||_user.email);
      await _promoteToJwt();
      return _user;
    }catch(e){
      _log("Session restore failed:",e.message);
      _clearSession();
    }
  }

  return null;
}

// ── Email/Password Auth ──────────────────────────────────────
async function signupEmail(name,email,password,remember){
  if(!_acct)initAppwrite();
  const{ID}=Appwrite;
  _log("Signing up:",email);
  await _acct.create(ID.unique(),email,password,name||email.split("@")[0]);
  const session=await _acct.createEmailPasswordSession(email,password);
  _user=await _acct.get();
  _storeSession(session,remember,email);
  await _promoteToJwt();
  _log("Signup OK:",_user.email,remember?"(remembered)":"");
  return _user;
}

async function loginEmail(email,password,remember){
  if(!_acct)initAppwrite();
  _log("Logging in:",email);
  const session=await _acct.createEmailPasswordSession(email,password);
  _user=await _acct.get();
  _storeSession(session,remember,email);
  await _promoteToJwt();
  _log("Login OK:",_user.email,remember?"(remembered)":"");
  return _user;
}

// ── Discord OAuth (via createOAuth2Token — NO COOKIES!) ──────
function loginDiscord(){
  if(!_acct)initAppwrite();
  const origin=window.location.origin+window.location.pathname;
  _log("Starting Discord OAuth via createOAuth2Token...");

  // Use createOAuth2Token (NOT createOAuth2Session!)
  // This returns userId+secret in the redirect URL, bypassing cookies entirely.
  _acct.createOAuth2Token({
    provider:"discord",
    success:origin,
    failure:origin+"?error=auth",
    scopes:["identify","email"]
  });
}

async function logout(){
  try{await _acct.deleteSession("current");}catch(_){}
  _user=null;_discordProfile=null;
  localStorage.removeItem(_JWT_KEY);
  localStorage.removeItem(_PROFILE_KEY);
  localStorage.removeItem("cookieFallback");
  _clearSession();  // Clear remember-me data
  _makeClient(null);
  _log("Logged out");
}

// ── Discord profile ──────────────────────────────────────────
const _PROFILE_KEY="ykw_discord_profile";

async function fetchDiscordProfile(){
  // If we have profile data from a previous fetch, use it
  if(_discordProfile&&_discordProfile.username){
    _log("Using cached profile:",_discordProfile.username);
    return _discordProfile;
  }
  // Try localStorage cache
  try{
    const cached=localStorage.getItem(_PROFILE_KEY);
    if(cached){_discordProfile=JSON.parse(cached);return _discordProfile;}
  }catch(_){}
  // Fetch from Discord API via Appwrite session
  try{
    const s=await _acct.getSession("current");
    if(!s||!s.providerAccessToken)return null;
    const r=await fetch("https://discord.com/api/users/@me",{
      headers:{Authorization:"Bearer "+s.providerAccessToken}
    });
    if(!r.ok)return null;
    _discordProfile=await r.json();
    localStorage.setItem(_PROFILE_KEY,JSON.stringify(_discordProfile));
    _log("Got Discord profile:",_discordProfile.username);
    return _discordProfile;
  }catch(_){return null;}
}

// ── Account settings ────────────────────────────────────────
async function updateAccountName(name){
  if(!_user)throw new Error("Not logged in");
  await _acct.updateName(name);
  _user.name=name;
  _log("Name updated to:",name);
}

async function updateAccountEmail(email,password){
  if(!_user)throw new Error("Not logged in");
  await _acct.updateEmail(email,password);
  _log("Email updated to:",email);
}

async function updateAccountPassword(newPw,oldPw){
  if(!_user)throw new Error("Not logged in");
  await _acct.updatePassword(newPw,oldPw||undefined);
  _log("Password updated");
}

async function deleteAccount(password){
  if(!_user)throw new Error("Not logged in");
  await _acct.updateStatus();  // Block account
  await logout();
  _log("Account deleted");
}

function discordAvatarUrl(d,size=64){
  if(!d||!d.id)return"";
  if(d.avatar)return`https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=${size}`;
  return`https://cdn.discordapp.com/embed/avatars/${Number(d.discriminator||0)%5}.png`;
}

// ── Raw Appwrite fetch (bypasses SDK cookie issue) ──────────
// The SDK v23 IIFE always sends credentials:'include' which sends cookies.
// We use credentials:'omit' + JWT header to avoid the "JWT and cookie" 403.
function _appwriteFetch(method,path,body){
  const jwt=localStorage.getItem(_JWT_KEY);
  const headers={"Content-Type":"application/json","X-Appwrite-Project":APPWRITE_PROJECT};
  if(jwt)headers["X-Appwrite-JWT"]=jwt;
  return fetch(APPWRITE_ENDPOINT+path,{
    method,headers,credentials:"omit",
    body:body?JSON.stringify(body):undefined
  }).then(async r=>{
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||r.statusText);}
    return r.json();
  });
}

// ── Cloud boxes ──────────────────────────────────────────────
async function loadCloudBoxes(){
  if(!_user)return[];
  try{
    const q=JSON.stringify({method:"equal",attribute:"user_id",values:[_user.$id]});
    const r=await _appwriteFetch("GET",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents?queries[0]=${encodeURIComponent(q)}`);
    return r.documents||[];
  }catch(e){console.error("loadCloudBoxes:",e);return[];}
}

async function saveYokaiToCloud(box,slot,yokai){
  if(!_user)throw new Error("Not logged in");
  const q1=JSON.stringify({method:"equal",attribute:"user_id",values:[_user.$id]});
  const q2=JSON.stringify({method:"equal",attribute:"box_num",values:[box]});
  const q3=JSON.stringify({method:"equal",attribute:"slot",values:[slot]});
  const r=await _appwriteFetch("GET",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents?queries[0]=${encodeURIComponent(q1)}&queries[1]=${encodeURIComponent(q2)}&queries[2]=${encodeURIComponent(q3)}`);
  const d={
    user_id:_user.$id,box_num:box,slot,
    yokai_id:yokai.yokai_id,level:yokai.level,
    name:yokai.name||resolveName(yokai.yokai_id),
    raw_hex:Array.from(yokai.raw).map(b=>b.toString(16).padStart(2,"0")).join(""),
    game:yokai.game||"yw2",is_team:yokai.is_team||false
  };
  if(r.documents.length>0)return await _appwriteFetch("PATCH",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents/${r.documents[0].$id}`,d);
  return await _appwriteFetch("POST",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents`,{documentId:Appwrite.ID.unique(),data:d});
}

async function removeYokaiFromCloud(box,slot){
  if(!_user)return;
  const q1=JSON.stringify({method:"equal",attribute:"user_id",values:[_user.$id]});
  const q2=JSON.stringify({method:"equal",attribute:"box_num",values:[box]});
  const q3=JSON.stringify({method:"equal",attribute:"slot",values:[slot]});
  const r=await _appwriteFetch("GET",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents?queries[0]=${encodeURIComponent(q1)}&queries[1]=${encodeURIComponent(q2)}&queries[2]=${encodeURIComponent(q3)}`);
  if(r.documents.length>0)await _appwriteFetch("DELETE",`/databases/${DB_ID}/collections/${COLLECTION_ID}/documents/${r.documents[0].$id}`);
}

async function moveYokaiInCloud(fb,fs,tb,ts){
  const boxes=await loadCloudBoxes();
  const src=boxes.find(r=>r.box_num===fb&&r.slot===fs);
  if(!src)return;
  await removeYokaiFromCloud(tb,ts);
  await saveYokaiToCloud(tb,ts,{yokai_id:src.yokai_id,level:src.level,name:src.name,raw:hexToBytes(src.raw_hex),game:src.game,is_team:src.is_team});
  await removeYokaiFromCloud(fb,fs);
}

async function uploadSaveFile(file){
  if(!_user)throw new Error("Not logged in");
  const id=Appwrite.ID.unique();
  const jwt=localStorage.getItem(_JWT_KEY);
  const fd=new FormData();
  fd.append("file",file);
  const headers={"X-Appwrite-Project":APPWRITE_PROJECT};
  if(jwt)headers["X-Appwrite-JWT"]=jwt;
  await fetch(`${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}`,{
    method:"POST",headers,credentials:"omit",body:fd
  }).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||r.statusText);});
  const p=_user.prefs||{},s=p.saves||[];
  s.push({id,name:file.name,size:file.size,date:Date.now()});
  await _acct.updatePrefs({saves:s});
  return id;
}

function listSaveFiles(){return(_user&&_user.prefs&&_user.prefs.saves)||[];}
function getSaveFileUrl(id){return `${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}/download?project=${APPWRITE_PROJECT}`;}

async function deleteSaveFile(id){
  const jwt=localStorage.getItem(_JWT_KEY);
  const headers={"X-Appwrite-Project":APPWRITE_PROJECT};
  if(jwt)headers["X-Appwrite-JWT"]=jwt;
  await fetch(`${APPWRITE_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${id}`,{
    method:"DELETE",headers,credentials:"omit"
  }).then(async r=>{if(!r.ok)throw new Error((await r.json().catch(()=>({}))).message||r.statusText);});
  const p=_user.prefs||{},s=(p.saves||[]).filter(x=>x.id!==id);
  await _acct.updatePrefs({saves:s});
}

function hexToBytes(h){
  const b=new Uint8Array(h.length/2);
  for(let i=0;i<b.length;i++)b[i]=parseInt(h.substr(i*2,2),16);
  return b;
}
