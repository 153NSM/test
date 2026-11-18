"use strict";
// index.html 안의 <script id="survey-core"> 블록만 꺼내 DOM 없이 실행한다.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "..", "index.html");

function readHtml() {
  return fs.readFileSync(htmlPath, "utf8");
}

function loadCore() {
  const m = readHtml().match(/<script id="survey-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('index.html에 <script id="survey-core"> 블록이 없습니다');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + "\n;this.SurveyCore = SurveyCore;", sandbox, { filename: "survey-core" });
  return sandbox.SurveyCore;
}

module.exports = { loadCore, readHtml };
