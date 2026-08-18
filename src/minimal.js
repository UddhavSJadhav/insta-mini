const minimalJs = `(function () {
  var TAB_ATTR = "data-insta-mini-tab";
  var STYLE_ID = "insta-mini-style";
  var AUTH =
    /\\/accounts\\/(login|emailsignup|password|onetap)|\\/challenge|\\/two_factor|\\/consent|\\/auth|\\/session\\//;

  let USERNAME = "";
  let IS_MOBILE_USER_AGENT = navigator.userAgent.includes("Mobile");

  function currentTab() {
    return document.documentElement.getAttribute(TAB_ATTR) || "following";
  }

  function isAuthPage() {
    var host = (location.hostname || "").toLowerCase();
    var path = location.pathname || "";
    if (
      host.indexOf("facebook.com") !== -1 ||
      host.indexOf("meta.com") !== -1 ||
      host.indexOf("accountscenter") !== -1
    ) {
      return true;
    }
    return AUTH.test(path);
  }

  function cssText(tab) {
    var stories =
      tab === "stories"
        ? 'html[data-insta-mini-tab="stories"] article { display: none !important; }'
        : "";
    return (
      "html[data-insta-mini-ready] nav," +
      'html[data-insta-mini-ready] [role="navigation"] {' +
      "  display: none !important;" +
      "}" +
      stories
    );
  }

  function ensureStyle() {
    if (location.pathname.includes("inbox")) return;
    if (isAuthPage()) {
      var existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
      document.documentElement.removeAttribute("data-insta-mini-ready");
      return;
    }
    var style = document.getElementById(STYLE_ID);
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || document.documentElement).appendChild(style);
    }
    style.textContent = cssText(currentTab());
    document.documentElement.setAttribute("data-insta-mini-ready", "1");
  }

  function isExploreRoot(path) {
    return path === "/explore" || path === "/explore/";
  }

  function guardUrl() {
    if (isAuthPage()) return false;
    var path = location.pathname || "/";
    var search = location.search || "";
    var tab = currentTab();

    if (isExploreRoot(path)) {
      location.replace("https://www.instagram.com/explore/search/");
      return true;
    }

    if (path.indexOf("/reels") === 0) {
      location.replace("https://www.instagram.com/?variant=following");
      return true;
    }

    return false;
  }

  // Hide inbox messages floating icon
  function hideInboxIcon() {
    document.querySelectorAll("svg[aria-label='Messages']").forEach(inbox => {
      const container = inbox.closest("div[role='button']")?.parentElement;

      container?.style.setProperty("display", "none", "important");
    });
  }

  // Hide nav : logo, search, notifications
  function hideNav() {
    if(location.pathname.includes("/"+USERNAME)||location.pathname.includes("/explore")) return;
    document.querySelector("nav")?.style.setProperty("display", "none", "important");
  }

  function reportUsername(name) {
    if (!name) return;
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "username", value: name })
        );
      }
    } catch (e) {}
  }

  // Hide tabs bar and get username from the profile anchor
  function hideTabsAndGetUsername() {
    const tabsParent = document
      .querySelector("svg[aria-label='Home']")
      ?.closest("div[data-visualcompletion='ignore-dynamic']")
      ?.closest("div.html-div");
    if (!tabsParent) return;

    tabsParent.style.setProperty("display", "none", "important");

    if (!USERNAME) {
      const anchors = tabsParent.querySelectorAll("a[href]");
      if (anchors.length > 0) {
        const href = anchors[anchors.length - 1].getAttribute("href") || "";
        var path = href;
        try {
          if (href.indexOf("http") === 0) path = new URL(href).pathname;
        } catch (e) {}
        var parts = path.split("/").filter(function (part) {
          return part.length > 0;
        });
        if (parts.length === 1 && /^[a-zA-Z0-9._]+$/.test(parts[0])) {
          USERNAME = parts[0];
        }
      }

      if (USERNAME) reportUsername(USERNAME);
    }
  }

  // JS to run in inbox page
  function runInbox() {
    if(IS_MOBILE_USER_AGENT && location.pathname.includes("direct")) {
      const backButton = document.querySelector("svg[aria-label='Back']");
      if(backButton) backButton.style.setProperty("display", "none", "important");

      const downChevronIcon = document.querySelector("svg[aria-label='Down chevron icon']");
      if(downChevronIcon) downChevronIcon.style.setProperty("display", "none", "important");

      return;
    }

    if (!location.pathname.includes("inbox")) return;

    const threadList = document.querySelector("div[aria-label='Thread list']");

    // Make chat box to take full height (thread list parent div)
    threadList?.closest("div.html-div")?.style.setProperty("height", "100%", "important");

    // Make Chat box to more width
    threadList?.style.setProperty("margin-right", "-20px", "important");
  }

  // JS to run in explore/search page
  function runExploreSearch() {
    if (!location.pathname.includes("explore/search")) return;

    const directDivOfMain = document.querySelector("main>div");
    if (directDivOfMain) directDivOfMain.style.setProperty("display", "none", "important");

    const nav = document.querySelector("nav");
    if (nav) {
      nav.style.setProperty("flex", "1", "important");

      const backButton = nav.querySelector("div[role='button'][aria-label='Back']");
      if (backButton) backButton.style.setProperty("display", "none", "important");

      const cancelButton = Array.from(nav.querySelectorAll("div[role='button']")).find(
        btn => btn.textContent.trim() === "Cancel"
      );
      if (cancelButton) cancelButton.style.setProperty("display", "none", "important");

      const firstHTMLDiv = nav.querySelector("div.html-div")
      const parent = firstHTMLDiv?.parentElement;
      if (parent) {
        parent.style.setProperty("display", "block", "important");
        parent.style.setProperty("width", "100%", "important");
        parent.style.setProperty("height", "100%", "important");
        parent.style.setProperty("padding-top", "10px", "important");
      }

      const sibling = firstHTMLDiv?.nextElementSibling;
      if (sibling) {
        sibling.style.setProperty("height", "calc(100vh - 60px)", "important");
      }
    }
  }

  // JS to run in Home (Stories) page
  function runStories() {
    if (location.pathname !== "/") return;

    const storiesTray = document.querySelector("div[data-pagelet='story_tray']");
    if(!storiesTray) return;

    // Hide the next element sibling of the stories tray (HIDE HOME FEED)
    storiesTray.parentElement?.nextElementSibling?.style.setProperty("display", "none", "important");

    if(IS_MOBILE_USER_AGENT) {
      const flexBox = storiesTray.querySelector("div[style*='display: flex']");
      if(!flexBox) return;
      
      flexBox.style.setProperty("height", "100vh", "important");
      flexBox.style.setProperty("width", "100vw", "important");
      flexBox.style.setProperty("justify-content", "flex-start", "important");
      flexBox.style.setProperty("align-items", "center", "important");

      return;
    }

    // Hide next button of the stories tray
    storiesTray.querySelector("button[aria-label='Next']")?.style.setProperty("display", "none", "important");

    // Modify UL elements inside stories tray
    const ulElement = storiesTray.querySelector("ul");
    if(!ulElement) return;

    ulElement.style.setProperty("height", "100vh", "important");
    ulElement.style.setProperty("width", "100vw", "important");
    ulElement.style.setProperty("flex-wrap", "nowrap", "important");
  }

  // Get message notification count
  function getNewMessagesCount() {
    let messageNotificationCountDiv = document.querySelector("svg[aria-label='Messages']")?.nextElementSibling;
    if(!messageNotificationCountDiv) {
      messageNotificationCountDiv = document.querySelector("svg[aria-label='Messages']")?.parentElement?.nextElementSibling;
    }
    if(!messageNotificationCountDiv) return;

    const count = messageNotificationCountDiv.querySelector("span")?.textContent?.trim() || "0";

    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: "new_messages_count", value: count })
        );
      }
    } catch (e) {}
  }

  function apply() {
    if (window.__instaMiniScanning) return;

    if (guardUrl()) return;
    // ensureStyle();

    if (isAuthPage()) return;
    hideInboxIcon();
    hideNav();
    hideTabsAndGetUsername();

    runInbox();
    runExploreSearch();
    runStories();
    getNewMessagesCount();
  }

  function hookHistory() {
    if (window.__instaMiniHooked) return;
    window.__instaMiniHooked = true;
    var wrap = function (fn) {
      return function () {
        var ret = fn.apply(this, arguments);
        setTimeout(apply, 0);
        return ret;
      };
    };
    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);
    window.addEventListener("popstate", function () {
      setTimeout(apply, 0);
    });
    var observer = new MutationObserver(function () {
      if (window.__instaMiniObsTimer) return;
      window.__instaMiniObsTimer = setTimeout(function () {
        window.__instaMiniObsTimer = null;
        apply();
      }, 250);
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  hookHistory();
  apply();
})();`;

module.exports = minimalJs;
