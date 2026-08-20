/**
 * contextmenu.js — Right-click (desktop) / double-tap (mobile)
 */
let _cm=null,_lastTap=0;
function initContextMenu(){
  _cm=document.createElement("div");_cm.id="context-menu";_cm.className="context-menu";_cm.style.display="none";
  document.body.appendChild(_cm);
  document.addEventListener("click",()=>hideContextMenu());
  document.addEventListener("contextmenu",e=>{if(e.target.closest("#box-grid")||e.target.closest(".cloud-grid"))e.preventDefault();});
}
function showContextMenu(x,y,items){
  _cm.innerHTML="";
  for(const it of items){
    const d=document.createElement("div");d.className="context-menu-item"+(it.danger?" danger":"");
    d.textContent=it.label;d.onclick=e=>{e.stopPropagation();hideContextMenu();it.action();};
    _cm.appendChild(d);
  }
  _cm.style.display="block";
  const r=_cm.getBoundingClientRect();
  _cm.style.left=Math.min(x,window.innerWidth-r.width-8)+"px";
  _cm.style.top=Math.min(y,window.innerHeight-r.height-8)+"px";
}
function hideContextMenu(){if(_cm)_cm.style.display="none";}

function attachCellCtx(cell,yokai,boxNum,slot,isCloud){
  cell.addEventListener("contextmenu",e=>{
    e.preventDefault();e.stopPropagation();
    if(yokai){
      showContextMenu(e.clientX,e.clientY,[
        {label:`📤 Export ${yokai.name||"Yo-kai"} (.yk${yokai.game==="yw1"?1:yokai.game==="yw2"?2:yokai.game==="yw3"?3:yokai.game==="ykb"?"kb":"kb2"})`,action:()=>exportYokai(yokai)},
        {label:"📋 Copy hex data",action:()=>copyHex(yokai)},
        {label:"ℹ️ View details",action:()=>showDetailModal(yokai,boxNum)},
        ...(isCloud?[{label:"🗑️ Remove from cloud",danger:true,action:async()=>{await removeYokaiFromCloud(boxNum,slot);refreshCloud();}}]:[]),
      ]);
    }else{
      showContextMenu(e.clientX,e.clientY,[
        {label:"📥 Import .yk file here",action:()=>importYkFile(boxNum,slot)},
      ]);
    }
  });
  let tt=null;
  cell.addEventListener("touchend",e=>{
    const now=Date.now();
    if(now-_lastTap<300){
      e.preventDefault();const t=e.changedTouches[0];
      if(yokai){
        showContextMenu(t.clientX,t.clientY,[
          {label:`📤 Export ${yokai.name}`,action:()=>exportYokai(yokai)},
          {label:"📋 Copy hex",action:()=>copyHex(yokai)},
          {label:"ℹ️ Details",action:()=>showDetailModal(yokai,boxNum)},
        ]);
      }else{
        showContextMenu(t.clientX,t.clientY,[{label:"📥 Import .yk file",action:()=>importYkFile(boxNum,slot)}]);
      }
      _lastTap=0;
    }else{_lastTap=now;}
  });
}

function exportYokai(yokai){
  const ext=YK_EXT[yokai.game]||".yk";
  const name=(resolveName(yokai.yokai_id)||"yokai").replace(/[^a-zA-Z0-9]/g,"_").toLowerCase();
  const blob=new Blob([yokai.raw],{type:"application/octet-stream"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+ext;a.click();URL.revokeObjectURL(a.href);
}
function copyHex(yokai){
  const hex=Array.from(yokai.raw).map(b=>b.toString(16).padStart(2,"0")).join(" ");
  navigator.clipboard.writeText(hex).catch(()=>{});
}
function importYkFile(boxNum,slot){
  const inp=document.createElement("input");inp.type="file";inp.accept=".yk1,.yk2,.yk3,.ykb,.ykb2,.yk,.bin";
  inp.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const buf=new Uint8Array(await file.arrayBuffer());
    const ext=file.name.split(".").pop().toLowerCase();
    const gm={yk1:"yw1",yk2:"yw2",yk3:"yw3",ykb:"ykb",ykb2:"b2"};
    const game=gm[ext]||"yw2";const gi=GAMES[game];
    if(!gi||buf.length<gi.size){alert("Unrecognised .yk file");return;}
    const dv=new DataView(buf.buffer,buf.byteOffset);
    const id=gi.crc?dv.getUint32(gi.idOff,true):dv.getUint16(gi.idOff,true);
    const lv=buf[gi.lvOff]||1;
    yokai={slot,yokai_id:id,level:lv,is_team:false,raw:new Uint8Array(buf.slice(0,gi.size)),game,name:resolveName(id)};
    // Validate: check if this yokai exists in the target game
    const srcGame=yokai.game;
    const tgtGame=_currentGame;
    if(srcGame&&tgtGame&&srcGame!==tgtGame){
      // Check if the yokai's icon exists in the target game's icon dirs
      const iconBase=resolveIconBase(id);
      if(iconBase){
        const fn=iconBase+".00.png";
        const tgtDir=ICON_DIRS[tgtGame];
        if(tgtDir){
          // We can't check file existence from JS, but we can check if the
          // yokai has a known name in the target game's context
          const tgtName=resolveName(id);
          // If the name is just "Yo-kai #ID" it probably doesn't exist in this game
          if(tgtName.startsWith("Yo-kai #")&&!iconBase){
            alert(`⚠️ ${yokai.name||"This Yo-kai"} may not exist in ${GAMES[tgtGame]?.name||tgtGame}.\n\nImporting anyway — check that it works in-game.`);
          }
        }
      }
    }
    if(typeof _placeYokaiInBox==="function")_placeYokaiInBox(boxNum,slot,yokai);
  };
  inp.click();
}
