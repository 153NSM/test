"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readWscHtml } = require("./wsc-load");

const html = readWscHtml();
const code = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join("\n");

test("스탬프 미션: 외부 주소를 불러오지 않는다", () => {
  // 인쇄한 QR이 가리키는 자기 주소(찍은 QR 확인용 글자)만 허용
  const urls = html.match(/https?:\/\/[^\s"'<>)]+/gi) || [];
  assert.deepEqual([...new Set(urls)], ["https://153nsm.github.io/test/wsc/"]);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(html, /@import|@font-face|[:\s,]url\(/);
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
  // 같은 폴더의 QR 판독기와 카메라 영상만 추가로 허용
  assert.match(m[1], /script-src 'self' 'unsafe-inline';/);
  assert.match(m[1], /media-src mediastream: blob:;/);
});

test("스탬프 미션: 모든 화면 맨 아래에 '카메라 켜기' 탭이 있다", () => {
  assert.match(html, /<nav class="tabbar"[\s\S]*?<button type="button" id="camera-btn">[\s\S]*?카메라 켜기[\s\S]*?<\/button>/);
});

test("스탬프 미션: 함께 싣는 QR 판독기(jsQR)는 네트워크·저장 API를 쓰지 않는다", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const dir = path.join(__dirname, "..", "wsc", "vendor");
  const js = fs.readFileSync(path.join(dir, "jsQR.js"), "utf8");
  for (const api of ["fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "localStorage", "document.cookie", "eval(", "new Function"]) {
    assert.ok(!js.includes(api), `jsQR에 ${api}`);
  }
  assert.ok(fs.existsSync(path.join(dir, "jsQR-LICENSE.txt")), "라이선스 파일");
});

test("스탬프 미션: 정답 번호가 소스에 평문으로 남지 않는다", () => {
  assert.doesNotMatch(code, /\banswer\s*:/);
  assert.doesNotMatch(code, /correct/i);
});
