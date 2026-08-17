import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import type { ScanUser } from "./InstaWebView";

type SubTab =
  | "following"
  | "followers"
  | "notFollowingBack"
  | "notFollowedBack";

const ROW_HEIGHT = 64;

const TABS: { id: SubTab; label: string }[] = [
  { id: "following", label: "Following" },
  { id: "followers", label: "Followers" },
  { id: "notFollowingBack", label: "Not following back" },
  { id: "notFollowedBack", label: "You don’t follow" },
];

type Props = {
  hidden?: boolean;
  username: string | null;
  scanning: boolean;
  scanPhase: "following" | "followers" | null;
  scanCount: number;
  hasResult: boolean;
  following: ScanUser[];
  followers: ScanUser[];
  notFollowingBack: ScanUser[];
  notFollowedBack: ScanUser[];
  onRefresh: () => void;
  onOpenUser: (username: string) => void;
  mobileUa: boolean;
  onMobileUaChange: (value: boolean) => void;
};

const UserRow = memo(function UserRow({
  item,
  onOpen,
}: {
  item: ScanUser;
  onOpen: (username: string) => void;
}) {
  return (
    <Pressable style={styles.row} onPress={() => onOpen(item.username)}>
      {item.photo ? (
        <Image source={{ uri: item.photo }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarLetter}>
            {(item.name || item.username).slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || item.username}
        </Text>
        <Text style={styles.handle} numberOfLines={1}>
          @{item.username}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color="#8e8e8e" />
    </Pressable>
  );
});

export function AdvancedScreen({
  hidden = false,
  username,
  scanning,
  scanPhase,
  scanCount,
  hasResult,
  following,
  followers,
  notFollowingBack,
  notFollowedBack,
  onRefresh,
  onOpenUser,
  mobileUa,
  onMobileUaChange,
}: Props) {
  const [subTab, setSubTab] = useState<SubTab>("following");
  const lists: Record<SubTab, ScanUser[]> = {
    following,
    followers,
    notFollowingBack,
    notFollowedBack,
  };
  const rows = lists[subTab];

  const renderItem = useCallback(
    ({ item }: { item: ScanUser }) => (
      <UserRow item={item} onOpen={onOpenUser} />
    ),
    [onOpenUser],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<ScanUser> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View
      style={[
        scanning ? styles.rootScan : styles.root,
        hidden && styles.hidden,
      ]}
      pointerEvents={hidden ? "none" : "auto"}
    >
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
        {username ? (
          scanning ? (
            <View style={styles.loading}>
              <ActivityIndicator color="#ffffff" size="small" />
              <Text style={styles.loadingText}>
                {scanPhase === "followers" ? "Followers" : "Following"}
                {scanCount ? ` ${scanCount}` : ""}
              </Text>
            </View>
          ) : (
            <Pressable style={styles.scanBtn} onPress={onRefresh}>
              <Text style={styles.scanBtnText}>
                {hasResult ? "Scan again" : "Scan lists"}
              </Text>
            </Pressable>
          )
        ) : null}
      </View>
      <View style={styles.uaRow}>
        <View style={styles.uaCopy}>
          <Text style={styles.uaLabel}>Mobile site</Text>
          <Text style={styles.uaHint}>
            Uses a phone browser. Scan and layout may differ from desktop.
          </Text>
        </View>
        <Switch
          value={mobileUa}
          onValueChange={onMobileUaChange}
          trackColor={{ false: "#333333", true: "#3d7a4a" }}
          thumbColor="#ffffff"
        />
      </View>
      <Text style={styles.hint}>
        Your account only. Reads Instagram’s Following and Followers dialogs.
        Large lists take time, and Instagram can change the page layout.
      </Text>

      {!username ? (
        <Text style={styles.empty}>
          Open Home or Profile once so we can detect your account, then return
          here.
        </Text>
      ) : (
        <>
          <View style={styles.subs}>
            {TABS.map((tab) => {
              const on = subTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  onPress={() => setSubTab(tab.id)}
                  style={[styles.sub, on && styles.subOn]}
                >
                  <Text
                    style={[styles.subText, on && styles.subTextOn]}
                    numberOfLines={2}
                  >
                    {tab.label} ({lists[tab.id].length})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {scanning ? null : (
            <FlatList
              data={rows}
              keyExtractor={(item) => item.username}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              initialNumToRender={12}
              maxToRenderPerBatch={12}
              windowSize={7}
              removeClippedSubviews
              ListEmptyComponent={
                <Text style={styles.empty}>
                  {hasResult ? "No accounts in this list." : "Tap Scan lists."}
                </Text>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  rootScan: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 280,
    zIndex: 2,
    backgroundColor: "rgba(0,0,0,0.92)",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  hidden: {
    opacity: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  title: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  uaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  uaCopy: {
    flex: 1,
  },
  uaLabel: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  uaHint: {
    color: "#8e8e8e",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  hint: {
    color: "#8e8e8e",
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 16,
  },
  subs: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  sub: {
    width: "50%",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 2,
    borderBottomColor: "#1a1a1a",
  },
  subOn: {
    borderBottomColor: "#ffffff",
  },
  subText: {
    color: "#8e8e8e",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  subTextOn: {
    color: "#ffffff",
  },
  loading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 13,
  },
  scanBtn: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scanBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  empty: {
    color: "#8e8e8e",
    fontSize: 14,
    paddingVertical: 24,
    textAlign: "center",
  },
  row: {
    height: ROW_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomColor: "#1a1a1a",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    color: "#8e8e8e",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    flex: 1,
  },
  name: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  handle: {
    color: "#8e8e8e",
    fontSize: 13,
    marginTop: 2,
  },
});
