/**
 * config.js — Appwrite + Discord config + game definitions
 *
 * Setup: See ykw-web/README.md
 */
const APP_VERSION = "3.3.0";  // Fixed YW4 magic byte order, added YW4 signature map
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
    { id:"yw3", label:"Yo-kai Watch 3 (International)",          icon:"icons/ykw3international.png", match:/international|us\\b|eu\\b/i },
    { id:"ykb", label:"Yo-kai Watch Blasters - Red Cat Corps",    icon:"icons/blasters1redcat.png",   match:/red\\s*cat/i },
    { id:"ykb", label:"Yo-kai Watch Blasters - White Dog Squad",  icon:"icons/blasters1whitedog.png", match:/white\\s*dog/i },
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

// YW4 signature-to-name map (from AYw4SaveEditor/GetYokai.cs)
const YW4_SIG_MAP={"B4-84-21-04":"Touma","64-FE-81-43":"Summer","D4-D7-E1-7E":"Akinori","B1-B0-5D-C6":"Akinori (Fit)","C4-0B-C1-CC":"Jack","74-22-A1-F1":"Nate","C5-E6-31-09":"Katie","3B-F6-F4-5D":"Himoji (Lightside)","5E-91-48-E5":"Himoji (Shadowside)","D2-A2-FC-9B":"Himoji Shadow Boss","3A-1B-04-98":"Pakkun (Lightside)","5F-7C-B8-20":"Pakkun (Shadowside)","15-30-E6-91":"Pakkun Shadow Boss","54-CF-10-EB":"Kyunshii (Lightside)","31-A8-AC-53":"Kyunshii (Shadowside)","67-91-A1-56":"Kyunshii Shadow Boss","84-B5-B0-AC":"Hare-onna (Lightside)","E1-D2-0C-14":"Hare-onna (Shadowside)","95-84-60-DB":"Choky (Lightside)","F0-E3-DC-63":"Choky (Shadowside)","2F-E1-38-6E":"Fubuki-hime (Lightside)","4A-86-84-D6":"Fubuki-hime (Shadowside)","BA-A3-CD-CB":"Fubuki-hime Shadow Boss","9F-C8-58-53":"Merameraion (Lightside)","FA-AF-E4-EB":"Merameraion (Shadowside)","7A-7C-43-0A":"Merameraion Shadow Boss","F1-1C-4C-20":"Orochi (Lightside)","94-7B-F0-98":"Orochi (Shadowside)","08-DD-04-CD":"Orochi Shadow Boss","21-66-EC-67":"Honmaguro-taishou (Lightside)","44-01-50-DF":"Honmaguro-taishou (Shadowside)","09-BB-E6-54":"Honmaguro-taishou Shadow Boss","2A-C7-24-2A":"Semicolon (Lightside)","4F-A0-98-92":"Semicolon (Shadowside)","96-25-DD-B8":"Semicolon Shadow Boss","3F-3D-18-DC":"Komasan (Lightside)","5A-5A-A4-64":"Komasan (Shadowside)","81-93-AC-E8":"Komajiro (Lightside)","E4-F4-10-50":"Komajiro (Shadowside)","4A-71-53-BC":"Komajiro Shadow Boss","4A-94-E4-50":"Banchou (Lightside)","2F-F3-58-E8":"Banchou (Shadowside)","57-9C-B1-E0":"Banchou Shadow Boss","4F-B2-F8-14":"Seiryuu (Lightside)","2A-D5-44-AC":"Seiryuu (Shadowside)","E1-C0-6C-92":"Fuu-kun (Lightside)","84-A7-D0-2A":"Fuu-kun (Shadowside)","8B-C8-3F-E4":"Fuu-kun Shadow Boss","30-57-3C-10":"Rai-chan (Lightside)","55-30-80-A8":"Rai-chan (Shadowside)","4D-3C-C7-77":"Rai-chan Shadow Boss","80-7E-5C-2D":"Hamham (Lightside)","E5-19-E0-95":"Hamham (Shadowside)","EF-47-B8-9B":"Jibanyan (Lightside)","8A-20-04-23":"Jibanyan (Shadowside)","99-56-E9-7A":"Uribou (Lightside)","FC-31-55-C2":"Uribou (Shadowside)","FF-9B-98-29":"Kyubi (Lightside)","9A-FC-24-91":"Kyubi (Shadowside)","BB-C5-2F-52":"Kyubi Shadow Boss","39-A3-A9-F5":"Charlie (Lightside)","5C-C4-15-4D":"Charlie (Shadowside)","59-F0-69-8F":"Zundoumaru (Lightside)","3C-97-D5-37":"Zundoumaru (Shadowside)","04-21-A7-90":"Zundoumaru Shadow Boss","88-67-39-0D":"Ungaikyo (Lightside)","ED-00-85-B5":"Ungaikyo (Shadowside)","FA-BD-84-6D":"Jinta (Lightside)","9F-DA-38-D5":"Jinta (Shadowside)","97-43-3F-21":"Jinta Shadow Boss","3C-85-B5-B1":"Kantaro (Lightside)","59-E2-09-09":"Kantaro (Shadowside)","E9-1E-DB-BB":"Kantaro Shadow Boss","8C-AC-D5-8C":"Kiborikkuma (Lightside)","E9-CB-69-34":"Kiborikkuma (Shadowside)","4C-0A-55-79":"Junior (Lightside)","29-6D-E9-C1":"Junior (Shadowside)","8F-14-78-E1":"Micchy (Lightside)","EA-73-C4-59":"Micchy (Shadowside)","52-51-A1-C2":"Micchy Hyper (Lightside)","37-36-1D-7A":"Micchy Hyper (Shadowside)","32-02-61-B8":"Hi no Shin (Lightside)","57-65-DD-00":"Hi no Shin (Shadowside)","72-5D-50-AA":"Hungramps","A2-27-F0-ED":"Dimmy","12-0E-90-D0":"Tattletell","02-D2-B0-62":"Dismarelda","B2-FB-D0-5F":"Hidabat","62-81-70-18":"Frostina","D2-A8-10-25":"Insomni","8B-1D-A9-C1":"Insomni (Boss)","03-3F-40-A7":"Blizzaria","42-0E-5B-BE":"Damona","67-A7-6C-5C":"Little Charrmer","07-F4-AC-26":"Roughraff","A6-FD-5B-2B":"Roughraff (Boss)","B7-DD-CC-1B":"Mochismo","A7-01-EC-A9":"Blazion","E5-37-EE-C3":"Blazion (Boss)","17-28-8C-94":"Sgt. Burly","C7-52-2C-D3":"Venoct","86-63-37-CA":"Illuminoct","45-30-1A-E1":"Shadow Venoct","77-7B-4C-EE":"Shogunyan","A6-EC-1C-6C":"Snartle","22-A5-F4-C9":"Snartle (Boss)","16-C5-7C-51":"Arachnus","E2-7A-7A-08":"Arachnus (Boss)","1A-17-F5-F0":"Komashura","79-FC-98-E7":"Noko","A9-86-38-A0":"Komasan","19-AF-58-9D":"Komajiro","B9-5A-18-12":"Happierre","69-20-B8-55":"Hovernyan","08-9E-88-EA":"Reuknight","D2-77-6A-BE":"Reuknight Boss","49-AF-93-F3":"Corptain","B8-B7-E8-D7":"Toadal Dude","12-A8-E4-7F":"Toadal Dude Boss","6C-06-A4-11":"Silver Lining","DC-2F-C4-2C":"Manjimutt","38-05-82-5E":"Manjimutt Boss","0C-55-64-6B":"Jibanyan","BC-7C-04-56":"Krystal Fox","1C-89-44-D9":"Baku","AD-4D-D4-21":"Kyubi","EC-7C-CF-38":"Darkyubi","1D-64-B4-1C":"Master Nyada","D4-36-A1-0C":"Noway","B4-65-61-76":"Sandmeh","04-4C-01-4B":"Mimikin","76-55-76-72":"Mimikin Boss","14-90-21-F9":"Mirapo","15-7D-D1-3C":"Robonyan","54-4C-CA-25":"Goldenyan","0F-ED-C9-06":"Wiglin","1F-31-E9-B4":"Steppa","AF-18-89-89":"Rhyth","A5-54-B1-01":"Walkappa","71-E5-FD-C7":"Nosirs","C1-CC-9D-FA":"Cornfused","8B-36-6F-7A":"Whisper","11-B6-3D-BD":"Swelton","B1-43-7D-32":"Usapyon","70-D9-32-20":"Usapyon","61-39-DD-75":"Spoilerina","AA-3E-95-CD":"Sighborg Y","D1-10-BD-48":"Wobblewok","B0-AE-8D-F7":"Deadcool","AE-F5-79-4C":"Gargaros","7A-44-35-8A":"Ogralus","CA-6D-55-B7":"Orcanos","BF-C4-A9-3B":"Gilgaros","7F-62-29-CE":"Shirokuma","CF-4B-49-F3":"Punkupine","1E-DC-19-71":"Sorrypus","EA-61-A4-DF":"Jabow","BA-E2-B5-7F":"Beetall","FB-D3-AE-66":"Cruncha","0A-CB-D5-42":"Rhinormous","4B-FA-CE-5B":"Hornaplenty","DA-B1-75-05":"Mad Mountain","9B-80-6E-1C":"Lava Lord","6A-98-15-38":"Faux Kappa","BB-0F-45-BA":"McKraken","66-A3-67-83":"Suu-san","07-1D-57-3C":"Yamanba","B3-FF-DB-80":"Tamamo","C3-70-3B-48":"Gyuuki","12-E7-6B-CA":"Narigama","7D-DE-8F-7C":"Blobgoblin","63-85-7B-C7":"Nekomata Neko'ou Bastet","13-0A-9B-0F":"Kappa Kappa'ou Sagojou","B7-34-37-01":"Zashiki-warashi Tengu'ou Kurama","A3-23-FB-32":"Kawauso","83-C6-F1-40":"Enma","33-EF-91-7D":"Lord Ananta","57-77-BD-86":"Douketsu","16-46-A6-9F":"Douketsu","E7-5E-DD-BB":"Shutendoji","8A-32-64-A5":"Ogu Togu Mogu","47-AB-9D-34":"Nurarihyon","F7-82-FD-09":"Fudou Myouou Boy","5B-4C-CF-3D":"Whisper","7C-98-71-8C":"Enma Awakened","1D-26-41-33":"Yami Enma","AD-0F-21-0E":"Kaibyou Kamaitachi","72-1F-A5-85":"Neko'ou Bastet","C2-36-C5-B8":"Kappa Kappa'ou Sagojou","12-4C-65-FF":"Zashiki-warashi Tengu'ou Kurama","D9-4B-2D-47":"Touma Omatsu","69-62-4D-7A":"Touma Yoshitsune","B8-F5-1D-F8":"Touma Goemon","08-DC-7D-C5":"Touma Benkei","DC-6D-31-03":"Suzaku (Sword Bearer)","6C-44-51-3E":"Genbu (Sword Bearer)","BC-3E-F1-79":"Byakko (Sword Bearer)","0C-17-91-44":"Kirin","6B-E4-5F-B5":"Souryuu","A2-65-05-C2":"Gunshin Susanoo","C9-97-0D-F5":"Touma Fudou Myouou","4B-F5-3B-C7":"Touma Fudou Myouou Ten","19-ED-AD-B2":"Touma Suzaku","A9-C4-CD-8F":"Touma Genbu 2","B9-18-ED-3D":"Touma Byakko","09-31-8D-00":"Touma Ashura","01-99-3D-FB":"Shuka Natsume (Summer)","86-58-1E-E6":"Overseer","56-22-BE-A1":"Overseer 2","E6-0B-DE-9C":"Overseer 3","F6-D7-FE-2E":"Diamond","F7-23-09-EB":"Yami Enma","57-06-2B-05":"Enma","AF-49-81-71":"Maten Soranaki","EC-CE-EF-10":"Kuuten","7E-D9-EE-7F":"Yasha Enma","4E-C7-85-8E":"Fukurou","2C-11-61-D1":"Shuka","7F-BF-0C-E6":"Gentou","BF-60-82-27":"Hakushu","B2-B9-25-70":"Kenshin Amaterasu","02-90-45-4D":"Gesshin Tsukuyomi","0A-C4-20-DE":"Touma Fudou Myouou-kai","00-00-00-00":"Empty"};

