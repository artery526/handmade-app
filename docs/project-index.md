# Emily 手作工坊專案索引

## 專案目的

這個專案用來展示 Emily 手作工坊的手作作品，先以 Google 試算表作為商品後台，再由靜態網頁讀取商品資料並呈現作品櫃與詢問清單。

## 目前入口

- 網站首頁：`index.html`
- 背景主視覺：`assets/emily-brand-bg.png`
- 商品試算表欄位範本：`sheet-template.csv`

## Google 試算表資料來源

- 試算表 ID：`1wYmYKcggwnXcpCMUF--Pl0Hwi70UaQ5OhvM4Ob4yg8w`
- 建議欄位：`上架、分類、名稱、價格、庫存、狀態、圖片、描述、規格、排序`

## 本地資料夾規劃

- `assets/`：圖片、預覽圖與其他網站素材。
- `docs/`：專案索引、規劃筆記、欄位規格與操作說明。
- `scripts/`：之後可放自動整理商品、檢查試算表、發布網站等指令碼。

## 下一步候選

- 將真實商品資料貼進 Google 試算表。
- 補上商品照片連結，確認前台可讀取。
- 決定購買流程要走 LINE 詢問、Google Form 訂單，或 Apps Script 寫回試算表。
