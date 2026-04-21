import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInHero } from "@/components/SignInHero";

export default async function AccessDeniedPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return <SignInHero mode="denied" />;
}
