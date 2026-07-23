"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LineCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setError("登入失敗，請重試");
      return;
    }
    localStorage.setItem("token", token);
    // 若登入前有待接受的邀請或導向目標，接續它
    const redirect = sessionStorage.getItem("post_login_redirect");
    sessionStorage.removeItem("post_login_redirect");
    const target = redirect && redirect.startsWith("/") && !redirect.startsWith("//")
      ? redirect
      : "/dashboard";
    router.replace(target);
  }, [searchParams, router]);

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      {error ? (
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <a href="/login" className="text-blue-400 hover:underline">返回登入</a>
        </div>
      ) : (
        <p className="text-gray-400">登入中…</p>
      )}
    </main>
  );
}

export default function LineCallbackPage() {
  return (
    <Suspense>
      <LineCallback />
    </Suspense>
  );
}
