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
      const ext=YK_EXT[yokai.game]||".yk";
      showContextMenu(e.clientX,e.clientY,[
        {label:`📤 Export ${yokai.name||"Yo-kai"}${ext}`,action:()=>exportYokai(yokai)},
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

// Export a single yokai as a .yk file (PKHeX-style: raw bytes + 16-byte header)
// Header: magic(4) + version(1) + gameId(1) + yokaiId(4) + level(1) + nameLen(2) + name(UTF-8) + reserved(3)
// Then the raw yokai bytes from the save
function exportYokai(yokai){
  const ext=YK_EXT[yokai.game]||".yk";
  const name=(yokai.name||resolveName(yokai.yokai_id)||"yokai").replace(/[^a-zA-Z0-9]/g,"_");
  const nameBytes=new TextEncoder().encode(name);
  // Build header
  const header=new ArrayBuffer(16+nameBytes.length);
  const hv=new DataView(header);
  // Magic: "YKXX"
  hv.setUint8(0,0x59);hv.setUint8(1,0x4B);hv.setUint8(2,0x58);hv.setUint8(3,0x58); // "YKXX"
  hv.setUint8(4,1); // version
  // Game ID byte
  const gameMap={yw1:1,yw2:2,yw3:3,ykb:0x0B,b2:0x0C,yw4:4};
  hv.setUint8(5,gameMap[yokai.game]||0);
  hv.setInt32(6,yokai.yokai_id,true); // yokai ID
  hv.setUint8(10,yokai.level); // level
  hv.setUint16(11,nameBytes.length,true); // name length
  // Name bytes at offset 13
  new Uint8Array(header,13,nameBytes.length).set(nameBytes);
  // Combine header + raw bytes
  const blob=new Blob([new Uint8Array(header),yokai.raw],{type:"application/octet-stream"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name+ext;a.click();URL.revokeObjectURL(a.href);
}
function copyHex(yokai){
  const hex=Array.from(yokai.raw).map(b=>b.toString(16).padStart(2,"0")).join(" ");
  navigator.clipboard.writeText(hex).catch(()=>{});
}
// Import a .yk file into a box slot
// Supports: new header format (.yk1/2/3/4/wb), raw bytes, and any file
function importYkFile(boxNum,slot){
  const inp=document.createElement("input");inp.type="file";inp.accept="*/*"; // Accept any file for iOS compatibility
  inp.onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    const buf=new Uint8Array(await file.arrayBuffer());
    const ext=file.name.split(".").pop().toLowerCase();

    let yokai=null;

    // Try new header format first (YKXX magic)
    if(buf.length>=16&&buf[0]===0x59&&buf[1]===0x4B&&buf[2]===0x58){
      const dv=new DataView(buf.buffer,buf.byteOffset);
      const version=dv.getUint8(4);
      const gameIdByte=dv.getUint8(5);
      const yokaiId=dv.getInt32(6,true);
      const level=dv.getUint8(10);
      const nameLen=dv.getUint16(11,true);
      const name=new TextDecoder().decode(buf.slice(13,13+nameLen));
      // Raw bytes start after header (16 + nameLen)
      const rawStart=16+nameLen;
      const raw=buf.slice(rawStart);
      // Determine game from byte
      const gameRev={1:"yw1",2:"yw2",3:"yw3",4:"yw4",0x0B:"ykb",0x0C:"b2"};
      const game=gameRev[gameIdByte]||extToGame(ext)||"yw2";
      const gi=GAMES[game];
      yokai={slot,yokai_id:yokaiId,level,name,is_team:false,raw:new Uint8Array(raw),game};
    }else{
      // Try file extension mapping
      const game=extToGame(ext);
      if(game&&GAMES[game]){
        const gi=GAMES[game];
        // For flat YW4 format: raw entry is 469 bytes
        if(game==="yw4"&&buf.length>=469){
          const dv=new DataView(buf.buffer,buf.byteOffset);
          const id1=dv.getUint16(0,true);
          const sig=formatSig(buf,72);
          const name=YW4_SIG_MAP[sig]||"Unknown";
          yokai={slot,yokai_id:id1,level:dv.getInt32(180,true),is_team:false,raw:new Uint8Array(buf.slice(0,469)),game,name};
        }else if(buf.length>=gi.size){
          // Section-based format: parse raw bytes
          const dv=new DataView(buf.buffer,buf.byteOffset);
          const id=gi.crc?dv.getUint32(gi.idOff,true):dv.getUint16(gi.idOff,true);
          const lv=buf[gi.lvOff]||1;
          yokai={slot,yokai_id:id,level:lv,is_team:false,raw:new Uint8Array(buf.slice(0,gi.size)),game,name:resolveName(id)};
        }
      }
    }

    // Fallback: treat entire file as raw yokai data
    if(!yokai&&buf.length>0){
      const game=_currentGame||"yw2";
      const gi=GAMES[game];
      if(gi){
        const dv=new DataView(buf.buffer,buf.byteOffset);
        const id=gi.crc?dv.getUint32(gi.idOff,true):dv.getUint16(gi.idOff,true);
        const lv=buf.length>gi.lvOff?buf[gi.lvOff]:1;
        yokai={slot,yokai_id:id,level:lv||1,is_team:false,raw:new Uint8Array(buf.slice(0,Math.min(buf.length,gi.size))),game,name:resolveName(id)};
      }
    }

    if(!yokai){alert("Could not parse yokai data from this file.");return;}

    // Cross-game import warning
    const srcGame=yokai.game;
    const tgtGame=_currentGame;
    if(srcGame&&tgtGame&&srcGame!==tgtGame){
      const tgtName=resolveName(yokai.yokai_id);
      if(tgtName.startsWith("Yo-kai #")){
        if(!confirm(`${yokai.name||"This Yo-kai"} may not exist in ${GAMES[tgtGame]?.name||tgtGame}.\n\nImport anyway?`))return;
      }
    }

    if(typeof _placeYokaiInBox==="function")_placeYokaiInBox(boxNum,slot,yokai);
  };
  inp.click();
}
function extToGame(ext){
  const map={yk1:"yw1",yk2:"yw2",yk3:"yw3",ykwb:"ykb",ykwb2:"b2",yk4:"yw4"};
  return map[ext]||null;
}
