const xrpl = require("xrpl");
const sqlite3 = require("sqlite3").verbose();

let fetch; // We'll load node-fetch dynamically later.

// ----------------------
// SQLite Promise Wrappers
// ----------------------
function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// ----------------------
// Database Setup
// ----------------------
const db = new sqlite3.Database("nfts.db", (err) => {
  if (err) console.error("Error opening database", err);
});

async function createTable() {
  const createSQL = `
    CREATE TABLE IF NOT EXISTS nfts (
      nft_id TEXT PRIMARY KEY,
      is_burned INTEGER,
      owner TEXT,
      name TEXT,
      image TEXT
    )
  `;
  await run(db, createSQL);
}


// ----------------------
// Helper Functions for Dynamic Columns
// ----------------------

// Sanitize trait names to be used as SQL column names.
function sanitizeColumnName(name) {
    return name.trim().toLowerCase().replace(/\W+/g, "_");
  }
  
  // Check if a column exists; if not, add it.
  async function ensureColumnExists(columnName) {
    const pragmaSQL = `PRAGMA table_info(nfts)`;
    const columns = await all(db, pragmaSQL);
    const exists = columns.some((col) => col.name === columnName);
    if (!exists) {
      const alterSQL = `ALTER TABLE nfts ADD COLUMN "${columnName}" TEXT`;
      await run(db, alterSQL);
      console.log(`Added column: ${columnName}`);
    }
  }


// ----------------------
// Database Update Functions
// ----------------------

// Insert a new NFT (mint) with metadata and dynamic traits.
async function storeNFTInDatabase(nftData, metadata) {
    let data = {
      nft_id: nftData.nft_id, // the NFT identifier we use
      is_burned: nftData.is_burned ? 1 : 0,
      owner: nftData.owner,
      name: metadata.name || "",
      image: metadata.image || ""
    };
  
    if (metadata.attributes && Array.isArray(metadata.attributes)) {
      for (const attr of metadata.attributes) {
        const traitType = attr.trait_type;
        const traitValue = attr.value;
        if (traitType) {
          const colName = sanitizeColumnName(traitType);
          await ensureColumnExists(colName);
          data[colName] = traitValue;
        }
      }
    }
  
    const columns = Object.keys(data).map((col) => `"${col}"`).join(", ");
    const placeholders = Object.keys(data).map(() => "?").join(", ");
    const values = Object.values(data);
    const sql = `INSERT OR REPLACE INTO nfts (${columns}) VALUES (${placeholders})`;
  
    await run(db, sql, values);
    console.log(`Stored NFT ${nftData.nft_id} in database.`);
  }

  function updateNFTOwner(nftID, newOwner) {
    const sqlCheck = `SELECT * FROM nfts WHERE nft_id = ?`;
    db.get(sqlCheck, [nftID], (err, row) => {
      if (err) {
        console.error("Database error during select:", err);
        return;
      }
      if (row) {
        console.log(`NFTokenAcceptOffer detected for NFTID: ${nftID}`);
        // NFT is tracked; update the owner.
        const sqlUpdate = `UPDATE nfts SET owner = ? WHERE nft_id = ?`;
        db.run(sqlUpdate, [newOwner, nftID], function (updateErr) {
          if (updateErr) {
            console.error("Failed to update NFT owner:", updateErr);
          } else {
            console.log(`Updated NFT ${nftID}: new owner ${newOwner}`);
          }
        });
      } else {
        return;
      }
    });
  }

  function updateNFTBurn(nftID) {
    const sqlCheck = `SELECT * FROM nfts WHERE nft_id = ?`;
    db.get(sqlCheck, [nftID], (err, row) => {
      if (err) {
        console.error("Database error during select:", err);
        return;
      }
      if (row) {
        console.log(`New burn by ${targetIssuer} detected:`);
        console.log(JSON.stringify(tx.tx_json, null, 2));
        // NFT is tracked; update the burn status.
        const sqlUpdate = `UPDATE nfts SET is_burned = 1 WHERE nft_id = ?`;
        db.run(sqlUpdate, [nftID], function (updateErr) {
          if (updateErr) {
            console.error("Failed to update NFT burn status:", updateErr);
          } else {
            console.log(`Updated NFT ${nftID}: burned`);
          }
        });
      } else {
        return;
      }
    });
  }
  
  // Mark an NFT as burned.
  async function markNFTBurned(nftId) {
    const sql = "UPDATE nfts SET is_burned = 1 WHERE nft_id = ?";
    await run(db, sql, [nftId]);
    console.log(`Marked NFT ${nftId} as burned`);
  }



