import { Chat } from "@/components/Chat";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <Chat userEmail={session?.user?.email} userName={session?.user?.name} />
  );
}
