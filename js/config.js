/**
 * config.js — Appwrite + Discord config + game definitions
 *
 * Setup: See ykw-web/README.md
 */
const APP_VERSION = "2.8.0";  // Bump this when deploying updates — forces browser to re-fetch JS files
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
];

const ICON_DIRS = { yw2:"YKW2/pngs", yw3:"YKW3/pngs", ykb:"YKWB/base_png", b2:"B2/base_pngs" };
const ICON_FALLBACK = ["yw3","yw2","ykb","b2"];
const YK_EXT = { yw1:".yk1", yw2:".yk2", yw3:".yk3", ykb:".ykb", b2:".ykb2" };
