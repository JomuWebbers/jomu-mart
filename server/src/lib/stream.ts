import { StreamChat, type Channel } from "stream-chat";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;

if (!apiKey || !apiSecret) {
  throw new Error(
    "Missing Stream Chat environment variables — check server/.env",
  );
}

export const streamApiKey = apiKey;

export function getStreamChatServer() {
  if (!apiKey || !apiSecret) {
    throw new Error("Missing Stream Chat environment variables — check server/.env");
  }
  return StreamChat.getInstance(apiKey, apiSecret, { timeout: 20000 });
}

export function streamUserId(userId: string) {
  return `jomumart_${userId}`;
}

export function streamDisplayName(role: string, name: string) {
  return role === "admin" ? `Support · ${name}` : name;
}

/**
 * Creates (or repairs) the 1:1 support channel between a user and the admin,
 * and returns it ready to send messages on.
 *
 * Both steps are required, because they fix two different failures:
 *
 * 1. `watch()` creates the channel when it is missing. Stream applies the
 *    `members` from the channel data at creation time, so a brand new channel
 *    comes back correctly populated.
 *
 * 2. `addMembers()` repairs a channel that ALREADY exists. `watch()` is a plain
 *    read for an existing channel and silently ignores the `members` we pass,
 *    so without this call a channel left over from before the
 *    `naijamart_` -> `jomumart_` identity rename keeps its stale members and
 *    the customer is never added.
 *
 * Step 2 is also what unblocks the browser. ChatContext.tsx watches the channel
 * client-side, and a user who is not a member of an existing channel is denied
 * `ReadChannel`, which surfaces as error 17:
 *   "GetOrCreateChannel failed ... not allowed to perform action
 *    ReadChannel in scope 'messaging'"
 * leaving the widget stuck on "Connecting to support...". Membership is only
 * enforceable here, because this client holds the API secret and a plain user
 * token cannot grant it.
 *
 * Both calls are idempotent, so this is safe to call on every page load.
 */
export async function ensureSupportChannel(options: {
  server: StreamChat;
  userId: string;
  userName: string;
  adminId: string;
  adminName: string;
}): Promise<Channel> {
  const { server, userId, userName, adminId, adminName } = options;

  const userSid = streamUserId(userId);
  const adminSid = streamUserId(adminId);

  // Both user objects must exist before they can be channel members.
  await server.upsertUsers([
    { id: userSid, name: userName },
    { id: adminSid, name: streamDisplayName("admin", adminName) },
  ]);

  const channel = server.channel("messaging", `support-${userId}`, {
    members: [userSid, adminSid],
    created_by_id: adminSid,
  });

  await channel.watch();
  await channel.addMembers([userSid, adminSid]);

  return channel;
}
