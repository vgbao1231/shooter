import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

// Pointer lock is disabled for the automated run.
await page.goto("http://127.0.0.1:5173/?noPointerLock=1", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// --- Menu → start Training so the game canvas mounts.
await page.getByRole("button", { name: /start training/i }).click();
await page.waitForTimeout(600);

const box = await page.locator("canvas").boundingBox();
if (!box) throw new Error("Canvas missing");
const point = (x, y) => ({
  x: box.x + (x / 1280) * box.width,
  y: box.y + (y / 720) * box.height,
});

// --- Fix positions in a clear lane so shots reach the bot.
await page.evaluate(() => {
  const world = window.__INKSHOT__;
  if (!world) throw new Error("no debug world");
  world.botEnabled = false;
  const bot = world.players[1];
  const player = world.players[0];
  // Stand on the central base platform so the shot lane is clear.
  player.x = 480;
  player.y = 580;
  player.vx = 0;
  player.vy = 0;
  bot.x = 650;
  bot.y = 580;
  bot.vx = 0;
  bot.vy = 0;
});
await page.locator("canvas").click();
await page.mouse.move(point(650, 580).x, point(650, 580).y);
await page.mouse.down();
const samples = [];
for (let index = 0; index < 12; index += 1) {
  await page.waitForTimeout(120);
  samples.push(
    await page.evaluate(() => {
      const world = window.__INKSHOT__;
      return {
        bullets: world.bullets.map((bullet) => Math.round(bullet.x)),
        botHealth: Math.round(world.players[1].health),
      };
    }),
  );
}
const duringFire = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  const player = world.players[0];
  return {
    fireCooldown: player.fireCooldown,
    aim: player.aimAngle,
    playerX: player.x,
    playerY: player.y,
    botX: world.players[1].x,
    botY: world.players[1].y,
    platformCount: world.platformList.length,
  };
});
await page.waitForTimeout(1200);
await page.mouse.up();
await page.waitForTimeout(250);
await page.screenshot({ path: "/tmp/opencode/inkshot-combat.png" });

// --- Card overlay (Training via C).
await page.keyboard.press("KeyC");
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/opencode/inkshot-cards.png" });

const visibleCards = await page.locator(".upgrade-card").count();
if (visibleCards > 0) await page.locator(".upgrade-card").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/opencode/inkshot-after-card.png" });

// --- Debug panel (F1).
await page.keyboard.press("F1");
await page.waitForTimeout(400);
await page.screenshot({ path: "/tmp/opencode/inkshot-debug.png" });

const result = await page.evaluate(() => {
  const text = (selector) => document.querySelector(selector)?.textContent?.trim() ?? null;
  const world = window.__INKSHOT__;
  return {
    // Vitality block removed; use the compact fighter bar instead.
    fighterHealth: text(".fighter-card--left .fighter-card__health"),
    botHealth: text(".fighter-card--right .fighter-card__meta"),
    simHealth: world?.players.map((player) => Math.round(player.health)) ?? null,
    deckCards: [...document.querySelectorAll(".deck-panel__card")].map((node) => node.textContent),
    deckOwned: document.querySelectorAll(".deck-panel__card.is-owned").length,
    debug: Boolean(document.querySelector(".hud__debug")),
    canvas: Boolean(document.querySelector("canvas")),
  };
});

// --- Gauntlet smoke: menu → select Gauntlet mode → start.
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /bot gauntlet/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /start gauntlet/i }).click();
await page.waitForTimeout(600);
const gauntlet = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  const mode = document.querySelector(".hud__mode")?.textContent?.trim() ?? null;
  return {
    mode,
    worldMode: world?.mode ?? null,
    arena: world?.arenaId ?? null,
    bots: world?.players.filter((player) => player.isBot).length ?? null,
  };
});
await page.screenshot({ path: "/tmp/opencode/inkshot-gauntlet.png" });

// --- Match smoke: menu → Match → countdown→playing → round award → match end.
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /^match/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /start match/i }).click();
await page.waitForTimeout(300);

// Countdown should be active right after start, then turn to playing.
const countdown = await page.evaluate(() => window.__INKSHOT__?.roundState ?? null);
await page.waitForFunction(
  () => {
    const world = window.__INKSHOT__;
    return world?.roundState === "playing";
  },
  { timeout: 5000 },
);

// Drop the bot into the left pit (x300-420 has no floor) → falls → round award.
await page.evaluate(() => {
  const world = window.__INKSHOT__;
  world.botEnabled = false;
  world.matchTarget = 2; // reachable quickly for the smoke test
  const bot = world.players[1];
  bot.x = 360;
  bot.y = 650;
  bot.vx = 0;
  bot.vy = 80;
  bot.grounded = false;
});
// The roundEnd banner should render once the round resolves.
await page.waitForFunction(
  () => document.querySelector(".hud__result")?.textContent?.includes("takes it") ?? false,
  { timeout: 5000 },
);
const roundAward = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  return {
    roundOver: world.roundOver,
    winnerId: world.winnerId,
    playerScore: world.players[0].score,
    roundState: world.roundState,
    hudText: document.querySelector(".hud__result")?.textContent?.trim() ?? null,
  };
});

// Wait for the next round countdown, then drop the bot again → match end.
await page.waitForFunction(
  () => {
    const world = window.__INKSHOT__;
    return world?.roundState === "playing" && world?.roundNumber === 2;
  },
  { timeout: 8000 },
);
await page.evaluate(() => {
  const world = window.__INKSHOT__;
  const bot = world.players[1];
  bot.x = 360;
  bot.y = 650;
  bot.vx = 0;
  bot.vy = 80;
  bot.grounded = false;
});
// The match-end overlay should render once the match resolves.
await page.waitForSelector(".gameover-overlay", { timeout: 8000 });
const matchEnd = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  return {
    matchOver: world.matchOver,
    roundState: world.roundState,
    playerScore: world.players[0].score,
    matchTarget: world.matchTarget,
    overlay: document.querySelector(".gameover-overlay")?.textContent?.trim() ?? null,
  };
});
await page.screenshot({ path: "/tmp/opencode/inkshot-match-end.png" });

// Rematch resets scores and round number, back to countdown.
await page.getByRole("button", { name: /rematch/i }).click();
await page.waitForTimeout(300);
const rematch = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  return {
    roundNumber: world.roundNumber,
    roundState: world.roundState,
    playerScore: world.players[0].score,
    matchOver: world.matchOver,
  };
});
await page.screenshot({ path: "/tmp/opencode/inkshot-rematch.png" });

console.log(
  JSON.stringify(
    { errors, visibleCards, samples, duringFire, result, gauntlet, countdown, roundAward, matchEnd, rematch },
    null,
    2,
  ),
);
await browser.close();
