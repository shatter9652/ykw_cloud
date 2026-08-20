/**
 * crypto.js — IeCCode + AES-CCM client-side encryption
 * Ported from shared/saves/yw_decrypt.py
 */
const _crc=new Uint32Array(256);
for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);_crc[i]=c;}
function crc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=_crc[(c^b[i])&0xFF]^(c>>>8);return(c^0xFFFFFFFF)>>>0;}

const _MUL=0x6C078966-1;
class Xorshift{
  constructor(s=0){this.s=[0x6C078966,0xDD5254A5,0xB9523B81,0x03DF95B3];if(!s)return;let v=(s^(s>>>30))>>>0;this.s[0]=(Math.imul(v|0,_MUL|0)+1)>>>0;v=(this.s[0]^(this.s[0]>>>30))>>>0;this.s[1]=(Math.imul(v|0,_MUL|0)+2)>>>0;v=(this.s[1]^(this.s[1]>>>30))>>>0;this.s[2]=(Math.imul(v|0,_MUL|0)+3)>>>0;}
  next(d=0){let t=(this.s[0]^(this.s[0]<<11))>>>0;this.s[0]=this.s[1];this.s[1]=this.s[2];this.s[2]=this.s[3];this.s[3]=((this.s[3]^(this.s[3]>>>19)^t^(t>>>8)))>>>0;return d>0?this.s[3]%d:this.s[3];}
}

const _PRIMES=[3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997,1009,1013,1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,1153,1163,1171,1181,1187,1193,1201,1213,1217,1223,1229,1231,1237,1249,1259,1277,1279,1283,1289,1291,1297,1301,1303,1307,1319,1321,1327,1361,1367,1373,1381,1399,1409,1423,1427,1429,1433,1439,1447,1451,1453,1459,1471,1481,1483,1487,1489,1493,1499,1511,1523,1531,1543,1549,1553,1559,1567,1571,1579,1583,1597,1601,1607,1609,1613,1619,1621];

function ieCCipher(data,seed,count=0x1000){
  const T=new Uint8Array(256);for(let i=0;i<256;i++)T[i]=i;
  const rng=new Xorshift(seed);
  for(let i=0;i<count;i++){const r=rng.next(0x10000);const r1=r&0xFF,r2=(r>>>8)&0xFF;if(r1!==r2){const a=T[r1],b=T[r2];const tmp=T[a];T[a]=T[b];T[b]=tmp;}}
  const out=new Uint8Array(data.length);let ka=0;
  for(let i=0;i<data.length;i++){if((i&0xFF)===0)ka=_PRIMES[T[(i&0xFF00)>>8]];out[i]=data[i]^T[(ka*(i+1))&0xFF];}
  return out;
}

function ywDecrypt(data){
  const dv=new DataView(data.buffer,data.byteOffset);
  const storedCRC=dv.getUint32(data.length-8,true);
  const seed=dv.getUint32(data.length-4,true);
  const payload=data.slice(0,data.length-8);
  if(crc32(payload)!==storedCRC)throw new Error("CRC mismatch");
  return{plain:ieCCipher(payload,seed),seed};
}
function ywEncrypt(payload,seed){
  const enc=ieCCipher(payload,seed);
  const r=new Uint8Array(enc.length+8);r.set(enc);
  const dv=new DataView(r.buffer);dv.setUint32(enc.length,crc32(enc),true);dv.setUint32(enc.length+4,seed,true);
  return r;
}

// AES-CCM via Web Crypto
async function _ik(k){return crypto.subtle.importKey("raw",k,{name:"AES-CBC"},false,["encrypt"]);}
async function _eb(ck,b){const r=await crypto.subtle.encrypt({name:"AES-CBC",iv:new Uint8Array(16)},ck,b);return new Uint8Array(r).slice(0,16);}

// 24-bit big-endian counter block (bytes 13-15) for a 12-byte nonce
async function _ctrBlock(ck,prefix,val){
  const ct=new Uint8Array(16);ct.set(prefix,0);
  ct[13]=(val>>>16)&0xFF;ct[14]=(val>>>8)&0xFF;ct[15]=val&0xFF;
  return _eb(ck,ct);
}

