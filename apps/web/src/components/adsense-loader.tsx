"use client";

import { useEffect } from "react";

import { isNativeIOSSurface } from "@/lib/analytics/client";

const clientID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID?.trim();

function isValidClientID(value: string | undefined): value is string {
  return /^ca-pub-\d{16}$/.test(value ?? "");
}

export function AdsenseLoader() {
  useEffect(() => {
    if (!isValidClientID(clientID) || isNativeIOSSurface()) return;
    if (document.querySelector("script[data-xiazi-adsense]")) return;

    const script = document.createElement("script");
    script.async = true;
    script.crossOrigin = "anonymous";
    script.dataset.xiaziAdsense = "true";
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientID)}`;
    document.head.appendChild(script);
  }, []);

  return null;
}
