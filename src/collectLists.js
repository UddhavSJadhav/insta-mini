const collectListsJs = `(function () {
  var gen = window.__instaMiniCollectGeneration || 0;
  if (window.__instaMiniCollecting && window.__instaMiniCollectGen === gen) return;
  window.__instaMiniCollecting = true;
  window.__instaMiniCollectGen = gen;
  window.__instaMiniScanning = true;

  var kind = window.__instaMiniCollectKind || "following";
  var reserved = {
    explore: 1,
    reels: 1,
    direct: 1,
    accounts: 1,
    stories: 1,
    following: 1,
    followers: 1,
    tagged: 1,
    reel: 1,
    p: 1,
    about: 1,
    legal: 1,
    nametag: 1,
    directory: 1,
  };

  function alive() {
    return window.__instaMiniCollectGen === gen;
  }

  function post(payload) {
    try {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  function debug(msg) {
    console.log("[collect " + kind + "] " + msg);
    post({ type: "scan_debug", value: "[" + kind + "] " + msg });
  }

  debug("collector start url=" + location.href);

  function usernameFromHref(href) {
    var path = href;
    try {
      if (href.indexOf("http") === 0) path = new URL(href).pathname;
    } catch (e) {}
    var parts = path.split("/").filter(function (part) {
      return part.length > 0;
    });
    if (parts.length !== 1) return "";
    var name = parts[0];
    if (reserved[name.toLowerCase()]) return "";
    if (!/^[a-zA-Z0-9._]+$/.test(name)) return "";
    return name;
  }

  function rowOf(el) {
    var cur = el;
    for (var i = 0; i < 10 && cur; i++) {
      var img = cur.querySelector ? cur.querySelector("img") : null;
      var links = cur.querySelectorAll ? cur.querySelectorAll("a[href]") : [];
      if (img && links.length) return cur;
      cur = cur.parentElement;
    }
    return el.parentElement;
  }

  function usersFrom(root) {
    var map = {};
    if (!root) return [];
    var links = root.querySelectorAll('a[href]:not([style])');
    for (var i = 0; i < links.length; i++) {
      var username = usernameFromHref(links[i].getAttribute("href") || "");
      if (!username) continue;
      var key = username.toLowerCase();
      if (!map[key]) map[key] = { username: username, name: "", photo: "" };
      var row = rowOf(links[i]);
      if (!row) continue;
      if (!map[key].photo) {
        var img = row.querySelector("img");
        var src = (img && (img.getAttribute("src") || img.src)) || "";
        if (src.indexOf("http") === 0) map[key].photo = src;
      }
      if (!map[key].name) {
        var spans = row.querySelectorAll("span");
        for (var s = 0; s < spans.length; s++) {
          var text = (spans[s].textContent || "").replace(/\\s+/g, " ").trim();
          if (!text || text.toLowerCase() === key) continue;
          if (text.length > 80) continue;
          if (/^(follow|following|unfollow|requested)$/i.test(text)) continue;
          map[key].name = text;
          break;
        }
      }
    }
    var out = [];
    for (var k in map) {
      if (Object.prototype.hasOwnProperty.call(map, k)) out.push(map[k]);
    }
    return out;
  }

  function nodeLabel(el) {
    return ((el.getAttribute("aria-label") || "") + " " + (el.textContent || ""))
      .replace(/\\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isFollowStateLabel(text) {
    return (
      text === "follow" ||
      text === "following" ||
      text === "unfollow" ||
      text === "requested"
    );
  }

  function isCountLabel(text, suffix) {
    var re =
      suffix === "followers"
        ? /^\\d[\\d,.]*\\s+followers$/
        : /^\\d[\\d,.]*\\s+following$/;
    return re.test(text);
  }

  function isConfirmDialog(dialog) {
    if (!dialog) return false;
    var t = (dialog.textContent || "").toLowerCase();
    return t.indexOf("unfollow") !== -1 && t.indexOf("cancel") !== -1;
  }

  function findListDialog() {
    var dialogs = document.querySelectorAll('[role="dialog"]');
    for (var i = 0; i < dialogs.length; i++) {
      if (isConfirmDialog(dialogs[i])) continue;
      return dialogs[i];
    }
    var labeled = document.querySelector(
      'div[aria-label="Following"], div[aria-label="Followers"]'
    );
    if (labeled && !isConfirmDialog(labeled)) return labeled;
    var headings = document.querySelectorAll("h1, h2");
    for (var h = 0; h < headings.length; h++) {
      var title = (headings[h].textContent || "").trim();
      if (title !== "Following" && title !== "Followers") continue;
      var el = headings[h];
      for (var k = 0; k < 10 && el; k++) {
        if (el.getAttribute && el.getAttribute("role") === "dialog") return el;
        if (el.querySelectorAll && el.querySelectorAll('a[href^="/"]').length > 4) {
          return el;
        }
        el = el.parentElement;
      }
    }
    return null;
  }

  function findScroller(dialog) {
    if (!dialog) return null;
    var nodes = dialog.querySelectorAll("div");
    var best = null;
    var bestSize = 0;
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var style = window.getComputedStyle(el);
      var scrollable =
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflow === "auto" ||
        style.overflow === "scroll";
      if (scrollable && el.scrollHeight > el.clientHeight + 20) {
        if (el.scrollHeight > bestSize) {
          best = el;
          bestSize = el.scrollHeight;
        }
      }
    }
    return best || dialog;
  }

  function pathOf(el) {
    var href = el.getAttribute("href") || el.href || "";
    try {
      if (href.indexOf("http") === 0) return new URL(href).pathname.toLowerCase();
    } catch (e) {}
    return href.toLowerCase();
  }

  function isOwnListPath(path, suffix) {
    var parts = path.replace(/\\/$/, "").split("/").filter(function (part) {
      return part.length > 0;
    });
    return parts.length === 2 && parts[1] === suffix;
  }

  function isInsideDialog(el) {
    return !!(el.closest && el.closest('[role="dialog"]'));
  }

  function dismissConfirm() {
    var dialogs = document.querySelectorAll('[role="dialog"]');
    for (var i = 0; i < dialogs.length; i++) {
      if (!isConfirmDialog(dialogs[i])) continue;
      var buttons = dialogs[i].querySelectorAll("button, div[role='button']");
      for (var j = 0; j < buttons.length; j++) {
        var label = nodeLabel(buttons[j]);
        if (label === "cancel" || label.indexOf("cancel") !== -1) {
          debug("clicked=cancel-unfollow overlay=true");
          buttons[j].click();
          return true;
        }
      }
    }
    return false;
  }

  function closeDialog() {
    var dialog = findListDialog();
    if (!dialog) return false;
    var closeSvg = dialog.querySelector(
      "svg[aria-label='Close'], svg[aria-label='close']"
    );
    var closeBtn =
      (closeSvg &&
        (closeSvg.closest("button") ||
          closeSvg.closest("div[role='button']") ||
          closeSvg.parentElement)) ||
      dialog.querySelector("button[aria-label='Close']");
    if (closeBtn) {
      debug("clicked=close-dialog overlay=true");
      closeBtn.click();
      return true;
    }
    debug("clicked=escape-dialog overlay=true");
    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        keyCode: 27,
        which: 27,
        bubbles: true,
      })
    );
    return true;
  }

  function clickProfileCount() {
    var suffix = kind === "followers" ? "followers" : "following";
    var links = document.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      if (isInsideDialog(links[i])) continue;
      var path = pathOf(links[i]);
      if (isOwnListPath(path, suffix)) {
        debug("clicked=profile-count overlay=" + !!findListDialog() + " href=" + path);
        links[i].click();
        return true;
      }
    }
    var nodes = document.querySelectorAll("header a, header span, main a, main span");
    for (var j = 0; j < nodes.length; j++) {
      if (isInsideDialog(nodes[j])) continue;
      var text = nodeLabel(nodes[j]);
      if (isFollowStateLabel(text)) continue;
      if (!isCountLabel(text, suffix)) continue;
      var clickable = nodes[j].closest("a") || nodes[j];
      debug("clicked=profile-text overlay=" + !!findListDialog() + " text=" + text);
      clickable.click();
      return true;
    }
    debug("clicked=none overlay=" + !!findListDialog());
    return false;
  }

  var awaitingClose = kind === "followers";
  var closeTries = 0;
  var stagnant = 0;
  var lastCount = 0;
  var ticks = 0;
  var maxTicks = 200;
  var opened = false;
  var lastUsers = [];
  var posted = false;

  function emitList(users) {
    if (posted) return;
    posted = true;
    window.__instaMiniCollecting = false;
    post({ type: "list", kind: kind, users: users || [] });
  }

  function openList() {
    if (dismissConfirm()) return false;
    var dialog = findListDialog();

    if (kind === "followers") {
      if (dialog && awaitingClose) {
        closeTries += 1;
        closeDialog();
        if (closeTries > 6) {
          awaitingClose = false;
          clickProfileCount();
        }
        return false;
      }
      if (!dialog) {
        awaitingClose = false;
        clickProfileCount();
        return false;
      }
      awaitingClose = false;
      return true;
    }

    if (!dialog) {
      clickProfileCount();
      return false;
    }
    return true;
  }

  function finish(users) {
    if (!alive() && posted) return;
    dismissConfirm();
    if (kind === "following") closeDialog();
    debug(
      "finish users=" +
        (users ? users.length : 0) +
        " ticks=" +
        ticks +
        " overlay=" +
        !!findListDialog()
    );
    emitList(users);
  }

  function tick() {
    if (!alive()) {
      if (window.__instaMiniCollectKind !== kind && lastUsers.length) {
        debug("flush on replace users=" + lastUsers.length);
        emitList(lastUsers);
      }
      return;
    }
    ticks += 1;
    dismissConfirm();

    if (!opened) {
      opened = true;
      debug("openList first try");
      openList();
    } else if (awaitingClose || !findListDialog()) {
      if (ticks % 2 === 0) {
        debug("openList retry tick=" + ticks + " awaitingClose=" + awaitingClose);
        openList();
      }
    }

    dismissConfirm();
    var dialog = findListDialog();
    var ready = !!dialog && !awaitingClose;
    var scroller = ready ? findScroller(dialog) : null;
    var users = ready ? usersFrom(scroller || dialog) : [];
    if (users.length) lastUsers = users;

    if (ticks === 1 || ticks % 6 === 0) {
      debug(
        "tick=" +
          ticks +
          " url=" +
          location.pathname +
          " overlay=" +
          !!dialog +
          " ready=" +
          ready +
          " scroll=" +
          !!scroller +
          " users=" +
          users.length
      );
    }

    if (!ready) {
      stagnant += 1;
    } else if (users.length !== lastCount) {
      stagnant = 0;
      lastCount = users.length;
      post({
        type: "list_progress",
        kind: kind,
        count: users.length,
        users: users,
      });
    } else {
      stagnant += 1;
    }

    if (ready && scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    } else if (ready && dialog) {
      dialog.scrollTop = dialog.scrollHeight;
    }

    if (ticks >= maxTicks) {
      finish(users);
      return;
    }
    if (ready && users.length > 0 && stagnant >= 12) {
      finish(users);
      return;
    }
    if (ready && dialog && users.length === 0 && stagnant >= 24) {
      finish(users);
      return;
    }
    setTimeout(tick, 500);
  }

  post({ type: "list_progress", kind: kind, count: 0 });
  setTimeout(tick, 800);
})();`;

module.exports = collectListsJs;