async function ccmDec(key,data,nonce){
  const L=15-nonce.length,Lp=L-1,flag=56+Lp,ck=await _ik(key);
  const prefix=new Uint8Array(1+nonce.length);prefix[0]=Lp;prefix.set(nonce,1);
  // Decrypt MAC with counter block 0
  const eM=await _ctrBlock(ck,prefix,0);const dM=new Uint8Array(16);
  for(let i=0;i<16;i++)dM[i]=eM[i]^data[i];
  // Decrypt message with counter blocks 1..n
  const msg=data.slice(16);const pt=new Uint8Array(msg.length);
  for(let i=0;i<msg.length;i+=16){const e=await _ctrBlock(ck,prefix,(i/16)+1);const s=msg.slice(i,Math.min(i+16,msg.length));for(let j=0;j<s.length;j++)pt[i+j]=s[j]^e[j];}
  // Compute CBC-MAC over plaintext and compare with decrypted MAC
  const B0=new Uint8Array(16);B0[0]=flag;B0.set(nonce,1);const ml=pt.length;B0[13]=(ml>>>16)&0xFF;B0[14]=(ml>>>8)&0xFF;B0[15]=ml&0xFF;
  let x=await _eb(ck,B0);
  for(let i=0;i<pt.length;i+=16){const b=new Uint8Array(16);b.set(pt.slice(i,Math.min(i+16,pt.length)));for(let j=0;j<16;j++)x[j]^=b[j];x=await _eb(ck,x);}
  for(let i=0;i<16;i++)if(x[i]!==dM[i])throw new Error("CCM auth failed");
  return pt;
}
async function ccmEnc(key,data,nonce){
  const L=15-nonce.length,Lp=L-1,flag=56+Lp,ck=await _ik(key);
  const prefix=new Uint8Array(1+nonce.length);prefix[0]=Lp;prefix.set(nonce,1);
  const B0=new Uint8Array(16);B0[0]=flag;B0.set(nonce,1);const ml=data.length;B0[13]=(ml>>>16)&0xFF;B0[14]=(ml>>>8)&0xFF;B0[15]=ml&0xFF;
  let x=await _eb(ck,B0);
  for(let i=0;i<data.length;i+=16){const b=new Uint8Array(16);b.set(data.slice(i,Math.min(i+16,data.length)));for(let j=0;j<16;j++)x[j]^=b[j];x=await _eb(ck,x);}
  const eM=await _ctrBlock(ck,prefix,0);const encM=new Uint8Array(16);for(let i=0;i<16;i++)encM[i]=eM[i]^x[i];
  const msg=new Uint8Array(data.length);
  for(let i=0;i<data.length;i+=16){const e=await _ctrBlock(ck,prefix,(i/16)+1);const s=data.slice(i,Math.min(i+16,data.length));for(let j=0;j<s.length;j++)msg[i+j]=s[j]^e[j];}
  const out=new Uint8Array(32+data.length);out.set(nonce,0);out.set(encM,16);out.set(msg,32);return out;
}

// Advance the Xorshift PRNG `count` times with divisor 0x10000, then draw
// 16 key bytes with divisor 0x100 (matches Python YWCipher(a, count)).
function _deriveKeyCount(a,count){
  const rng=new Xorshift(a);
  for(let i=0;i<(count&0xFF);i++)rng.next(0x10000);
  const k=new Uint8Array(16);for(let i=0;i<16;i++)k[i]=rng.next(0x100)&0xFF;return k;
}
// Plain Xorshift(seed@0x0C) derivation (YW2 2.x / head.yw)
function _deriveKeySimple(a){
  const rng=new Xorshift(a);
  const k=new Uint8Array(16);for(let i=0;i<16;i++)k[i]=rng.next(0x100)&0xFF;return k;
}

