import { ReactNode } from "react";
import BottomNav from "./BottomNav";

export default function AppShell({ children, hideNav }: { children: ReactNode; hideNav?: boolean }) {
  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col bg-background">
      <main className={`flex-1 ${hideNav ? "pb-safe" : "pb-24"}`}>{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
