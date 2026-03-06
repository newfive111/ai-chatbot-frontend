export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">

      {/* 頂部導覽 */}
      <nav className="flex justify-between items-center px-8 py-5 border-b border-gray-800">
        <span className="text-xl font-bold">😴 懶得回 LazyReply</span>
        <div className="flex gap-3">
          <a href="/login" className="px-5 py-2 text-gray-300 hover:text-white transition text-sm">
            登入
          </a>
          <a href="/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-semibold transition">
            免費註冊
          </a>
        </div>
      </nav>

      {/* 主視覺 */}
      <section className="flex flex-col items-center justify-center text-center px-4 py-24">
        <div className="inline-block bg-blue-900 text-blue-300 text-sm px-4 py-1 rounded-full mb-6">
          🚀 不需要工程師，10 分鐘上線
        </div>
        <h1 className="text-5xl font-bold mb-6 leading-tight max-w-2xl">
          幫你的企業建立<br />
          <span className="text-blue-400">AI 客服機器人</span>
        </h1>
        <p className="text-lg text-gray-400 mb-10 max-w-xl">
          上傳你的 FAQ 或產品資料，AI 自動回答 80% 的客服問題。
          支援嵌入網站 + LINE Bot，一次設定，永久使用。
        </p>
        <a
          href="/register"
          className="bg-blue-600 hover:bg-blue-700 px-10 py-4 rounded-xl font-bold text-lg transition shadow-lg shadow-blue-900"
        >
          👉 免費開始使用
        </a>
        <p className="mt-3 text-gray-500 text-sm">不需要信用卡 · 永久免費方案</p>
      </section>

      {/* 功能介紹 */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 px-8 pb-24 max-w-5xl mx-auto">
        {[
          { icon: "📄", title: "上傳資料", desc: "上傳 PDF、貼上 FAQ，AI 自動學習你的產品知識" },
          { icon: "💬", title: "自動回答", desc: "客戶問問題，AI 即時回覆，24小時不休息" },
          { icon: "🔗", title: "多渠道整合", desc: "一鍵嵌入網站，或連接 LINE Bot，彈性部署" },
        ].map((f) => (
          <div key={f.title} className="bg-gray-900 rounded-2xl p-6">
            <div className="text-3xl mb-3">{f.icon}</div>
            <h3 className="font-bold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.desc}</p>
          </div>
        ))}
      </section>

    </main>
  );
}
