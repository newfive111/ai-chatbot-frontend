"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import Sidebar from "../components/Sidebar";

const API = "/api/proxy";

const ROLE_LABEL: Record<string, string> = {
  owner: "擁有者",
  admin: "管理員",
  editor: "編輯者",
  viewer: "檢視者",
};
const ASSIGNABLE_ROLES = ["admin", "editor", "viewer"];

interface Org { id: string; name: string; is_owner: boolean; role: string; }
interface Member {
  user_id: string; role: string; display_name: string;
  email: string | null; picture_url: string | null;
}
interface Invite { token: string; role: string; expires_at: string; }

export default function TeamPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [myRole, setMyRole] = useState<string>("viewer");
  const [inviteRole, setInviteRole] = useState("editor");
  const [newInviteUrl, setNewInviteUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);

  const canManage = myRole === "owner" || myRole === "admin";

  useEffect(() => {
    const t = localStorage.getItem("token");
    if (!t) { router.push("/login?redirect=/team"); return; }
    setToken(t);
    (async () => {
      try {
        const res = await axios.get(`${API}/orgs`, { headers: { Authorization: `Bearer ${t}` } });
        setOrgs(res.data);
        if (res.data.length > 0) setOrgId(res.data[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (!orgId || !token) return;
    const org = orgs.find(o => o.id === orgId);
    setMyRole(org?.role || "viewer");
    loadMembers();
    if (org?.role === "owner" || org?.role === "admin") loadInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, token]);

  const authHeader = () => ({ headers: { Authorization: `Bearer ${token}` } });

  const loadMembers = async () => {
    try {
      const res = await axios.get(`${API}/orgs/${orgId}/members`, authHeader());
      setMembers(res.data);
    } catch { /* ignore */ }
  };

  const loadInvites = async () => {
    try {
      const res = await axios.get(`${API}/orgs/${orgId}/invites`, authHeader());
      setInvites(res.data);
    } catch { /* ignore */ }
  };

  const createInvite = async () => {
    setMsg("");
    try {
      const res = await axios.post(`${API}/orgs/${orgId}/invites`, { role: inviteRole }, authHeader());
      setNewInviteUrl(res.data.invite_url);
      loadInvites();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "建立邀請失敗");
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setMsg("✅ 已複製邀請連結");
  };

  const changeRole = async (uid: string, role: string) => {
    try {
      await axios.patch(`${API}/orgs/${orgId}/members/${uid}`, { role }, authHeader());
      loadMembers();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "變更失敗");
    }
  };

  const removeMember = async (uid: string) => {
    if (!confirm("確定要移除這位成員嗎？")) return;
    try {
      await axios.delete(`${API}/orgs/${orgId}/members/${uid}`, authHeader());
      loadMembers();
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || "移除失敗");
    }
  };

  const revokeInvite = async (t: string) => {
    try {
      await axios.delete(`${API}/orgs/${orgId}/invites/${t}`, authHeader());
      loadInvites();
    } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <Sidebar />
      <main className="flex-1 md:ml-60 min-h-screen px-6 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">團隊成員</h1>

        {loading ? (
          <p className="text-gray-400">載入中…</p>
        ) : (
          <>
            {/* 團隊切換 */}
            {orgs.length > 1 && (
              <div className="mb-6">
                <label className="text-sm text-gray-400 mb-2 block">選擇團隊</label>
                <select
                  value={orgId}
                  onChange={e => setOrgId(e.target.value)}
                  className="bg-gray-800 px-4 py-2 rounded-lg outline-none"
                >
                  {orgs.map(o => (
                    <option key={o.id} value={o.id}>{o.name}（{ROLE_LABEL[o.role]}）</option>
                  ))}
                </select>
              </div>
            )}

            {msg && <p className="text-sm text-blue-300 mb-4">{msg}</p>}

            {/* 邀請成員 */}
            {canManage && (
              <div className="bg-gray-900 rounded-xl p-5 mb-6">
                <h2 className="font-semibold mb-3">邀請成員</h2>
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={inviteRole}
                    onChange={e => setInviteRole(e.target.value)}
                    className="bg-gray-800 px-4 py-2 rounded-lg outline-none"
                  >
                    {ASSIGNABLE_ROLES.map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                  <button
                    onClick={createInvite}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition"
                  >
                    產生邀請連結
                  </button>
                </div>
                {newInviteUrl && (
                  <div className="mt-3 flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-300 truncate flex-1">{newInviteUrl}</span>
                    <button onClick={() => copyUrl(newInviteUrl)} className="text-blue-400 text-sm hover:underline shrink-0">複製</button>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">把連結傳給員工，對方用 LINE 或 Email 登入後即可加入。連結 7 天內有效。</p>

                {invites.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs text-gray-400 mb-2">尚未使用的邀請</p>
                    <div className="flex flex-col gap-2">
                      {invites.map(inv => (
                        <div key={inv.token} className="flex items-center gap-2 text-sm bg-gray-800 rounded-lg px-3 py-2">
                          <span className="text-gray-300">{ROLE_LABEL[inv.role]}</span>
                          <span className="text-gray-500 truncate flex-1">/invite/{inv.token.slice(0, 12)}…</span>
                          <button onClick={() => copyUrl(`${window.location.origin}/invite/${inv.token}`)} className="text-blue-400 hover:underline shrink-0">複製</button>
                          <button onClick={() => revokeInvite(inv.token)} className="text-red-400 hover:underline shrink-0">撤銷</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 成員列表 */}
            <div className="bg-gray-900 rounded-xl p-5">
              <h2 className="font-semibold mb-4">成員（{members.length}）</h2>
              <div className="flex flex-col divide-y divide-gray-800">
                {members.map(m => (
                  <div key={m.user_id} className="flex items-center gap-3 py-3">
                    {m.picture_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.picture_url} alt="" className="w-9 h-9 rounded-full" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-sm">
                        {m.display_name.slice(0, 1)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.display_name}</p>
                      {m.email && <p className="text-xs text-gray-500 truncate">{m.email}</p>}
                    </div>

                    {m.role === "owner" ? (
                      <span className="text-sm text-yellow-400">擁有者</span>
                    ) : canManage ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={m.role}
                          onChange={e => changeRole(m.user_id, e.target.value)}
                          className="bg-gray-800 px-3 py-1.5 rounded-lg text-sm outline-none"
                        >
                          {ASSIGNABLE_ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                        <button onClick={() => removeMember(m.user_id)} className="text-red-400 text-sm hover:underline">移除</button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">{ROLE_LABEL[m.role]}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
