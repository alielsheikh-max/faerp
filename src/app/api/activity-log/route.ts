import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import { getActivityLog, countActivityLog } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = getCurrentSession();
  if (!session || session.role !== "AD") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp     = req.nextUrl.searchParams;
  const page   = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const limit  = Math.min(200, parseInt(sp.get("limit") ?? "60") || 60);
  const role   = sp.get("role")  || undefined;
  const event  = sp.get("event") || undefined;
  const offset = (page - 1) * limit;

  const entries = getActivityLog({ limit, offset, role, eventType: event });
  const total   = countActivityLog({ role, eventType: event });

  return NextResponse.json({ entries, total, page, pages: Math.ceil(total / limit) });
}
