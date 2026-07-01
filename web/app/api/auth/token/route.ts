import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = "438513486290-hvsmc82435unb6t9gvmgddngk0p92g1m.apps.googleusercontent.com";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { code, code_verifier, redirect_uri, grant_type, refresh_token } = body;

  if (!CLIENT_SECRET) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_SECRET env var is not set." }, { status: 500 });
  }

  const params: Record<string, string> = {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type,
  };

  if (grant_type === "authorization_code") {
    params.code = code;
    params.code_verifier = code_verifier;
    params.redirect_uri = redirect_uri;
  } else if (grant_type === "refresh_token") {
    params.refresh_token = refresh_token;
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
