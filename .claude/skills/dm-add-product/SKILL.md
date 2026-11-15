---
name: dm-add-product
description: 沙龍 DM 編輯器上架新產品或更新既有產品（商品圖、品名、介紹、用途、建議售價、英波翻譯、官方英文品名）。使用者提供產品資料或產品圖，要求加入或修改 DM 編輯器商品清單時使用。
---

# DM 編輯器：上架與更新產品

repo 根目錄：`C:\Users\oright\Desktop\沙龍\DM`

產品資料直接寫在 `Coding/` 的四個資料檔，沒有產生工具，也沒有來源表格：

| 檔案 | 內容 | key |
|---|---|---|
| `products.js` | `window.PRODUCTS`：商品清單，每個 SKU（含容量）一筆 | 陣列，無 key |
| `product-copy.js` | `window.PRODUCT_COPY`：介紹、用途、售價 | `copyKey`（官網名稱，不含容量） |
| `i18n.js` | `window.PRODUCT_I18N`：英文、波蘭文翻譯 | `copyKey` |
| `names-en.js` | `window.PRODUCT_NAMES_EN`：國際部官方英文品名 | 商品 `id` |

## 通則

- 只寫使用者提供的資料；使用者沒給的欄位留空字串，不自行編造。翻譯除外，見第 5 節。
- 資料檔與 `index.html` 不新增任何註解或說明文字。
- 以 Node 腳本讀寫資料檔（UTF-8），寫回時保持原本的格式：
  - `products.js`、`product-copy.js`、`names-en.js`：`window.變數名 = ` ＋ `JSON.stringify(資料, null, 2)` ＋ `;\n`。
  - `i18n.js`：每個 `copyKey` 一行，格式 `  "copyKey": { "name_en": "…", "name_pl": "…", "intro_en": "…", "intro_pl": "…", "usage_en": "…", "usage_pl": "…" },`；最後一筆不加逗號，檔尾為 `};\n`。
- 開工前讀取四個資料檔，確認是新品，還是既有產品的新容量或修改。

## 1. 產品圖

1. 檔名：`品名+容量.webp`，例：`豐盈彈韌精華油70mL.webp`。檔名去掉副檔名就是商品 `id`。
2. 放置：PRO 系列放 `產品圖片/PRO系列/`；Salon USE 系列放 `產品圖片/Salon USE系列/`。
3. 格式：一律 WebP，保留透明背景；高度上限 2200px。來源圖不是 WebP 時先轉檔。
4. 留白：與同資料夾既有產品圖比對；新圖為滿版貼邊時，先補透明留白至與既有圖一致。
5. 更換既有產品圖：用同一檔名覆蓋，並更新該筆 `img` 的版本號（見第 2 節第 1 點的 `?v=`）。

## 2. `products.js`：新增一筆

1. 欄位：
   - `id`、`name`：兩者相同，都等於圖檔檔名去副檔名。
   - `series`：`"PRO"` 或 `"Salon USE"`。
   - `copyKey`：官網名稱，不含容量。同一產品的其他容量已存在時，沿用相同的 `copyKey`。
   - `orig`：該容量的建議售價，只寫數字字串（例：`"1200"`）；沒有售價寫 `""`。
   - `img`：`../產品圖片/<PRO系列|Salon USE系列>/<圖檔檔名>?v=<版本號>`，版本號＝圖檔修改時間的毫秒整數（Node：`Math.floor(fs.statSync(圖檔路徑).mtimeMs)`）。
2. 位置：所有 `PRO` 在前、`Salon USE` 在後；同系列內依 `id` 以 `localeCompare(其他id, 'zh-Hant')` 排序。新筆插入排序後應在的位置，這個順序就是編輯器下拉選單的順序。
3. 同一個 `id` 不可重複。

## 3. `product-copy.js`：新增或更新 `copyKey`

