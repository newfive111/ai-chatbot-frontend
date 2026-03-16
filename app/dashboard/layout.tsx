import Sidebar from "../components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <Sidebar />
      {/* 主內容區：左邊讓開 sidebar 寬度 */}
      <main className="flex-1 md:ml-60 min-h-screen">
        {children}
      </main>
    </div>
  );
}
