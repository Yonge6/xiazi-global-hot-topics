import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ effect: undefined as undefined | (() => void | (() => void)), load: vi.fn() }));
vi.mock("react", () => ({ useEffect: (effect: () => void | (() => void)) => { hooks.effect = effect; } }));
vi.mock("@/features/issues/content-service", () => ({ loadCurrentIssue: hooks.load }));
import { useNativeEditionRefresh } from "@/lib/use-native-edition-refresh";

describe("native edition refresh", () => {
  const replace = vi.fn();
  let cleanup: void | (() => void);
  let doc: EventTarget & { visibilityState: string; documentElement: { dataset: Record<string, string> } };
  beforeEach(() => {
    hooks.load.mockReset(); replace.mockReset();
    doc = Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { dataset: {} } });
    vi.stubGlobal("document", doc);
    vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { href: "https://xiazishuo.com/en/?surface=ios#stories", replace } }));
  });
  afterEach(() => { cleanup?.(); cleanup = undefined; vi.unstubAllGlobals(); });
  const start = (archived = false, enabled = true) => {
    // Hook effects are executed explicitly by this dependency-isolated harness.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useNativeEditionRefresh(enabled, archived, "old"); cleanup = hooks.effect?.();
  };
  it("waits for latest request before declaring ready", async () => {
    hooks.load.mockResolvedValue({ assetVersion: "old" }); start();
    expect(doc.documentElement.dataset.editionReady).toBe("checking");
    await vi.waitFor(() => expect(doc.documentElement.dataset.editionReady).toBe("ready"));
    expect(replace).not.toHaveBeenCalled();
  });
  it("replaces the whole edition while preserving locale and deep link", async () => {
    hooks.load.mockResolvedValue({ assetVersion: "new" }); start();
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("https://xiazishuo.com/en/?surface=ios&edition=new#stories"));
    expect(doc.documentElement.dataset.editionReady).not.toBe("ready");
  });
  it("does not loop when the same version remains stale after replacement", async () => {
    Object.assign(window.location, { href: "https://xiazishuo.com/en/?edition=new" });
    hooks.load.mockResolvedValue({ assetVersion: "new" }); start();
    await vi.waitFor(() => expect(doc.documentElement.dataset.editionReady).toBe("fallback"));
    expect(replace).not.toHaveBeenCalled();
  });
  it("retains readable content offline and retries when back online", async () => {
    hooks.load.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ assetVersion: "old" }); start();
    await vi.waitFor(() => expect(doc.documentElement.dataset.editionReady).toBe("fallback"));
    window.dispatchEvent(new Event("online"));
    await vi.waitFor(() => expect(doc.documentElement.dataset.editionReady).toBe("ready"));
  });
  it("does not replace deliberate archive reading or ordinary browser pages", () => {
    start(true); expect(hooks.load).not.toHaveBeenCalled();
    start(false, false); expect(hooks.load).not.toHaveBeenCalled();
  });
  it("ignores an in-flight response after switching to archive", async () => {
    let resolve!: (value: unknown) => void;
    hooks.load.mockReturnValue(new Promise((done) => { resolve = done; })); start();
    cleanup?.(); resolve({ assetVersion: "new" });
    await Promise.resolve(); expect(replace).not.toHaveBeenCalled();
  });
  it("checks again on foreground return", async () => {
    hooks.load.mockResolvedValue({ assetVersion: "old" }); start();
    await vi.waitFor(() => expect(doc.documentElement.dataset.editionReady).toBe("ready"));
    doc.visibilityState = "hidden"; doc.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.load).toHaveBeenCalledTimes(1);
    doc.visibilityState = "visible"; doc.dispatchEvent(new Event("visibilitychange"));
    expect(hooks.load).toHaveBeenCalledTimes(2);
  });
});