1. 欄位：
   - `intro`：介紹。
   - `usage`：用途；原文有換行時以 `\n` 保留。
   - `price`：建議售價原文，格式 `容量/TWD金額`，多個容量以 `\n` 分隔，例：`"260mL/TWD1300\n500mL/TWD2200"`。
   - `orig`：`price` 中第一個 TWD 金額的數字字串；沒有則 `""`。
   - `series`：`"PRO"` 或 `"Salon USE"`。
2. 新 `copyKey` 加在物件最後。
3. 既有產品新增容量時，在該 `copyKey` 的 `price` 補上新容量那一行，並重新計算 `orig`。
4. 售價與 `products.js` 的 `orig` 要一致：每個 SKU 的 `orig` 取 `price` 中符合該 SKU 容量的那一行；找不到符合的容量時，取第一個 TWD 金額。

## 4. `names-en.js`：官方英文品名

1. 只在使用者提供國際部官方英文品名時新增。
2. key 為商品 `id`（含容量），值為官方英文品名，去掉開頭的 `*` 與結尾的 `SET OF n`。
3. 沒有官方英文品名時不新增，英文品名改由 `i18n.js` 的 `name_en` 提供。

## 5. `i18n.js`：英文、波蘭文翻譯

1. 每個新 `copyKey` 加一筆在物件最後，欄位：`name_en`、`name_pl`、`intro_en`、`intro_pl`、`usage_en`、`usage_pl`。
2. 由 Claude 直接翻譯撰寫，不呼叫任何外部翻譯服務或 API。
3. 顯示規則（翻譯時依此決定 `name_xx` 寫法）：
   - 英文品名：優先 `names-en.js`，沒有才用 `name_en`。
   - 波蘭文品名：`name_pl` 加上容量（商品 `name` 去掉 `copyKey` 後剩下的部分）。`copyKey` 等於完整商品名稱時，`name_pl` 自己包含容量。
   - 介紹、用途：`intro_xx`、`usage_xx`；欄位不存在時顯示中文。
4. 用途原文有換行時，譯文保留相同換行（`\n`）。
5. 介紹和同系列既有產品相同時，沿用該產品的既有譯文。
6. 中文介紹為空時，`intro_en`、`intro_pl` 也寫空字串。

## 6. 更新既有產品

- 改文案或售價：修改 `product-copy.js` 對應的 `copyKey`；售價有變時，同步修改所有相同 `copyKey` 的 SKU 在 `products.js` 的 `orig`。
- 中文文案修改時，同步修改 `i18n.js` 的對應譯文。
- 不改動與本次修改無關的產品與欄位。

## 7. 資料檔版本號

- 四個資料檔任一有修改時，把 `Coding/index.html` 中 `products.js`、`product-copy.js`、`i18n.js`、`names-en.js` 四個 `<script src="...?v=數字">` 的數字，全部改成同一個新值（`Date.now()`）。

## 8. 驗證

以 Node 載入四個資料檔（先設定 `global.window = {}`，再依序 require `products.js`、`product-copy.js`、`i18n.js`、`names-en.js`），確認以下全部成立：

1. 四個檔案都能正常載入，沒有語法錯誤。
2. 新品或修改的 SKU 存在於 `PRODUCTS`，`series`、`copyKey`、`orig` 正確，且 `id` 不重複。
3. 每個 `copyKey` 都能在 `PRODUCT_COPY` 找到；`img` 去掉 `?v=` 後指向的圖檔確實存在。
4. `PRODUCTS` 符合第 2 節第 2 點的排序規則。
5. 依 `Coding/index.html` 的 `prodName()` 與 `getCopy()` 邏輯，新品在 zh／en／pl 三種語言的品名、介紹、用途都正確。
6. `index.html` 四個資料檔的 `?v=` 數字相同。

最後在預覽頁（以 repo 根目錄啟動，開 `/Coding/`）確認：新品出現在商品選單，選取後 DM 正確顯示商品圖、品名與價格。

## 9. 文件與提交

- 依 `docs-changelog` 規則新增變更紀錄。
- 使用者在過程中做了決定時，依 `docs-decision-log` 規則記錄。
- 只 `git add` 本次修改的檔案，commit 訊息用中文寫清楚上架或修改了哪些產品，然後 `git push origin main`。
