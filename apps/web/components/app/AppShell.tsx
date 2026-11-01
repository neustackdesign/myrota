"use client";
import { RuntimeProvider } from "@/lib/client/runtime";
import { useAppVM } from "@/lib/app/useAppVM";
import { AppFrame } from "./AppFrame";

export function AppShell() {
  return (
    <RuntimeProvider>
      <AppView />
    </RuntimeProvider>
  );
}

function AppView() {
  const v = useAppVM();
  return <AppFrame v={v} />;
}
