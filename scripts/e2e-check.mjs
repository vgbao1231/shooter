import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// --- Menu → start Training so the game canvas mounts.
await page.getByRole("button", { name: /start training/i }).click();
await page.waitForTimeout(600);

const box = await page.locator("canvas").boundingBox();
if (!box) throw new Error("Canvas missing");
// `object-fit: contain` letterboxes the wide map; mirror pointerToWorld so the
// aim maps to the same world coordinates the game computes.
const scale = Math.min(box.width / 1600, box.height / 720);
const displayedW = 1600 * scale;
const displayedH = 720 * scale;
const offsetX = box.x + (box.width - displayedW) / 2;
const offsetY = box.y + (box.height - displayedH) / 2;
const point = (x, y) => ({
  x: offsetX + x * scale,
  y: offsetY + y * scale,
});

// --- Fix positions in a clear lane (right floor) so shots reach the bot.
await page.evaluate(() => {
  const world = window.__INKSHOT__;
  if (!world) throw new Error("no debug world");
  world.botEnabled = false;
  const bot = world.players[1];
  const player = world.players[0];
  player.x = 800;
  player.y = 594;
  player.vx = 0;
  player.vy = 0;
  bot.x = 1000;
  bot.y = 594;
  bot.vx = 0;
  bot.vy = 0;
});
await page.locator("canvas").click();
await page.mouse.move(point(1000, 594).x, point(1000, 594).y);
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
    fighterHealth: text(".fighter-card--left .fighter-card__health"),
    botHealth: text(".fighter-card--right .fighter-card__meta"),
    simHealth: world?.players.map((player) => Math.round(player.health)) ?? null,
    deckCards: [...document.querySelectorAll(".deck-panel__card")].map((node) => node.textContent),
    deckOwned: document.querySelectorAll(".deck-panel__card.is-owned").length,
    debug: Boolean(document.querySelector(".hud__debug")),
    canvas: Boolean(document.querySelector("canvas")),
  };
});

// --- Pause overlay via Esc (local mode).
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const pauseShown = await page.locator(".pause-overlay").count();
await page.screenshot({ path: "/tmp/opencode/inkshot-pause.png" });
await page.getByRole("button", { name: /resume/i }).click();
await page.waitForTimeout(200);

// --- Gauntlet smoke: menu → Vượt ải → level select → level 1.
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /vượt ải/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /choose a level/i }).click();
await page.waitForTimeout(300);
const levelCards = await page.locator(".level-card").count();
await page.getByRole("button", { name: /ải 1/i }).click();
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

// --- High-level gauntlet (level 6) should start 3 hard bots.
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /vượt ải/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /choose a level/i }).click();
await page.waitForTimeout(300);
await page.getByRole("button", { name: /ải 6/i }).click();
await page.waitForTimeout(600);
const gauntletHigh = await page.evaluate(() => {
  const world = window.__INKSHOT__;
  return {
    worldMode: world?.mode ?? null,
    arena: world?.arenaId ?? null,
    bots: world?.players.filter((player) => player.isBot).length ?? null,
    difficulty: world?.botDifficulty ?? null,
  };
});

// --- Level-select preview renders a non-blank map for both arenas.
await page.getByRole("button", { name: "Menu" }).click();
await page.waitForTimeout(400);
await page.getByRole("button", { name: /vượt ải/i }).click();
await page.waitForTimeout(200);
await page.getByRole("button", { name: /choose a level/i }).click();
await page.waitForTimeout(300);
const previews = await page.evaluate(() =>
  [...document.querySelectorAll(".level-card__preview")].map((canvas) => {
    const context = canvas.getContext("2d");
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let colored = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index + 3] > 0) colored += 1;
    }
    return colored;
  }),
);

console.log(
  JSON.stringify(
    { errors, visibleCards, samples, duringFire, result, pauseShown, levelCards, gauntlet, gauntletHigh, previews },
    null,
    2,
  ),
);
await browser.close();
