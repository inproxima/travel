import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { deleteResult, getResult } from "@/lib/ai/history";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = getResult((await params).id);
    return result ? NextResponse.json({ result }) : NextResponse.json({ error: "Not found." }, { status: 404 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    deleteResult((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
