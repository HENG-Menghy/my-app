// @/lib/schedule.ts

import { Logger } from "./logger";
import { qstashClient } from "./upstash-qstash";

/**
 * System Cleanup
 * Triggers the `system-cleanup` endpoint to run on a schedule.
 * This job is executed every x.
 */

export async function scheduleCleanup() {
  await qstashClient.schedules.create({
    destination: `${process.env.NEXT_PUBLIC_BASE_URL}/api/system-cleanup`,
    cron: "*/30 * * * *", // every x
    scheduleId: "scd_6pEAqq2Vb6L5ZhMFW7qtWdUSqfUD",
  });
}

scheduleCleanup().catch(error => {
  Logger.error("QSTASH_SCHEDULES_ERROR", error as Error);
  process.exit(1);
});