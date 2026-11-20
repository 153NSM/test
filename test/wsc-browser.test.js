"use strict";
// 실제 브라우저로 미션 한 바퀴를 돈다. Playwright가 없으면 건너뛴다.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let chromium = null;
try { ({ chromium } = require("playwright")); } catch { /* 없으면 건너뜀 */ }

const BASE = pathToFileURL(path.join(__dirname, "..", "wsc", "index.html")).href;
const ANSWERS = { jang: 0, kepler: 1, newton: 1, curie: 3, johnson: 2 };

test("브라우저: 아무 순서로 5곳을 풀어 GREAT 완성, 안내데스크 수령 기록", { skip: chromium ? false : "playwright 없음" }, async () => {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const errors = [];
    const requests = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => { if (!/^(file|data):/.test(r.url())) requests.push(r.url()); });
    const choice = (i) => page.locator(".choices button").nth(i);
    const slotsText = () => page.$$eval("#lock .slot b", (bs) => bs.map((b) => b.textContent).join(""));

    // 첫 화면: 이야기와 빈 자물쇠, 안내데스크 칸 없음
    await page.goto(BASE);
    assert.equal(await slotsText(), "?????");
    assert.equal(await page.locator(".desk").count(), 0);
    assert.match(await page.textContent("#view"), /사라진 5개의 시크릿 코드/);

    // 마리 퀴리: 틀리면 안내 후 다시, 맞히면 A
    await page.goto(BASE + "?lab=curie");
    await choice(0).click();
    assert.equal(await page.locator(".feedback").isVisible(), true);
    assert.match(await choice(0).getAttribute("class"), /wrong/);
    await choice(2).click();
    await choice(ANSWERS.curie).click();
    assert.equal(await page.locator(".big-letter").textContent(), "A");
    assert.equal(await slotsText(), "???A?");

    // 본부: 코드 1개 → 달력만 받을 수 있음
    await page.click("text=미션 본부로 가기");
    assert.equal(await page.locator(".desk").count(), 1);
    assert.match(await page.textContent(".claims li:nth-child(1)"), /받을 수 있어요/);
    assert.match(await page.textContent(".claims li:nth-child(2)"), /GREAT 완성 시 가능/);
    // 직원 확인 2단계: 취소하면 기록 안 됨, 수령 처리하면 기록
    await page.click(".claims li:nth-child(1) >> text=직원용: 수령 확인");
    await page.click("text=취소");
    assert.match(await page.textContent(".claims li:nth-child(1)"), /받을 수 있어요/);
    await page.click(".claims li:nth-child(1) >> text=직원용: 수령 확인");
    await page.click("text=수령 처리");
    assert.match(await page.textContent(".claims li:nth-child(1)"), /수령 완료/);
    assert.equal(await page.locator(".claims li:nth-child(1) button").count(), 0);

    // 이미 푼 연구실을 다시 찍으면 문제 없이 글자만 보여 줌
    await page.goto(BASE + "?lab=curie");
    assert.equal(await page.locator(".choices").count(), 0);
    assert.match(await page.textContent(".reward"), /이미 찾은 코드/);

    // 나머지를 뒤섞인 순서로
    for (const id of ["johnson", "jang", "newton", "kepler"]) {
      await page.goto(BASE + "?lab=" + id);
      await choice(ANSWERS[id]).click();
    }
    assert.equal(await slotsText(), "GREAT");
    assert.match(await page.textContent(".reward"), /5개의 코드를 모두 모았어요/);

    // 완성 화면 + 뽑기 수령, 새로고침해도 유지
    await page.goto(BASE);
    assert.equal(await page.locator(".complete .code").textContent(), "GREAT");
    await page.click(".claims li:nth-child(2) >> text=직원용: 수령 확인");
    await page.click("text=수령 처리");
    await page.reload();
    assert.match(await page.textContent(".claims li:nth-child(2)"), /수령 완료/);
    assert.match(await page.textContent(".claims li:nth-child(1)"), /수령 완료/);

    // 시계가 움직인다
    const t1 = await page.textContent("#clock-text");
    await page.waitForTimeout(1100);
    assert.notEqual(await page.textContent("#clock-text"), t1);

    // 잘못된 연구실 주소
    await page.goto(BASE + "?lab=nobody");
    assert.match(await page.textContent("#view"), /연구실을 찾을 수 없어요/);

    // 휴대폰 폭에서 가로 스크롤 없음
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
  } finally {
    await browser.close();
  }
});
