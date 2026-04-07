// 請複製本檔案為 config.js，然後填入公司內部 Power Automate / backend webhook URL。
// 建議做法：前端只呼叫公司內部流程入口，由該流程再轉發到企業微信機器人 webhook。
// `travel-request.html` 及 `travel-approval-booking.html` 會共用此 webhook 設定來發送通知。
// 正式環境請勿把真實 webhook URL 直接提交到 GitHub repo。
// 如改以 SharePoint List / Power Apps / 內部 API 接駁，可沿用同一結構。
window.APP_CONFIG = {
  webhookUrl: "https://your-company-flow-url",
  storagePrefix: "adminExpense"
};
