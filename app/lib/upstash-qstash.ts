// @/lib/upstash-qstash.ts

/**
 * Instead of calling an endpoint directly, QStash acts as a middleman between you and an API to guarantee delivery, perform automatic retries on failure, and more.
 * Create an Upstash account here: https://console.upstash.com/auth/sign-in
 * @background_jobs https://upstash.com/docs/qstash/features/background-jobs
 * @schedules https://upstash.com/docs/qstash/features/schedules
*/

/**
 * Local Development
 * 
 * QStash requires a publicly available API to send messages to. 
 * During development when applications are not yet deployed, developers typically need to expose their local API by creating a public tunnel. 
 * While local tunneling works seamlessly, it requires code changes between development and production environments and increase friction for developers. 
 * 
 * To simplify the development process, you can:
 * @cli https://upstash.com/docs/qstash/howto/local-development
 * @local_tunnel https://upstash.com/docs/qstash/howto/local-tunnel
 * @trycloudflare npx cloudflared tunnel --url http://localhost:3000 (or other port you are running)
 * 
 */

import { Client } from "@upstash/qstash";

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});
