"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/client/pwa";

export function PwaRegister() {
  useEffect(() => {
    captureInstallPrompt();
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("myrota service worker registration failed", error);
    });
  }, []);

  return null;
}
