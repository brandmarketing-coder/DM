# DM 編輯器 — 技術規格

## 架構
單頁 HTML (`index.html`)，無外部依賴，純 CSS + Vanilla JS。

## A4 尺寸
- 畫面預覽：595 × 842 px（72dpi），CSS transform 縮放置中
- 列印輸出：210mm × 297mm（@media print 切換）

## 頁首 / 頁尾
- 頁首：`../沙龍DM公版/公版DM_1.jpg`（2480×875px，寬 100%，高自動 ≈ 210px）
- 頁尾：`../沙龍DM公版/公版DM_2.jpg`（2480×294px，寬 100%，高自動 ≈ 71px）
- 內容高 ≈ 842 − 210 − 71 = 561 px

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

## PDF 匯出
純 CSS `@media print`，隱藏 navbar 和 editor pane，DM sheet 輸出 210mm×297mm。
