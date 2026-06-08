#!/usr/bin/env node
/*
 * build-copy.mjs — 從沙龍部門的 Excel 產生 Coding/product-copy.js
 *
 * 用途：
 *   沙龍部門更新「產品文案/產品文字彙整.xlsx」後，執行本程式即可
 *   重新產生 DM 編輯器使用的文案資料，無需手動改 index.html。
 *
 * 執行（需安裝 Node.js）：
 *   node tools/build-copy.mjs
 *
 * 來源 Excel 欄位（兩個工作表 PRO / SALON USE，第一列為標題）：
 *   A 官網名稱 | B 介紹 | C 用途 | D 建議售價
 *
 * 產生檔：Coding/product-copy.js  （以「官網名稱」為 key）
 *
 * 本程式不依賴任何 npm 套件，自行解析 .xlsx（zip + XML）。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const xlsxPath = process.argv[2] || path.join(repoRoot, '產品文案', '產品文字彙整.xlsx');
const outPath = path.join(repoRoot, 'Coding', 'product-copy.js');

/* ── 極簡 ZIP 讀取（透過中央目錄，零依賴） ── */
function readZipEntries(buf) {
  // 找 End Of Central Directory (EOCD) 簽章 0x06054b50
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 .xlsx（找不到 ZIP 中央目錄）');
  const cdOffset = buf.readUInt32LE(eocd + 16);
  const cdCount = buf.readUInt16LE(eocd + 10);

  const entries = {};
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    // 讀本地檔頭以取得資料起點
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = buf.subarray(dataStart, dataStart + compSize);
    entries[name] = method === 0 ? raw : zlib.inflateRawSync(raw);

    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const decodeXml = s => (s || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&amp;/g, '&');

function parseSharedStrings(xml) {
  if (!xml) return [];
  const out = [];
  for (const m of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    let s = '';
    for (const t of m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) s += t[1];
    out.push(decodeXml(s));
  }
  return out;
}

const colToNum = col => { let n = 0; for (const c of col) n = n * 26 + (c.charCodeAt(0) - 64); return n; };

function parseSheet(xml, shared) {
  const rows = {};
  const cRe = /<c\s+r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let c;
  while ((c = cRe.exec(xml))) {
    const col = colToNum(c[1]);
    const row = parseInt(c[2], 10);
    const attrs = c[3] || '';
    const body = c[4] || '';
    const t = (attrs.match(/t="([^"]+)"/) || [])[1] || 'n';
    let val = '';
    const v = body.match(/<v>([\s\S]*?)<\/v>/);
    if (t === 's' && v) val = shared[parseInt(v[1], 10)] || '';
    else if (t === 'inlineStr') { const im = body.match(/<t[^>]*>([\s\S]*?)<\/t>/); val = im ? decodeXml(im[1]) : ''; }
    else if (v) val = decodeXml(v[1]);
    (rows[row] = rows[row] || {})[col] = val;
  }
  return rows;
}

/* 規整文字：CRLF→\n、去除前後空白 */
const clean = s => (s || '').replace(/\r\n?/g, '\n').replace(/ /g, ' ').trim();

/* 從「建議售價」抽出第一個 TWD 數字作為原價；沒有 TWD 則回空字串 */
function parseOrig(priceStr) {
  const m = (priceStr || '').match(/TWD\s*([\d,]+)/i);
  return m ? m[1].replace(/,/g, '') : '';
}

/* ── 主流程 ── */
const buf = fs.readFileSync(xlsxPath);
const entries = readZipEntries(buf);
const shared = parseSharedStrings(entries['xl/sharedStrings.xml']?.toString('utf8'));

// 依 workbook 順序取得工作表名稱與對應檔案
const wb = entries['xl/workbook.xml'].toString('utf8');
const rels = entries['xl/_rels/workbook.xml.rels'].toString('utf8');
const relMap = {};
for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) relMap[m[1]] = m[2];
const sheetFiles = [];
for (const m of wb.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)) {
  const target = relMap[m[2]] || '';
  sheetFiles.push({ name: m[1], file: 'xl/' + target.replace(/^\/?xl\//, '') });
}

const copy = {};
let count = 0;
for (const { name, file } of sheetFiles) {
  const xml = entries[file]?.toString('utf8');
  if (!xml) continue;
  const rows = parseSheet(xml, shared);
  const rowNums = Object.keys(rows).map(Number).sort((a, b) => a - b);
  for (const r of rowNums) {
    if (r === 1) continue; // 標題列
    const cells = rows[r];
    const key = clean(cells[1]);            // A 官網名稱
    if (!key) continue;
    const intro = clean(cells[2]);          // B 介紹
    const usage = clean(cells[3]);          // C 用途
    const price = clean(cells[4]);          // D 建議售價
    copy[key] = { intro, usage, price, orig: parseOrig(price), sheet: name };
    count++;
  }
}

const header = `/* eslint-disable */
/*
 * product-copy.js — 自動產生，請勿手動編輯
 * 來源：產品文案/產品文字彙整.xlsx
 * 重新產生：node tools/build-copy.mjs
 *
 * 結構：window.PRODUCT_COPY[官網名稱] = {
 *   intro: 介紹（DM 標題用）,
 *   usage: 用途（一格版面說明用）,
 *   price: 建議售價原字串,
 *   orig:  原價（從建議售價解析的第一個 TWD 數字，無則為空）,
 *   sheet: 來源工作表（PRO / SALON USE）
 * }
 */
`;

const body = 'window.PRODUCT_COPY = ' + JSON.stringify(copy, null, 2) + ';\n';
fs.writeFileSync(outPath, header + body, 'utf8');
console.log(`✓ 已寫入 ${path.relative(repoRoot, outPath)}（${count} 筆產品文案，來自 ${sheetFiles.map(s => s.name).join(' / ')}）`);
