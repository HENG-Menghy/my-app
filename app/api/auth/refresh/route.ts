// @/api/auth/refresh/route.ts

import { NextRequest } from "next/server";
import { ApiResponse } from "@/lib/api/response";

export async function POST(req: NextRequest) {
  try {
   
  } catch (error) {
    return ApiResponse.error(error);
  }
}
