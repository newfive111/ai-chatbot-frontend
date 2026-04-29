import NavBar from "../../components/NavBar";

export const metadata = {
  title: "隱私政策 | 租盾",
  description: "租盾 App 隱私政策",
};

export default function ZudunPrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <NavBar />
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">隱私政策</h1>
        <p className="text-gray-400 text-sm mb-1">租盾（Rent Shield）App</p>
        <p className="text-gray-500 text-sm mb-10">最後更新：2026 年 4 月 29 日</p>

        <div className="flex flex-col gap-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. 總則</h2>
            <p>
              租盾（以下簡稱「本服務」）致力於保護使用者的個人資料。本隱私政策說明我們如何收集、使用及保護您在使用本服務過程中所提供的資訊。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. 資料收集範圍</h2>
            <p className="mb-2">本服務可能收集以下資訊：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>帳號資訊（電子郵件地址）</li>
              <li>租約相關資訊（租約名稱、租期日期、租金等）</li>
              <li>使用者上傳的照片與文件</li>
              <li>拍照時的 GPS 位置（僅用於存證標記，使用者授權後才啟用）</li>
              <li>存證紀錄（標題、描述、發生時間）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. 資料使用目的</h2>
            <p className="mb-2">所收集的資料僅用於以下目的：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>提供租約管理與存證服務</li>
              <li>AI 分析對話截圖（圖片傳送至 Google Gemini API 處理，不另行儲存）</li>
              <li>產出 PDF 存證報告</li>
              <li>發送租約到期推播通知</li>
              <li>帳號管理與客戶支援</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. 資料分享與揭露</h2>
            <p className="mb-2">本服務不會將您的個人資料出售、出租或交換給第三方。以下情況除外：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>法律要求或主管機關命令</li>
              <li>為保護本服務或使用者安全所必要之情形</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. 第三方服務</h2>
            <p className="mb-2">本服務整合以下第三方平台，各平台均有其獨立的隱私政策：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>Supabase（資料儲存，位於日本東京地區）</li>
              <li>Google Gemini API（AI 圖片分析）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. 資料保留</h2>
            <p>
              您的資料儲存於 Supabase 雲端服務，採用業界標準加密保護。您可隨時透過 App 內「我的」頁面申請刪除帳號及所有相關資料。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. 資料安全</h2>
            <p>
              本服務採用 HTTPS/TLS 加密技術保護資料傳輸，並採取適當的技術與管理措施防止未經授權的存取、使用或洩漏。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">8. 您的權利</h2>
            <p className="mb-2">您有權：</p>
            <ul className="list-disc list-inside flex flex-col gap-1.5 pl-2">
              <li>查詢本服務持有的您的個人資料</li>
              <li>要求更正不正確的資料</li>
              <li>要求刪除您的帳號及所有個人資料</li>
              <li>撤回 GPS 位置或通知授權（可於手機設定中調整）</li>
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
            <p>如有任何關於隱私權的問題或請求，請透過以下方式聯絡我們：</p>
            <div className="mt-3 bg-gray-900 rounded-xl px-5 py-4 text-sm">
              <p className="font-medium text-white mb-1">租盾</p>
              <p className="text-gray-400">
                電子郵件：
                <a href="mailto:youfanliao444@gmail.com" className="text-blue-400 hover:text-blue-300 underline transition">
                  youfanliao444@gmail.com
                </a>
              </p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
