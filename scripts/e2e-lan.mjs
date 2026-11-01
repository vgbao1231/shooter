import { chromium } from "playwright";

const LAN_HOST = "http://127.0.0.1:8080";
const PAGE = "http://127.0.0.1:5173/";

const browser = await chromium.launch({ headless: true });
const errors = [];

async function openClient(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`[${name}] console: ${message.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[${name}] pageerror: ${error.message}`));
  await page.goto(PAGE, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^lan/i }).click();
  await page.waitForTimeout(200);
  await page.getByLabel("Your name").fill(name);
  return { context, page };
}

// Host creates a room and reads its code.
const host = await openClient("Alpha");
await host.page.getByRole("button", { name: /create room/i }).click();
await host.page.waitForSelector(".lobby__teams", { timeout: 8000 });
const roomCode = (
  await host.page.locator(".lobby__room-code strong").textContent()
)?.trim();
if (!roomCode) throw new Error("No room code rendered");

// Guest joins the same room by code.
const guest = await openClient("Beta");
await guest.page.getByLabel("Room code").fill(roomCode);
await guest.page.getByRole("button", { name: /^join$/i }).click();
await guest.page.waitForSelector(".lobby__teams", { timeout: 8000 });
await host.page.waitForTimeout(300);
await guest.page.waitForTimeout(300);

// A third client opening the invite link must auto-join the same room (the
// share link must resolve to the Colyseus host, not a dev origin).
const link = (await host.page.locator(".lobby__room-link code").textContent())?.trim();
if (!link) throw new Error("No invite link rendered");
const linker = await openClient("Gamma");
await linker.page.goto(link, { waitUntil: "networkidle" });
await linker.page.waitForSelector(".lobby__teams", { timeout: 8000 });
const linkJoined = await linker.page.locator(".lobby__team").count();
if (linkJoined < 1) throw new Error("Guest opening the invite link did not reach the lobby");

const lobbyState = async (page) =>
  page.evaluate(() => {
    const teams = [...document.querySelectorAll(".lobby__team")].map((node) =>
      node.textContent?.trim(),
    );
    return { teams, code: document.querySelector(".lobby__room-code strong")?.textContent?.trim() };
  });

const hostLobby = await lobbyState(host.page);
const guestLobby = await lobbyState(guest.page);

// Host sees start controls; guest sees Ready.
const hostCanStart = await host.page.getByRole("button", { name: /start match/i }).count();
const guestReady = await guest.page.getByRole("button", { name: /ready/i }).count();

// Host starts the match.
await host.page.getByRole("button", { name: /start match/i }).click();
await host.page.waitForTimeout(400);

// Both clients reach the game and the countdown turns to playing.
await host.page.waitForSelector("canvas.game-canvas", { timeout: 8000 });
await guest.page.waitForSelector("canvas.game-canvas", { timeout: 8000 });
await host.page.waitForFunction(
  () => window.__INKSHOT_LAN__?.roundState === "playing",
  { timeout: 8000 },
);
await guest.page.waitForFunction(
  () => window.__INKSHOT_LAN__?.roundState === "playing",
  { timeout: 8000 },
);

const gameState = async (page) =>
  page.evaluate(() => {
    const world = window.__INKSHOT_LAN__;
    return {
      roundState: world?.roundState,
      roundNumber: world?.roundNumber,
      players: world?.players?.map((p) => ({ id: p.id, isBot: p.isBot, x: Math.round(p.x), y: Math.round(p.y) })),
      arena: world?.arenaId,
      hud: document.querySelector(".hud__mode")?.textContent?.trim() ?? null,
    };
  });

const hostGame = await gameState(host.page);
const guestGame = await gameState(guest.page);

// Drive the host player right for ~500ms and confirm x changes.
const before = await host.page.evaluate(() =>
  Math.round(window.__INKSHOT_LAN__.players[0]?.x ?? 0),
);
await host.page.locator("canvas.game-canvas").click();
await host.page.keyboard.down("KeyD");
await host.page.waitForTimeout(500);
await host.page.keyboard.up("KeyD");
await host.page.waitForTimeout(200);
const after = await host.page.evaluate(() =>
  Math.round(window.__INKSHOT_LAN__.players[0]?.x ?? 0),
);

// Verify the guest also sees the remote player move (mirrors the host's x).
const guestRemote = await guest.page.evaluate(() => {
  const world = window.__INKSHOT_LAN__;
  const human = world?.players?.find((p) => !p.isBot);
  return human ? Math.round(human.x) : null;
});

await host.page.screenshot({ path: "/tmp/opencode/inkshot-lan-host.png" });
await guest.page.screenshot({ path: "/tmp/opencode/inkshot-lan-guest.png" });

console.log(
  JSON.stringify(
    {
      errors,
      hostLobby,
      guestLobby,
      hostCanStart,
      guestReady,
      hostGame,
      guestGame,
      hostMoved: { before, after, delta: after - before },
      guestRemoteX: guestRemote,
    },
    null,
    2,
  ),
);

await host.context.close();
await guest.context.close();
await browser.close();
