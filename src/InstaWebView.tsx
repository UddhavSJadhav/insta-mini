import React, { useEffect, useRef, type RefObject } from "react";
import { Linking, Alert } from "react-native";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";
import minimalJs from "./minimal.js";
import {
  CHROME_DESKTOP_UA,
  isAllowedHost,
  sameDestination,
  tabUrl,
  usernameFromCookieString,
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

type Props = {
  tab: MiniTab;
  webViewRef: RefObject<WebView | null>;
  onCanGoBackChange?: (canGoBack: boolean) => void;
};

export function InstaWebView({ tab, webViewRef, onCanGoBackChange }: Props) {
  const usernameRef = useRef<string | null>(null);
  const lastTabRef = useRef<MiniTab | null>(null);
  const lastUsernameRef = useRef<string | null>(null);
  const sourceUriRef = useRef(tabUrl("following", null));

  const inject = (nextTab: MiniTab) => {
    webViewRef.current?.injectJavaScript(
      `document.documentElement.setAttribute('data-insta-mini-tab', ${JSON.stringify(
        nextTab
      )});
       ${minimalJs}
       ${COOKIE_JS}
       true;`
    );
  };

  const loadIfNeeded = (nextTab: MiniTab, username: string | null) => {
    const target = tabUrl(nextTab, username);
    const tabChanged = lastTabRef.current !== nextTab;
    const usernameAppeared =
      nextTab === "profile" &&
      username != null &&
      lastUsernameRef.current == null;
    lastTabRef.current = nextTab;
    lastUsernameRef.current = username;
    inject(nextTab);
    if (
      (tabChanged || usernameAppeared) &&
      !sameDestination(sourceUriRef.current, target)
    ) {
      sourceUriRef.current = target;
      webViewRef.current?.stopLoading();
      webViewRef.current?.injectJavaScript(
        `window.location.replace(${JSON.stringify(target)}); true;`
      );
    }
  };

  useEffect(() => {
    loadIfNeeded(tab, usernameRef.current);
  }, [tab]);

  const onShouldStartLoadWithRequest = (request: ShouldStartLoadRequest) => {
    if (request.isTopFrame === false) return true;
    const host = hostOf(request.url);
    if (isAllowedHost(host)) return true;
    openExternal(request.url);
    return false;
  };

  const rememberUsername = (username: string | null) => {
    if (!username || username === usernameRef.current) return;
    usernameRef.current = username;
    loadIfNeeded(tab, username);
  };

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        value?: string;
      };
      if (typeof data.value !== "string") return;
      if (data.type === "alert") {
        Alert.alert("Alert: " + data.value);
        return;
      }
      if (data.type === "username") {
        rememberUsername(data.value.trim() || null);
        return;
      }
      if (data.type === "cookies") {
        rememberUsername(usernameFromCookieString(data.value));
      }
    } catch {
      // Ignore unrelated page messages.
    }
  };

  const onNavigationStateChange = (nav: WebViewNavigation) => {
    onCanGoBackChange?.(nav.canGoBack);
    if (nav.url) sourceUriRef.current = nav.url;
  };

  return (
    <WebView
      ref={webViewRef}
      source={{ uri: tabUrl("following", null) }}
      userAgent={CHROME_DESKTOP_UA}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled
      setSupportMultipleWindows
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      originWhitelist={["*"]}
      injectedJavaScriptBeforeContentLoaded={`document.documentElement.setAttribute('data-insta-mini-tab', ${JSON.stringify(
        tab
      )}); true;`}
      injectedJavaScript={`${minimalJs}\n${COOKIE_JS}\ntrue;`}
      onLoadEnd={() => inject(tab)}
      onMessage={onMessage}
      onNavigationStateChange={onNavigationStateChange}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onOpenWindow={(event) => {
        const url = event.nativeEvent.targetUrl;
        if (isAllowedHost(hostOf(url))) {
          webViewRef.current?.injectJavaScript(
            `window.location.href = ${JSON.stringify(url)}; true;`
          );
        } else {
          openExternal(url);
        }
      }}
    />
  );
}
