import NavBar from "../components/NavBar";

export const metadata = {
  title: "隱私政策 | LDH.ai",
  description: "LDH.ai 隱私政策",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">隱私政策</h1>
        <p className="text-gray-500 text-sm mb-10">最後更新：2026 年 3 月 18 日</p>

        <div className="flex flex-col gap-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. 總則</h2>
            <p>
              LDH.ai（以下簡稱「本服務」）致力於保護使用者的個人資料。本隱私政策說明我們如何收集、使用及保護您在使用本服務過程中所提供的資訊。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. 資料收集範圍</h2>
            <p className="mb-2">本服務可能收集以下資訊：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>使用者與 AI 客服機器人的對話內容</li>
              <li>使用者主動提供的個人資料（如姓名、電話、電子郵件等）</li>
              <li>社群平台識別碼（如 LINE 用戶 ID、Instagram 用戶 ID）</li>
              <li>帳號註冊資訊（電子郵件地址）</li>
              <li>服務使用紀錄（對話時間、訊息數量）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. 資料使用目的</h2>
            <p className="mb-2">所收集的資料僅用於以下目的：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>提供 AI 客服回應服務</li>
              <li>將用戶資訊記錄至商家指定的 Google 試算表（僅限商家授權範圍內）</li>
              <li>改善服務品質與使用體驗</li>
              <li>帳號管理與客戶支援</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. 資料分享與揭露</h2>
            <p className="mb-2">本服務不會將您的個人資料出售、出租或交換給第三方。以下情況除外：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>商家使用本服務收集資料時，相關資訊將儲存至商家自行設定的 Google 試算表</li>
              <li>法律要求或主管機關命令</li>
              <li>為保護本服務或使用者安全所必要之情形</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. 第三方服務</h2>
            <p className="mb-2">本服務整合以下第三方平台，各平台均有其獨立的隱私政策：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>LINE Messaging API（LINE Corporation）</li>
              <li>Instagram / Meta Graph API（Meta Platforms, Inc.）</li>
              <li>Google Sheets API（Google LLC）</li>
              <li>Google Gemini API（Google LLC）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. 資料保留</h2>
            <p>
              對話紀錄保留於本服務資料庫，用於維持對話記憶與分析服務品質。用戶可隨時透過聯絡我們要求刪除其個人資料。商家可於後台自行管理及刪除其 Bot 的對話紀錄。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. 資料安全</h2>
            <p>
              本服務採用業界標準的加密技術（HTTPS/TLS）保護資料傳輸，並採取適當的技術與管理措施防止未經授權的存取、使用或洩漏。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. 您的權利</h2>
            <p className="mb-2">您有權：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>查詢本服務持有的您的個人資料</li>
              <li>要求更正不正確的資料</li>
              <li>要求刪除您的個人資料</li>
              <li>撤回同意授權</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">9. 政策變更</h2>
            <p>
              本政策如有重大變更，將於本頁面公告，並更新頁面頂部的「最後更新」日期。建議定期查閱本頁面以了解最新政策。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">10. 聯絡我們</h2>
            <p>
              如有任何關於隱私權的問題或請求，請透過以下方式聯絡我們：
            </p>
            <div className="mt-3 bg-gray-900 rounded-xl px-5 py-4 text-sm">
              <p className="font-medium text-white mb-1">LDH.ai</p>
              <p className="text-gray-400">網站：<a href="https://landehui.online" className="text-blue-400 hover:text-blue-300 underline transition">landehui.online</a></p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
