/**
 * cloud.js — Appwrite DB/Storage + Discord OAuth
 * Appwrite = persistent file storage only. Users login via Discord.
 */
let _acct=null,_db=null,_sto=null,_user=null;
function initAppwrite(){
  const{Client,Account,Databases,Storage}=Appwrite;
  const c=new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
  _acct=new Account(c);_db=new Databases(c);_sto=new Storage(c);return c;
}
async function checkAuth(){try{_user=await _acct.get();return _user;}catch(_){_user=null;return null;}}
function loginDiscord(){
  const s=window.location.origin+window.location.pathname;
  _acct.createOAuth2Session("discord",s,s+"?error=auth",["identify","email"]);
}
async function logout(){await _acct.deleteSession("current");_user=null;}

async function loadCloudBoxes(){
  if(!_user)return[];
  try{const r=await _db.listRows({databaseId:DB_ID,tableId:COLLECTION_ID,queries:[Appwrite.Query.equal("user_id",_user.$id)]});return r.rows;}catch(e){console.error(e);return[];}
}
async function saveYokaiToCloud(box,slot,yokai){
  if(!_user)throw new Error("Not logged in");
  const ex=await _db.listRows({databaseId:DB_ID,tableId:COLLECTION_ID,queries:[Appwrite.Query.equal("user_id",_user.$id),Appwrite.Query.equal("box_num",box),Appwrite.Query.equal("slot",slot)]});
  const d={user_id:_user.$id,box_num:box,slot,yokai_id:yokai.yokai_id,level:yokai.level,name:yokai.name||resolveName(yokai.yokai_id),raw_hex:Array.from(yokai.raw).map(b=>b.toString(16).padStart(2,"0")).join(""),game:yokai.game||"yw2",is_team:yokai.is_team||false};
  if(ex.rows.length>0)return await _db.updateRow({databaseId:DB_ID,tableId:COLLECTION_ID,rowId:ex.rows[0].$id,data:d});
  return await _db.createRow({databaseId:DB_ID,tableId:COLLECTION_ID,rowId:Appwrite.ID.unique(),data:d});
}
async function removeYokaiFromCloud(box,slot){
  if(!_user)return;
  const ex=await _db.listRows({databaseId:DB_ID,tableId:COLLECTION_ID,queries:[Appwrite.Query.equal("user_id",_user.$id),Appwrite.Query.equal("box_num",box),Appwrite.Query.equal("slot",slot)]});
  if(ex.rows.length>0)await _db.deleteRow({databaseId:DB_ID,tableId:COLLECTION_ID,rowId:ex.rows[0].$id});
}
async function moveYokaiInCloud(fb,fs,tb,ts){
  const boxes=await loadCloudBoxes();const src=boxes.find(r=>r.box_num===fb&&r.slot===fs);if(!src)return;
  await removeYokaiFromCloud(tb,ts);
  await saveYokaiToCloud(tb,ts,{yokai_id:src.yokai_id,level:src.level,name:src.name,raw:hexToBytes(src.raw_hex),game:src.game,is_team:src.is_team});
  await removeYokaiFromCloud(fb,fs);
}
async function uploadSaveFile(file){
  if(!_user)throw new Error("Not logged in");
  const id=Appwrite.ID.unique();
  await _sto.createFile({bucketId:BUCKET_ID,fileId:id,file});
  const p=_user.prefs||{};const s=p.saves||[];
  s.push({id,name:file.name,size:file.size,date:Date.now()});
  await _acct.updatePrefs({saves:s});return id;
}
function listSaveFiles(){return(_user&&_user.prefs&&_user.prefs.saves)||[];}
function getSaveFileUrl(id){return _sto.getFileDownload({bucketId:BUCKET_ID,fileId:id});}
async function deleteSaveFile(id){
  await _sto.deleteFile({bucketId:BUCKET_ID,fileId:id});
  const p=_user.prefs||{};const s=(p.saves||[]).filter(x=>x.id!==id);
  await _acct.updatePrefs({saves:s});
}
function hexToBytes(h){const b=new Uint8Array(h.length/2);for(let i=0;i<b.length;i++)b[i]=parseInt(h.substr(i*2,2),16);return b;}
