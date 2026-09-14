"use client";

import { useEffect } from "react";
import { loadCurrentIssue } from "@/features/issues/content-service";

// Check the mutable publication pointer on cold launch and foreground return.
// A whole-page replacement keeps masthead, archive list and posters in one edition.
export function useNativeEditionRefresh(enabled: boolean, archived: boolean, version: string) {
  useEffect(() => {
    if (!enabled || archived) return;
    let disposed = false;
    let running = false;
    const check = async () => {
      if (running || document.visibilityState === "hidden") return;
      running = true;
      document.documentElement.dataset.editionReady = "checking";
      try {
        const issue = await loadCurrentIssue();
        if (disposed) return;
        const latest = issue.assetVersion || issue.beijingTimestamp || issue.issueDate;
        if (latest !== version) {
          const url = new URL(window.location.href);
          // One replacement per version prevents a stale upstream from looping.
          if (url.searchParams.get("edition") !== latest) {
            url.searchParams.set("edition", latest);
            window.location.replace(url.href);
            return;
          }
          document.documentElement.dataset.editionReady = "fallback";
          return;
        }
        document.documentElement.dataset.editionReady = "ready";
      } catch {
        if (!disposed) document.documentElement.dataset.editionReady = "fallback";
      } finally {
        running = false;
      }
    };
    void check();
    const resume = () => { void check(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("online", resume);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("online", resume);
    };
  }, [enabled, archived, version]);
}
