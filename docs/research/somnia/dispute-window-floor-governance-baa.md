# disputeWindowSeconds Minimum Floor — TimelockController Pattern and Hospital BAA Settlement Finality

Research findings for cliqueue-coding-blockchain. PHI never on-chain; pointers, hashes, and payments only.

---

## 2026-05-16 — Should `disputeWindowSeconds` have a network-level minimum floor enforced by TimelockController min-delay logic — and should this floor be documented in the hospital BAA as a settlement finality guarantee?

---

### Finding 1: OpenZeppelin TimelockController has NO built-in minimum delay floor — the Compound Timelock pattern is the correct precedent

- OpenZeppelin's `TimelockController.updateDelay()` (v5.x, current) accepts any `newDelay` value including zero. The only guard is that the caller must be `address(this)` (the timelock itself). There is **no `MIN_DELAY` constant or immutable floor** in the OZ implementation. OZ GitHub Issue #2642 proposed adding a `minDelayBaseline` immutable constructor parameter enforced in `updateDelay`, but the issue was closed without resolution and the feature was never merged into `TimelockController`.
  — [OZ TimelockController.sol (master)](https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/governance/TimelockController.sol); [OZ Issue #2642](https://github.com/OpenZeppelin/openzeppelin-contracts/issues/2642)
  — Assessment: High confidence (verified from source).

- **The Compound Timelock is the established DeFi precedent for a hardcoded minimum floor.** `Timelock.sol` in compound-protocol declares `uint public constant MINIMUM_DELAY = 2 days` and `uint public constant MAXIMUM_DELAY = 30 days`. Both the constructor and the `setDelay()` runtime function enforce these bounds: `require(delay_ >= MINIMUM_DELAY, ...)` and `require(delay_ <= MAXIMUM_DELAY, ...)`. This means governance cannot reduce the timelock below 2 days regardless of token-holder vote — the floor is bytecode-immutable.
  — [compound-finance/compound-protocol/contracts/Timelock.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/Timelock.sol)
  — Assessment: High confidence (verified from source).

- **Recommended implementation for `ClaimsAdjudicator`:** Create a `ClinicalTimelockController` that inherits OZ `TimelockController` and overrides `updateDelay`:

  ```solidity
  contract ClinicalTimelockController is TimelockController {
    uint256 public immutable MIN_DELAY_FLOOR;
    uint256 public immutable MAX_DELAY_CEILING;

    constructor(
      uint256 minDelay,
      uint256 minFloor,
      uint256 maxCeiling,
      address[] memory proposers,
      address[] memory executors,
      address admin
    ) TimelockController(minDelay, proposers, executors, admin) {
      require(minDelay >= minFloor, "floor violation at deploy");
      require(minDelay <= maxCeiling, "ceiling violation at deploy");
      MIN_DELAY_FLOOR = minFloor;
      MAX_DELAY_CEILING = maxCeiling;
    }

    function updateDelay(uint256 newDelay) public override {
      require(newDelay >= MIN_DELAY_FLOOR, "below minimum floor");
      require(newDelay <= MAX_DELAY_CEILING, "above maximum ceiling");
      super.updateDelay(newDelay);
    }
  }
  ```

  A separate `disputeWindowSeconds` governance parameter in `ClaimsAdjudicator` (controlled by this timelock) should similarly enforce its own floor/ceiling — but these are two distinct concepts: the timelock's own `minDelay` (how long governance proposals wait) and `disputeWindowSeconds` (how long payers have to dispute a settled claim). They should NOT be conflated.
  — Synthesis from Compound pattern and OZ architecture.
  — Assessment: High confidence as design synthesis.

---

### Finding 2: Healthcare payer dispute timelines are measured in calendar days — no hour-based filing window exists in US regulation

- Major payer appeal deadlines (from denial/adjudication date): UnitedHealthcare = 65 calendar days; Aetna, BCBS, Cigna, Humana = 180 calendar days. These are the windows in which a provider must FILE a dispute — not real-time windows.
  — [Muni Health: Insurance Appeal Deadlines by Payer 2026](https://muni.health/blog/insurance-appeal-deadlines-2025)
  — Assessment: High confidence.

- **Expedited appeals** (for urgent clinical situations only) must be resolved within 72 hours by the payer under ACA/CMS rules. This is the payer's RESPONSE timeline for urgent cases — not the provider's DISPUTE INITIATION window. No CMS or CAQH CORE rule specifies an hour-based window within which a provider must initiate a dispute after a real-time adjudication event.
  — [Innovation Health Dispute & Appeal FAQs](https://www.innovationhealth.com/en/health-care-professionals/dispute-appeals/faqs.html); CMS Medicare Claims Processing Manual
  — Assessment: High confidence.

- **CAQH CORE 156 Real-Time Response Time Rule** governs how quickly a payer must respond to a real-time X12 transaction (eligibility inquiry, claim status). It does NOT specify a dispute window for real-time adjudication decisions. The CORE framework separates transaction response latency from claims dispute processes.
  — [CAQH CORE Operating Rules](https://www.caqh.org/core/operating-rules)
  — Assessment: High confidence (negative finding; CORE scope confirmed by prior research).

- **Implication for `disputeWindowSeconds` floor:** Because no regulatory mandate specifies a minimum hours-based dispute window, the floor is a **design choice entirely of cliqueue's making**, not a regulatory compliance requirement. The floor should be calibrated against payer back-office operational reality, not regulatory mandate.

---

### Finding 3: A 6-hour floor (21,600 seconds) is defensible operationally — a 24-hour floor is the conservative recommendation

- Payer back-office systems that process real-time adjudication events (point-of-care adjudication) typically run on batch-cycle reconciliation — overnight or intra-day. A 6-hour floor (21,600 seconds) is likely insufficient for a payer's manual review queue to even populate the disputed claim for human inspection during off-peak hours (evenings, weekends, holidays). A 24-hour floor (86,400 seconds) ensures the payer's standard batch cycle has at least one full pass before the dispute window could theoretically be reduced to.
  — Inferred from industry real-time adjudication literature and expedited appeal response requirements (72 hours).
  — Assessment: Medium confidence (operational inference; no direct primary source specifies a minimum hours-based floor for healthcare claim disputes).

- **Best practice from DeFi:** Compound's 2-day `MINIMUM_DELAY` for governance proposals is treated as the minimum "meaningful notice period" — below 2 days, the community cannot realistically review and react. The analogy for cliqueue: below 24 hours, payer back-office systems and hospital coding staff cannot realistically detect, escalate, and initiate a dispute. A 24-hour floor is the minimum that preserves operational integrity.
  — [compound-finance/compound-protocol Timelock.sol](https://github.com/compound-finance/compound-protocol/blob/master/contracts/Timelock.sol)
  — Assessment: Medium confidence (analogy from DeFi; no direct healthcare precedent).

- **The default `disputeWindowSeconds` (48 hours, confirmed by prior research) is well above the 24-hour operational floor** and should remain the default. The floor exists to prevent a governance action from reducing the window below operational viability during early-stage calibration.

---

### Finding 4: No published healthcare blockchain protocol has defined a dispute window floor in a BAA — the concept is novel

- A survey of academic literature (Frontiers in Blockchain 2025, arXiv healthcare blockchain papers, MDPI), CMS documentation, and industry sources (HFMA, CAQH, AMA) found **no published example of a business associate agreement or provider-payer contract that specifies a settlement finality guarantee in hours or a minimum dispute window floor for blockchain-anchored claims**.
  — [Frontiers in Blockchain: Blockchain applications in health insurance 2025](https://www.frontiersin.org/journals/blockchain/articles/10.3389/fbloc.2025.1699290/full); [Healthcare Policy Compliance: A Blockchain Smart Contract-Based Approach](https://arxiv.org/html/2312.10214v1)
  — Assessment: High confidence (negative finding; absence of precedent in multiple sources).

- The closest analogy is **payment finality SLAs in ACH and SWIFT**: ACH same-day credit is final after the settlement window closes (typically same business day); SWIFT GPI commits to same-day value transfer with finality on the beneficiary bank's receipt. Healthcare blockchain settlement finality at the application layer (cliqueue's `disputeWindowSeconds`) is a novel construct that borrows from these payment finality concepts but has no direct regulatory precedent.
  — Assessment: Medium confidence (payment system analogy; not specific to healthcare).

- **BAA recommendation:** The hospital BAA should include a "Settlement Finality Exhibit" (not a core HIPAA BAA clause) that documents: (a) the current `disputeWindowSeconds` value, (b) the network-level `MIN_DISPUTE_WINDOW_FLOOR`, (c) the governance process and minimum notice period for changing either value, and (d) a covenant that cliqueue will not propose a governance change reducing `disputeWindowSeconds` below 24 hours without 30-day advance written notice to the hospital. This is a contractual SLA, not a HIPAA BAA requirement.
  — Assessment: High confidence as design recommendation; no regulatory obligation.

---

### Finding 5: `disputeWindowSeconds` and the timelock's `minDelay` are distinct parameters — they must not be conflated

- The `TimelockController`'s `minDelay` governs how long a **governance proposal** waits before execution. The `ClaimsAdjudicator`'s `disputeWindowSeconds` governs how long a **payer** has to challenge a settled claim. These are entirely separate concepts.
  — A proposal to change `disputeWindowSeconds` must itself wait through the timelock's `minDelay` (e.g., 48 hours) before taking effect. The net result: reducing `disputeWindowSeconds` from 48h to 24h requires: (1) queue the proposal, (2) wait 48h (timelock), (3) execute. This creates a natural 48-hour notice period for any `disputeWindowSeconds` change — independent of any floor on `disputeWindowSeconds` itself.
  — This means the timelock's `minDelay` already provides one layer of protection against instant governance reduction of `disputeWindowSeconds`. The `MIN_DISPUTE_WINDOW_FLOOR` constant in `ClaimsAdjudicator` provides a second, bytecode-level layer.

- **Recommended two-layer floor architecture:**
  1. `ClinicalTimelockController.MIN_DELAY_FLOOR` (immutable, e.g., 48 hours) — prevents governance from reducing the proposal delay below 48 hours.
  2. `ClaimsAdjudicator.MIN_DISPUTE_WINDOW_FLOOR` (immutable constant, e.g., 86,400 = 24 hours) — enforced in the setter for `disputeWindowSeconds`:
     ```solidity
     uint256 public constant MIN_DISPUTE_WINDOW_FLOOR = 86_400; // 24 hours
     uint256 public constant MAX_DISPUTE_WINDOW_CEILING = 604_800; // 7 days

     function setDisputeWindow(uint256 newWindow) external onlyRole(TIMELOCK_ROLE) {
       require(newWindow >= MIN_DISPUTE_WINDOW_FLOOR, "below floor");
       require(newWindow <= MAX_DISPUTE_WINDOW_CEILING, "above ceiling");
       disputeWindowSeconds = newWindow;
       emit DisputeWindowUpdated(newWindow);
     }
     ```
  — Assessment: High confidence as design synthesis.

---

**Design implication:** `ClaimsAdjudicator` should embed a `uint256 public constant MIN_DISPUTE_WINDOW_FLOOR = 86_400` (24 hours) enforced in the `setDisputeWindow()` governance function, with a ceiling of `604_800` (7 days). The default `disputeWindowSeconds` remains 172,800 (48 hours). Separately, the `TimelockController` wrapper should override `updateDelay` to enforce its own `MIN_DELAY_FLOOR` immutable (Compound pattern). These two floors are independent and must not be conflated. The hospital BAA should include a Settlement Finality Exhibit — a non-HIPAA contractual SLA — documenting the current window value, the immutable floor, and a 30-day advance notice covenant before any governance change reduces the window. No regulatory mandate specifies a minimum hours-based dispute window; the floor is cliqueue's operational design choice, calibrated to payer back-office cycle reality (one full business day = 24 hours minimum).

**Open questions generated:**
1. Should the `MIN_DISPUTE_WINDOW_FLOOR` (24 hours) and `MAX_DISPUTE_WINDOW_CEILING` (7 days) be deployed as `immutable` bytecode constants or stored as governance-frozen `constant` in `ClaimsAdjudicator` — and does either choice affect the Somnia block explorer's ability to display them to hospital auditors without an ABI call? — added 2026-05-16, priority: medium
2. Should the Settlement Finality Exhibit in the hospital BAA specify the `ClaimsAdjudicator` proxy contract address and the Somnia block explorer URL for verifying `MIN_DISPUTE_WINDOW_FLOOR` — so a hospital's auditor can independently confirm the floor is bytecode-immutable without relying on cliqueue's word? — added 2026-05-16, priority: high
3. Should `ClaimsAdjudicator` emit a `DisputeWindowUpdated(uint256 oldWindow, uint256 newWindow)` event on every `setDisputeWindow()` governance execution — creating an immutable on-chain log of all governance changes to the dispute window that hospital compliance teams and payer procurement can subscribe to? — added 2026-05-16, priority: medium

---

**See also** — [[../topics/dispute-window|dispute-window hub]] · [[../topics/hipaa|HIPAA hub]] · [[../topics/upgradeable-proxy|upgradeable-proxy hub]]
