/**
 * app.js — Main UI: boxes, grid, detail panel, save upload, cloud boxes
 * Modeled after Unbound-Cloud's MainPage.js
 */
let _saves={},_cloudBoxes=[],_currentGame=null,_boxIdx=0,_selSlot=null;
let _cloudBoxIdx=0,_viewMode="save"; // "save" | "cloud"
let _pendingGame=null; // {buf,file} waiting for head.yw / head.yw_g (iOS two-step)

async function initApp(){
  // Safari cache bust: if version changed, force-reload all scripts
  const lastVersion=localStorage.getItem("ykw_build_version");
  if(lastVersion&&lastVersion!==APP_VERSION){
    localStorage.setItem("ykw_build_version",APP_VERSION);
    // Add cache-bust param to all script tags and reload
    document.querySelectorAll("script[src]").forEach(s=>{
      const url=new URL(s.src,location.href);
      url.searchParams.set("cb",Date.now());
      s.src=url.toString();
    });
    location.reload();
    return;
  }
  localStorage.setItem("ykw_build_version",APP_VERSION);
  await loadIconData();
  preloadAllIcons();
  initContextMenu();
  initAppwrite();
  // checkAuth() reads ?userId=&secret= from URL (after Discord OAuth redirect)
  const user=await checkAuth();
  if(user){
    try{await fetchDiscordProfile();}catch(_){}
  }
  updateAuthUI(user);
  document.getElementById("file-input").addEventListener("change",handleSaveFile);
  setupGridDrop();
  const error=new URLSearchParams(window.location.search).get("error");
  if(error){
    alert("Discord login failed ("+error+"). Try email/password login instead.");
    window.history.replaceState({},document.title,window.location.pathname);
  }
}

async function doLogout(){
  await logout();
  updateAuthUI(null);
}

