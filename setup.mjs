/**
 * setup.mjs — Create cloud_boxes collection via Appwrite REST API
 * Usage: node setup.mjs
 */

const ENDPOINT = "https://tor.cloud.appwrite.io/v1";
const PROJECT  = "6a86504b0033f733c338";
const API_KEY  = "standard_25913c593fd34618d6c4ff61bab2fb176982a64c5fc4db53e9f036bcf4effaf17c38a949972353cf761754aedde6eaad24f4d53ee103f06895ef23d6b428268fdc094ddbb8f5fe0036ee5aa4a519b3c5c0bb1fd3e435e0ecc95c74e4fefeb0811c75c6705aa524754cc51acd96456a694fae8c845e8effe0cf6f4f7bc3f5bcb8";
const DB_ID    = "6a8656f000147e1b67b0";

async function api(method, path, body) {
    const opts = {
        method,
        headers: {
            "X-Appwrite-Key": API_KEY,
            "X-Appwrite-Project": PROJECT,
            "Content-Type": "application/json",
        },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${ENDPOINT}${path}`, opts);
    const data = await res.json();
    if (data.code) throw new Error(`${data.code}: ${data.message}`);
    return data;
}

async function main() {
    console.log("1. Creating collection 'cloud_boxes'...");
    const col = await api("POST", `/databases/${DB_ID}/collections`, {
        collectionId: "unique()",
        name: "cloud_boxes",
        permissions: [
            "read(\"users\")", "create(\"users\")",
            "update(\"users\")", "delete(\"users\")",
        ],
    });
    const colId = col.$id;
    console.log(`   Collection ID: ${colId}`);

    const attrs = [
        ["createStringAttribute",  "user_id",  { size: 255, required: true }],
        ["createIntegerAttribute", "box_num",  { required: true }],
        ["createIntegerAttribute", "slot",     { required: true }],
        ["createIntegerAttribute", "yokai_id", { required: true }],
        ["createIntegerAttribute", "level",    { required: true }],
        ["createStringAttribute",  "name",     { size: 100, required: false }],
        ["createStringAttribute",  "raw_hex",  { size: 500, required: true }],
        ["createStringAttribute",  "game",     { size: 10, required: true }],
        ["createBooleanAttribute", "is_team",  { required: false }],
    ];

    console.log("2. Adding attributes...");
    for (const [endpoint, key, params] of attrs) {
        const attrKey = endpoint.replace("create", "").replace("Attribute", "").toLowerCase();
        console.log(`   + ${key}...`);
        try {
            await api("POST", `/databases/${DB_ID}/collections/${colId}/attributes/${attrKey}`, {
                key, ...params,
            });
        } catch (e) { console.log(`     (skip: ${e.message})`); }
        await new Promise(r => setTimeout(r, 500));
    }

    console.log("3. Creating index on user_id...");
    try {
        await api("POST", `/databases/${DB_ID}/collections/${colId}/indexes`, {
            key: "idx_user_id",
            type: "key",
            attributes: ["user_id"],
            orders: ["ASC"],
        });
    } catch (e) { console.log(`   (skip: ${e.message})`); }

    // Update config.js
    const fs = require("fs");
    const cfgPath = new URL("./js/config.js", import.meta.url).pathname;
    let cfg = fs.readFileSync(cfgPath, "utf8");
    cfg = cfg.replace(
        'const COLLECTION_ID     = "YOUR_COLLECTION_ID"; // Set by script',
        `const COLLECTION_ID     = "${colId}";`
    );
    fs.writeFileSync(cfgPath, cfg);
    console.log(`\n✅ Done! Collection: ${colId}\n   config.js updated.`);
}

main().catch(e => { console.error("Failed:", e.message); process.exit(1); });
