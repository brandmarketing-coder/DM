# DM 編輯器 — 技術規格

## 架構
單頁 HTML (`index.html`)，純 CSS + Vanilla JS。
匯出依賴 CDN 載入的 html2canvas 1.4.1 與 jsPDF 2.5.1；資料層（products.js / product-copy.js / i18n.js）以 `<script>` 載入。

## A4 尺寸
- 直式預覽：595 × 842 px（72dpi）；橫式預覽：842 × 595 px。CSS transform 縮放置中
- 匯出：jsPDF A4（210×297mm 直式／297×210mm 橫式），畫布以 scale 2 產生

## 底圖模式
- 直式：頁首＋內容＋頁尾三段式
  - 頁首：`../沙龍DM公版/公版DM_1.jpg`（2480×875px，寬 100%，高自動 ≈ 210px）
  - 頁尾：`../沙龍DM公版/公版DM_2.jpg`（2480×294px，寬 100%，高自動 ≈ 71px）
  - 內容高 ≈ 842 − 210 − 71 = 561 px
- 橫式 1/2/3：`橫1/2/3.jpg` 滿版鋪底，內容區以絕對定位百分比疊在白框上（座標常數 `LAND_POS`，可微調）
  - 橫式 1 白框較小：不支援四格（自動切回兩格）
  - 橫式 2/3 的兩格＝單品特寫模式（`isFeatureTwo()`）

## 版面模式
| 模式 | 結構 | 商品格數 |
|------|------|---------|
| 四格 | 2×2 獨立格，CSS grid | 4 格，各自有主商品＋贈品＋標題＋售價 |
| 兩格 | 上下兩列 | 2 列，各自有主商品＋贈品（並排）＋售價 |
| 一格 | 單格置中 | 1 格，主商品＋贈品（並排），置中顯示 |

## 資料結構
```js
cells[0..3] = {
  prodId,      // 主商品
  giftId,      // 贈品（空字串 = 不顯示）
  headline,    // 粗體標題（四格顯示為格標題；兩格/一格顯示為促銷標語）
  price,       // 售價
  origPrice,   // 原價（可空）
}
// 四格 → cells[0..3]
// 兩格 → cells[0], cells[1]
// 一格 → cells[0]
```

## 圖片防爆版
- 所有 flex 父層加 `min-height: 0; overflow: hidden`
- 圖片用 `max-width: 100%; max-height: 100%; object-fit: contain`
- 四格圖區固定高：`height: 165px`
- 兩格圖區固定高：`height: 210px`
- 一格圖區固定高：`height: 260px`

## PDF / JPG 匯出
- 主要路徑：html2canvas 渲染真正的 `#dm-sheet`（渲染前暫時把預覽 transform 設回 1）→ jsPDF 輸出 A4 PDF，或直接下載 JPG（品質 0.95）
- 匯出前等待所有圖片載入（每張最多 4 秒保底）
- 備援路徑：`@media print` 仍保留（直式），Ctrl+P 可列印

## 多語系
- `lang`：'zh' | 'en' | 'pl'；DM 內容與編輯器介面一併切換（字典 `UI`）
- 產品文案翻譯在 `i18n.js`（key = copyKey），查不到回退中文
- 價格每語言各自儲存：zh 存 `price`/`origPrice`（TWD 自動帶入）；en/pl 存 `i18nPrice[lang]`/`i18nOrig[lang]`（手動輸入）
- 顯示一律經 `dispPrice()`/`dispOrig()` 取當前語言的值