// ── Auth modal ───────────────────────────────────────────────
function showAuthModal(){
  document.getElementById("auth-modal").style.display="flex";
  document.getElementById("auth-error").style.display="none";
  showLoginForm();
  // Pre-fill email from stored remember-me data
  const stored=_storedEmail();
  if(stored){
    const emailEl=document.getElementById("auth-email");
    if(emailEl)emailEl.value=stored;
  }
}
function closeAuthModal(){
  document.getElementById("auth-modal").style.display="none";
}
function switchAuthTab(tab){
  document.querySelectorAll(".auth-tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===tab));
  document.getElementById("auth-discord-tab").style.display=tab==="discord"?"":"none";
  document.getElementById("auth-email-tab").style.display=tab==="email"?"":"none";
  document.getElementById("auth-error").style.display="none";
}
function showLoginForm(){
  document.getElementById("email-login-form").style.display="";
  document.getElementById("email-signup-form").style.display="none";
}
function showSignupForm(){
  document.getElementById("email-login-form").style.display="none";
  document.getElementById("email-signup-form").style.display="";
}
function showAuthError(msg){
  const el=document.getElementById("auth-error");
  el.textContent=msg;el.style.display="";
}
async function doLoginDiscord(){
  loginDiscord();
}
async function doImportSession(){
  if(importSessionManually()){
    // Reload auth state
    initAppwrite();
    const user=await checkAuth();
    if(user){
      try{await fetchDiscordProfile();}catch(_){}
      updateAuthUI(user);
      closeAuthModal();
    }
  }
}
async function doLoginEmail(){
  const email=document.getElementById("auth-email").value.trim();
  const pass=document.getElementById("auth-password").value;
  const remember=document.getElementById("auth-remember").checked;
  if(!email||!pass){showAuthError("Enter email and password.");return;}
  try{
    const user=await loginEmail(email,pass,remember);
    updateAuthUI(user);
    closeAuthModal();
  }catch(e){
    showAuthError(e.message||"Login failed.");
  }
}
async function doSignupEmail(){
  const name=document.getElementById("auth-name").value.trim();
  const email=document.getElementById("auth-signup-email").value.trim();
  const pass=document.getElementById("auth-signup-password").value;
  const remember=document.getElementById("auth-signup-remember").checked;
  if(!email||!pass){showAuthError("Enter email and password.");return;}
  if(pass.length<8){showAuthError("Password must be at least 8 characters.");return;}
  try{
    const user=await signupEmail(name,email,pass,remember);
    updateAuthUI(user);
    closeAuthModal();
  }catch(e){
    showAuthError(e.message||"Signup failed.");
  }
}

function updateAuthUI(user){
  const btn=document.getElementById("auth-btn");
  const userEl=document.getElementById("user-info");
  const mBtn=document.getElementById("mobile-auth-btn");
  const mPill=document.getElementById("mobile-user-pill");
  const sidebarAuth=document.getElementById("sidebar-auth");
  // Try Discord profile first, then fall back to Appwrite user
  const d=_discordProfile||{};
  const uname=d.global_name||d.username||user?.name||user?.email||"User";
  const avatar=discordAvatarUrl(d);
  const avatarHtml=avatar
    ?`<img class="user-avatar" src="${avatar}" alt="" onerror="this.style.display='none'">`
    :`<div class="user-avatar placeholder-avatar" style="background:${nameColor(uname)};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#fff;">${(uname||"?")[0].toUpperCase()}</div>`;
  if(user){
    btn.style.display="none";
    userEl.style.display="inline-flex";
    userEl.innerHTML=`
      ${avatarHtml}
      <span class="user-name">${uname.replace(/</g,"&lt;")}</span>
      <button class="btn small" onclick="doLogout()">Logout</button>`;
    // Mobile topbar: hide auth icon, show user pill
    if(mBtn)mBtn.style.display="none";
    if(mPill){
      mPill.style.display="inline-flex";
      mPill.innerHTML=`
        ${avatarHtml}
        <span class="user-name">${uname.replace(/</g,"&lt;")}</span>
        <button class="btn small" onclick="doLogout()">Logout</button>`;
    }
    // Sidebar: show user card
    if(sidebarAuth){
      sidebarAuth.innerHTML=`
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
          ${avatarHtml}
          <div><div style="font-weight:bold;font-size:13px;">${uname.replace(/</g,"&lt;")}</div>
          <div style="font-size:10px;color:var(--text2);">${user.email||""}</div></div>
        </div>
        <button class="btn small" onclick="toggleMobileSidebar();doLogout();" style="width:100%;">Logout</button>`;
    }
    // Enable cloud buttons
    document.querySelectorAll("[data-requires-auth]").forEach(b=>b.disabled=false);
  }else{
    btn.style.display="";
    btn.textContent="Sign In";
    btn.onclick=()=>showAuthModal();
    userEl.style.display="none";
    if(mBtn){mBtn.style.display="";mBtn.onclick=()=>showAuthModal();}
    if(mPill)mPill.style.display="none";
    if(sidebarAuth)sidebarAuth.innerHTML=`<button class="btn primary" onclick="toggleMobileSidebar();showAuthModal();">Sign In</button>`;
    // Disable cloud buttons
    document.querySelectorAll("[data-requires-auth]").forEach(b=>b.disabled=true);
  }
}

const ALL_GAMES=["yw1","yw2","yw3","ykb","b2","yw4"];

function makeFileReader(){
  return file=>new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(new Uint8Array(reader.result));
    reader.onerror=()=>reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

// Try candidates in a sensible order (hint first, like the Python auto-detector)
function candidateOrder(name,hintVer){
  if(hintVer&&ALL_GAMES.includes(hintVer.id))return[hintVer.id,...ALL_GAMES.filter(g=>g!==hintVer.id)];
  const n=(name||"").toLowerCase();
  const hints={"yw1":["yw1","yokai_watch_1"],"yw2":["yw2","yokai_watch_2"],"yw3":["yw3","yokai_watch_3","yokai3"],"ykb":["ykb","busters","blasters"],"b2":["b2","blasters2"],"yw4":["yw4","yokai_watch_4","userdata"]};
  for(const g of ALL_GAMES){if(hints[g].some(h=>n.includes(h)))return[g,...ALL_GAMES.filter(x=>x!==g)];}
  return ALL_GAMES;
}

// Try every game pipeline until one decrypts + parses (mirrors SaveHandler.load)
async function loadSaveIntoView(g,headData){
  const name=g.file.name;
  const header=g.buf.slice(0,64);
  const hintVer=detectGameVersion(name,header);
  const order=candidateOrder(name,hintVer);
  const errors=[];
  for(const gameId of order){
    try{
      const result=await decryptSave(g.buf,headData,gameId);
      const yokai=extractYokai(result.data,gameId);
      const ver=(hintVer&&hintVer.id===gameId)?hintVer:(GAME_VERSIONS.find(v=>v.id===gameId)||hintVer);
      _saves[gameId]={game:gameId,version:ver,yokai,file:name,raw:g.buf,result};
      _currentGame=gameId;_boxIdx=0;_selSlot=null;
      renderSaveCards();renderGrid();
      document.getElementById("welcome").style.display="none";
      document.getElementById("box-view").style.display="flex";
      return true;
    }catch(err){errors.push(`${gameId}: ${err.message}`);}
  }
  if(headData)throw new Error(errors.join(" | "));
  return false;
}

function _validateFile(f){
  const MAX_SIZE=5*1024*1024; // 5MB
  const name=(f.name||"").toLowerCase();
  const ext=name.split(".").pop();
  const validSaveExt=["yw","yw_g","bin","yw4"];
  const validHeadPrefix=name.startsWith("head");
  const isSave=validSaveExt.includes(ext);
  const isHead=validHeadPrefix;
  if(!isSave&&!isHead){
    alert(`"${f.name}" is not a supported file type.\n\nAccepted: .yw, .yw_g, .bin, .yw4\n(head.yw / head.yw_g for iOS, data.bin for YW4)`);
    return false;
  }
  if(f.size>MAX_SIZE){
    alert(`"${f.name}" is too large (${(f.size/1024/1024).toFixed(1)}MB). Max 5MB.`);
    return false;
  }
  return true;
}

async function handleSaveFile(e){
  const files=Array.from(e.target.files);
  e.target.value="";
  if(!files.length)return;
  const readFile=makeFileReader();

  // Step 2 of a two-step load: user is picking head.yw / head.yw_g now
  if(_pendingGame){
    const head=files.find(f=>/^head\./i.test(f.name));
    if(head){
      try{
        const p=_pendingGame;_pendingGame=null;
        const headData=await readFile(head);
        await loadSaveIntoView(p,headData);
      }catch(err){alert(`Failed to decrypt: ${err.message}`);}
    }else{
      alert("Pick the head.yw file (name starts with 'head').");
      document.getElementById("file-input").click();
    }
    return;
  }

  // Validate all files
  for(const f of files){if(!_validateFile(f))return;}

  const isHead=f=>/^head\./i.test(f.name);
  const isGame=f=>!isHead(f);  // Any non-head file is a game file
  const head=files.find(isHead);
  const game=files.find(isGame);
  if(!game){alert("Select a save file (.yw / .yw_g / .bin), optionally together with head.yw.");return;}

  try{
    const buf=await readFile(game);
    let headData=null;
    if(head)headData=await readFile(head);

    if(headData){
      await loadSaveIntoView({buf,file:game},headData);
      return;
    }

    // No head yet: try headless candidates (YW1 / YW2 fixed-key)
    const ok=await loadSaveIntoView({buf,file:game},null);
    if(!ok){
      _pendingGame={buf,file:game};
      alert("This save needs its head.yw (or head.yw_g) file — pick it now.");
      document.getElementById("file-input").click();
    }
  }catch(err){alert(`Failed to decrypt: ${err.message}`);}
}

function renderSaveCards(){
  const el=document.getElementById("save-list");el.innerHTML="";
  const sidebarEl=document.getElementById("sidebar-save-list");if(sidebarEl)sidebarEl.innerHTML="";
  for(const[gid,save]of Object.entries(_saves)){
    const card=document.createElement("div");
    card.className="save-card"+(gid===_currentGame?" selected":"");
    card.onclick=()=>{_currentGame=gid;_boxIdx=0;renderSaveCards();renderGrid();};
    card.innerHTML=`<img src="${save.version.icon}" class="save-icon" onerror="this.src='icons/ykw2psycicspecters.png'"><div><div class="save-name">${save.version.label}</div><div class="save-meta">${save.yokai.length} yokai · ${save.file}</div></div>`;
    el.appendChild(card);
    // Also add to sidebar save list
    if(sidebarEl){
      const sc=card.cloneNode(true);
      sc.onclick=()=>{_currentGame=gid;_boxIdx=0;renderSaveCards();renderGrid();toggleMobileSidebar();};
      sidebarEl.appendChild(sc);
    }
  }
}

function renderGrid(){
  const save=_saves[_currentGame];if(!save)return;
  const total=save.yokai.length;
  const boxCount=Math.max(1,Math.ceil(total/MONS_PER_BOX));
  _boxIdx=Math.min(_boxIdx,boxCount-1);
  document.getElementById("box-title").textContent=`Box ${_boxIdx+1}/${boxCount} · ${total} yokai`;
  const grid=document.getElementById("box-grid");grid.innerHTML="";
  const start=_boxIdx*MONS_PER_BOX;
  const map={};
  for(const y of save.yokai){const i=y.slot-start;if(i>=0&&i<MONS_PER_BOX)map[i]=y;}
  for(let i=0;i<MONS_PER_BOX;i++){
    const cell=document.createElement("div");cell.className="cell";
    const y=map[i];
    if(y){
      cell.classList.add("filled");
      if(y.is_team)cell.classList.add("team");
      const url=getYokaiIconUrl(y.yokai_id,_currentGame);
      if(url){
        const img=document.createElement("img");img.src=url;img.alt=y.name||"";
        img.onerror=function(){this.remove();addPlaceholder(cell,y);};
        cell.appendChild(img);
      }else{addPlaceholder(cell,y);}
      const lv=document.createElement("div");lv.className="lv"+(y.level===99?" gold":"");
      lv.textContent="Lv."+y.level;cell.appendChild(lv);
      cell.onclick=()=>showDetailModal(y,_boxIdx);
    }
    attachCellCtx(cell,y,_boxIdx,i,false);
    grid.appendChild(cell);
  }
  // Party strip
  const strip=document.getElementById("party-strip");strip.innerHTML='<span class="party-label">Party</span>';
  const party=save.yokai.filter(y=>y.is_team).sort((a,b)=>a.slot-b.slot);
  if(!party.length){strip.style.display="none";}else{
    strip.style.display="flex";
    for(const y of party){
      const c=document.createElement("div");c.className="party-cell";
      const url=getYokaiIconUrl(y.yokai_id,_currentGame);
      if(url){const img=document.createElement("img");img.src=url;img.onerror=function(){this.style.display="none";};c.appendChild(img);}
      strip.appendChild(c);
    }
  }
}

function addPlaceholder(cell,y){
  const ph=document.createElement("div");ph.className="placeholder";
  ph.style.background=nameColor(y.name);
  ph.textContent=(y.name||"?").slice(0,2).toUpperCase();
  cell.appendChild(ph);
}

function prevBox(){if(_boxIdx>0){_boxIdx--;_selSlot=null;renderGrid();}}
function nextBox(){_boxIdx++;_selSlot=null;renderGrid();}

// ── Detail modal ──────────────────────────────────────────────
function showDetailModal(y,boxNum){
  const m=document.getElementById("detail-modal");
  const c=document.getElementById("detail-content");
  const url=getYokaiIconUrl(y.yokai_id,y.game);
  const hex=Array.from(y.raw.slice(0,64)).map(b=>b.toString(16).padStart(2,"0")).join(" ");
  const ext=YK_EXT[y.game]||".yk";
  c.innerHTML=`
    <div class="detail-icon">${url?`<img src="${url}" onerror="this.outerHTML='<div class=\\'placeholder large\\' style=\\'background:${nameColor(y.name)}\\'>${(y.name||"?").slice(0,2).toUpperCase()}</div>'">`:`<div class="placeholder large" style="background:${nameColor(y.name)}">${(y.name||"?").slice(0,2).toUpperCase()}</div>`}</div>
    <h2>${y.name||resolveName(y.yokai_id)}</h2>
    <div class="badge" style="color:${y.level===99?"var(--yellow)":"var(--accent)"}">Level ${y.level}</div>
    <div class="badge team">${y.is_team?"★ PARTY MEMBER":""}</div>
    <div class="info-card">
      <div class="info-row"><span class="k">ID</span><span class="v">0x${y.yokai_id.toString(16).toUpperCase().padStart(8,"0")}</span></div>
      <div class="info-row"><span class="k">Slot</span><span class="v">${y.slot} (box ${boxNum+1})</span></div>
      <div class="info-row"><span class="k">Game</span><span class="v">${y.game.toUpperCase()}</span></div>
      <div class="info-row"><span class="k">Entry</span><span class="v">${y.raw.length} bytes</span></div>
    </div>
    <div class="info-card"><h3>Raw (hex)</h3><div class="hex">${hex}${y.raw.length>64?"…":""}</div></div>
    <div class="detail-actions">
      <button class="btn primary" onclick="exportYokai(_currentSaveYokai)">📤 Export ${ext}</button>
      <button class="btn" onclick="copyHex(_currentSaveYokai)">📋 Copy hex</button>
    </div>
    <button class="btn close-btn" onclick="closeDetail()">Close</button>`;
  _currentSaveYokai=y;
  m.style.display="flex";
}
let _currentSaveYokai=null;
function closeDetail(){document.getElementById("detail-modal").style.display="none";}

// ── Cloud boxes ───────────────────────────────────────────────
async function loadCloudView(){
  if(!_user){
    try{const u=await checkAuth();if(!u){alert("Please sign in first.");return;}}catch(_){alert("Please sign in first.");return;}
  }
  _cloudBoxes=await loadCloudBoxes();
  _cloudBoxIdx=0;_viewMode="cloud";
  renderCloudBoxes();showView("cloud");
}
function renderCloudBoxes(){
  const grid=document.getElementById("cloud-grid");grid.innerHTML="";
  const start=_cloudBoxIdx*MONS_PER_BOX;
  const map={};
  for(const r of _cloudBoxes){const i=r.slot;if(i>=0&&i<MONS_PER_BOX)map[i]=r;}
  document.getElementById("cloud-title").textContent=`Cloud Box ${_cloudBoxIdx+1} · ${_cloudBoxes.length} yokai`;
  for(let i=0;i<MONS_PER_BOX;i++){
    const cell=document.createElement("div");cell.className="cell";
    const r=map[i];
    if(r){
      cell.classList.add("filled");
      const y={slot:i,yokai_id:r.yokai_id,level:r.level,name:r.name,raw:hexToBytes(r.raw_hex),game:r.game,is_team:r.is_team};
      const url=getYokaiIconUrl(r.yokai_id,r.game);
      if(url){const img=document.createElement("img");img.src=url;img.onerror=function(){this.remove();addPlaceholder(cell,y);};cell.appendChild(img);}
      else addPlaceholder(cell,y);
      const lv=document.createElement("div");lv.className="lv"+(r.level===99?" gold":"");
      lv.textContent="Lv."+r.level;cell.appendChild(lv);
      cell.onclick=()=>showDetailModal(y,_cloudBoxIdx);
    }
    attachCellCtx(cell,r?{slot:i,yokai_id:r.yokai_id,level:r.level,name:r.name,raw:hexToBytes(r.raw_hex),game:r.game,is_team:r.is_team}:null,_cloudBoxIdx,i,true);
    grid.appendChild(cell);
  }
}
function prevCloudBox(){if(_cloudBoxIdx>0){_cloudBoxIdx--;renderCloudBoxes();}}
function nextCloudBox(){_cloudBoxIdx++;renderCloudBoxes();}

// ── Save to cloud ─────────────────────────────────────────────
async function saveToCloud(){
  if(!await checkAuth()){alert("Login with Discord first!");return;}
  if(!_currentSaveYokai){alert("Select a yokai first!");return;}
  const box=prompt("Cloud box number (1-100):","1");
  const slot=prompt("Slot in box (0-29):","0");
  if(!box||!slot)return;
  try{
    await saveYokaiToCloud(parseInt(box)-1,parseInt(slot),_currentSaveYokai);
    alert("Saved to cloud!");
  }catch(e){alert("Error: "+e.message);}
}

// ── Upload save file to cloud storage ─────────────────────────
async function uploadSaveToCloud(){
  if(!await checkAuth()){alert("Login with Discord first!");return;}
  const inp=document.createElement("input");inp.type="file";inp.accept="*/*";
  inp.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{await uploadSaveFile(file);alert("Save file uploaded!");renderSaveFileList();}
    catch(err){alert("Upload failed: "+err.message);}
  };
  inp.click();
}
function renderSaveFileList(){
  const el=document.getElementById("cloud-saves");if(!el)return;
  const files=listSaveFiles();
  el.innerHTML=files.length?files.map(f=>`
    <div class="save-file-row">
      <span>${f.name} (${(f.size/1024).toFixed(1)}KB)</span>
      <a href="${getSaveFileUrl(f.id)}" target="_blank" class="btn small">Download</a>
      <button class="btn small danger" onclick="deleteSaveFile('${f.id}');renderSaveFileList();">Delete</button>
    </div>`).join(""):"<p class='muted'>No save files uploaded yet.</p>";
}

// ── View switching ────────────────────────────────────────────
function showView(v){
  document.querySelectorAll(".page").forEach(p=>p.style.display="none");
  document.getElementById(v+"-page").style.display="flex";
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
  document.querySelectorAll(".sidebar-nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===v));
}
function navigate(v){showView(v);if(v==="cloud")loadCloudView();if(v==="settings")renderSettings();}

// ── Mobile sidebar ──────────────────────────────────────────
let _sidebarOpen=false;
function toggleMobileSidebar(){
  _sidebarOpen=!_sidebarOpen;
  document.getElementById("mobile-sidebar").classList.toggle("open",_sidebarOpen);
  document.getElementById("mobile-sidebar-overlay").classList.toggle("open",_sidebarOpen);
  document.body.style.overflow=_sidebarOpen?"hidden":"";
}

// ── Place yokai from import ───────────────────────────────────
function _placeYokaiInBox(boxNum,slot,yokai){
  if(_viewMode==="cloud"){
    saveYokaiToCloud(boxNum,slot,yokai).then(()=>loadCloudView());
  }else{
    const save=_saves[_currentGame];
    if(save){save.yokai.push({...yokai,slot:boxNum*MONS_PER_BOX+slot});renderGrid();}
  }
}
function refreshCloud(){loadCloudView();}

// ── Quick yokai import (button + drag & drop) ─────────────────
function quickImportYokai(){
  const save=_saves[_currentGame];
  if(!save){alert("Open a save first.");return;}
  const start=_boxIdx*MONS_PER_BOX;
  const used=new Set(save.yokai.map(y=>y.slot));
  let slot=start;
  while(slot<start+MONS_PER_BOX&&used.has(slot))slot++;
  if(slot>=start+MONS_PER_BOX){alert("This box is full — go to another box.");return;}
  importYkFile(_boxIdx,slot);
}

// ── Export full save file (re-encrypted) ─────────────────────
async function exportSaveFile(){
  const save=_saves[_currentGame];
  if(!save){alert("Open a save first.");return;}
  try{
    const enc=await encryptSave(save.result,_currentGame);
    const blob=new Blob([enc],{type:"application/octet-stream"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    const baseName=(save.file||"save").replace(/\.[^.]+$/,"");
    const ext=YK_EXT[_currentGame]||".bin";
    a.download=baseName+ext;
    a.click();
    URL.revokeObjectURL(a.href);
  }catch(e){
    alert("Export failed: "+e.message);
  }
}

function setupGridDrop(){
  const grid=document.getElementById("box-grid");
  if(!grid)return;
  grid.addEventListener("dragover",e=>{e.preventDefault();});
  grid.addEventListener("drop",e=>{
    e.preventDefault();
    const file=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
    if(!file||!/\.(yk1|yk2|yk3|ykb|ykb2|yk|bin)$/i.test(file.name))return;
    const save=_saves[_currentGame];
    if(!save)return;
    const rect=grid.getBoundingClientRect();
    const col=Math.min(MONS_PER_ROW-1,Math.max(0,Math.floor((e.clientX-rect.left)/(rect.width/MONS_PER_ROW))));
    const row=Math.min(MONS_PER_COL-1,Math.max(0,Math.floor((e.clientY-rect.top)/(rect.height/MONS_PER_COL))));
    const slot=row*MONS_PER_ROW+col;
    importYkFile(_boxIdx,slot);
  });
}

// ── Keyboard shortcuts ────────────────────────────────────────
document.addEventListener("keydown",e=>{
  if(e.key==="Escape")closeDetail();
  if(e.ctrlKey&&e.key==="o"){e.preventDefault();document.getElementById("file-input").click();}
});

// ── Settings page ────────────────────────────────────────────
function renderSettings(){
  const el=document.getElementById("settings-content");
  if(!_user){el.innerHTML='<p class="muted">Login to access account settings.</p>';return;}
  const d=_discordProfile||{};
  const name=d.username||_user.name||_user.email||"User";
  const avatar=discordAvatarUrl(d);
  const isDiscord=_user.labels&&_user.labels.includes("discordsignin");
  el.innerHTML=`
    <div class="panel-card" style="margin-bottom:12px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        ${avatar?`<img src="${avatar}" style="width:48px;height:48px;border-radius:50%;border:2px solid var(--accent);">`:''}
        <div>
          <div style="font-weight:bold;font-size:14px;">${name.replace(/</g,"&lt;")}</div>
          <div style="font-size:11px;color:var(--text2);">${_user.email||"No email"}</div>
          <div style="font-size:10px;color:var(--text2);">ID: ${_user.$id}</div>
        </div>
      </div>
    </div>
    <div class="panel-card" style="margin-bottom:12px;">
      <h3>Change Display Name</h3>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <input type="text" id="settings-name" value="${(_user.name||"").replace(/"/g,"&quot;")}" placeholder="Display name" style="flex:1;">
        <button class="btn primary" onclick="doUpdateName()">Save</button>
      </div>
    </div>
    <div class="panel-card" style="margin-bottom:12px;">
      <h3>Change Email</h3>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
        <input type="email" id="settings-email" value="${_user.email||""}" placeholder="New email">
        <input type="password" id="settings-email-pw" placeholder="Current password (required)">
        <button class="btn primary" onclick="doUpdateEmail()">Update Email</button>
      </div>
    </div>
    <div class="panel-card" style="margin-bottom:12px;">
      <h3>Change Password</h3>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px;">
        <input type="password" id="settings-new-pw" placeholder="New password (min 8 chars)">
        <input type="password" id="settings-old-pw" placeholder="Current password (optional for OAuth users)">
        <button class="btn primary" onclick="doUpdatePassword()">Update Password</button>
      </div>
    </div>
    <div class="panel-card" style="border-color:var(--red);">
      <h3 style="color:var(--red);">Danger Zone</h3>
      <button class="btn danger" onclick="doDeleteAccount()" style="margin-top:8px;">Delete Account</button>
    </div>
    <p id="settings-msg" style="font-size:11px;margin-top:8px;"></p>
  `;
}
function settingsMsg(msg,isError){
  const el=document.getElementById("settings-msg");
  if(el){el.textContent=msg;el.style.color=isError?"var(--red)":"var(--green)";}
}
async function doUpdateName(){
  const name=document.getElementById("settings-name").value.trim();
  if(!name){settingsMsg("Enter a name.",true);return;}
  try{await updateAccountName(name);settingsMsg("Name updated!");renderSettings();}
  catch(e){settingsMsg(e.message,true);}
}
async function doUpdateEmail(){
  const email=document.getElementById("settings-email").value.trim();
  const pw=document.getElementById("settings-email-pw").value;
  if(!email||!pw){settingsMsg("Enter new email and current password.",true);return;}
  try{await updateAccountEmail(email,pw);settingsMsg("Email updated! Check your inbox for verification.");renderSettings();}
  catch(e){settingsMsg(e.message,true);}
}
async function doUpdatePassword(){
  const newPw=document.getElementById("settings-new-pw").value;
  const oldPw=document.getElementById("settings-old-pw").value;
  if(!newPw||newPw.length<8){settingsMsg("Password must be at least 8 chars.",true);return;}
  try{await updateAccountPassword(newPw,oldPw);settingsMsg("Password updated!");}
  catch(e){settingsMsg(e.message,true);}
}
async function doDeleteAccount(){
  if(!confirm("Are you sure you want to delete your account? This cannot be undone."))return;
  const pw=prompt("Enter your password to confirm deletion (leave blank for OAuth users):");
  try{await deleteAccount(pw);alert("Account deleted.");window.location.reload();}
  catch(e){settingsMsg(e.message,true);}
}
