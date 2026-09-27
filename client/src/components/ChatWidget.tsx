import { useEffect, useState } from "react";
import {
  Chat,
  Channel,
  Window,
  ChannelHeader,
  MessageList,
  MessageComposer,
} from "stream-chat-react";
import { MessageCircleIcon, XIcon } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { useChat } from "../context/useChat";

export default function ChatWidget() {
  const { user } = useAuth();
  const { client, channel, connecting, unreadCount, markChatRead } = useChat();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleOpenSupportChat() {
      setOpen(true);
      markChatRead();
    }

    window.addEventListener(
      "naija-mart:open-support-chat",
      handleOpenSupportChat,
    );

    return () => {
      window.removeEventListener(
        "naija-mart:open-support-chat",
        handleOpenSupportChat,
      );
    };
  }, [markChatRead]);
  if (!user || user.role === "admin") return null;

  return (
    <>
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markChatRead();
        }}
        className="fixed bottom-5 right-5 z-40 size-14 rounded-full bg-black text-white flex items-center justify-center shadow-lg hover:bg-neutral-800 transition-colors"
        aria-label="Open help center chat"
      >
        {open ? (
          <XIcon className="size-6" />
        ) : (
          <MessageCircleIcon className="size-6" />
        )}
        {!open && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-600 text-white text-[11px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-40 w-[90vw] max-w-sm h-[70vh] max-h-[520px] border-2 border-black bg-white shadow-xl flex flex-col overflow-hidden">
          {connecting || !client || !channel ? (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-400">
              Connecting to support…
            </div>
          ) : (
            <Chat client={client} theme="str-chat__theme-light">
              <Channel channel={channel}>
                <Window>
                  <ChannelHeader title="Naija Mart Support" />
                  <MessageList />
                  <MessageComposer />
                </Window>
              </Channel>
            </Chat>
          )}
        </div>
      )}
    </>
  );
}






