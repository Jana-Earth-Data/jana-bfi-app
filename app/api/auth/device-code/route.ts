import { NextResponse } from "next/server";

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? "";

export async function POST() {
  if (!AUTH_URL) {
    return NextResponse.json(
      { error: "AUTH_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(`${AUTH_URL}/api/auth/device-code/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: "jana-sdk" }),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Auth service error: ${message}` },
      { status: 500 }
    );
  }
}
