"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { loadCore } = require("./load-core");

const { parseTSV, classifyCell, formatAverage, aggregate } = loadCore();

// vm 안에서 만든 객체를 일반 객체로 바꿔 deepEqual 비교를 쉽게 한다.
const plain = (v) => JSON.parse(JSON.stringify(v));
const row = (name, valid, average, blank, excluded) => ({ name, valid, average, blank, excluded });
const table = (text) => plain(aggregate(text).questions).map((q) => row(q.name, q.valid, q.average, q.blank, q.excluded));

test("칸 판정: 앞뒤 공백을 지운 1~5는 유효", () => {
  for (const v of ["1", "2", "3", "4", "5", " 3 ", "\t4", "5  ", " 2 "]) {
    assert.deepEqual(plain(classifyCell(v)), { kind: "valid", value: Number(v.trim()) }, JSON.stringify(v));
  }
});

test("칸 판정: 비었거나 공백만 있으면 빈 응답", () => {
  for (const v of ["", " ", "   ", "\t", " ", "　", undefined]) {
    assert.equal(classifyCell(v).kind, "blank", JSON.stringify(v));
  }
});

test("칸 판정: 그 밖의 값은 제외", () => {
  for (const v of ["0", "6", "10", "3.0", "03", "+3", "-1", "１", "３", "3점", "예", "N/A", "1 2", "x"]) {
    assert.equal(classifyCell(v).kind, "excluded", JSON.stringify(v));
  }
});

test("평균: 소수 셋째 자리에서 반올림해 둘째 자리까지", () => {
  assert.equal(formatAverage(9, 3), "3.00");
  assert.equal(formatAverage(8, 3), "2.67"); // 2.6666…
  assert.equal(formatAverage(7, 3), "2.33"); // 2.3333…
  assert.equal(formatAverage(5, 2), "2.50");
  assert.equal(formatAverage(1, 1), "1.00");
  assert.equal(formatAverage(25, 5), "5.00");
  // 정확히 …5에서 끊기는 경우는 올림 (2.125 → 2.13, 1.005 → 1.01)
  assert.equal(formatAverage(17, 8), "2.13");
  assert.equal(formatAverage(201, 200), "1.01");
  assert.equal(formatAverage(2001, 2000), "1.00"); // 1.0005 → 1.00
  assert.equal(formatAverage(1999, 400), "5.00"); // 4.9975 → 5.00
  assert.equal(formatAverage(1997, 400), "4.99"); // 4.9925 → 4.99
});

test("평균: 유효가 0이면 -", () => {
  assert.equal(formatAverage(0, 0), "-");
});

test("parseTSV: 탭·줄바꿈 구분, CRLF·LF·CR 모두 처리", () => {
  assert.deepEqual(plain(parseTSV("a\tb\r\n1\t2\r\n")), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(plain(parseTSV("a\tb\n1\t2")), [["a", "b"], ["1", "2"]]);
  assert.deepEqual(plain(parseTSV("a\tb\r1\t2\r")), [["a", "b"], ["1", "2"]]);
});

test("parseTSV: 끝에 붙은 빈 줄은 버리고, 중간의 빈 칸은 유지", () => {
  assert.deepEqual(plain(parseTSV("a\tb\n1\t\n\n\n")), [["a", "b"], ["1", ""]]);
  assert.deepEqual(plain(parseTSV("a\tb\n\t\n")), [["a", "b"], ["", ""]]);
  assert.deepEqual(plain(parseTSV("")), []);
  assert.deepEqual(plain(parseTSV("\r\n\r\n")), []);
});

test("parseTSV: 엑셀이 큰따옴표로 감싼 칸(줄바꿈·탭·따옴표 포함)", () => {
  assert.deepEqual(plain(parseTSV('번호\t"문항\n하나"\t"따옴표 ""x"""\n1\t3\t4\n')), [
    ["번호", "문항\n하나", '따옴표 "x"'],
    ["1", "3", "4"],
  ]);
  assert.deepEqual(plain(parseTSV('a\t"b\tc"\n')), [["a", "b\tc"]]);
  // 감싼 꼴이 아니면 따옴표를 글자 그대로 둔다
  assert.deepEqual(plain(parseTSV('a\t"3"점\tx"y\n')), [["a", '"3"점', 'x"y']]);
});

test("집계: 기본 예시", () => {
  const text = [
    "응답번호\t만족도\t추천 의향\t재방문",
    "1\t5\t4\t3",
    "2\t4\t\t3",
    "3\t3\t모름\t",
    "4\t 5 \t2\t6",
  ].join("\r\n") + "\r\n";
  assert.deepEqual(table(text), [
    row("만족도", 4, "4.25", 0, 0),
    row("추천 의향", 2, "3.00", 1, 1),
    row("재방문", 2, "3.00", 1, 1),
  ]);
  assert.equal(aggregate(text).responseCount, 4);
});

test("집계: 첫 열(응답번호)은 값이 무엇이든 집계하지 않는다", () => {
  const text = "응답번호\tQ1\n3\t1\n\t2\n5\t\n";
  assert.deepEqual(table(text), [row("Q1", 2, "1.50", 1, 0)]);
});

test("집계: 칸이 모자란 줄은 모자란 칸을 빈 응답으로 센다", () => {
  const text = "번호\tQ1\tQ2\tQ3\n1\t5\n2\n3\t1\t2\t3\n";
  assert.deepEqual(table(text), [
    row("Q1", 2, "3.00", 1, 0),
    row("Q2", 1, "2.00", 2, 0),
    row("Q3", 1, "3.00", 2, 0),
  ]);
});

test("집계: 머리글보다 많은 칸은 무시한다", () => {
  const text = "번호\tQ1\n1\t2\t5\t5\n";
  assert.deepEqual(table(text), [row("Q1", 1, "2.00", 0, 0)]);
});

test("집계: 유효가 0인 문항은 평균 -", () => {
  const text = "번호\tQ1\tQ2\n1\t\t아니오\n2\t \t0\n";
  assert.deepEqual(table(text), [row("Q1", 0, "-", 2, 0), row("Q2", 0, "-", 0, 2)]);
});

test("집계: 응답 줄이 없으면 모든 수가 0", () => {
  assert.deepEqual(table("번호\tQ1\tQ2\n"), [row("Q1", 0, "-", 0, 0), row("Q2", 0, "-", 0, 0)]);
});

test("집계: 문항 이름은 앞뒤 공백을 지우고, 비면 열 번호로 표시", () => {
  const text = "번호\t  만족도 \t\tQ3\n1\t1\t2\t3\n";
  assert.deepEqual(plain(aggregate(text).questions).map((q) => q.name), ["만족도", "(3열)", "Q3"]);
});

test("집계: 빈 입력과 문항 없는 머리글은 오류로 알린다", () => {
  assert.equal(aggregate("").error, "empty");
  assert.equal(aggregate("  \n").error, "no-questions");
  assert.equal(aggregate("응답번호\n1\n2\n").error, "no-questions");
  assert.equal(aggregate("번호\tQ1\n1\t1").error, null);
});

test("집계: 3분의 1 같은 평균도 부동소수점 오차 없이 반올림", () => {
  // 1.005 같은 값은 (1.005).toFixed(2) === "1.00" 처럼 틀리기 쉽다.
  const lines = ["번호\tQ1"];
  for (let i = 0; i < 199; i++) lines.push(`${i + 1}\t1`);
  lines.push("200\t2"); // 합 201 / 200 = 1.005 → 1.01
  assert.deepEqual(table(lines.join("\n")), [row("Q1", 200, "1.01", 0, 0)]);
});
