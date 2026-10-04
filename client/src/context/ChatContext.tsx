import { useCallback, useEffect, useState, type ReactNode } from "react";
import { StreamChat, type Channel } from "stream-chat";
import { ChatContext } from "./chat-context";
import { useAuth } from "./useAuth";
import { apiRequest } from "../lib/api";

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Lets the widget offer a "Try again" button after a failed connection.
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let cancelled = false;
    let activeClient: StreamChat | null = null;

    apiRequest("/chat/token", { token })
      .then(async (data) => {
        setConnecting(true);
        setError(null);
        const chatClient = StreamChat.getInstance(data.apiKey);
        await chatClient.connectUser(
          { id: data.userId, name: data.name },
          data.token,
        );
        if (cancelled) return;
        activeClient = chatClient;
        setClient(chatClient);
        // The admin reads its conversations through AdminSupportInbox, which
        // queries every channel it is a member of.
        if (user.role === "admin") {
          return;
        }

        // This call is what makes the channel exist and puts the customer in
        // it, server-side. Without it the client-side watch() below fails with
        // Stream error 17 (not allowed to perform action ReadChannel).
        const { agentId } = await apiRequest("/chat/support-agent", { token });
        const streamUserId = `jomumart_${user.id}`;
        const ch = chatClient.channel("messaging", `support-${user.id}`, {
          members: [streamUserId, agentId],
        });
        try {
          await ch.watch();
        } catch (err) {
          // Surface the real reason instead of leaving the widget stuck on
          // "Connecting to support..." forever.
          const message =
            err instanceof Error ? err.message : "Could not open the chat";
          console.error("Could not watch support channel:", message);
          if (!cancelled) setError(message);
          return;
        }
        if (cancelled) return;
        setChannel(ch);
        setUnreadCount(ch.state.unreadCount || 0);

        ch.on("message.new", (event) => {
          if (event.user?.id !== streamUserId) {
            setUnreadCount((count) => count + 1);
          }
        });
      })
      .catch((err) => {
        console.error("Chat connection failed:", err);
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not reach support chat",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setConnecting(false);
      });

    return () => {
      cancelled = true;
      if (activeClient) {
        activeClient.disconnectUser();
      }
      setClient(null);
      setChannel(null);
      setUnreadCount(0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, token, attempt]);

  const markChatRead = () => {
    if (channel) {
      channel.markRead();
      setUnreadCount(0);
    }
  };

  return (
    <ChatContext.Provider
      value={{ client, channel, connecting, error, retry, unreadCount, markChatRead }}
    >
      {children}
    </ChatContext.Provider>
  );
}




