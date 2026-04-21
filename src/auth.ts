import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = () =>
  (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  pages: {
    error: "/access-denied",
    signIn: "/sign-in",
  },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    signIn({ user }) {
      const email = user.email?.toLowerCase();
      if (!email) {
        return "/access-denied";
      }

      if (!allowedEmails().includes(email)) {
        return "/access-denied";
      }

      return true;
    },
  },
});
