import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Clears only the Supabase bridge session. Clerk owns the browser redirect
 * after its own sign-out is complete, so this endpoint must never redirect.
 */
export async function POST() {
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Supabase session cleanup failed", error);
      return NextResponse.json(
        { ok: false },
        { status: 500, headers: { "Cache-Control": "no-store" } },
      );
    }

    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Supabase session cleanup failed", error);
    return NextResponse.json(
      { ok: false },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
