import React, { useEffect, useRef, useState, type RefObject } from "react";
import { Linking, Alert } from "react-native";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";
import collectListsJs from "./collectLists.js";
import minimalJs from "./minimal.js";
import {
  CHROME_DESKTOP_UA,
  isAllowedHost,
  sameDestination,
  tabUrl,
  type MiniTab,
} from "./tabs";

const COOKIE_JS = `(function(){
  try {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: "cookies",
        value: document.cookie
      }));
    }
  } catch (e) {}
})();`;

function openExternal(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    Linking.openURL(url).catch(() => {});
  }
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname.toLowerCase().replace(/\/$/, "") || "/";
  } catch {
    return "";
  }
}

function isListPath(url: string): boolean {
  const path = pathOf(url);
  return path.endsWith("/following") || path.endsWith("/followers");
}

export type ScanPhase = "following" | "followers";

export type ScanUser = {
  username: string;
  name: string;
  photo: string;
};

function asScanUser(value: unknown): ScanUser | null {
  if (typeof value === "string" && value) {
    return { username: value, name: "", photo: "" };
  }
  if (value && typeof value === "object") {
    const raw = value as { username?: unknown; name?: unknown; photo?: unknown };
    if (typeof raw.username !== "string" || !raw.username) return null;
    return {
      username: raw.username,
      name: typeof raw.name === "string" ? raw.name : "",
      photo: typeof raw.photo === "string" ? raw.photo : "",
    };
  }
  return null;
}

type Props = {
  tab: MiniTab;
  webViewRef: RefObject<WebView | null>;
  scanToken?: number;
  openProfileUser?: string | null;
  onCanGoBackChange?: (canGoBack: boolean) => void;
  onNewMessagesCount?: (count: string) => void;
  onUsername?: (username: string) => void;
  onScanProgress?: (phase: ScanPhase, count: number) => void;
  onScanComplete?: (following: ScanUser[], followers: ScanUser[]) => void;
  onScanError?: () => void;
  onScanDebug?: (line: string) => void;
};

