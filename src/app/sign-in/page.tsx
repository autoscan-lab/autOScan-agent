import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignInHero } from "@/components/SignInHero";

export default async function SignInPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return <SignInHero />;
}
