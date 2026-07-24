"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "axios";

const ROLE_LABEL: Record<string, string> = {
  admin: "管理員",
  editor: "編輯者",
  viewer: "檢視者",
};

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<{ org_name: string; role: string } | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`/api/proxy/invites/${token}`);
        setInfo(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.detail || "邀請連結無效或已過期");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const goLogin = () => {
    // 未登入 / token 過期 → 清掉舊 token，去登入頁，登入後導回本頁接續
    localStorage.removeItem("token");
    router.push(`/login?redirect=/invite/${token}`);
  };

  const handleAccept = async () => {
    const authToken = localStorage.getItem("token");
    if (!authToken) {
      goLogin();
      return;
    }
    setAccepting(true);
    setError("");
    try {
      await axios.post(`/api/proxy/invites/${token}/accept`, {}, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      router.push("/dashboard");
    } catch (e: any) {
      // token 過期/無效 → 當成未登入，導去登入再回來，而不是卡死在錯誤畫面
      if (e?.response?.status === 401) {
        goLogin();
        return;
      }
      setError(e?.response?.data?.detail || "接受邀請失敗");
      setAccepting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-gray-900 rounded-xl p-8 text-center">
        {loading ? (
          <p className="text-gray-400">載入中…</p>
        ) : error ? (
          <>
            <p className="text-red-400 mb-4">{error}</p>
            <a href="/dashboard" className="text-blue-400 hover:underline">前往首頁</a>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">團隊邀請</h1>
            <p className="text-gray-300 mb-1">
              你被邀請加入 <span className="font-semibold text-white">{info?.org_name}</span>
            </p>
            <p className="text-gray-400 text-sm mb-6">
              身分：{ROLE_LABEL[info?.role || ""] || info?.role}
            </p>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-semibold transition disabled:opacity-50"
            >
              {accepting ? "處理中…" : "接受邀請"}
            </button>
            <p className="mt-4 text-gray-500 text-xs">
              若尚未登入，將先引導你登入或註冊
            </p>
          </>
        )}
      </div>
    </main>
  );
}
