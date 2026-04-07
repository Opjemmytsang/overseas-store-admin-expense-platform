# Travel Workflow Next Steps

本次新增內容：
- `modules/travel-request.html`
- `modules/travel-approval-booking.html`
- `assets/js/travel-workflow.js`
- `wecom-payload-examples.json`

## 建議下一步（仍需補入現有頁面）

### 1. 首頁入口
更新 `index.html`：
- 將原本「機票申請」入口改為「出差申請」
- 新增第二個入口「出差審批及訂購」
- Hero 區塊可補一句：已支援兩頁式出差流程

### 2. 舊機票頁處理
更新 `modules/flight.html`：
- 可改成提示頁，說明流程已搬到：
  - `travel-request.html`
  - `travel-approval-booking.html`
- 或直接用前端轉址到 `travel-request.html`

### 3. Webhook 設定
更新 `assets/js/config.sample.js` 說明：
- `webhookUrl` 可接 Power Automate / 公司 backend
- 由 Flow / backend 再轉發到企業微信機器人 webhook
- 正式環境不要把真實 webhook 直接提交到 repo

### 4. 推薦通知流程
- 送出申請：通知審批人 / 行政
- 批准後：通知跟進訂購人
- 訂購完成：通知申請人、審批人及相關群組

### 5. Trip.com 查價
現版本為前端入口版：
- 直航與轉機各自生成查價連結
- 真正自動抓價建議由 backend / automation 補上

## 推薦 PR 合併後再做
- 接 SharePoint / Power Automate
- 加 requestNo deep link from WeCom message
- 在 approval page 顯示最近操作時間
- 加 booking audit log
