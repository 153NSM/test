"use strict";
// wsc/index.html 안의 <script id="wsc-core"> 블록만 꺼내 DOM 없이 실행한다.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const htmlPath = path.join(__dirname, "..", "wsc", "index.html");

function readWscHtml() {
  return fs.readFileSync(htmlPath, "utf8");
}

function loadWscCore() {
  const m = readWscHtml().match(/<script id="wsc-core">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('wsc/index.html에 <script id="wsc-core"> 블록이 없습니다');
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(m[1] + "\n;this.WscCore = WscCore;", sandbox, { filename: "wsc-core" });
  return sandbox.WscCore;
}

module.exports = { loadWscCore, readWscHtml };
