// @/api/auth/session

import { ApiResponse } from "@/lib/api/response";
import { sessionService } from "@/services/sessionService";
import { FormattedDateDisplay } from "@/utils/datetime";
import { NextRequest } from "next/server";

export async function GET (_:NextRequest) {
  try {
    const sessions = await sessionService.getAllSessions();
    return ApiResponse.success({
      message: "Successfully get all sessions",
      data: FormattedDateDisplay(sessions)
    })
  } catch (error) {
    return ApiResponse.error(error)
  }
}

export async function DELETE (_:NextRequest) {
  try {
    await sessionService.clearAllSessions();
    return ApiResponse.success({
      message: "All sessions deleted successfully"
    })
  } catch (error) {
    return ApiResponse.error(error);
  }
}