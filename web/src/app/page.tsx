import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>URL Shortener</h1>
      
      {session?.user ? (
        <div style={{ padding: "1rem", background: "#e8f5e9", borderRadius: "8px" }}>
          <h2 style={{ marginBottom: "1rem" }}>Welcome!</h2>
          <p><strong>Name:</strong> {session.user.name}</p>
          <p><strong>Email:</strong> {session.user.email}</p>
          {session.user.image && (
            <img src={session.user.image} alt="Profile" style={{ borderRadius: "50%", width: 50, height: 50 }} />
          )}
          <br /><br />
          <Link href="/api/auth/signout" style={{ color: "#1976d2", textDecoration: "underline" }}>
            Sign Out
          </Link>
        </div>
      ) : (
        <div>
          <p style={{ marginBottom: "1rem" }}>Sign in to continue</p>
          <Link
            href="/api/auth/signin"
            style={{
              display: "inline-block",
              padding: "12px 24px",
              background: "#1976d2",
              color: "white",
              borderRadius: "4px",
              textDecoration: "none"
            }}
          >
            Sign In with Google
          </Link>
        </div>
      )}
    </main>
  );
}