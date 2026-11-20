"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadWscCore } = require("./wsc-load");

const W = loadWscCore();
const plain = (v) => JSON.parse(JSON.stringify(v));
// PDF에 실린 정답 (0부터 센 번호)
const ANSWERS = { jang: 0, kepler: 1, newton: 1, curie: 3, johnson: 2 };
const T0 = Date.UTC(2026, 11, 25, 5, 0, 0);

test("연구실 5곳과 글자가 GREAT 순서로 하나씩 배정된다", () => {
  assert.equal(W.LABS.length, 5);
  assert.equal(W.LABS.map((l) => l.letter).join(""), W.CODE);
  assert.equal(W.CODE, "GREAT");
  assert.deepEqual(plain(W.LABS.map((l) => l.id)), ["jang", "kepler", "newton", "curie", "johnson"]);
  assert.equal(new Set(W.LABS.map((l) => l.id)).size, 5);
});

test("각 연구실의 정답 하나만 맞고 나머지 보기는 모두 틀린다", () => {
  for (const lab of W.LABS) {
    lab.choices.forEach((_, i) => {
      assert.equal(W.checkAnswer(lab.id, i), i === ANSWERS[lab.id], `${lab.id} 보기 ${i + 1}`);
    });
  }
});

test("정답 확인: 없는 연구실·잘못된 입력은 틀림", () => {
  assert.equal(W.checkAnswer("nobody", 0), false);
  assert.equal(W.checkAnswer("jang", "0"), false);
  assert.equal(W.checkAnswer("jang", -1), false);
  assert.equal(W.checkAnswer("jang", 99), false);
  assert.equal(W.checkAnswer("jang"), false);
});

test("정답은 소스에 그대로 적혀 있지 않다 (해시만 있음)", () => {
  for (const lab of W.LABS) {
    assert.equal(lab.answer, undefined);
    assert.match(lab.answerHash, /^[0-9a-f]{8}$/);
  }
});

test("해시: UTF-8 기준 FNV-1a", () => {
  assert.equal(W.hash(""), "811c9dc5");
  assert.equal(W.hash("a"), "e40c292c");
  assert.equal(W.hash("가"), W.hash("가")); // 결정적
});

test("글자 모으기: 아무 순서로나 모을 수 있고, 다시 맞혀도 처음 시각을 유지", () => {
  let p = W.emptyProgress();
  assert.deepEqual(plain(W.slots(p)), [null, null, null, null, null]);
  p = W.collect(p, "curie", T0);
  p = W.collect(p, "jang", T0 + 1000);
  assert.deepEqual(plain(W.slots(p)), ["G", null, null, "A", null]);
  assert.equal(W.foundCount(p), 2);
  const again = W.collect(p, "curie", T0 + 5000);
  assert.equal(again.found.curie, T0);
  assert.equal(W.foundCount(again), 2);
  assert.equal(W.isComplete(p), false);
  assert.equal(p.completedAt, null);
});

test("글자 모으기: 원래 진행 상황은 바꾸지 않는다", () => {
  const p = W.emptyProgress();
  W.collect(p, "jang", T0);
  assert.equal(W.foundCount(p), 0);
});

test("글자 모으기: 없는 연구실은 무시", () => {
  const p = W.collect(W.emptyProgress(), "nobody", T0);
  assert.equal(W.foundCount(p), 0);
});

test("5곳을 모두 맞히면 GREAT 완성, 완성 시각은 마지막 글자 시각", () => {
  let p = W.emptyProgress();
  ["johnson", "newton", "jang", "kepler", "curie"].forEach((id, i) => { p = W.collect(p, id, T0 + i * 60000); });
  assert.equal(W.isComplete(p), true);
  assert.equal(W.slots(p).join(""), "GREAT");
  assert.equal(p.completedAt, T0 + 4 * 60000);
});

test("안내데스크: 글자 1개 이상이면 달력, GREAT 완성이면 뽑기, 각각 한 번만", () => {
  let p = W.emptyProgress();
  assert.equal(W.canClaim(p, "calendar"), false);
  assert.equal(W.canClaim(p, "draw"), false);
  p = W.claim(p, "calendar", T0);
  assert.equal(p.claims.calendar, null, "글자가 없으면 달력 기록 안 됨");

  p = W.collect(p, "kepler", T0);
  assert.equal(W.canClaim(p, "calendar"), true);
  assert.equal(W.canClaim(p, "draw"), false);
  p = W.claim(p, "draw", T0);
  assert.equal(p.claims.draw, null, "완성 전에는 뽑기 기록 안 됨");
  p = W.claim(p, "calendar", T0 + 1);
  assert.equal(p.claims.calendar, T0 + 1);
  assert.equal(W.canClaim(p, "calendar"), false);
  p = W.claim(p, "calendar", T0 + 2);
  assert.equal(p.claims.calendar, T0 + 1, "두 번째 기록은 무시");

  for (const id of ["jang", "newton", "curie", "johnson"]) p = W.collect(p, id, T0 + 10);
  assert.equal(W.canClaim(p, "draw"), true);
  p = W.claim(p, "draw", T0 + 20);
  assert.equal(p.claims.draw, T0 + 20);
  assert.equal(W.canClaim(p, "draw"), false);
  assert.equal(W.canClaim(p, "unknown"), false);
});

