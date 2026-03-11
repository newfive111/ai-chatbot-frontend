import { NextRequest, NextResponse } from "next/server";

const RAILWAY = "https://graceful-patience-production-0170.up.railway.app";

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const targetPath = "/" + path.join("/");
  const targetUrl = RAILWAY + targetPath + (req.nextUrl.search || "");

  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("Content-Type") || "application/json",
  };

  const auth = req.headers.get("Authorization");
  if (auth) headers["Authorization"] = auth;

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.text()
    : undefined;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // @ts-expect-error Next.js/Node fetch extension
      duplex: "half",
    });

    const data = await upstream.text();

    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/json",
      },
    });
  } catch (err) {
    console.error("[proxy] upstream error:", err);
    return NextResponse.json({ detail: "上游服務暫時無法連線" }, { status: 502 });
  }
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;
