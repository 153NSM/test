"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { readHtml } = require("./load-core");

const html = readHtml();
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];

test("외부 주소를 불러오지 않는다 (라이브러리·글꼴·분석 도구 없음)", () => {
  assert.doesNotMatch(html, /https?:\/\//i);
  assert.doesNotMatch(html, /(^|[\s"'(=])\/\/[a-z0-9.-]+\.[a-z]{2,}/i, "프로토콜 생략 주소");
  assert.doesNotMatch(html, /@import|@font-face|url\(/i);
  for (const [, attrs] of scripts) assert.doesNotMatch(attrs, /\bsrc\s*=/i, "외부 스크립트");
  assert.doesNotMatch(html, /<link\b(?![^>]*rel="icon"[^>]*href="data:,")[^>]*>/i, "data: 아이콘 말고는 <link> 없음");
  assert.doesNotMatch(html, /<(iframe|img|object|embed|form)\b/i);
});

test("데이터를 보내거나 저장하는 API를 쓰지 않는다", () => {
  const code = scripts.map((m) => m[2]).join("\n");
  for (const api of ["fetch", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "localStorage", "sessionStorage", "indexedDB", "document.cookie", "caches", "serviceWorker", "postMessage", "window.open", "location"]) {
    assert.ok(!code.includes(api), `${api} 사용 금지`);
  }
});

test("CSP로 외부 연결과 폼 전송을 막는다", () => {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, "CSP 메타 태그");
  const csp = m[1];
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /base-uri 'none'/);
  assert.doesNotMatch(csp, /connect-src|https?:|\*/);
});

test("결과 표 머리글은 문항 / 유효 응답 / 평균 / 빈 응답 / 제외", () => {
  const thead = html.match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const heads = [...thead.matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ["문항", "유효 응답", "평균", "빈 응답", "제외"]);
});

test("결과는 textContent로만 그린다 (붙여넣은 글을 HTML로 해석하지 않음)", () => {
  const code = scripts.map((m) => m[2]).join("\n");
  assert.doesNotMatch(code, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
});
