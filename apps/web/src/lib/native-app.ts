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

function nativeWindow() {
  return window as XiaziNativeWindow;
}

export function isXiaziIOSApp() {
  if (typeof window === "undefined") return false;
  const current = nativeWindow();
  return current.XiaziNativeBridge?.platform === "ios"
    && typeof current.webkit?.messageHandlers?.xiaziNative?.postMessage === "function";
}

export const subscribeToNativeSurface = () => () => {};

export function postNativeMessage(type: string, payload: Record<string, unknown> = {}) {
  if (!isXiaziIOSApp()) return false;
  nativeWindow().webkit?.messageHandlers?.xiaziNative?.postMessage({ type, payload });
  return true;
}
