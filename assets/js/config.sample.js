// 請複製本檔案為 config.js，然後填入公司內部 Power Automate webhook URL。
// 注意：正式環境如使用 Premium HTTP Trigger，需先確認授權成本。
// 若改以 SharePoint List / Power Apps 表單方式接駁，可不用此檔。
window.APP_CONFIG = {
  webhookUrl: "https://your-company-flow-url",
  storagePrefix: "adminExpense"
};
