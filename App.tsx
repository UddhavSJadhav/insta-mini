import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { WebView } from "react-native-webview";
import { InstaWebView } from "./src/InstaWebView";
import type { MiniTab } from "./src/tabs";

const TAB_ITEMS: {
  id: MiniTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: "following", label: "Following", icon: "home-outline" },
  { id: "stories", label: "Stories", icon: "book-outline" },
  { id: "messages", label: "Messages", icon: "chatbubble-outline" },
  { id: "search", label: "Search", icon: "search-outline" },
  { id: "profile", label: "Profile", icon: "person-outline" },
];

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [tab, setTab] = useState<MiniTab>("following");
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <View style={styles.web}>
          <InstaWebView
            tab={tab}
            webViewRef={webViewRef}
            onCanGoBackChange={setCanGoBack}
          />
        </View>
        <View style={styles.bar}>
          {TAB_ITEMS.map((item) => {
            const selected = tab === item.id;
            const color = selected ? "#ffffff" : "#8e8e8e";
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={styles.item}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
              >
                <Ionicons name={item.icon} size={22} color={color} />
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
    fontSize: 10,
    fontWeight: "500",
  },
});