// ----------------------
// Utility Functions
// ----------------------

// Decode a hex-encoded string to UTF-8.
function decodeHex(hexStr) {
    try {
      return Buffer.from(hexStr, "hex").toString("utf8");
    } catch (err) {
      console.error("Error decoding hex string:", err);
      return "";
    }
  }
  
// Given a URI (possibly an IPFS link), fetch its JSON metadata.
 async function fetchMetadata(uri) {
    if (!uri) return {};
    let url = uri;
    if (uri.startsWith("ipfs://")) {
      const ipfsHash = uri.slice(7);
      url = `https://ipfs.io/ipfs/${ipfsHash}`;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`HTTP error fetching metadata! status: ${res.status}`);
        return {};
      }
      const json = await res.json();
      return json;
    } catch (err) {
      console.error("Error fetching metadata:", err);
      return {};
    }
  }
  
  // Retrieve detailed NFT info (including the URI) via the nft_info API.
  async function getNFTInfo(client, nftId) {
    try {
      const response = await client.request({
        command: "nft_info",
        nft_id: nftId
      });
      return response.result;
    } catch (error) {
      console.error(`Error fetching nft_info for ${nftId}:`, error);
      return null;
    }
  }
  
  // For NFTokenMint transactions, extract new NFT IDs from meta.
  // Compares FinalFields vs. PreviousFields in affected nodes.
  function extractNewNFTIDs(meta) {
    let newIDs = [];
    if (!meta || !meta.AffectedNodes) return newIDs;
    for (const node of meta.AffectedNodes) {
      if (node.CreatedNode && node.CreatedNode.LedgerEntryType === "NFTokenPage") {
        if (node.CreatedNode.NewFields && node.CreatedNode.NewFields.NFTokens) {
          for (const tokenObj of node.CreatedNode.NewFields.NFTokens) {
            if (tokenObj.NFToken && tokenObj.NFToken.NFTokenID) {
              newIDs.push(tokenObj.NFToken.NFTokenID);
            }
          }
        }
      } else if (node.ModifiedNode && node.ModifiedNode.LedgerEntryType === "NFTokenPage") {
        const finalTokens = node.ModifiedNode.FinalFields.NFTokens || [];
        const previousTokens = (node.ModifiedNode.PreviousFields && node.ModifiedNode.PreviousFields.NFTokens) || [];
        const previousIDs = previousTokens.map(tokenObj => tokenObj.NFToken.NFTokenID);
        for (const tokenObj of finalTokens) {
          const id = tokenObj.NFToken.NFTokenID;
          if (!previousIDs.includes(id)) {
            newIDs.push(id);
          }
        }
      }
    }
    return newIDs;
  }



// ----------------------
// Subscription Handling
// ----------------------

// Now that we have our functions for processing NFT transactions (buildListener, tradeListener, etc.), 
// we subscribe to the full transaction stream and filter the data accordingly.

