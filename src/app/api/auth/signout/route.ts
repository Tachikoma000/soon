import { NextResponse } from "next/server";
import { endSession } from "@/lib/session";

export async function POST(req: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/welcome", req.url), { status: 303 });
}
