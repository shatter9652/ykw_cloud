/**
 * cloud.js — Appwrite DB/Storage + Authentication
 * Auth options: Discord OAuth2, or Email/Password
 * Appwrite = persistent file storage + user accounts
 * Uses Appwrite SDK v15 (classic documents API, positional args).
 *
 * Session strategy:
 * 1. After email/password login, create a JWT immediately (no cookie issues)
 * 2. After Discord OAuth redirect, bootstrap session from cookie/fallback
 * 3. Promote cookie sessions to JWT for all future requests
 * 4. Store JWT in localStorage — works forever, no cross-origin cookie issues
 */
let _acct=null,_db=null,_sto=null,_user=null,_discordProfile=null;
const _FALLBACK_KEY="cookieFallback";
const _JWT_KEY="ykw_jwt";

function _makeClient(token){
  const{Client,Databases,Storage}=Appwrite;
  const c=new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
  if(token)c.setJWT(token);
  _db=new Databases(c);_sto=new Storage(c);
  return c;
}

function initAppwrite(){
  const{Account}=Appwrite;
  const savedJwt=localStorage.getItem(_JWT_KEY);
  const c=_makeClient(savedJwt);
  _acct=new Account(c);
}

// ── Session bootstrap (for OAuth redirects) ──────────────────
// After an OAuth redirect the session may exist as a cookie but NOT in
// localStorage.  Try to capture it via multiple methods.
async function _bootstrapSession(){
  // Already have a fallback — nothing to do
  if(localStorage.getItem(_FALLBACK_KEY))return;

  // 1. Try document.cookie (works for non-HttpOnly cookies)
  try{
    const entries={};
    document.cookie.split(";").forEach(c=>{
      const t=c.trim();
      if(t.startsWith("a_session_")){const[k,...v]=t.split("=");entries[k]=v.join("=");}
    });
    if(Object.keys(entries).length>0){
      localStorage.setItem(_FALLBACK_KEY,JSON.stringify(entries));
      console.log("[auth] Bootstrapped from document.cookie");
      return;
    }
  }catch(_){}

  // 2. Raw fetch — if the cookie IS sent (SameSite=None), the server will
  //    return X-Fallback-Cookies which we save for the SDK.
  try{
    const res=await fetch(`${APPWRITE_ENDPOINT}/account`,{
      credentials:"include",
      headers:{"X-Appwrite-Project":APPWRITE_PROJECT,"Content-Type":"application/json"}
    });
    const fb=res.headers.get("X-Fallback-Cookies");
    if(fb){
      localStorage.setItem(_FALLBACK_KEY,fb);
      console.log("[auth] Bootstrapped from X-Fallback-Cookies header");
      if(res.ok){try{_user=await res.json();}catch(_){}}
    }
    // Even without fallback header, if the fetch succeeded we have a session
    if(res.ok && !_user){
      try{_user=await res.json();}catch(_){}
      // Store the session as fallback for future requests
      const cookies={};
      document.cookie.split(";").forEach(c=>{
        const t=c.trim();
        if(t.startsWith("a_session_")){const[k,...v]=t.split("=");cookies[k]=v.join("=");}
      });
      if(Object.keys(cookies).length>0){
        localStorage.setItem(_FALLBACK_KEY,JSON.stringify(cookies));
      }
    }
  }catch(e){
    console.log("[auth] Bootstrap fetch failed:",e.message);
  }
}

async function checkAuth(){
  // Already have a user from bootstrap, use it
  if(_user)return _user;

  // 1. Try saved JWT first (no cookie needed — best for repeat visits)
  const savedJwt=localStorage.getItem(_JWT_KEY);
  if(savedJwt){
    try{
      _user=await _acct.get();
      return _user;
    }catch(_){
      localStorage.removeItem(_JWT_KEY);
      _user=null;
    }
  }

  // 2. Try session cookie / fallback mechanism (for OAuth redirect)
  await _bootstrapSession();
  try{
    _user=await _acct.get();
    // Auth succeeded! Promote to JWT so future requests bypass cookies
    await _promoteToJwt();
    return _user;
  }
  catch(_){
    _user=null;
    return null;
  }
}

// After a successful cookie-based session, create a JWT and store it.
// All future requests use the JWT header — no more cookie issues.
async function _promoteToJwt(){
  try{
    const res=await _acct.createJWT();
    if(res&&res.jwt){
      localStorage.setItem(_JWT_KEY,res.jwt);
      // Rebuild the SDK client to use JWT auth
      const c=_makeClient(res.jwt);
      _acct=new Account(c);
      console.log("[auth] Promoted session to JWT");
    }
  }catch(e){
    console.log("[auth] JWT promotion failed:",e.message);
  }
}

