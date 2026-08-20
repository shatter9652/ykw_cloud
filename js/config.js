/**
 * config.js — Appwrite + Discord config + game definitions
 *
 * Setup: See ykw-web/README.md
 */
const APP_VERSION = "3.1.0";  // Added YW4 support + icon fallbacks + yokai validation
console.log("[config] YKW Home v" + APP_VERSION + " loaded");

const APPWRITE_ENDPOINT = "https://tor.cloud.appwrite.io/v1";
const APPWRITE_PROJECT  = "6a86504b0033f733c338";
const DB_ID             = "6a8656f000147e1b67b0";
const COLLECTION_ID     = "6a8658c8ede182b58e7e";
const BUCKET_ID         = "6a865718003c43ddcbc7";

const MAX_BOXES    = 100;
const MONS_PER_BOX = 30;
const MONS_PER_ROW = 6;
const MONS_PER_COL = MONS_PER_BOX / MONS_PER_ROW;

const GAMES = {
    yw1: { name:"Yo-kai Watch 1",            size:0x5C, lvOff:0x4F, idOff:0x04, crc:true },
    yw2: { name:"Yo-kai Watch 2",            size:0x5C, lvOff:0x4F, idOff:0x04, crc:true },
    yw3: { name:"Yo-kai Watch 3",            size:0x54, lvOff:0x49, idOff:0x04, crc:true },
    ykb: { name:"Yo-kai Watch Blasters",     size:0x4C, lvOff:0x48, idOff:0x04, crc:true },
    b2:  { name:"Yo-kai Watch Blasters 2",   size:0x4C, lvOff:0x48, idOff:0x04, crc:true },
    yw4: { name:"Yo-kai Watch 4",            size:469,  lvOff:180, idOff:0,   crc:false, flat:true },
};

const GAME_VERSIONS = [
    { id:"yw1", label:"Yo-kai Watch 1",                          icon:"icons/ykw1.png" },
    { id:"yw2", label:"Yo-kai Watch 2 - Bony Spirits",           icon:"icons/ykw2bonyspirits.png",  match:/bony|honke/i },
    { id:"yw2", label:"Yo-kai Watch 2 - Fleshy Souls",           icon:"icons/ykw2fleshysouls.png",  match:/fleshy|ganso/i },
    { id:"yw2", label:"Yo-kai Watch 2 - Psychic Specters",       icon:"icons/ykw2psycicspecters.png",match:/psychic|shinuchi/i },
    { id:"yw3", label:"Yo-kai Watch 3 - Sushi",                  icon:"icons/ykw3sushi.png",        match:/sushi/i },
    { id:"yw3", label:"Yo-kai Watch 3 - Tempura",                icon:"icons/ykw3tempura.png",      match:/tempura/i },
    { id:"yw3", label:"Yo-kai Watch 3 - Sukiyaki",               icon:"icons/ykw3sukiyaki.png",     match:/sukiyaki/i },
    { id:"yw3", label:"Yo-kai Watch 3 (International)",          icon:"icons/ykw3international.png", match:/international|us\b|eu\b/i },
    { id:"ykb", label:"Yo-kai Watch Blasters - Red Cat Corps",    icon:"icons/blasters1redcat.png",   match:/red\s*cat/i },
    { id:"ykb", label:"Yo-kai Watch Blasters - White Dog Squad",  icon:"icons/blasters1whitedog.png", match:/white\s*dog/i },
    { id:"ykb", label:"Yo-kai Watch Blasters",                   icon:"icons/blasters1_generic.png" },
    { id:"b2",  label:"Yo-kai Watch Blasters 2 - Sword",         icon:"icons/blasters2sword.png",    match:/sword/i },
    { id:"b2",  label:"Yo-kai Watch Blasters 2 - Magnium",       icon:"icons/blasters2magnium.png",  match:/magnium/i },
    { id:"b2",  label:"Yo-kai Watch Blasters 2",                 icon:"icons/blasters2sword.png" },
    { id:"yw4", label:"Yo-kai Watch 4",                          icon:"icons/ykw4.png" },
];

const ICON_DIRS = { yw2:"YKW2/pngs", yw3:"YKW3/pngs", ykb:"YKWB/base_png", b2:"B2/base_pngs" };
const ICON_FALLBACK = ["yw3","yw2","ykb","b2"];
const YK_EXT = { yw1:".yk1", yw2:".yk2", yw3:".yk3", ykb:".ykb", b2:".ykb2" };

