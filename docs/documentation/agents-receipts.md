# Somnia Agents — Invocation Receipts

> **Source:** https://docs.somnia.network/agents/invoking-agents/receipts
> **Copied:** 2026-05-26. Hard reference from Somnia's official docs (verbatim
> technical content). Confirm against the live page before relying on endpoints
> or field names.

## What receipts are

A **receipt** is a detailed log of each step an agent took during execution —
for transparency and auditability. Receipts are currently stored on centralized
infrastructure, with planned migration to decentralized storage.

## Results vs. receipts (important distinction)

- **Results** undergo validator **consensus** across nodes — the final result is
  what validators agree on.
- **Receipts** are **subjective** per-node execution logs. They document what one
  particular node did to compute the result and may vary between nodes due to
  timing or implementation differences.

So the result is verified across multiple validators; the receipt explains one
node's path to that result.

## Receipt structure

A receipt has a `steps` array (the execution timeline) and a `result` field (the
final encoded output). Each step has a `name`, often a `timestamp`, and
contextual fields that vary by step type.

### Common step types

| Step | Purpose |
|------|---------|
| `request_received` | Invocation received |
| `http_request` | External HTTP call made |
| `http_response` | Response from external service |
| `llm_request` | LLM inference requested |
| `value_extracted` | Data extracted from response |
| `response_encoded` | Final result encoded |
| `error` | Failure occurred |

### Example receipt (success)

```json
{
  "steps": [
    {
      "name": "request_received",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "function": "fetchUint",
      "args": ["https://api.example.com/price", "data.price", 8]
    },
    {
      "name": "http_request",
      "url": "https://api.example.com/price",
      "method": "GET",
      "duration_ms": 245
    },
    {
      "name": "http_response",
      "status": 200,
      "body_preview": "{\"data\":{\"price\":42000.50}}"
    },
    {
      "name": "value_extracted",
      "selector": "data.price",
      "raw_value": 42000.50,
      "scaled_value": "4200050000000"
    },
    {
      "name": "response_encoded",
      "timestamp": "2024-01-15T10:30:00.250Z"
    }
  ],
  "result": "0x00000000000000000000000000000000000000000000000000003d2a0b76c00"
}
```

### Example receipt (error tracing)

```json
{
  "steps": [
    { "name": "request_received", "function": "fetchUint" },
    { "name": "http_request", "url": "https://api.example.com/data" },
    {
      "name": "error",
      "message": "HTTP request failed: 404 Not Found",
      "url": "https://api.example.com/data"
    }
  ]
}
```

## Accessing receipts

**Web UI:** visit https://agents.somnia.network, invoke an agent, then click
**"View Receipt"**.

**Direct URL:** `https://agents.somnia.network/receipts/<request-id>`

**Programmatically:**

```javascript
const requestId = 'abc123...';
const baseUrl = 'https://receipts.mainnet.agents.somnia.host';   // network-specific; a Testnet endpoint also exists

const response = await fetch(`${baseUrl}?requestId=${requestId}`);
const receipt = await response.json();
console.log('Steps:', receipt.steps);
```

Network-specific endpoints exist for Mainnet and Testnet.

## On-chain link to receipts

The on-chain `Response` struct returned to a contract callback carries a
`uint256 receipt` field — a pointer/identifier for the off-chain receipt — along
with the consensus `result`:

```solidity
struct Response {
    address validator;
    bytes result;
    ResponseStatus status;
    uint256 receipt;        // pointer to the off-chain execution receipt
    uint256 timestamp;
    uint256 executionCost;
}
```

The full receipt body (HTTP `body_preview`, extracted values, step logs) lives in
the off-chain receipts service and is retrievable by `requestId` as shown above;
the chain stores the `result` and the `receipt` pointer.
