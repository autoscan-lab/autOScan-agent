import { Chat } from "@/components/Chat";
import { auth } from "@/auth";
import { getChatState } from "@/lib/chat-state";

export default async function Home() {
  const session = await auth();
  const userId = session?.user?.email ?? session?.user?.name ?? "unknown-user";
  const chatState = await getChatState(userId);

  return (
    <Chat
      initialChatId={chatState.chatId}
      initialMessages={chatState.messages}
      userEmail={session?.user?.email}
      userName={session?.user?.name}
    />
  );
}