// YW4 flat binary offsets (from AYw4SaveEditor)
const YW4_OFFSETS = {
    magic: 0x00, money: 203,
    consumables: { start:76579, entrySize:54, max:500 },
    equipment:   { start:103587, entrySize:63, max:1000 },
    party:       { start:166627, entrySize:469, max:6 },
    yokai:       { start:169449, entrySize:469, max:400 },
    yokaiCount:  946497,
    genericSoul: { start:958227, entrySize:54, max:100 },
    yokaiSoul:   { start:963635, entrySize:80, max:500 },
};
const YW4_SIG_MAP = {
    "74-22-A1-F1":"Nate","C5-E6-31-09":"Katie","64-FE-81-43":"Summer",
    "B4-84-21-04":"Touma","D4-D7-E1-7E":"Akinori","C4-0B-C1-CC":"Jack",
    "0C-55-64-6B":"Jibanyan","A9-86-38-A0":"Komasan","19-AF-58-9D":"Komajiro",
    "72-5D-50-AA":"Hungramps","A2-27-F0-ED":"Dimmy","12-0E-90-D0":"Tattletell",
    "02-D2-B0-62":"Dismarelda","B2-FB-D0-5F":"Hidabat","62-81-70-18":"Frostina",
    "D2-A8-10-25":"Insomni","03-3F-40-A7":"Blizzaria","42-0E-5B-BE":"Damona",
    "67-A7-6C-5C":"Little Charrmer","07-F4-AC-26":"Roughraff","B7-DD-CC-1B":"Mochismo",
    "A7-01-EC-A9":"Blazion","17-28-8C-94":"Sgt. Burly","C7-52-2C-D3":"Venoct",
    "86-63-37-CA":"Illuminoct","45-30-1A-E1":"Shadow Venoct","77-7B-4C-EE":"Shogunyan",
    "A6-EC-1C-6C":"Snartle","16-C5-7C-51":"Arachnus","1A-17-F5-F0":"Komashura",
    "79-FC-98-E7":"Noko","69-20-B8-55":"Hovernyan","08-9E-88-EA":"Reuknight",
    "49-AF-93-F3":"Corptain","B8-B7-E8-D7":"Toadal Dude","6C-06-A4-11":"Silver Lining",
    "DC-2F-C4-2C":"Manjimutt","AD-4D-D4-21":"Kyubi","EC-7C-CF-38":"Darkyubi",
    "1D-64-B4-1C":"Master Nyada","D4-36-A1-0C":"Noway","B4-65-61-76":"Sandmeh",
    "04-4C-01-4B":"Mimikin","14-90-21-F9":"Mirapo","15-7D-D1-3C":"Robonyan",
    "54-4C-CA-25":"Goldenyan","EF-47-B8-9B":"Jibanyan (Lightside)",
    "8A-20-04-23":"Jibanyan (Shadowside)","83-C6-F1-40":"Enma",
    "7C-98-71-8C":"Enma Awakened","1D-26-41-33":"Yami Enma",
    "AE-F5-79-4C":"Gargaros","7A-44-35-8A":"Ogralus","CA-6D-55-B7":"Orcanos",
    "BF-C4-A9-3B":"Gilgaros","BB-0F-45-BA":"McKraken","47-AB-9D-34":"Nurarihyon",
    "33-EF-91-7D":"Lord Ananta","57-77-BD-86":"Douketsu","E7-5E-DD-BB":"Shutendoji",
    "8A-32-64-A5":"Ogu Togu Mogu","F7-82-FD-09":"Fudou Myouou Boy",
    "5B-4C-CF-3D":"Whisper","AD-0F-21-0E":"Kaibyou Kamaitachi",
    "01-99-3D-FB":"Shuka Natsume (Summer)","8F-14-78-E1":"Micchy (Lightside)",
    "EA-73-C4-59":"Micchy (Shadowside)","FA-BD-84-6D":"Jinta (Lightside)",
    "9F-DA-38-D5":"Jinta (Shadowside)","52-51-A1-C2":"Micchy Hyper (Lightside)",
    "37-36-1D-7A":"Micchy Hyper (Shadowside)","32-02-61-B8":"Hi no Shin (Lightside)",
    "57-65-DD-00":"Hi no Shin (Shadowside)",
};