async function decryptYW2(data,hd){
  const nonce=data.slice(0,12);
  try{const inner=await ccmDec(new TextEncoder().encode("5+NI8WVq09V7LI5w"),data.slice(16),nonce);const p=ywDecrypt(inner);return{data:p.plain,aesKey:new TextEncoder().encode("5+NI8WVq09V7LI5w"),seed:p.seed,nonce};}catch(_){}
  if(hd){const h=ywDecrypt(hd).plain;const a=new DataView(h.buffer,h.byteOffset).getUint32(0x0C,true);const k=_deriveKeySimple(a);const inner=await ccmDec(k,data.slice(16),nonce);const p=ywDecrypt(inner);return{data:p.plain,aesKey:k,seed:p.seed,nonce};}
  throw new Error("YW2 failed — need head.yw");
}
async function decryptYW3(data,hd){
  if(!hd)throw new Error("YW3 needs head.yw");
  const h=ywDecrypt(hd).plain;const dv=new DataView(h.buffer,h.byteOffset,h.byteLength);
  function sub(){
    let r2=dv.getUint32(0x10,true);if(r2!==0)r2--;
    let pos=r2*0xA8+0x20;if(pos===0)return 0;
    return dv.getUint32(pos+8+0x30,true);
  }
  function sub2(){
    let r2=dv.getUint32(0x10,true);if(r2!==0)r2--;
    let pos=r2*0xA8+0x20;if(pos===0)return 0;
    pos+=0x40;let s=0;for(let i=0;i<6;i++)s+=dv.getUint32(pos+i*4,true);return s&0xFF;
  }
  let a=dv.getUint32(0x0C,true);try{a^=sub();}catch(_){}
  const k=_deriveKeyCount(a,sub2());
  const nonce=data.slice(0,12);const inner=await ccmDec(k,data.slice(16),nonce);const p=ywDecrypt(inner);
  return{data:p.plain,aesKey:k,seed:p.seed,nonce};
}
async function decryptYKB2(data,hd){
  if(!hd)throw new Error("Blasters 2 needs head.yw");
  const h=ywDecrypt(hd).plain;const dv=new DataView(h.buffer,h.byteOffset,h.byteLength);
  function sub(index){
    let r2=index>0?index:dv.getUint32(0x10,true);if(r2!==0)r2--;
    let pos=r2*0xA8+0x36F8;
    return dv.getUint32(pos+8+0x30,true);
  }
  function sub2(index){
    let r2=index>0?index:dv.getUint32(0x10,true);if(r2!==0)r2--;
    let pos=r2*0xA8+0x36F8+0x40;let s=0;for(let i=0;i<6;i++)s+=dv.getUint32(pos+i*4,true);return s&0xFF;
  }
  let a=dv.getUint32(0x0C,true);
  for(const slot of [1,2,0]){
    try{
      const k=_deriveKeyCount(a^sub(slot),sub2(slot));
      const nonce=data.slice(0,12);const inner=await ccmDec(k,data.slice(16),nonce);const p=ywDecrypt(inner);
      return{data:p.plain,aesKey:k,seed:p.seed,nonce};
    }catch(_){}
  }
  throw new Error("Blasters 2 failed — wrong head.yw?");
}
async function decryptYKB(data,hd){
  if(!hd)throw new Error("Blasters needs head.yw");
  const h=ywDecrypt(hd).plain;const dv=new DataView(h.buffer,h.byteOffset,h.byteLength);
  const configs=[["NONJP",0x80,0x1C],["JP",0x78,0x18]];
  let lastErr=null;
  for(const[cfg,userLength,ignLength]of configs){
    for(const g of [false,true]){
      try{
        function sub(r1){
          let index=dv.getUint32(0x10,true);if(index!==0)index--;
          let pos=index*userLength+0x39C8;if(pos===0)return 0;
          return dv.getUint32(pos+ignLength+r1*4,true);
        }
        let a=dv.getUint32(0x0C,true)^sub(0x0C);
        if(g){if(sub(0)&0x4000)a=(~a)&0xFFFFFFFF;}
        const k=_deriveKeyCount(a,sub(0x0A));
        const nonce=data.slice(0,12);const inner=await ccmDec(k,data.slice(16),nonce);const p=ywDecrypt(inner);
        return{data:p.plain,aesKey:k,seed:p.seed,nonce};
      }catch(e){lastErr=e;}
    }
  }
  throw new Error("Blasters failed with all configs: "+lastErr.message);
}
async function decryptSave(data,hd,game){
  if(game==="yw1"){const p=ywDecrypt(data);return{data:p.plain,aesKey:null,seed:p.seed,nonce:null};}
  if(game==="yw3")return decryptYW3(data,hd);
  if(game==="ykb")return decryptYKB(data,hd);
  if(game==="b2")return decryptYKB2(data,hd);
  return decryptYW2(data,hd);
}

// Section tree parser (mirrors Python SectionParser)
const MO=0xFFFE,MCL=0xFEFF;
function parseTree(buf){
  const dv=new DataView(buf.buffer,buf.byteOffset,buf.byteLength);const sec={};
  function parseNode(pos,end){
    if(pos+8>end)return null;
    const ow=dv.getUint32(pos,true);
    if((ow&0xFFFF)!==MO)return null;
    const st=dv.getUint32(pos+4,true);const t=st&0xFF,size=st>>>8;
    const ps=pos+8,pe=Math.min(ps+size,end);
    if(ps+2>end)return null;
    const pk=dv.getUint16(ps,true);
    const node={t,pos,size,isContainer:false,children:[]};
    if(pk===MCL){node.isContainer=true;node.size=0;return node;}
    if(pk===MO){
      node.isContainer=true;
      let cp=ps,prev=-1;
      while(cp+8<=pe&&cp>prev){
        prev=cp;
        const c=parseNode(cp,pe);
        if(!c)break;
        node.children.push(c);
        cp=c.pos+8+c.size+4;
      }
      node.size=cp-ps;
      return node;
    }
    node.size=pe-ps;
    sec[t]=buf.slice(ps,pe);
    return node;
  }
  parseNode(0,buf.byteLength);return sec;
}

function extractYokai(dec,game){
  const gi=GAMES[game];if(!gi)return[];
  const sec=parseTree(dec);if(!sec[0x07])throw new Error("Section 0x07 missing");
  const sd=sec[0x07];const sv=new DataView(sd.buffer,sd.byteOffset,sd.byteLength);
  const team=[];
  if(sec[0x01]&&game==="yw2"){const fd=sec[0x01];if(fd.byteLength>=0x48){const fv=new DataView(fd.buffer,fd.byteOffset);for(let i=0;i<6;i++)team.push(fv.getUint32(0x30+i*4,true));}}
  const entries=[];const max=Math.floor(sd.byteLength/gi.size);
  for(let slot=0;slot<max;slot++){
    const off=slot*gi.size;if(off+gi.size>sd.byteLength)break;
    const id=gi.crc?sv.getUint32(off+gi.idOff,true):sv.getUint16(off+gi.idOff,true);
    if(!id)continue;const lv=sd[off+gi.lvOff];if(!lv||lv>99)continue;
    let isT=false;for(const h of team){if(h&&(h&0xFFF)===slot&&((h>>12)&0xF)===0){isT=true;break;}}
    entries.push({slot,yokai_id:id,level:lv,is_team:isT,raw:new Uint8Array(sd.buffer,sd.byteOffset+off,gi.size),game});
  }
  return entries;
}
