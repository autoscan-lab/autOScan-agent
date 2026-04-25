import { Chat } from "@/components/chat/Chat";
import { auth } from "@/auth";
import { getChatState } from "@/lib/chat/chat-state";
import { resolveSessionUserId } from "@/lib/auth";

export default async function Home() {
  const session = await auth();
  const userId = resolveSessionUserId(session);
  const chatState = await getChatState(userId);

  return (
    <Chat
      initialChatId={chatState.chatId}
      initialMessages={chatState.messages}
      userEmail={session?.user?.email}
      userImage={session?.user?.image}
      userName={session?.user?.name}
    />
  );
}
