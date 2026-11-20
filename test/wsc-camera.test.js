"use strict";
// 가짜 카메라에 인쇄용 QR 카드(케플러)를 비추고, '카메라 켜기' → QR 인식 → 그 연구실로 이동하는지 본다.
// Playwright와 ffmpeg가 있어야 하며, 없으면 건너뛴다.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");

let chromium = null;
try { ({ chromium } = require("playwright")); } catch { /* 없음 */ }
let ffmpeg = true;
try { execFileSync("ffmpeg", ["-version"], { stdio: "ignore" }); } catch { ffmpeg = false; }

const ROOT = path.join(__dirname, "..", "wsc");
const BASE = pathToFileURL(path.join(ROOT, "index.html")).href;

function makeVideo(card, dir) {
  // 카드 가운데 QR 부분을 잘라 640x480 영상 한 장면으로 만든다
  const out = path.join(dir, path.basename(card, ".png") + ".y4m");
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", card,
    "-vf", "crop=1000:1000:120:500,scale=440:440,pad=640:480:100:20:white,format=yuv420p",
    "-frames:v", "1", out]);
  return out;
}

async function withCamera(videoFile, fn) {
  const browser = await chromium.launch({ args: [
    "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
    "--use-file-for-fake-video-capture=" + videoFile,
  ] });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.grantPermissions(["camera"]);
    await fn(await ctx.newPage());
  } finally {
    await browser.close();
  }
}

const skip = !chromium ? "playwright 없음" : !ffmpeg ? "ffmpeg 없음" : false;

test("카메라 켜기: 미션 QR을 비추면 그 연구실로 이동하고 카메라를 끈다", { skip, timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wsc-cam-"));
  const video = makeVideo(path.join(ROOT, "print", "02-kepler-R.png"), dir);
  await withCamera(video, async (page) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(BASE + "?lab=jang");
    // 맨 아래 탭은 화면 아래쪽에 고정되어 보인다
    const btn = page.locator("#camera-btn");
    assert.equal(await btn.isVisible(), true);
    const box = await btn.boundingBox();
    assert.ok(box.y + box.height > 844 - 80, "탭이 화면 맨 아래에 있음");

    await btn.click();
    assert.equal(await page.locator("#scanner").isVisible(), true);
    await page.waitForURL(/\?lab=kepler$/, { timeout: 15000 });
    assert.match(await page.textContent("#q-title"), /KEPLER LAB/);
    assert.equal(await page.locator("#scanner").isVisible(), false);
    assert.deepEqual(errors, []);
  });
});

test("카메라 켜기: 미션과 상관없는 QR은 안내만 하고 이동하지 않으며, 닫으면 카메라가 꺼진다", { skip, timeout: 30000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wsc-cam-"));
  // 다른 사이트 주소를 담은 QR 카드를 임시로 만든다
  const card = path.join(dir, "other.png");
  execFileSync("python3", ["-c", [
    "import qrcode",
    "from PIL import Image",
    "q=qrcode.make('https://example.com/hello', box_size=10, border=2).convert('RGB').resize((820,820))",
    "c=Image.new('RGB',(1240,1748),'white'); c.paste(q,(210,590)); c.save(r'" + card + "')",
  ].join("\n")]);
  const video = makeVideo(card, dir);
  await withCamera(video, async (page) => {
    await page.goto(BASE);
    await page.click("#camera-btn");
    await page.waitForFunction(() => /미션 QR이 아니에요/.test(document.getElementById("scan-msg").textContent), null, { timeout: 15000 });
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.evaluate(() => !!document.getElementById("scan-video").srcObject), true);
    await page.click("#scan-close");
    assert.equal(await page.locator("#scanner").isVisible(), false);
    assert.equal(await page.evaluate(() => document.getElementById("scan-video").srcObject), null);
  });
});
