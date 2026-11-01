# INKSHOT — Agent guidance

## Start of any task

1. Read `docs/README.md` first. It is the single current-status source (phase, core decisions, run commands, phase status, next step).
2. State the phase and its acceptance criteria before implementing. Keep work inside the current phase's scope.
3. Drill into `docs/01-game-design.md`, `docs/03-technical-architecture.md`, or `docs/04-roadmap.md` only when the task needs that detail. Do not read all of them for every task.
4. Do NOT re-research settled decisions. They are recorded in `docs/README.md` §2 (Core decisions) and `docs/03` §2 (Stack — including the Colyseus 0.16 deviation) and §7 (Bots). If a decision is already recorded, do not re-question it.

## Shared architecture (client / server / sim)

- `packages/sim` is the single authority: fixed-step, deterministic (seeded RNG, no `Math.random()`), no DOM/Node imports. Gameplay rules live only here.
- `apps/web` renders and captures input; it never simulates gameplay. LAN clients render authoritative snapshots (50 ms interpolation, local effect decay only).
- `apps/server` owns authority, rooms, and bots (Colyseus host, one port).
- `packages/sim` **defines** the wire protocol (`src/protocol.ts`) and snapshot serializer (`src/net.ts`); `apps/server` and `apps/web` must import them from `@inkshot/sim`, never fork the shapes.
- Before editing anything that touches this contract, flag it. Do not let the client invent rules, add non-determinism to the sim, or drift the protocol shapes. (Full detail: `docs/03` §5–§6.)

## Discovery (keep it targeted)

- Use `glob`/`grep` on a path instead of reading whole files. Use the built-in `explore` subagent for "where is X / how does Y work" questions (read-only, fast).
- Do small, well-scoped edits directly. Do not spawn a subagent for a one-line fix.
- Use the `reviewer` subagent only after a non-trivial diff (multi-file, networking, or a contract change).

## Verify before reporting

- Always: `pnpm typecheck` (all packages) and `pnpm test` (sim).
- If web/server changed: `pnpm check:e2e` (needs the dev server on 5173).
- If LAN/networking changed: `pnpm check:e2e:lan` (needs the dev server on 5173 + `pnpm host` on 8080).
- If serving the client: `pnpm build` before `pnpm host`. (Plain command list: `docs/README` §6.)
- Report short: what changed, tests run + counts, known gaps/risks. Do not re-explain the architecture.
