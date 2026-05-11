"use client";

import { useSession, signOut } from "next-auth/react";
import { 
  User, 
  LogOut, 
  Settings, 
  CreditCard,
  ChevronUp,
  LogOutIcon
} from "lucide-react";
import { useState } from "react";

export function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);

  if (!session?.user) return null;

  const user = session.user;
  const initials = user.name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "U";

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-secondary transition-colors"
      >
        <div className="flex items-center gap-3">
          {user.image ? (
            <img 
              src={user.image} 
              alt={user.name || ""} 
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
              {initials}
            </div>
          )}
          <div className="text-left">
            <p className="text-sm font-medium text-foreground truncate max-w-[120px]">
              {user.name || user.email?.split("@")[0]}
            </p>
            <p className="text-xs text-muted-foreground truncate max-w-[120px]">
              {user.email}
            </p>
          </div>
        </div>
        <ChevronUp className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 py-2 bg-secondary rounded-lg border border-border shadow-lg">
          <div className="px-3 py-2 border-b border-border mb-2">
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="text-sm font-medium text-foreground truncate">{user.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-destructive/10 transition-colors"
          >
            <LogOutIcon className="w-4 h-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}