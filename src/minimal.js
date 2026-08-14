const minimalJs = `(function () {
  var TAB_ATTR = "data-insta-mini-tab";
  var STYLE_ID = "insta-mini-style";
  var AUTH =
    /\\/accounts\\/(login|emailsignup|password|onetap)|\\/challenge|\\/two_factor|\\/consent|\\/auth|\\/session\\//;

  let USERNAME = "";

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
    if (
      (tab === "following" || tab === "stories") &&
      (path === "/" || path === "") &&
      search.indexOf("variant=") === -1
    ) {
      location.replace("https://www.instagram.com/?variant=following");
      return true;
    }
    return false;
  }

  function looksLikeChrome(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    var style = window.getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var explore = !!el.querySelector('a[href="/explore/"], a[href="/explore"]');
    var reels = !!el.querySelector('a[href="/reels/"], a[href^="/reels"]');
    var messages = !!el.querySelector(
      'a[href="/direct/inbox/"], a[href="/direct/inbox"]'
    );
    var chromeHits = (explore ? 1 : 0) + (reels ? 1 : 0) + (messages ? 1 : 0);
    if (chromeHits < 1) return false;
    var isNav =
      el.tagName === "NAV" || el.getAttribute("role") === "navigation";
    var isFixed = style.position === "fixed" || style.position === "sticky";
    var leftSidebar =
      rect.height > window.innerHeight * 0.45 &&
      rect.width < 380 &&
      rect.left < 90;
    var bottomBar =
      isFixed &&
      rect.bottom >= window.innerHeight - 24 &&
      rect.height < 140 &&
      rect.width > window.innerWidth * 0.6;
    return isNav || leftSidebar || bottomBar || (isFixed && chromeHits >= 2);
  }



  function hideSuggested() {
    if (isAuthPage()) return;
    var nodes = document.querySelectorAll("span, h2, h3");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!el.childNodes || el.childNodes.length !== 1) continue;
      var text = (el.textContent || "").trim();
      if (text !== "Suggested for you" && text !== "Suggested Posts") continue;
      var p = el.parentElement;
      for (var j = 0; j < 7 && p && p !== document.body; j++) {
        var rect = p.getBoundingClientRect();
        if (p.tagName === "ASIDE" || (rect.width > 0 && rect.width < 420)) {
          p.style.setProperty("display", "none", "important");
          break;
        }
        p = p.parentElement;
      }
    }
  }

  function hideStoriesFeed() {
    if (isAuthPage()) return;
    var hide = currentTab() === "stories";
    var articles = document.querySelectorAll("article");
    for (var i = 0; i < articles.length; i++) {
      if (hide) {
        articles[i].style.setProperty("display", "none", "important");
      } else if (articles[i].style.display === "none") {
        articles[i].style.removeProperty("display");
      }
    }
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
      const anchors = tabsParent.querySelectorAll("a");
      if (anchors.length > 0) {
        USERNAME = anchors[anchors.length - 1].getAttribute("href")?.replaceAll("/", "");
      }

      if (USERNAME) reportUsername(USERNAME);
    }
  }

  // JS to run in inbox page
  function runInbox() {
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

  function apply() {
    // if (window.ReactNativeWebView) {
    //   window.ReactNativeWebView.postMessage(
    //     JSON.stringify({ type: "alert", value: "loaded" })
    //   );
    // }

    if (guardUrl()) return;
    // ensureStyle();

    if (isAuthPage()) return;
    hideInboxIcon();
    hideNav();
    hideTabsAndGetUsername();

    runInbox();
    runExploreSearch();

    // hideSuggested();
    // hideStoriesFeed();
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
