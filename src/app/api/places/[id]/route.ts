import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { deletePlace } from "@/lib/settings";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    deletePlace((await params).id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
