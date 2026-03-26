# Overseas Store Admin & Expense Management Platform

中文名稱：**海外分店行政及費用管理平台**

GitHub Repo 名：`overseas-store-admin-expense-platform`

## 內容

這是一套供公司內部使用的靜態前台範本，已包含：

- 行政及費用申請首頁
- 貨品報稅模組
- 機票申請模組
- 酒店申請模組
- 鋪頭雜費申請模組
- 付款及核對追蹤頁

## 建議正式架構

- HTML 前台：放於 SharePoint / Teams 內部頁面
- SharePoint 文件庫：`行政及費用附件庫`
- Excel 總表：`海外分店行政及費用總表.xlsx`
- Excel Table：`tblAdminExpenseCases`
- Power Automate：接收資料，建立 folder，上傳附件，寫入 Excel

## 檔案結構

```text
overseas-store-admin-expense-platform/
├─ index.html
├─ modules/
│  ├─ tax.html
│  ├─ flight.html
│  ├─ hotel.html
│  ├─ store-expense.html
│  └─ payment-tracking.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/
│     ├─ app.js
│     └─ config.sample.js
├─ README.md
└─ excel-template.csv
```

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

## 正式接駁建議

1. SharePoint 建立 Site：**海外分店行政及費用管理平台**
2. 建立 List：**行政及費用申請主表**
3. 建立文件庫：**行政及費用附件庫**
4. 建立 Excel：**海外分店行政及費用總表.xlsx**
5. Power Automate：
   - 接收表單資料
   - 建立案件 folder
   - 上傳附件
   - 寫入 Excel Table `tblAdminExpenseCases`
   - 自動標記文件是否齊全、金額是否一致、核對狀態

## 備註

現版本為前台示範版：
- 已支援本地暫存
- 已支援 CSV 匯出
- 已預留 webhook 設定位置
- 適合作為 GitHub 靜態展示或內部前端原型
