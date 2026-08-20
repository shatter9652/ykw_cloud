/**
 * icons.js — Game icon + yokai icon resolution + version detection
 */
let _crcIcon={},_nameDB={},_crcName={},_loaded=false;
async function loadIconData(){
  if(_loaded)return;_loaded=true;
  try{const r=await fetch("resources/data/crc32_to_icon.json");if(r.ok)_crcIcon=await r.json();}catch(_){}
  try{const r=await fetch("resources/data/crc32_yokai_map.json");if(r.ok){const d=await r.json();for(const[k,v]of Object.entries(d))_crcName[parseInt(k,16)]=v;}}catch(_){}
  try{const r=await fetch("resources/data/yokai_names.json");if(r.ok){const d=await r.json();for(const[k,v]of Object.entries(d))_nameDB[parseInt(k)]=v;}}catch(_){}
}
function resolveName(id){const n=_crcName[id]||_nameDB[id];if(!n)return`Yo-kai #${id}`;const m=n.match(/\(([^)]+)\)\s*$/);return m?m[1].trim():n;}
function resolveIconBase(id){
  const k="0x"+id.toString(16).toUpperCase().padStart(8,"0");
  if(_crcIcon[k])return _crcIcon[k];
  // Fallback: try sequential ID patterns (YW2/YKB: y{id+100}000, YW3: c{id}000)
  // Only try this for small IDs that look like sequential yokai IDs
  if(id>0&&id<10000){
    const yName=`y${id+100}000`;const cName=`c${id}000`;
    // Check if the icon file exists by testing against known icon dirs
    for(const g of["yw3","yw2"]){const d=ICON_DIRS[g];if(d){
      // We can't check filesystem from JS, but return the name as a guess
      // The caller will try multiple dirs and fallback
      if(g==="yw3")return cName;
      return yName;
    }}
  }
  return null;
}
function getYokaiIconUrl(id,prefGame){
  const base=resolveIconBase(id);if(!base)return null;
  const fn=base+".00.png";const order=[prefGame,...ICON_FALLBACK.filter(g=>g!==prefGame)];
  for(const g of order){const d=ICON_DIRS[g];if(d)return`YoKaiIcons/${d}/${fn}`;}return null;
}
function getGameIconUrl(game){return GAME_VERSIONS.find(v=>v.id===game)?.icon||"icons/ykw2psycicspecters.png";}

function detectGameVersion(filename,header){
  const name=(filename||"").toLowerCase();
  const hint=name;
  for(const v of GAME_VERSIONS)if(v.match&&v.match.test(hint))return v;
  // Check YW4 magic FIRST (0xEEFF = bytes 0xFF, 0xEE) — before CCM check
  // because YW4 files also have non-zero first bytes
  if(header&&header.length>=2&&header[0]===0xFF&&header[1]===0xEE)return GAME_VERSIONS.find(v=>v.id==="yw4");
  if(header&&header.length>=12){
    let hasCCM=false;for(let i=0;i<12;i++)if(header[i]!==0){hasCCM=true;break;}
    if(hasCCM){
      if(name.includes("yw3")||name.includes("sushi")||name.includes("tempura")||name.includes("sukiyaki"))
        return GAME_VERSIONS.find(v=>v.id==="yw3"&&v.label.includes("International"));
      if(name.includes("ykb")||name.includes("blaster"))
        return GAME_VERSIONS.find(v=>v.id==="ykb"&&v.label.includes("Red Cat"));
      if(name.includes("b2"))return GAME_VERSIONS.find(v=>v.id==="b2"&&v.label.includes("Sword"));
      return GAME_VERSIONS.find(v=>v.id==="yw2"&&v.label.includes("Psychic"));
    }
  }
  if(name.includes("yw4")||name.includes("userdata")||name.includes("watch_4"))return GAME_VERSIONS.find(v=>v.id==="yw4");
  if(name.includes("yw3"))return GAME_VERSIONS.find(v=>v.id==="yw3"&&v.label.includes("International"));
  if(name.includes("ykb")||name.includes("blaster"))return GAME_VERSIONS.find(v=>v.id==="ykb"&&v.label.includes("Red Cat"));
  if(name.includes("b2"))return GAME_VERSIONS.find(v=>v.id==="b2"&&v.label.includes("Sword"));
  return GAME_VERSIONS.find(v=>v.id==="yw2"&&v.label.includes("Psychic"));
}
function nameColor(n){let h=0;for(let i=0;i<(n||"").length;i++)h=((h*31)+n.charCodeAt(i))&0xFFFF;return`hsl(${h%360},47%,55%)`;}

// ── Preload all yokai icons at startup ──────────────────────
// Creates Image objects for every icon so they're cached by the browser
// before any save file is loaded. This avoids blank icons on first view.
let _preloaded=false;
function preloadAllIcons(){
  if(_preloaded)return;_preloaded=true;
  if(!_crcIcon||!Object.keys(_crcIcon).length)return;
  let count=0;
  for(const[_k,base]of Object.entries(_crcIcon)){
    if(!base)continue;
    const fn=base+".00.png";
    // Try each game directory until we find one that loads
    for(const g of ICON_FALLBACK){
      const d=ICON_DIRS[g];if(!d)continue;
      const img=new Image();
      img.src=`YoKaiIcons/${d}/${fn}`;
      count++;
    }
  }
  console.log(`[icons] Preloaded ${count} icon URLs`);
}
