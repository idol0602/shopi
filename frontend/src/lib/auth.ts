import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "mock-google-client-id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "mock-google-client-secret",
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Shopi Account",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mật khẩu", type: "password" },
        accessToken: { label: "Access Token", type: "text" },
        refreshToken: { label: "Refresh Token", type: "text" },
        userId: { label: "User ID", type: "text" },
        fullName: { label: "Họ tên", type: "text" },
        role: { label: "Role", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        // If pre-authenticated via OTP registration or Google flow
        if (credentials.accessToken && credentials.userId) {
          return {
            id: credentials.userId,
            email: credentials.email,
            name: credentials.fullName || credentials.email?.split("@")[0],
            role: credentials.role || "BUYER",
            accessToken: credentials.accessToken,
          };
        }

        // Direct email + password authentication against api-gateway
        if (credentials.email && credentials.password) {
          const gatewayUrl =
            process.env.API_GATEWAY_INTERNAL_URL ||
            process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
            "http://localhost:8080";

          const res = await fetch(`${gatewayUrl}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.message || "Email hoặc mật khẩu không chính xác");
          }

          const data = await res.json();
          return {
            id: data.userId,
            email: data.email,
            name: data.fullName || data.email?.split("@")[0],
            role: data.role || "BUYER",
            accessToken: data.accessToken,
          };
        }

        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const gatewayUrl =
            process.env.API_GATEWAY_INTERNAL_URL ||
            process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
            "http://localhost:8080";

          // Sync Google OAuth with backend identity-service via API Gateway
          const res = await fetch(`${gatewayUrl}/api/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: user.email,
              fullName: user.name,
              idToken: account.id_token,
              avatarUrl: user.image,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            user.id = data.userId;
            (user as any).role = data.role;
            (user as any).accessToken = data.accessToken;
          }
        } catch (err) {
          console.warn("Failed to sync Google user with backend identity-service:", err);
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role || "BUYER";
        token.accessToken = (user as any).accessToken;
      }
      if (account) {
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = (token.role as string) || "BUYER";
        (session.user as any).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || "shopi-jwt-secret-super-secure-key-2026-c2c",
};
