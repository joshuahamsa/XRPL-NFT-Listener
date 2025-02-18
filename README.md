# XRPL-NFT-Listener

A Node.js script for capturing NFT interactions on the XRP Ledger (XRPL) and updating a local SQLite database (`nfts.db`) with NFT data. This project subscribes to the full transaction stream on XRPL and processes NFT-related transactions such as mints, burns, create offers, and accept offers. It also fetches NFT metadata (from IPFS or HTTP endpoints) and dynamically updates the database schema based on NFT traits.

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Contributing](#contributing)
- [References](#references)

## Features

- **Real-Time NFT Tracking:** Subscribes to validated XRPL transactions and filters for NFT-related events.
- **Comprehensive NFT Handling:** Processes mints, burns, and offer/trade transactions.
- **Metadata Fetching:** Retrieves NFT metadata (including images and attributes) using the NFT's URI.
- **Dynamic Database Schema:** Automatically adds new columns for NFT traits as needed.
- **Local Persistence:** Stores NFT data in a local SQLite database (`nfts.db`).

## Requirements

- **Node.js** (v12 or later)
- **NPM** (Node Package Manager)
- **SQLite:** The script uses the [sqlite3](https://www.npmjs.com/package/sqlite3) package.
- **XRPL WebSocket Endpoint:** For example, `wss://s2-clio.ripple.com`

## Installation

1. **Clone this repository:**

   ```bash
   git clone https://github.com/joshuahamsa/XRPL-NFT-Listener.git
   cd XRPL-NFT-Listener
   ```

2. **Install dependencies:**

   ```bash
   npm install xrpl sqlite3 node-fetch
   ```

3. **Database Setup:**

   Ensure you have a SQLite database named `nfts.db` with a table named `nfts`. You can create the table using the [xrpl-nft-fetcher](https://github.com/joshuahamsa/xrpl-nft-fetcher) repository. 

## Usage

Run the script using the following command:

```bash
node listener.js <issuer_to_watch> <collection_taxon>
```

- `<issuer_to_watch>`: The XRPL account address for the NFT issuer you wish to monitor.
- `<collection_taxon>`: The numeric taxon for the NFT collection (e.g., 123456).

**Example:**

```bash
node listener.js rCE7uRtdNRmmiXst6DQiaUZnGWcPNT4Sh 3
```

## How It Works

1. **Subscription to XRPL Transactions:**
   - The script connects to an XRPL WebSocket endpoint and subscribes to the full transaction stream.
   - It listens for all validated transactions.

2. **Filtering for NFT-Related Transactions:**
   - Custom listeners are implemented:
     - **burnListener:** Detects `NFTokenBurn` transactions and updates the burn status in the database.
     - **mintListener:** Detects `NFTokenMint` transactions from an `Authorized Minter` account and processes new NFT mints by fetching metadata.
     - **buildListener:** Detects `NFTokenMint` transactions  from the `Issuer` account and processes new NFT mints by fetching metadata.
     - **tradeListener:** Processes `NFTokenAcceptOffer` transactions to update NFT ownership.
   - Each listener checks that the transaction is relevant (e.g., by comparing the `Account` or `Issuer` with the target issuer and ensuring the collection taxon matches).

3. **Database Updates:**
   - **Minting:** For new mints, the script extracts NFT IDs from the transaction metadata, fetches detailed info (via the `nft_info` command), decodes the NFT URI, and retrieves JSON metadata from IPFS or HTTP. The NFT is then stored in the database with dynamic trait columns.
   - **Offers/Trades:** When an NFT offer is created or accepted, the script updates the owner information in the database.
   - **Burning:** When an NFT is burned, the script marks the NFT as burned in the database.

4. **Metadata Fetching & Dynamic Schema:**
   - The script decodes hex-encoded URIs, fetches metadata (which may include images and dynamic attributes), and adds new columns to the `nfts` table as necessary.

## Contributing

Contributions are welcome! If you have any suggestions or improvements, please open an issue or submit a pull request.

## References

- [XRPL Documentation](https://xrpl.org/)
- [xrpl-nft-fetcher](https://github.com/joshuahamsa/xrpl-nft-fetcher) – Repository to create the SQLite database and table schema.

---

Feel free to adjust any sections as necessary for your project specifics.