async function subscribeToNFTUpdates(targetIssuer, collectionTaxon) {
  // Create the base table.
  await createTable();

  // Connect to XRPL client.
  const client = new xrpl.Client("wss://s2-clio.ripple.com");
  await client.connect();
  console.log("Connected to the XRPL server.");

  // Subscribe to the full transactions stream.
  await client.request({
    command: "subscribe",
    streams: ["transactions"]
  });
  console.log("Subscribed to the transactions stream.");
  console.log(`Listening for NFT transactions for issuer ${targetIssuer} and taxon ${collectionTaxon}...`);

  
  // Function: burnListener - filters transactions based on Type (NFTokenBurn), Account and Taxon.
  async function burnListener(tx) {
    if (
      tx.tx_json &&
      tx.tx_json.TransactionType === "NFTokenBurn"
    ) {
      // Extract burned NFT IDs from meta.
      const nftId = tx.tx_json.NFTokenID;
      updateNFTBurn(nftId);
    }
}

  // Function: buildListener - filters transactions based on type (NFTokenMint), Account and Taxon.
  async function buildListener(tx) {
    if (
      tx.tx_json &&
      tx.tx_json.TransactionType === "NFTokenMint" &&
      tx.tx_json.Account === targetIssuer && 
      tx.tx_json.NFTokenTaxon === collectionTaxon
    ) {
      console.log(`New mint by ${targetIssuer} detected:`);
      console.log(JSON.stringify(tx.tx_json, null, 2));
      // Extract new NFT IDs from meta.
      const newNFTIDs = extractNewNFTIDs(tx.meta);
      if (newNFTIDs.length === 0) {
        console.log("No new NFT IDs found in meta.");
        return;
      }
      for (const nftId of newNFTIDs) {
        // Wait briefly to allow the ledger to update.
        await new Promise((resolve) => setTimeout(resolve, 500));
        const info = await getNFTInfo(client, nftId);
        if (!info) continue;
        // Initially, set the owner as per the transaction's Account.
        info.owner = tx.tx_json.Account;
        // Decode the URI (expected as a hex string).
        const uriHex = info.uri || "";
        const uri = decodeHex(uriHex);
        console.log(`NFT ${nftId} URI: ${uri}`);
        const metadata = await fetchMetadata(uri);
        console.log(`Fetched metadata for NFT ${nftId}:`, metadata);
        const nftData = {
          nft_id: nftId,
          is_burned: false,
          owner: tx.Account
        };
        await storeNFTInDatabase(nftData, metadata);
      }
    }
  }

    // Function: buildListener - filters transactions based on type (NFTokenMint), Issuer and Taxon.
    async function mintListener(tx) {
        if (
          tx.tx_json &&
          tx.tx_json.TransactionType === "NFTokenMint" &&
          tx.tx_json.Issuer === targetIssuer &&
          tx.tx_json.NFTokenTaxon === collectionTaxon
        ) {
          const authMinter = tx.tx_json.Account
          console.log(`New Authorized Mint by ${authMinter} detected:`);
          console.log(JSON.stringify(tx.tx_json, null, 2));
          // Extract new NFT IDs from meta.
        const newNFTIDs = extractNewNFTIDs(tx.meta);
        if (newNFTIDs.length === 0) {
          console.log("No new NFT IDs found in meta.");
          return;
        }
        for (const nftId of newNFTIDs) {
          // Wait briefly to allow the ledger to update.
          await new Promise((resolve) => setTimeout(resolve, 500));
          const info = await getNFTInfo(client, nftId);
          if (!info) continue;
          // Initially, set the owner as per the transaction's Account.
          info.owner = tx.Account;
          // Decode the URI (expected as a hex string).
          const uriHex = info.uri || "";
          const uri = decodeHex(uriHex);
          console.log(`NFT ${nftId} URI: ${uri}`);
          const metadata = await fetchMetadata(uri);
          console.log(`Fetched metadata for NFT ${nftId}:`, metadata);
          const nftData = {
            nft_id: nftId,
            is_burned: false,
            owner: tx.Account
          };
          await storeNFTInDatabase(nftData, metadata);
        }
        }
      }
  
  // Function: tradeListener - processes NFTokenAcceptOffer transactions to update ownership.
  async function tradeListener(tx) {
    if (
        tx.tx_json && 
        tx.tx_json.TransactionType === "NFTokenAcceptOffer" 
        // && tx.tx_json.
    ) {
      const newOwner = tx.tx_json.Account;
      const affectedNodes = tx.meta && tx.meta.AffectedNodes;
      if (affectedNodes && Array.isArray(affectedNodes)) {
        affectedNodes.forEach((node) => {
          // Look for a DeletedNode of type NFTokenOffer.
          if (node.DeletedNode && node.DeletedNode.LedgerEntryType === "NFTokenOffer") {
            const finalFields = node.DeletedNode.FinalFields;
            if (finalFields && finalFields.NFTokenID) {
              const nftID = finalFields.NFTokenID;
              // Update the NFT owner if this NFTID is tracked in your database.
              updateNFTOwner(nftID, newOwner);
            }
          }
        });
      }
    }
  }
  
  // Attach all listeners to the "transaction" event.
  client.on("transaction", burnListener);
  client.on("transaction", buildListener);
  client.on("transaction", tradeListener);
  client.on("transaction", mintListener);
  
}

// ----------------------
// Main Process
// ----------------------
async function main() {
    if (process.argv.length < 4) {
      console.error("Usage: node subscribe.js <issuer to watch> <collection taxon>");
      process.exit(1);
    }
    const targetIssuer = process.argv[2];
    const collectionTaxon = parseInt(process.argv[3], 10);
    if (isNaN(collectionTaxon)) {
      console.error("Collection taxon must be a number.");
      process.exit(1);
    }
  
    // Dynamically import node-fetch.
    try {
      const fetchModule = await import("node-fetch");
      fetch = fetchModule.default;
    } catch (err) {
      console.error("Error initializing fetch module:", err);
      process.exit(1);
    }
  
    await subscribeToNFTUpdates(targetIssuer, collectionTaxon);
  }
  
  main().catch(console.error);  
