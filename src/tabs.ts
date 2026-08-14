export type MiniTab = "following" | "stories" | "messages" | "search" | "profile";

export const HOME_URL = "https://www.instagram.com/";
export const FOLLOWING_URL = "https://www.instagram.com/?variant=following";
export const MESSAGES_URL = "https://www.instagram.com/direct/inbox/";
export const SEARCH_URL = "https://www.instagram.com/explore/search/";

export const CHROME_DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.6778.135 Safari/537.36";

export const ALLOWED_HOST_SUFFIXES = [
  "instagram.com",
  "facebook.com",
  "meta.com",
  "accountscenter.com",
  "fbcdn.net",
  "cdninstagram.com",
];

export function tabUrl(tab: MiniTab, username: string | null): string {
  switch (tab) {
    case "following":
    case "stories":
      return FOLLOWING_URL;
    case "messages":
      return MESSAGES_URL;
    case "search":
      return SEARCH_URL;
    case "profile":
      return username ? `https://www.instagram.com/${username}/` : HOME_URL;
  }
}

export function isAllowedHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  const h = hostname.toLowerCase().replace(/\.$/, "");
  return ALLOWED_HOST_SUFFIXES.some((suffix) => h === suffix || h.endsWith(`.${suffix}`));
}

export function usernameFromCookieString(cookie: string): string | null {
  const dsUser = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("ds_user="))
    ?.slice("ds_user=".length);
  if (!dsUser || dsUser === "undefined") return null;
  try {
    return decodeURIComponent(dsUser);
  } catch {
    return dsUser;
  }
}

export function sameDestination(current: string | undefined, target: string): boolean {
  if (!current) return false;
  try {
    const a = new URL(current);
    const b = new URL(target);
    const pathA = a.pathname.replace(/\/$/, "") || "/";
    const pathB = b.pathname.replace(/\/$/, "") || "/";
    return (
      a.hostname === b.hostname &&
      pathA === pathB &&
      a.searchParams.get("variant") === b.searchParams.get("variant")
    );
  } catch {
    return current === target;
  }
}
