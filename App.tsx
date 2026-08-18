import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { WebView } from "react-native-webview";
import { AdvancedScreen } from "./src/AdvancedScreen";
import {
  InstaWebView,
  type ScanPhase,
  type ScanUser,
} from "./src/InstaWebView";
import { CHROME_DESKTOP_UA, CHROME_MOBILE_UA, type MiniTab } from "./src/tabs";

const TAB_ITEMS: {
  id: MiniTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "following", label: "Following", icon: "home-outline" },
  { id: "stories", label: "Stories", icon: "book-outline" },
  { id: "messages", label: "Messages", icon: "chatbubble-outline" },
  { id: "notifications", label: "Activity", icon: "heart-outline" },
  { id: "search", label: "Search", icon: "search-outline" },
  { id: "profile", label: "Profile", icon: "person-outline" },
  { id: "advanced", label: "More", icon: "options-outline" },
];

const MOBILE_UA_KEY = "insta-mini.mobileUa";

function diffLists(following: ScanUser[], followers: ScanUser[], me: string) {
  const meLower = me.toLowerCase();
  const followerSet = new Set(
    followers.map((user) => user.username.toLowerCase())
  );
  const followingSet = new Set(
    following.map((user) => user.username.toLowerCase())
  );
  return {
    notFollowingBack: following.filter(
      (user) =>
        user.username.toLowerCase() !== meLower &&
        !followerSet.has(user.username.toLowerCase())
    ),
    notFollowedBack: followers.filter(
      (user) =>
        user.username.toLowerCase() !== meLower &&
        !followingSet.has(user.username.toLowerCase())
    ),
  };
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [tab, setTab] = useState<MiniTab>("following");
  const [canGoBack, setCanGoBack] = useState(false);
  const [messageCount, setMessageCount] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [scanToken, setScanToken] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scanPhase, setScanPhase] = useState<ScanPhase | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [hasResult, setHasResult] = useState(false);
  const [followingList, setFollowingList] = useState<ScanUser[]>([]);
  const [followersList, setFollowersList] = useState<ScanUser[]>([]);
  const [notFollowingBack, setNotFollowingBack] = useState<ScanUser[]>([]);
  const [notFollowedBack, setNotFollowedBack] = useState<ScanUser[]>([]);
  const [peekUser, setPeekUser] = useState<string | null>(null);
  const [mobileUa, setMobileUa] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(MOBILE_UA_KEY).then((value) => {
      if (value === "0") setMobileUa(false);
    });
  }, []);

  const onMobileUaChange = (value: boolean) => {
    setMobileUa(value);
    AsyncStorage.setItem(MOBILE_UA_KEY, value ? "1" : "0");
  };

  const startScan = () => {
    if (!username || scanning) return;
    setScanning(true);
    setScanPhase("following");
    setScanCount(0);
    setScanToken((token) => token + 1);
  };

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (tab === "advanced" && peekUser) {
        setPeekUser(null);
        return true;
      }
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, tab, peekUser]);

  const showBackBar = tab === "advanced" && !!peekUser;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.web}>
          <InstaWebView
            key={mobileUa ? "ua-mobile" : "ua-desktop"}
            tab={tab}
            webViewRef={webViewRef}
            userAgent={mobileUa ? CHROME_MOBILE_UA : CHROME_DESKTOP_UA}
            scanToken={scanToken}
            openProfileUser={peekUser}
            onCanGoBackChange={setCanGoBack}
            onUsername={setUsername}
            onNewMessagesCount={(count) => {
              setMessageCount(count && count !== "0" ? count : "");
            }}
            onScanProgress={(phase, count) => {
              setScanPhase(phase);
              setScanCount(count);
            }}
            onScanComplete={(following, followers) => {
              const diff = diffLists(following, followers, username || "");
              setFollowingList(following);
              setFollowersList(followers);
              setNotFollowingBack(diff.notFollowingBack);
              setNotFollowedBack(diff.notFollowedBack);
              setHasResult(true);
              setScanning(false);
              setScanPhase(null);
            }}
            onScanError={() => {
              setScanning(false);
              setScanPhase(null);
            }}
          />
          {tab === "advanced" ? (
            <AdvancedScreen
              hidden={!!peekUser}
              username={username}
              scanning={scanning}
              scanPhase={scanPhase}
              scanCount={scanCount}
              hasResult={hasResult}
              following={followingList}
              followers={followersList}
              notFollowingBack={notFollowingBack}
              notFollowedBack={notFollowedBack}
              onRefresh={startScan}
              onOpenUser={setPeekUser}
              mobileUa={mobileUa}
              onMobileUaChange={onMobileUaChange}
            />
          ) : null}
          {showBackBar ? (
            <Pressable style={styles.backBar} onPress={() => setPeekUser(null)}>
              <Ionicons name="chevron-back" size={20} color="#ffffff" />
              <Text style={styles.backText}>Back to lists</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.bar}>
          {TAB_ITEMS.map((item) => {
            const selected = tab === item.id;
            const color = selected ? "#ffffff" : "#8e8e8e";
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === "advanced") setPeekUser(null);
                  setTab(item.id);
                }}
                style={styles.item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
              >
                <View>
                  <Ionicons name={item.icon} size={22} color={color} />
                  {item.id === "messages" && messageCount ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{messageCount}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.label, { color }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#000000",
  },
  web: {
    flex: 1,
    backgroundColor: "#000000",
  },
  bar: {
    flexDirection: "row",
    backgroundColor: "#000000",
    borderTopColor: "#1a1a1a",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    paddingBottom: 4,
  },
  item: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  label: {
    fontSize: 9,
    fontWeight: "500",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: "#ff3040",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700",
  },
  backBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  backText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
});
