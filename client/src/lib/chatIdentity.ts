/**
 * Stream identity helpers.
 *
 * The brand rename changed the Stream identity prefix from `naijamart_` to
 * `jomumart_`. Messages sent before the rename keep their original author id,
 * and Stream decides "mine" vs "theirs" purely by comparing a message's author
 * against `client.userID`. So a message written by `naijamart_<userId>` is not
 * recognised as the current user's own message once they sign in as
 * `jomumart_<userId>`, and it renders on the LEFT for both sides instead of
 * the usual own-right / other-left split.
 *
 * Both prefixes refer to the same real person, so rewriting the author id in
 * local channel state is safe and purely cosmetic - nothing is sent to Stream.
 */
const LEGACY_PREFIX = "naijamart_";
const CURRENT_PREFIX = "jomumart_";

type MessageLike = {
  user_id?: string;
  user?: { id?: string } | null;
};

/** Maps a pre-rename Stream identity onto its current equivalent. */
export function normalizeStreamUserId(
  id: string | null | undefined,
): string | undefined {
  if (typeof id !== "string" || !id.startsWith(LEGACY_PREFIX)) {
    return id ?? undefined;
  }
  return CURRENT_PREFIX + id.slice(LEGACY_PREFIX.length);
}

/**
 * Rewrites pre-rename author ids in a channel's cached messages so the message
 * list renders with the correct own/other alignment.
 */
export function normalizeMessageAuthors(
  messages: MessageLike[] | undefined,
): void {
  if (!Array.isArray(messages)) return;

  for (const message of messages) {
    const authorId = message.user_id ?? message.user?.id;
    const normalized = normalizeStreamUserId(authorId);
    if (!normalized || normalized === authorId) continue;

    message.user_id = normalized;
    if (message.user) {
      message.user.id = normalized;
    }
  }
}