// ── Email/Password Auth ──────────────────────────────────────
async function signupEmail(name,email,password){
  const{ID}=Appwrite;
  // Create account
  await _acct.create(ID.unique(),email,password,name||email.split("@")[0]);
  // Auto-login after signup
  await _acct.createEmailPasswordSession(email,password);
  _user=await _acct.get();
  // Promote to JWT immediately (avoids all cookie issues)
  await _promoteToJwt();
  return _user;
}

async function loginEmail(email,password){
  await _acct.createEmailPasswordSession(email,password);
  _user=await _acct.get();
  // Promote to JWT immediately
  await _promoteToJwt();
  return _user;
}

// ── Discord OAuth ────────────────────────────────────────────
function loginDiscord(){
  // Success/failure URLs — Appwrite redirects here after OAuth
  const origin=window.location.origin+window.location.pathname;
  const success=origin;
  const failure=origin+"?error=auth";
  _acct.createOAuth2Session("discord",success,failure,["identify","email"]);
}

async function logout(){
  try{await _acct.deleteSession("current");}catch(_){}
  _user=null;_discordProfile=null;
  localStorage.removeItem(_FALLBACK_KEY);
  localStorage.removeItem(_JWT_KEY);
  // Rebuild client without JWT
  const c=_makeClient(null);
  _acct=new Account(c);
}

// ── Discord profile ──────────────────────────────────────────
async function fetchDiscordProfile(){
  try{
    const s=await _acct.getSession("current");
    if(!s||!s.providerAccessToken)return null;
    const r=await fetch("https://discord.com/api/users/@me",{
      headers:{Authorization:"Bearer "+s.providerAccessToken}
    });
    if(!r.ok)return null;
    _discordProfile=await r.json();
    return _discordProfile;
  }catch(_){return null;}
}

function discordAvatarUrl(d,size=64){
  if(!d||!d.id)return"";
  if(d.avatar)return`https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.png?size=${size}`;
  return`https://cdn.discordapp.com/embed/avatars/${Number(d.discriminator||0)%5}.png`;
}

// ── Cloud boxes ──────────────────────────────────────────────
async function loadCloudBoxes(){
  if(!_user)return[];
  try{
    const r=await _db.listDocuments(DB_ID,COLLECTION_ID,[Appwrite.Query.equal("user_id",_user.$id)]);
    return r.documents||[];
  }catch(e){console.error("loadCloudBoxes:",e);return[];}
}

async function saveYokaiToCloud(box,slot,yokai){
  if(!_user)throw new Error("Not logged in");
  const ex=await _db.listDocuments(DB_ID,COLLECTION_ID,[
    Appwrite.Query.equal("user_id",_user.$id),
    Appwrite.Query.equal("box_num",box),
    Appwrite.Query.equal("slot",slot)
  ]);
  const d={
    user_id:_user.$id,
    box_num:box,
    slot,
    yokai_id:yokai.yokai_id,
    level:yokai.level,
    name:yokai.name||resolveName(yokai.yokai_id),
    raw_hex:Array.from(yokai.raw).map(b=>b.toString(16).padStart(2,"0")).join(""),
    game:yokai.game||"yw2",
    is_team:yokai.is_team||false
  };
  if(ex.documents.length>0)return await _db.updateDocument(DB_ID,COLLECTION_ID,ex.documents[0].$id,d);
  return await _db.createDocument(DB_ID,COLLECTION_ID,Appwrite.ID.unique(),d);
}

async function removeYokaiFromCloud(box,slot){
  if(!_user)return;
  const ex=await _db.listDocuments(DB_ID,COLLECTION_ID,[
    Appwrite.Query.equal("user_id",_user.$id),
    Appwrite.Query.equal("box_num",box),
    Appwrite.Query.equal("slot",slot)
  ]);
  if(ex.documents.length>0)await _db.deleteDocument(DB_ID,COLLECTION_ID,ex.documents[0].$id);
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
  await _sto.createFile(BUCKET_ID,id,file);
  const p=_user.prefs||{};
  const s=p.saves||[];
  s.push({id,name:file.name,size:file.size,date:Date.now()});
  await _acct.updatePrefs({saves:s});
  return id;
}

function listSaveFiles(){return(_user&&_user.prefs&&_user.prefs.saves)||[];}

function getSaveFileUrl(id){return _sto.getFileDownload(BUCKET_ID,id);}

async function deleteSaveFile(id){
  await _sto.deleteFile(BUCKET_ID,id);
  const p=_user.prefs||{};
  const s=(p.saves||[]).filter(x=>x.id!==id);
  await _acct.updatePrefs({saves:s});
}

function hexToBytes(h){
  const b=new Uint8Array(h.length/2);
  for(let i=0;i<b.length;i++)b[i]=parseInt(h.substr(i*2,2),16);
  return b;
}
