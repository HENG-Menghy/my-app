// @/api/auth/session/many/route.ts

import { ApiResponse } from "@/lib/api/response";
import { NextRequest } from "next/server";

export async function DELETE(req: NextRequest) {
  try {
    const sessionIds: string[] = await req.json();
    return ApiResponse.success({
      message: `Successfully removed sessions; Removed ${sessionIds.length} sessions: ${sessionIds}`,
    });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
