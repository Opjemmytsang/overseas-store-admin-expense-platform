# Overseas Store Admin & Expense Management Platform

中文名稱：**海外分店行政及費用管理平台**

GitHub Repo 名：`overseas-store-admin-expense-platform`

## 內容

這是一套供公司內部使用的靜態前台範本，現已包含：

- 行政及費用申請首頁
- 貨品報稅模組
- 機票申請模組
- 酒店申請模組
- **費用及報銷入口**
  - 單次申請（1 Batch + 1 Line）
  - 月度總表申請（1 Batch + 多 Line）
- 付款及核對追蹤頁

## 今次新增重點

### 1. 費用模組改為雙入口

原本單一「鋪頭雜費申請」頁，已重構成：

- `modules/store-expense.html`：費用及報銷入口
- `modules/single-expense.html`：單次申請
- `modules/monthly-expense.html`：月度總表申請

### 2. 共用資料結構：Batch / Line

為方便日後接 SharePoint / Excel / Power Automate，費用資料現改用兩層結構：

- **Batch**：批次主表
  - BatchNo
  - StoreCode
  - Applicant
  - MonthKey / SourceMode
  - TotalAmount
  - Status
- **Line**：費用明細表
  - LineNo
  - ExpenseDate
  - ExpenseType
  - Vendor
  - Description
  - Amount
  - Currency
  - PaymentMethod
  - PaidBy

### 3. PDF 讀取強化

`assets/js/app.js` 已加入：

- PDF.js 文字層讀取
- 若 PDF 文字不足，自動逐頁 render 再 OCR
- 支援圖片 / PDF 混合上傳

### 4. Excel 匯入

月度總表頁已支援：

- 匯入 `.xlsx` / `.xls` / `.csv`
- 讀取第一個工作表
- 自動 map 常見欄名
- 建立多條 Line

### 5. 首頁資料中心（備份 / 還原）

首頁新增「系統資料中心」，可直接：

- 顯示各模組的本機資料筆數與估算容量
- 下載完整 JSON 備份
- 匯入 JSON 備份並覆蓋原資料
- 一鍵清空目前 `localStorage` 的系統資料

## 建議正式架構

- HTML 前台：放於 SharePoint / Teams 內部頁面
- SharePoint List / Excel Table：分開存 `Batch` 與 `Line`
- SharePoint 文件庫：`行政及費用附件庫`
- Power Automate：
  - 接收表單資料
  - 建立 batch folder
  - 上傳附件
  - 寫入 Batch 主表
  - 寫入 Line 明細表

## 檔案結構

```text
overseas-store-admin-expense-platform/
├─ index.html
├─ modules/
│  ├─ tax.html
│  ├─ flight.html
│  ├─ hotel.html
│  ├─ store-expense.html
│  ├─ single-expense.html
│  ├─ monthly-expense.html
│  └─ payment-tracking.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/
│     ├─ app.js
│     └─ config.sample.js
├─ README.md
├─ excel-template.csv
└─ monthly-expense-template.csv
```

## 月度 Excel 建議欄名

建議使用以下欄名之一，系統會自動嘗試配對：

- `ExpenseDate`
- `ExpenseType`
- `Vendor`
- `Description`
- `Amount`
- `Currency`
- `PaymentMethod`
- `PaidBy`
- `AdvancePayerName`

## 本地測試方法

直接打開 `index.html` 即可。

為避免瀏覽器跨檔案限制，建議用簡單本地 server：

```bash
python -m http.server 8080
```

然後打開：

```text
http://localhost:8080
```

## 備註

現版本為前台示範版：

- 已支援本地暫存
- 已支援 CSV 匯出
- 已支援 PDF.js + OCR fallback
- 已支援月度 Excel 匯入
- 已預留 webhook 設定位置
- 適合作為 GitHub 靜態展示或內部前端原型
