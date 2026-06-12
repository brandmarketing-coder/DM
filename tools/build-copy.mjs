#!/usr/bin/env node
/*
 * build-copy.mjs — 由「產品文案 CSV」+「產品圖片資料夾」產生 DM 編輯器的資料檔
 *
 * 產生兩個檔（皆放在 Coding/，由 index.html 以 <script> 載入）：
 *   1) product-copy.js  → window.PRODUCT_COPY[官網名稱] = { intro, usage, price, orig, series }
 *   2) products.js      → window.PRODUCTS = [ { id, name, series, copyKey, img }, ... ]
 *
 * 規則：
 *   - 每個圖片檔 = 一個項目；名稱 = 圖片檔名（去副檔名），系列依資料夾（PRO系列／Salon USE系列）。
 *   - copyKey：以 CSV 的「官網名稱」去比對圖片檔名（取最長且為檔名子字串者），用來帶入文案／價格。
 *   - 原價 orig：自「建議售價」取第一個 TWD 數字；無 TWD（如 2000mL 或空白）則為空。
 *
 * 維護：沙龍部門更新 產品文案/PRO.csv、Salon.csv（請存成 UTF-8），或增減 產品圖片/ 內的圖檔後，
 *       執行： node tools/build-copy.mjs    即可重新產生上述兩個檔，無需手改 index.html。
 *
 * 零依賴（僅用 Node 內建模組）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const copyDir = path.join(repoRoot, '產品文案');
const imgRoot = path.join(repoRoot, '產品圖片');
const outCopy = path.join(repoRoot, 'Coding', 'product-copy.js');
const outProducts = path.join(repoRoot, 'Coding', 'products.js');

/* ── 極簡 CSV 解析（支援雙引號內含逗號／換行、"" 跳脫） ── */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const clean = s => (s || '').replace(/\r\n?/g, '\n').replace(/　/g, ' ').trim();
const parseOrig = p => { const m = (p || '').match(/TWD\s*([\d,]+)/i); return m ? m[1].replace(/,/g, '') : ''; };

/* 依「該 SKU 容量」自建議售價取對應價格（無容量或找不到 → 取第一個 TWD；皆無 → 空） */
const sizeOf = name => { const m = (name || '').match(/(\d+)\s*mL/i); return m ? m[1] : ''; };
function origForSize(name, priceStr) {
  if (!priceStr) return '';
  const size = sizeOf(name);
  if (size) {
    const m = priceStr.match(new RegExp('(?:^|\\n)\\s*' + size + '\\s*mL\\s*/\\s*TWD\\s*([\\d,]+)', 'i'));
    if (m) return m[1].replace(/,/g, '');
  }
  return parseOrig(priceStr);
}

/* ── 讀 CSV → 文案 map（key = 官網名稱） ── */
function loadCopy(file, series) {
  const rows = parseCSV(fs.readFileSync(path.join(copyDir, file), 'utf8'));
  const map = {};
  for (let r = 1; r < rows.length; r++) {       // 跳過標題列
    const [name, intro, usage, price] = rows[r];
    const key = clean(name);
    if (!key) continue;                          // 略過空白列
    map[key] = { intro: clean(intro), usage: clean(usage), price: clean(price), orig: parseOrig(price), series };
  }
  return map;
}

const copy = { ...loadCopy('PRO.csv', 'PRO'), ...loadCopy('Salon.csv', 'Salon USE') };
const copyKeys = Object.keys(copy);

/* ── 比對圖片檔名 → 官網名稱（取最長且為檔名子字串者） ── */
const norm = s => s.replace(/\s/g, '');
function matchKey(nameNoExt) {
  const fn = norm(nameNoExt);
  let best = '';
  for (const k of copyKeys) {
    const nk = norm(k);
    if (fn.includes(nk) && nk.length > norm(best).length) best = k;
  }
  return best;
}

/* ── 掃描圖片資料夾 → PRODUCTS ── */
const FOLDERS = [
  { dir: 'PRO系列', series: 'PRO' },
  { dir: 'Salon USE系列', series: 'Salon USE' },
];
const IMG_RE = /\.(png|jpe?g)$/i;
const products = [];
const unmatched = [];
for (const { dir, series } of FOLDERS) {
  const full = path.join(imgRoot, dir);
  if (!fs.existsSync(full)) continue;
  const files = fs.readdirSync(full).filter(f => IMG_RE.test(f)).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  for (const f of files) {
    const nameNoExt = f.replace(IMG_RE, '');
    const copyKey = matchKey(nameNoExt);
    if (!copyKey) unmatched.push(`${dir}/${f}`);
    const orig = copyKey ? origForSize(nameNoExt, copy[copyKey].price) : '';
    products.push({ id: nameNoExt, name: nameNoExt, series, copyKey, orig, img: `../產品圖片/${dir}/${f}` });
  }
}

/* ── 輸出 ── */
const head = (title) => `/* eslint-disable */
/* ${title}
 * 自動產生，請勿手動編輯。來源：產品文案/PRO.csv、Salon.csv 與 產品圖片/
 * 重新產生：node tools/build-copy.mjs
 */
`;
fs.writeFileSync(outCopy, head('product-copy.js — 產品文案（key = 官網名稱）') + 'window.PRODUCT_COPY = ' + JSON.stringify(copy, null, 2) + ';\n', 'utf8');
fs.writeFileSync(outProducts, head('products.js — 商品清單（每個圖片檔一筆）') + 'window.PRODUCTS = ' + JSON.stringify(products, null, 2) + ';\n', 'utf8');

console.log(`✓ products.js：${products.length} 個項目（PRO ${products.filter(p=>p.series==='PRO').length} ／ Salon USE ${products.filter(p=>p.series==='Salon USE').length}）`);
console.log(`✓ product-copy.js：${copyKeys.length} 筆文案`);
if (unmatched.length) console.log(`⚠ 無對應文案的圖片（copyKey 留空）：\n  ${unmatched.join('\n  ')}`);
else console.log('✓ 全部圖片都對應到文案');
