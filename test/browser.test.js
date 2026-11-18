"use strict";
// 실제 브라우저에서 붙여넣기 → 결과 표를 확인한다. Playwright가 없으면 건너뛴다.
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

let chromium = null;
try { ({ chromium } = require("playwright")); } catch { /* 없으면 건너뜀 */ }

test("브라우저: 붙여넣으면 결과 표가 나오고 외부 요청이 없다", { skip: chromium ? false : "playwright 없음" }, async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const requests = [];
    page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) requests.push(r.url()); });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, "..", "index.html")).href);

    await page.locator("#input").focus();
    await page.evaluate(() => {
      // 붙여넣기처럼 값을 넣고 input 이벤트를 띄운다.
      const el = document.getElementById("input");
      el.value = "응답번호\t<b>Q1</b>\tQ2\r\n1\t5\t\r\n2\t4\t예\r\n3\r\n";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const rows = await page.$$eval("#result-body tr", (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent)));
    assert.deepEqual(rows, [
      ["<b>Q1</b>", "2", "4.50", "1", "0"],
      ["Q2", "0", "-", "2", "1"],
    ]);
    assert.equal(await page.locator("#result").isVisible(), true);
    assert.equal(await page.textContent("#status"), "응답 3줄 · 문항 2개");

    await page.click("#clear");
    assert.equal(await page.locator("#result").isVisible(), false);

    await page.click("#sample");
    assert.equal(await page.locator("#result-body tr").count(), 3);

    assert.deepEqual(errors, []);
    assert.deepEqual(requests, []);
  } finally {
    await browser.close();
  }
});
