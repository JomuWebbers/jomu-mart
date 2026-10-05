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

/** Identity prefix used before the Naija Mart -> Jomu Mart rename. */
const LEGACY_IDENTITY_PREFIX = "naijamart_";

/**
 * Creates (or repairs) the 1:1 support channel between a user and the admin,
 * and returns it ready to send messages on.
 *
 * Three steps are required, because they fix three different failures:
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
 * 3. `removeMembers()` drops the legacy `naijamart_*` identities. Those are the
 *    SAME two people under their pre-rename ids, so leaving them in makes every
 *    support room report "4 members" and render a doubled-up avatar stack in
 *    the header. Removing a member does NOT delete message history - the old
 *    messages stay in the channel and still resolve their author.
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
 * All three calls are idempotent, so this is safe on every page load.
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

  // Evict the pre-rename identities so the room shows 2 members, not 4.
  const state = await channel.query();
  const legacyMembers = (state.members || [])
    .map((member) => member.user_id as string)
    .filter((id) => typeof id === "string" && id.startsWith(LEGACY_IDENTITY_PREFIX));

  if (legacyMembers.length > 0) {
    await channel.removeMembers(legacyMembers);
  }

  return channel;
}
