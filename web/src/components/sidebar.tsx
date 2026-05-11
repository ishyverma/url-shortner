"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Link2, 
  BarChart3, 
  Settings, 
  Zap,
  LogIn,
  Sparkles
} from "lucide-react";
import { UserMenu } from "./user-menu";

const navItems = [
  { name: "Links", href: "/", icon: Link2 },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <aside className="w-64 h-screen border-r border-border/50 bg-card/50 backdrop-blur-xl fixed left-0 top-0 flex flex-col">
      <div className="p-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">LinkForge</span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {status === "loading" ? (
          <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
        ) : session ? (
          <>
            {navItems.map((item) => {
              const isActive = item.href === "/" 
                ? pathname === "/" 
                : pathname.startsWith(item.href);
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? "bg-primary/10 text-primary shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                  {item.name === "Analytics" && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                      Pro
                    </span>
                  )}
                </Link>
              );
            })}
          </>
        ) : (
          <div className="px-3 py-4">
            <Link
              href="/login"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Link>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Sign in to access your links
            </p>
          </div>
        )}
      </nav>

      {session && (
        <div className="p-3 border-t border-border/50">
          <UserMenu />
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mt-2 transition-all ${
              pathname === "/settings"
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Link>
        </div>
      )}

      {!session && (
        <div className="p-4 border-t border-border/50">
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Pro Features</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Sign in to unlock advanced analytics and custom domains
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}