import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { PolicyBuilder } from "@/components/policies/PolicyBuilder";

export default async function PoliciesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return <PolicyBuilder />;
}
