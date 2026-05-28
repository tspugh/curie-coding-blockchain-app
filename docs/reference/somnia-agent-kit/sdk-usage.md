# Somnia Agent Kit SDK Usage

> **Source:** https://somnia-agent-kit.gitbook.io/somnia-agent-kit/sdk-usage/sdk-usage
> **Fetched:** 2026-05-14 via WebFetch (AI-summarised — see [`PROVENANCE.md`](PROVENANCE.md))

## Initialisation

The SDK supports two initialisation patterns.

**Manual configuration:**

```typescript
const kit = new SomniaAgentKit({
  network: SOMNIA_NETWORKS.testnet,
  contracts: { /* contract addresses */ },
  privateKey: process.env.PRIVATE_KEY,
});
await kit.initialize();
```

**Environment-based (recommended):**

```typescript
const kit = new SomniaAgentKit();
await kit.initialize();
```

Configuration via `.env` requires: `SOMNIA_RPC_URL`, `SOMNIA_CHAIN_ID`, optional `PRIVATE_KEY`, and contract address variables for registry, manager, executor, and vault.

## Core Class Methods

The `SomniaAgentKit` class provides getter methods for accessing managers and utilities:

- `getNetworkInfo()` — returns network name, chain ID, and RPC URL.
- `getProvider()` — accesses the blockchain provider.
- `getSigner()` — returns signer instance (requires private key).
- `getContractDeployer()` — deploys contracts with ABI and bytecode.
- `getContractVerifier()` — verifies contract source code.
- `getWebSocketClient()` — enables real-time block subscriptions.

Contract access via `kit.contracts.registry`, `kit.contracts.manager`, `kit.contracts.vault`, and `kit.contracts.executor`.

## Token Management

Specialised managers for different token types.

**ERC20 Manager:**

```typescript
const erc20 = kit.getERC20Manager();
const balance = await erc20.balanceOf(tokenAddress, account);
```

**ERC721 Manager (NFTs):**

```typescript
const nft = kit.getERC721Manager();
const owner = await nft.ownerOf(collectionAddress, tokenId);
```

**Native Token Manager (STT):**

```typescript
const native = kit.getNativeTokenManager();
const balance = await native.getBalance();
```

## Additional Utilities

- **Multicall** — batching RPC calls: `multicall.aggregate(calls)`
- **IPFS Manager** — `ipfs.fetchNFTMetadata('ipfs://...')`
- **MetaMask Integration** (browser) — `metamask.connect()` after availability check

## Typical Usage Pattern

```typescript
async function main() {
  const kit = new SomniaAgentKit({
    network: SOMNIA_NETWORKS.testnet,
    privateKey: process.env.PRIVATE_KEY,
  });

  await kit.initialize();
  const signer = kit.getSigner();
  const address = await signer.getAddress();
  const total = await kit.contracts.registry.getTotalAgents();

  if (total > 0n) {
    const agent = await kit.contracts.registry.getAgent(1);
    console.log('Agent:', agent.name);
  }
}
```

## Best Practices

1. **Always initialise before use:** `await kit.initialize();` — only then is contract access safe.
2. **Check signer existence** for write operations to ensure private key is configured.
3. **Handle network errors** by catching error codes like `'NETWORK_ERROR'`.
4. **Use environment variables** for sensitive configuration over manual config.

## LLM Integration & Autonomous Runtime

The upstream docs reference advanced features — **LLM Integration** (`sdk-llm`) and **Autonomous Runtime** (`sdk-runtime`) — as separate pages. They are not yet captured locally; see [`PROVENANCE.md`](PROVENANCE.md) for the "not yet captured" list. Specific implementation details, Ollama/OpenAI adapter patterns, and runtime architecture should be read from upstream until those pages are pulled in.

## TypeScript Notes

The SDK exports `SomniaAgentKit` class and `SOMNIA_NETWORKS` constant with typed network configurations (`testnet`, `mainnet`, `devnet`, or custom objects). Contract addresses are typed within the configuration object. Manager methods return typed promises — e.g., `balanceOf()` returns a promise resolving to a balance value.

**Configuration shape:** accepts `network`, `contracts` object with address strings, and optional `privateKey`. The class implements an async initialisation workflow before contract/provider access is safe.
