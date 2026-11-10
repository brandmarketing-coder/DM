---
name: dm-add-product
description: 沙龍 DM 編輯器上架新產品（新增商品圖、文案、價格、英波翻譯）。使用者提供新品名稱、介紹、用途、建議售價或產品圖，要求加入 DM 編輯器商品清單時使用。
---

# DM 編輯器：新增產品流程

repo 根目錄：`C:\Users\oright\Desktop\沙龍\DM`

## 1. 產品圖

1. 檔名：`品名+容量.webp`（亦接受 `.png` / `.jpg`），例：`豐盈彈韌精華油70mL.webp`。
2. 放置：PRO 系列放 `產品圖片/PRO系列/`；Salon USE 系列放 `產品圖片/Salon USE系列/`。
3. 與同資料夾既有產品圖比對留白；新圖為滿版貼邊時，先補透明留白至與既有圖一致。

## 2. 文案 CSV

1. 檔案：PRO 系列寫 `產品文案/PRO.csv`；Salon USE 系列寫 `產品文案/Salon.csv`。
2. 欄位：`官網名稱,介紹,用途,建議售價,圖片連結`（圖片連結可空）。
3. `官網名稱` 必須是圖檔檔名（去副檔名）的子字串；多筆符合時取最長者。新品要套用專屬文案時，`官網名稱` 設為與檔名完全相同。
4. `建議售價` 格式：`容量/TWD金額`，多容量以換行分隔，例：`70mL/TWD1500`。
5. 於檔案最後附加新列，不重排、不改動既有列。
6. 以 Node 腳本寫入（UTF-8；欄位含逗號、雙引號或換行時加雙引號包覆，內部雙引號重複為 `""`）。

## 3. 產生資料檔

1. 執行 `node tools/build-copy.mjs`。
   - 輸出 `Coding/products.js`、`Coding/product-copy.js`，並更新 `index.html` 資料檔 `?v=`。
   - 確認輸出為「✓ 全部圖片都對應到文案」。
2. 執行 `node tools/build-names.mjs`。
   - 輸出 `Coding/names-en.js`（國際部官方英文品名，key = 商品 id）。
   - 確認新品 id 出現在比對結果；未比對到者，英文品名改由 `i18n.js` 提供。

## 4. 英文／波蘭文翻譯

1. 於 `Coding/i18n.js` 的 `window.PRODUCT_I18N` 末端加一筆，key = 該商品的 `copyKey`（見 `products.js`）。
2. 欄位：`name_en`、`name_pl`、`intro_en`、`intro_pl`、`usage_en`、`usage_pl`。
3. 顯示規則：
   - 英文品名：優先 `names-en.js`，無則 `name_en`。
   - 波蘭文品名：`name_pl` + 容量後綴（`商品名稱` 去掉 `copyKey` 的剩餘部分）。`copyKey` 等於完整商品名稱時，`name_pl` 自行包含容量。
   - 介紹、用途：`intro_xx`、`usage_xx`；欄位不存在時顯示中文。
4. 用途原文有換行時，譯文保留相同換行（`\n`）。
5. 介紹與既有同系列產品相同時，沿用該產品既有譯文。

## 5. 驗證

以 Node 載入四個資料檔（`global.window = {}` 後依序 require `products.js`、`product-copy.js`、`i18n.js`、`names-en.js`），確認：

1. `PRODUCTS` 有新品，`copyKey`、`orig`（售價）、`img` 正確。
2. `PRODUCT_COPY[copyKey]` 的介紹、用途、價格正確。
3. 依 `index.html` 的 `prodName()` / `getCopy()` 邏輯，新品在 zh / en / pl 三語的品名、介紹、用途皆正確。
4. `index.html` 四個資料檔（products / product-copy / i18n / names-en）的 `?v=` 版本號一致。

## 6. 提交

`git add -A` → `git commit` → `git push origin main`。
