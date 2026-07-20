#!/usr/bin/env node
/*
 * build-names.mjs — 由「產品文案/產品名中英文對照.xlsx」（國際部官方英文品名）
 * 產生 Coding/names-en.js（window.PRODUCT_NAMES_EN：商品 id → 官方英文品名）。
 *
 * 比對規則（中文品名，忽略空白/大小寫/全半形）：
 *   pass1：完全相同（含容量）
 *   pass2：去除表內裝飾字後相同（Re補充薄瓶、_PRO、沙龍用/執業前綴、(升級版) 等括號、_n支/-n入、羅馬數字前綴）
 *   pass3：雙方都去掉容量後相同（僅當兩邊皆唯一才採用，避免多容量商品誤配）
 *   OVERRIDES：無法自動比對的特例（如 極萃鎏金套盒 粗硬髮/細軟髮）
 * 官方英文名輸出時去掉開頭「*」與結尾「_SET OF n」（DM 上顯示單品）。
 *
 * 維護：國際部更新 xlsx 後執行 node tools/build-names.mjs 即可重新產生。零依賴。
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const xlsxPath = path.join(repoRoot, '產品文案', '產品名中英文對照.xlsx');
const imgRoot = path.join(repoRoot, '產品圖片');
const outFile = path.join(repoRoot, 'Coding', 'names-en.js');

/* ── 極簡 ZIP 讀取（xlsx = zip；只支援 stored/deflate，Excel 產出即此二種） ── */
function readZip(buf) {
  let i = buf.length - 22;
  while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
  if (i < 0) throw new Error('EOCD not found');
  const count = buf.readUInt16LE(i + 10);
  let p = buf.readUInt32LE(i + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const lNameLen = buf.readUInt16LE(localOff + 26);
    const lExtraLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(start, start + compSize);
    files[name] = method === 0 ? data : zlib.inflateRawSync(data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

/* ── xlsx 第一張工作表 → rows（{col: value}） ── */
function readSheet(files) {
  const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#10;/g, '\n');
  const ssXml = files['xl/sharedStrings.xml'] ? files['xl/sharedStrings.xml'].toString('utf8') : '';
  const strings = [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m =>
    unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join('')));
  const sheet = files['xl/worksheets/sheet1.xml'].toString('utf8');
  const rows = [];
  for (const rm of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {};
    for (const cm of rm[1].matchAll(/<c r="([A-Z]+)\d+"(?:[^>]*t="(\w+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>)?<\/c>/g)) {
      const [, col, type, v] = cm;
      cells[col] = (type === 's' && v != null) ? strings[Number(v)] : (v != null ? unesc(v) : undefined);
    }
    rows.push(cells);
  }
  return rows;
}

/* ── 中文名正規化與裝飾字去除 ── */
const normZh = s => (s || '')
  .replace(/（/g, '(').replace(/）/g, ')')
  .replace(/｜/g, '|').replace(/[’']/g, "'")
  .replace(/\s+/g, '')
  .toLowerCase();
const stripDecor = s => normZh(s)
  .replace(/\(.*?\)/g, '')
  .replace(/re補充薄瓶/g, '')
  .replace(/^沙龍用/, '').replace(/^執業/, '')
  .replace(/_pro$/, '')
  .replace(/[_\-/]\d+[支入].*$/, '')
  .replace(/^[ivxⅰⅱⅲⅳⅴ]+(?=[一-鿿])/, '');
const stripSize = s => s.replace(/\d+(?:\.\d+)?\s*m?l/gi, '');

/* 官方英文名輸出清理：去開頭 *、結尾 _SET OF n、多餘空白 */
const cleanEn = s => (s || '').trim().replace(/^\*/, '').replace(/_?SET OF \d+\s*$/i, '')
  .replace(/^([ⅠⅡⅢⅣⅤ])(?=\S)/, '$1 ').replace(/\s{2,}/g, ' ').trim();

/* 無法自動比對的特例（id → 官方英文名） */
const OVERRIDES = {
  '印加果｜極萃鎏金養護高訂喚活套盒': 'AURIC VITAL COLLECTION (FOR THICK HAIR)',   // 粗硬髮
  '海洋藤竹｜極萃鎏金養護高訂喚活套盒': 'AURIC VITAL COLLECTION (FOR FINE HAIR)',  // 細軟髮
};

/* ── 讀對照表 ── */
const zip = readZip(fs.readFileSync(xlsxPath));
const rows = readSheet(zip).filter(r => r.D && r.E);
const entries = rows.map(r => ({ zh: String(r.E), en: cleanEn(String(r.D)), code: r.C || '' })).filter(e => e.en && e.zh);

/* 三層索引：exact → stripped（不覆蓋 exact 已占用的 key）→ 去容量（唯一才收） */
const exact = new Map(), stripped = new Map(), sizeless = new Map(), sizelessDup = new Set();
for (const e of entries) {
  const k1 = normZh(e.zh);
  if (!exact.has(k1)) exact.set(k1, e);
  const k2 = stripDecor(e.zh);
  if (k2 && k2 !== k1 && !stripped.has(k2)) stripped.set(k2, e);
  const k3 = stripSize(stripDecor(e.zh));
  if (k3) { if (sizeless.has(k3) && sizeless.get(k3) !== e) sizelessDup.add(k3); else sizeless.set(k3, e); }
}

/* ── 掃商品（圖片檔名）並比對 ── */
const IMG_RE = /\.(png|jpe?g)$/i;
const products = [];
for (const dir of ['PRO系列', 'Salon USE系列']) {
  const full = path.join(imgRoot, dir);
  if (!fs.existsSync(full)) continue;
  for (const f of fs.readdirSync(full).filter(f => IMG_RE.test(f)).sort((a, b) => a.localeCompare(b, 'zh-Hant'))) {
    products.push(f.replace(IMG_RE, ''));
  }
}

const result = {}, report = [], unmatched = [];
for (const id of products) {
  if (OVERRIDES[id]) { result[id] = OVERRIDES[id]; report.push([id, OVERRIDES[id], 'override']); continue; }
  const k1 = normZh(id), k2 = stripDecor(id), k3 = stripSize(stripDecor(id));
  let hit = exact.get(k1) || stripped.get(k1) || exact.get(k2) || stripped.get(k2);
  let via = hit ? 'exact/stripped' : '';
  if (!hit && k3) {
    /* pass3：去容量後比對，商品側同名者需唯一；表側撞鍵（如同品名 2L 與 5L 並存）時
       退回「表側含裝飾字但無容量」的 stripped/exact 索引（如 /3入 列的 2L 品） */
    const same = products.filter(p => stripSize(stripDecor(p)) === k3);
    if (same.length === 1) {
      hit = (!sizelessDup.has(k3) ? sizeless.get(k3) : null) || stripped.get(k3) || exact.get(k3);
      if (hit) via = 'sizeless';
    }
  }
  if (hit) { result[id] = hit.en; report.push([id, hit.en, via + (hit.code ? ` (${hit.code})` : '')]); }
  else unmatched.push(id);
}

/* ── 輸出 ── */
const head = `/* eslint-disable */
/* names-en.js — 官方英文品名（國際部對照表；key = 商品 id）
 * 自動產生，請勿手動編輯。來源：產品文案/產品名中英文對照.xlsx
 * 重新產生：node tools/build-names.mjs
 */
`;
fs.writeFileSync(outFile, head + 'window.PRODUCT_NAMES_EN = ' + JSON.stringify(result, null, 2) + ';\n', 'utf8');

console.log(`✓ names-en.js：${Object.keys(result).length}/${products.length} 個商品對到官方英文名`);
for (const [id, en, via] of report) console.log(`  ${id} → ${en}  [${via}]`);
if (unmatched.length) console.log(`⚠ 對照表查無官方英文名（沿用 i18n.js 翻譯）：\n  ${unmatched.join('\n  ')}`);
