"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readWscHtml } = require("./wsc-load");

const html = readWscHtml();
const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test("스탬프 미션: 외부 주소를 불러오지 않는다", () => {
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /@import|@font-face|url\(/i);
  assert.doesNotMatch(html, /<(iframe|img|object|embed|form)\b/i);
});

test("스탬프 미션: 데이터를 보내는 API를 쓰지 않고, 화면은 textContent로만 그린다", () => {
  for (const api of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "document.cookie", "indexedDB", "serviceWorker"]) {
    assert.ok(!code.includes(api), `${api} 사용 금지`);
  }
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
});

test("스탬프 미션: CSP로 외부 연결과 폼 전송을 막는다", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m);
  assert.match(m[1], /default-src 'none'/);
  assert.match(m[1], /form-action 'none'/);
  assert.doesNotMatch(m[1], /connect-src|https?:|\*/);
});

test("스탬프 미션: 정답 번호가 소스에 평문으로 남지 않는다", () => {
  assert.doesNotMatch(code, /\banswer\s*:/);
  assert.doesNotMatch(code, /correct/i);
});