export function InstaWebView({
  tab,
  webViewRef,
  scanToken = 0,
  openProfileUser = null,
  onCanGoBackChange,
  onNewMessagesCount,
  onUsername,
  onScanProgress,
  onScanComplete,
  onScanError,
  onScanDebug,
}: Props) {
  const usernameRef = useRef<string | null>(null);
  const lastTabRef = useRef<MiniTab | null>(null);
  const lastUsernameRef = useRef<string | null>(null);
  const scanningRef = useRef(false);
  const collectKindRef = useRef<ScanPhase | null>(null);
  const followingAccRef = useRef<ScanUser[]>([]);
  const followersAccRef = useRef<ScanUser[]>([]);
  const progressCountRef = useRef(0);
  const lastScanTokenRef = useRef(0);
  const lastOpenProfileRef = useRef<string | null>(null);
  const profileLoadedRef = useRef(false);
  const retryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeUri, setActiveUri] = useState(tabUrl("following", null));
  const [isScanning, setIsScanning] = useState(false);
  const activeUriRef = useRef(activeUri);
  activeUriRef.current = activeUri;

  const clearTimers = () => {
    retryTimersRef.current.forEach(clearTimeout);
    retryTimersRef.current = [];
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  };

  const injectChrome = (nextTab: MiniTab) => {
    webViewRef.current?.injectJavaScript(
      `document.documentElement.setAttribute('data-insta-mini-tab', ${JSON.stringify(
        nextTab
      )});
       ${minimalJs}
       ${COOKIE_JS}
       true;`,
    );
  };

  const injectCollector = (kind: ScanPhase) => {
    onScanDebug?.(`inject collector ${kind}`);
    console.log("[scan] inject collector", kind);
    webViewRef.current?.injectJavaScript(
      `window.__instaMiniScanning = true;
       window.__instaMiniCollectKind = ${JSON.stringify(kind)};
       window.__instaMiniCollecting = false;
       window.__instaMiniCollectGeneration = (window.__instaMiniCollectGeneration || 0) + 1;
       ${collectListsJs}
       true;`,
    );
  };

  const armCollector = (kind: ScanPhase) => {
    clearTimers();
    progressCountRef.current = 0;
    retryTimersRef.current.push(
      setTimeout(() => {
        if (
          scanningRef.current &&
          collectKindRef.current === kind &&
          progressCountRef.current === 0
        ) {
          injectCollector(kind);
        }
      }, 1500),
    );
    retryTimersRef.current.push(
      setTimeout(() => {
        if (
          scanningRef.current &&
          collectKindRef.current === kind &&
          progressCountRef.current === 0
        ) {
          injectCollector(kind);
        }
      }, 4000),
    );
    const watch = (extra: boolean) => {
      watchdogRef.current = setTimeout(() => {
        if (!scanningRef.current || collectKindRef.current !== kind) return;
        const count = progressCountRef.current;
        if (count > 0 && !extra) {
          watch(true);
          return;
        }
        if (kind === "following") {
          const user = usernameRef.current;
          if (!user) {
            stopScan();
            onScanError?.();
            return;
          }
          onScanProgress?.("followers", 0);
          navigateScan("followers", user);
        } else {
          stopScan();
          onScanComplete?.(followingAccRef.current, followersAccRef.current);
        }
      }, extra ? 25000 : 50000);
    };
    watch(false);
  };

  const navigateScan = (kind: ScanPhase, username: string) => {
    scanningRef.current = true;
    collectKindRef.current = kind;
    const profileUrl = `https://www.instagram.com/${username}/`;
    console.log("[scan] profile", kind, profileUrl);
    onScanDebug?.(`profile ${kind} ${profileUrl}`);
    setIsScanning(true);
    if (!profileLoadedRef.current) {
      profileLoadedRef.current = true;
      const onProfile = pathOf(activeUriRef.current) === `/${username.toLowerCase()}`;
      setActiveUri(profileUrl);
      if (onProfile) {
        injectCollector(kind);
      }
    } else {
      injectCollector(kind);
    }
    armCollector(kind);
  };

  const stopScan = () => {
    scanningRef.current = false;
    collectKindRef.current = null;
    setIsScanning(false);
    clearTimers();
    webViewRef.current?.injectJavaScript(
      `window.__instaMiniScanning = false;
       window.__instaMiniCollecting = false;
       window.__instaMiniCollectGeneration = (window.__instaMiniCollectGeneration || 0) + 1;
       true;`,
    );
  };

  const loadIfNeeded = (nextTab: MiniTab, username: string | null) => {
    if (nextTab === "advanced") {
      lastTabRef.current = nextTab;
      return;
    }
    if (scanningRef.current) stopScan();
    const target = tabUrl(nextTab, username);
    const tabChanged = lastTabRef.current !== nextTab;
    const usernameAppeared =
      nextTab === "profile" &&
      username != null &&
      lastUsernameRef.current == null;
    lastTabRef.current = nextTab;
    lastUsernameRef.current = username;
    if (
      (tabChanged || usernameAppeared) &&
      !sameDestination(activeUri, target)
    ) {
      setActiveUri(target);
    } else {
      injectChrome(nextTab);
    }
  };

  useEffect(() => {
    loadIfNeeded(tab, usernameRef.current);
  }, [tab]);

  useEffect(() => {
    if (!scanToken || scanToken === lastScanTokenRef.current) return;
    lastScanTokenRef.current = scanToken;
    const user = usernameRef.current;
    if (!user) {
      console.log("[scan] abort: no username in webview");
      onScanDebug?.("abort: no username in webview");
      onScanError?.();
      return;
    }
    followingAccRef.current = [];
    followersAccRef.current = [];
    progressCountRef.current = 0;
    profileLoadedRef.current = false;
    onScanProgress?.("following", 0);
    navigateScan("following", user);
  }, [scanToken]);

  useEffect(() => {
    if (!openProfileUser) {
      lastOpenProfileRef.current = null;
      return;
    }
    if (openProfileUser === lastOpenProfileRef.current) return;
    lastOpenProfileRef.current = openProfileUser;
    stopScan();
    webViewRef.current?.injectJavaScript(`(function(){
      var d = document.querySelector('[role="dialog"]');
      if (d) {
        var close = d.querySelector("svg[aria-label='Close']");
        var btn = close && (close.closest("button") || close.closest("div[role='button']"));
        if (btn) btn.click();
        else document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      }
      true;
    })();`);
    setActiveUri(`https://www.instagram.com/${openProfileUser}/`);
  }, [openProfileUser]);

  useEffect(() => () => clearTimers(), []);

  const onShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
    if (request.isTopFrame === false) return true;
    if (scanningRef.current && isListPath(request.url)) {
      onScanDebug?.(`block list-url ${request.url}`);
      return false;
    }
    const host = hostOf(request.url);
    if (isAllowedHost(host)) return true;
    openExternal(request.url);
    return false;
  };

  const rememberUsername = (username: string | null) => {
    if (!username || username === usernameRef.current) return;
    usernameRef.current = username;
    onUsername?.(username);
    loadIfNeeded(tab, username);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        value?: string;
        kind?: ScanPhase;
        count?: number;
        users?: unknown[];
      };
      if (data.type === "alert" && typeof data.value === "string") {
        Alert.alert("Alert: " + data.value);
        return;
      }
      if (data.type === "username" && typeof data.value === "string") {
        rememberUsername(data.value.trim() || null);
        return;
      }
      if (data.type === "new_messages_count" && typeof data.value === "string") {
        onNewMessagesCount?.(data.value.trim());
        return;
      }
      if (data.type === "scan_debug" && typeof data.value === "string") {
        console.log("[scan]", data.value);
        onScanDebug?.(data.value);
        return;
      }
      if (data.type === "list_progress" && data.kind) {
        const count = Number(data.count) || 0;
        progressCountRef.current = count;
        onScanProgress?.(data.kind, count);
        const snapshot = (data.users || [])
          .map(asScanUser)
          .filter((user): user is ScanUser => user != null);
        if (data.kind === "following" && snapshot.length) {
          followingAccRef.current = snapshot;
        }
        if (data.kind === "followers" && snapshot.length) {
          followersAccRef.current = snapshot;
        }
        return;
      }
      if (data.type === "list" && data.kind && Array.isArray(data.users)) {
        const users = data.users
          .map(asScanUser)
          .filter((user): user is ScanUser => user != null);
        console.log("[scan] list", data.kind, users.length);
        onScanDebug?.(`list ${data.kind} n=${users.length}`);
        if (data.kind === "following") {
          followingAccRef.current = users;
          if (collectKindRef.current !== "following") return;
          const user = usernameRef.current;
          if (!user) {
            stopScan();
            onScanError?.();
            return;
          }
          onScanProgress?.("followers", 0);
          navigateScan("followers", user);
          return;
        }
        followersAccRef.current = users;
        stopScan();
        onScanComplete?.(followingAccRef.current, users);
      }
    } catch {
      // Ignore unrelated page messages.
    }
  };

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    onCanGoBackChange?.(nav.canGoBack);
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: activeUri }}
      userAgent={CHROME_DESKTOP_UA}
      javaScriptEnabled
      domStorageEnabled
      cacheEnabled
      cacheMode="LOAD_DEFAULT"
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      setSupportMultipleWindows
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
      injectedJavaScriptBeforeContentLoaded={`
        window.__instaMiniScanning = ${isScanning ? "true" : "false"};
        document.documentElement.setAttribute('data-insta-mini-tab', ${JSON.stringify(tab)});
        true;
      `}
      injectedJavaScript={`${minimalJs}\n${COOKIE_JS}\ntrue;`}
      onLoadEnd={(event) => {
        const url = event.nativeEvent.url || "";
        const kind = collectKindRef.current;
        console.log("[scan] loadEnd", url, "scanning=", scanningRef.current, "kind=", kind);
        onScanDebug?.(`loadEnd ${url}`);
        if (scanningRef.current && kind && url.includes("instagram.com")) {
          if (isListPath(url)) {
            onScanDebug?.(`skip inject list-url ${url}`);
          } else if (progressCountRef.current > 0) {
            onScanDebug?.(`skip inject in-progress ${kind}`);
          } else {
            injectCollector(kind);
          }
        } else if (!scanningRef.current) {
          injectChrome(tab);
        }
      }}
      onMessage={onMessage}
      onNavigationStateChange={onNavigationStateChange}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onOpenWindow={(event) => {
        const url = event.nativeEvent.targetUrl;
        if (isAllowedHost(hostOf(url))) {
          webViewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`,
          );
        } else {
          openExternal(url);
        }
      }}
    />
  );
}
