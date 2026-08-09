export type NativeSupportProduct = {
  id: string;
  displayName: string;
  displayPrice: string;
};

export type NativeMessage =
  | { type: "supportProducts"; products: NativeSupportProduct[] }
  | { type: "supportState"; status: "idle" | "loading" | "purchasing" | "purchased" | "pending" | "cancelled" | "failed"; message?: string };

type XiaziNativeWindow = Window & {
  XiaziNativeBridge?: {
    platform?: string;
    shellVersion?: string;
    capabilities?: string[];
  };
  webkit?: {
    messageHandlers?: {
      xiaziNative?: {
        postMessage: (message: unknown) => void;
      };
    };
  };
};

export const NATIVE_MESSAGE_EVENT = "xiazi:native-message";

function nativeWindow() {
  return window as XiaziNativeWindow;
}

export function isXiaziIOSApp() {
  if (typeof window === "undefined") return false;
  const current = nativeWindow();
  return current.XiaziNativeBridge?.platform === "ios"
    && typeof current.webkit?.messageHandlers?.xiaziNative?.postMessage === "function";
}

export function postNativeMessage(type: string, payload: Record<string, unknown> = {}) {
  if (!isXiaziIOSApp()) return false;
  nativeWindow().webkit?.messageHandlers?.xiaziNative?.postMessage({ type, payload });
  return true;
}

export function subscribeToNativeMessages(listener: (message: NativeMessage) => void) {
  const handleMessage = (event: Event) => {
    const message = (event as CustomEvent<NativeMessage>).detail;
    if (message?.type === "supportProducts" || message?.type === "supportState") {
      listener(message);
    }
  };

  window.addEventListener(NATIVE_MESSAGE_EVENT, handleMessage);
  return () => window.removeEventListener(NATIVE_MESSAGE_EVENT, handleMessage);
}
