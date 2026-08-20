/**
 * app.js — Main UI: boxes, grid, detail panel, save upload, cloud boxes
 * Modeled after Unbound-Cloud's MainPage.js
 */
let _saves={},_cloudBoxes=[],_currentGame=null,_boxIdx=0,_selSlot=null;
let _cloudBoxIdx=0,_viewMode="save"; // "save" | "cloud"
let _pendingGame=null; // {buf,file} waiting for head.yw / head.yw_g (iOS two-step)

async function initApp(){
  await loadIconData();
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
  if(!email||!pass){showAuthError("Enter email and password.");return;}
  try{
    const user=await loginEmail(email,pass);
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
  if(!email||!pass){showAuthError("Enter email and password.");return;}
  if(pass.length<8){showAuthError("Password must be at least 8 characters.");return;}
  try{
    const user=await signupEmail(name,email,pass);
    updateAuthUI(user);
    closeAuthModal();
  }catch(e){
    showAuthError(e.message||"Signup failed.");
  }
}

function updateAuthUI(user){
  const btn=document.getElementById("auth-btn");
  const userEl=document.getElementById("user-info");
  if(user){
    btn.style.display="none";
    userEl.style.display="inline-flex";
    // Try Discord profile first, then fall back to Appwrite user
    const d=_discordProfile||{};
    const name=d.global_name||d.username||user.name||user.email||"User";
    const avatar=discordAvatarUrl(d);
    // If no Discord avatar, generate a colored initial circle
    const avatarHtml=avatar
      ?`<img class="user-avatar" src="${avatar}" alt="" onerror="this.style.display='none'">`
      :`<div class="user-avatar placeholder-avatar" style="background:${nameColor(name)};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;color:#fff;">${(name||"?")[0].toUpperCase()}</div>`;
    userEl.innerHTML=`
      ${avatarHtml}
      <span class="user-name">${name.replace(/</g,"&lt;")}</span>
      <button class="btn small" onclick="doLogout()">Logout</button>`;
    // Enable cloud buttons
    document.querySelectorAll("[data-requires-auth]").forEach(b=>b.disabled=false);
  }else{
    btn.style.display="";
    btn.textContent="Sign In";
    btn.onclick=()=>showAuthModal();
    userEl.style.display="none";
    // Disable cloud buttons
    document.querySelectorAll("[data-requires-auth]").forEach(b=>b.disabled=true);
  }
}

const ALL_GAMES=["yw1","yw2","yw3","ykb","b2"];

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
  const hints={"yw1":["yw1","yokai_watch_1"],"yw2":["yw2","yokai_watch_2"],"yw3":["yw3","yokai_watch_3","yokai3"],"ykb":["ykb","busters","blasters"],"b2":["b2","blasters2"]};
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

  const isHead=f=>/^head\./i.test(f.name);
  const isGame=f=>/\.(yw|yw_g|bin)$/i.test(f.name)&&!isHead(f);
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
  for(const[gid,save]of Object.entries(_saves)){
    const card=document.createElement("div");
    card.className="save-card"+(gid===_currentGame?" selected":"");
    card.onclick=()=>{_currentGame=gid;_boxIdx=0;renderSaveCards();renderGrid();};
    card.innerHTML=`<img src="${save.version.icon}" class="save-icon" onerror="this.src='icons/ykw2psycicspecters.png'"><div><div class="save-name">${save.version.label}</div><div class="save-meta">${save.yokai.length} yokai · ${save.file}</div></div>`;
    el.appendChild(card);
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
  if(!await checkAuth()){alert("Login with Discord first!");return;}
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
  const inp=document.createElement("input");inp.type="file";inp.accept=".yw,.yw_g,.bin";
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
}
function navigate(v){showView(v);if(v==="cloud")loadCloudView();}

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