test("저장·읽기: 그대로 되살아난다", () => {
  let p = W.emptyProgress();
  p = W.collect(p, "jang", T0);
  p = W.claim(p, "calendar", T0 + 5);
  const back = W.parseProgress(W.serialize(p));
  assert.deepEqual(plain(back), plain(p));
});

test("저장·읽기: 깨졌거나 이상한 값은 버린다", () => {
  const empty = plain(W.emptyProgress());
  for (const bad of [null, "", "{", "[]", "123", '{"v":2,"found":{"jang":1}}', '"text"']) {
    assert.deepEqual(plain(W.parseProgress(bad)), empty, String(bad));
  }
  const p = W.parseProgress(JSON.stringify({
    v: 1,
    found: { jang: T0, kepler: "x", hacker: T0, newton: -1, curie: Infinity },
    completedAt: T0,
    claims: { calendar: T0, draw: T0 },
  }));
  assert.deepEqual(Object.keys(plain(p.found)), ["jang"]);
  assert.equal(p.completedAt, null, "완성 안 됐으면 완성 시각 없음");
  assert.equal(p.claims.calendar, T0);
  assert.equal(p.claims.draw, null, "완성 안 됐으면 뽑기 기록 없음");
});

test("저장·읽기: 완성 시각이 빠졌으면 마지막 글자 시각으로 채운다", () => {
  const found = { jang: T0, kepler: T0 + 1, newton: T0 + 9, curie: T0 + 2, johnson: T0 + 3 };
  const p = W.parseProgress(JSON.stringify({ v: 1, found }));
  assert.equal(p.completedAt, T0 + 9);
});

test("시각 표시", () => {
  const d = new Date(2026, 11, 25, 9, 5, 7).getTime();
  assert.equal(W.formatTime(d), "12월 25일 09:05");
  assert.equal(W.formatTime(d, true), "12월 25일 09:05:07");
});

test("찍은 QR 해석: 인쇄한 미션 QR 주소", () => {
  const page = "https://153nsm.github.io/test/wsc/?lab=jang";
  const B = "https://153nsm.github.io/test/wsc/";
  assert.deepEqual(plain(W.parseScan(B + "?lab=kepler", page)), { type: "lab", id: "kepler" });
  assert.deepEqual(plain(W.parseScan(B, page)), { type: "home" });
  assert.deepEqual(plain(W.parseScan(B + "index.html?lab=curie", page)), { type: "lab", id: "curie" });
  assert.deepEqual(plain(W.parseScan("  " + B + "?lab=johnson\n", page)), { type: "lab", id: "johnson" });
  for (const lab of W.LABS) assert.equal(W.parseScan(B + "?lab=" + lab.id, page).id, lab.id);
});

test("찍은 QR 해석: 지금 페이지와 같은 폴더 주소도 받는다 (다른 곳에 올렸을 때)", () => {
  const page = "http://localhost:8000/wsc/index.html";
  assert.deepEqual(plain(W.parseScan("http://localhost:8000/wsc/?lab=newton", page)), { type: "lab", id: "newton" });
  assert.deepEqual(plain(W.parseScan("http://localhost:8000/wsc/index.html", page)), { type: "home" });
});

test("찍은 QR 해석: 미션과 상관없는 QR은 이동하지 않는다", () => {
  const page = "https://153nsm.github.io/test/wsc/";
  for (const bad of [
    "", "hello", "GREAT", "https://example.com/", "https://example.com/test/wsc/?lab=jang",
    "https://153nsm.github.io/test/", "https://153nsm.github.io/test/wsc/other.html?lab=jang",
    "https://153nsm.github.io/test/wsc/?lab=nobody", "http://153nsm.github.io/test/wsc/?lab=jang",
    "javascript:alert(1)", "https://153nsm.github.io.evil.com/test/wsc/?lab=jang", null,
  ]) {
    assert.equal(W.parseScan(bad, page).type, "other", String(bad));
  }
});
