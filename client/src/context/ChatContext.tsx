import { useEffect, useState, type ReactNode } from "react";
import { StreamChat, type Channel } from "stream-chat";
import { ChatContext } from "./chat-context";
import { useAuth } from "./useAuth";
import { apiRequest } from "../lib/api";

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const [client, setClient] = useState<StreamChat | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user || !token) {
      return;
    }

    let cancelled = false;
    let activeClient: StreamChat | null = null;
    

    apiRequest("/chat/token", { token })
      .then(async (data) => {
        setConnecting(true);
        const chatClient = StreamChat.getInstance(data.apiKey);
        await chatClient.connectUser(
          { id: data.userId, name: data.name },
          data.token,
        );
        if (cancelled) return;
        activeClient = chatClient;
        setClient(chatClient);
        if (user.role === "admin") {
  return;
}

        const { agentId } = await apiRequest("/chat/support-agent", { token });
        const streamUserId = `jomumart_${user.id}`;
        const ch = chatClient.channel("messaging", `support-${user.id}`, {
          members: [streamUserId, agentId],
        });
        await ch.watch();
        if (cancelled) return;
        setChannel(ch);
        setUnreadCount(ch.state.unreadCount || 0);

        ch.on("message.new", (event) => {
          if (event.user?.id !== streamUserId) {
            setUnreadCount((count) => count + 1);
          }
        });
      })
      .catch((err) => console.error("Chat connection failed:", err))
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
  }, [user?.id, token]);

  const markChatRead = () => {
    if (channel) {
      channel.markRead();
      setUnreadCount(0);
    }
  };

  return (
    <ChatContext.Provider
      value={{ client, channel, connecting, unreadCount, markChatRead }}
    >
      {children}
    </ChatContext.Provider>
  );
}
