---
name: dm-add-background
description: 沙龍 DM 編輯器新增底圖（橫式或直式滿版底圖、選單縮圖、內容區座標）。使用者提供新底圖設計稿，要求加入 DM 編輯器底圖選單時使用。
---

# DM 編輯器：新增底圖流程

repo 根目錄：`C:\Users\oright\Desktop\沙龍\DM`。底圖無 build 工具，全部於 `Coding/index.html` 設定。

## 1. 決定代號

- 橫式：`h` + 流水號（既有 h1～h4），例：`h5`。
- 直式滿版：`p` + 流水號（既有 p2、p3），例：`p4`。
- 以下以 `h5`、選單名稱「秋季橫式」表示新底圖。

## 2. 圖檔（依方向放 `沙龍DM公版/直式/` 或 `沙龍DM公版/橫式/`）

檔名＝編輯器選單上顯示的名稱，不含空格（選單「橫式 1」→ `橫式1.jpg`）。

1. 底圖本體：滿版 A4 設計圖，保留白色內容區。橫式約 3508×2480、直式約 2480×3508。
   例：`沙龍DM公版/橫式/秋季橫式.jpg`。
2. 選單縮圖：約 10KB 縮小圖，與底圖同名，放同方向的 `縮圖/` 子資料夾。
   例：`沙龍DM公版/橫式/縮圖/秋季橫式.jpg`。

## 3. 量測內容區座標

於預覽頁（以 DM 資料夾為根，開啟 `/Coding/`）執行：

```js
(async () => {
  const img = new Image();
  img.src = '../沙龍DM公版/橫式/秋季橫式.jpg';
  await new Promise(r => { img.onload = r; img.onerror = r; });
  const W = 200, H = Math.round(200 * img.naturalHeight / img.naturalWidth);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, W, H);
  const d = ctx.getImageData(0, 0, W, H).data;
  const white = (x, y) => { const i = (y * W + x) * 4; return d[i] > 238 && d[i+1] > 238 && d[i+2] > 238; };
  const colW = x => { let n = 0; for (let y = 0; y < H; y++) if (white(x, y)) n++; return n / H; };
  const rowW = y => { let n = 0; for (let x = 0; x < W; x++) if (white(x, y)) n++; return n / W; };
  let l = 0, r = W - 1, t = 0, b = H - 1;
  while (l < W && colW(l) < 0.5) l++;
  while (r > 0 && colW(r) < 0.5) r--;
  while (t < H && rowW(t) < 0.5) t++;
  while (b > 0 && rowW(b) < 0.5) b--;
  const pct = v => (v * 100).toFixed(1) + '%';
  return { left: pct(l / W), top: pct(t / H), right: pct((W - 1 - r) / W), bottom: pct((H - 1 - b) / H) };
})()
```

將結果各邊往內收約 1～3%，作為 `LAND_POS` 數值。

## 4. `Coding/index.html` 設定

1. `LAND_BG` 物件加一筆：`h5: '../沙龍DM公版/橫式/秋季橫式.jpg'`
2. `LAND_POS` 物件加一筆：`h5: { left: '..%', top: '..%', right: '..%', bottom: '..%' }`
3. `BG_LIST` 陣列加一筆（陣列順序＝選單顯示順序）：`{ id: 'h5', orient: 'l', thumb: '橫式/縮圖/秋季橫式.jpg', label: 'bgH5' }`
   - `thumb`：相對於 `沙龍DM公版/`（`BG_DIR`）的路徑。
   - `orient`：橫式 `'l'`、直式 `'p'`（決定選單分組、A4 尺寸與匯出方向）。
4. `isFeatureTwo()` 的陣列：兩格版用「單品放大＋描述」樣式則加入 `'h5'`；用「主商品＋贈品」樣式則不加。
5. `UI` 物件的 `zh` / `en` / `pl` 三區各加 `bgH5: '...'`。

## 5. 選配

- 停用四格：`setBg()` 的 `noFour` 條件加入該代號。
- 版面微調：新增 `#dm-sheet.bg-h5 { ... }` CSS 規則。

## 6. 驗證

1. 預覽頁切換到新底圖：電腦版確認對應分組下拉出現該選項、滑鼠移入有浮動預覽；觸控版（手機尺寸）確認對應分組列出現該卡片。
2. 四格／兩格／一格 × zh／en／pl，逐一檢查內容區元素 `scrollHeight - clientHeight` 與 `scrollWidth - clientWidth` 為 0（不溢出）。
3. 匯出 JPG／PDF，確認尺寸與方向正確（橫式 1684×1190、直式 1190×1684）。
4. 手機寬度（≤700px）檢查選單與預覽。

## 7. 提交

`git add -A` → `git commit` → `git push origin main`。
