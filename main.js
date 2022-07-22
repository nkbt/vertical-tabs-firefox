/* global browser */
//var maintext = document.querySelector("#maintext");
//var theValue;
//
//
//maintext.onchange = function () {
//  save();
//}
//
//function save() {
//  theValue = maintext.value;
//  browser.extension.getBackgroundPage().setValue(theValue);
//}
//
//function show() {
//  theValue = browser.extension.getBackgroundPage().getValue();
//
//  if (!theValue) {
//    theValue = "";
//  }
//
//  maintext.value = theValue;
//}
//
//document.addEventListener("DOMContentLoaded", show, false);

function e(selector) {
  return document.querySelector(selector);
}


async function sortTabs() {
  const tabs = await browser.tabs.query({currentWindow: true, pinned: false});
  const [{index: first}] = tabs;
  let shouldReorder = false;
  const nextTabs = tabs
    .map(({id, url, index, title, cookieStoreId}) => ({
      id,
      url,
      index,
      host: url ? new URL(url).host.split(".").slice(-2).join(".") : "___",
      title,
      cookieStoreId
    }))
    .sort(({title: t1}, {title: t2}) => t1.localeCompare(t2))
    .sort(({host: h1}, {host: h2}) => h1.localeCompare(h2))
    .sort(({cookieStoreId: c1}, {cookieStoreId: c2}) => c1.localeCompare(c2))
    .map(({id, index}, i) => {
      if (i + first !== index) {
        shouldReorder = true;
      }
      return {id, index: i + first};
    });

  if (shouldReorder) {
    await Promise.all(nextTabs.map(({id, index}) => browser.tabs.move(id, {index})));
  }
}

function createTabElement(tab) {
  const $tab = document.createElement("button");
  $tab.dataset.id = tab.id;
  $tab.dataset.container = tab.cookieStoreId;
  $tab.dataset.pinned = tab.pinned;
  $tab.dataset.status = tab.status;
  $tab.dataset.url = tab.url;
  $tab.dataset.active = tab.active;
  $tab.dataset.muted = tab.mutedInfo?.muted;
  $tab.dataset.audible = tab.audible;
  $tab.dataset.host = tab.url
    ? new URL(tab.url).host.split(".").slice(-2).join(".")
    : "___";
  $tab.title = tab.title;
  $tab.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await browser.tabs.update(tab.id, {active: true});
  };
  $tab.ondblclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await browser.tabs.remove(tab.id);
  };

  $tab.style.backgroundImage = tab.favIconUrl
    ? `url("${tab.favIconUrl}")`
    : `url("resource://favicon/${tab.url}")`;

  const $title = document.createElement("span");
  $title.textContent = tab.title;
  $tab.appendChild($title);

  return $tab;
}


const containerCache = {};
const stylesheet = new CSSStyleSheet();

function containerStyles() {
  const styles = Object.entries(containerCache)
    .map(([container, {colorCode}]) => (`#tabs button[data-container="${container}"] { border-color: ${colorCode}; }`));
  stylesheet.replace(styles.join('\n'));
}

async function render() {
  e("#sort").onclick = async () => {
    await sortTabs();
  };

  e("#duplicate").onclick = async () => {
    const [tab] = await browser.tabs.query({currentWindow: true, active: true});
    await browser.tabs.duplicate(tab.id);
  };

  e("#pin").onclick = async () => {
    const [tab] = await browser.tabs.query({currentWindow: true, active: true});
    await browser.tabs.update(tab.id, {pinned: !tab.pinned});
  };

  e("html").ondblclick = async (e) => {
    await browser.tabs.create({active: true});
  };

  const tabs = await browser.tabs.query({currentWindow: true});

  const $tabs = e("#tabs");
  tabs.forEach(tab => {
    const $tab = createTabElement(tab);
    const $sameWindow = $tabs.querySelector(`[data-win="${tab.windowId}"]`);
    if ($sameWindow) {
      $sameWindow.appendChild($tab);
      return;
    }

    const $otherWindow = $tabs.querySelector(`[data-win]`);
    if ($otherWindow) {
      // Ignore
      return;
    }

    const $win = document.createElement('div');
    $win.dataset.win = tab.windowId;
    $tabs.appendChild($win);
    $win.appendChild($tab);
  });

  browser.tabs.onUpdated.addListener(function (tabId, info, tab) {
    const $tabs = e("#tabs");
    $tabs.querySelectorAll(`button[data-id="${tabId}"]`).forEach(($tab) => {
      if ("url" in info) {
        $tab.dataset.url = info.url;
        $tab.dataset.host = info.url
          ? new URL(info.url).host.split(".").slice(-2).join(".")
          : "___";
      }

      if ("favIconUrl" in info) {
        $tab.style.backgroundImage = info.favIconUrl
          ? `url("${info.favIconUrl}")`
          : `url("resource://favicon/${tab.url}")`;
      }

      if ("title" in info) {
        $tab.title = info.title;
        $tab.querySelectorAll("span").forEach(($title) => {
          $title.textContent = info.title;
        });
      }

      if ("status" in info) {
        $tab.dataset.status = info.status;

        if (info.status === "complete") {
          $tab.style.backgroundImage = tab.favIconUrl
            ? `url("${tab.favIconUrl}")`
            : `url("resource://favicon/${tab.url}")`;
        }
      }
    });
  });

  browser.tabs.onCreated.addListener(function (tab) {
    const $win = e(`#tabs [data-win="${tab.windowId}"]`);
    if (!$win) {
      return;
    }
    const $tab = createTabElement(tab);
    $win
      .querySelectorAll(`button:nth-child(${tab.index})`)
      .forEach(($prevTab) => {
        $prevTab.insertAdjacentElement("afterend", $tab);
      });
  });

  browser.tabs.onRemoved.addListener(function (tabId) {
    const $tab = e(`button[data-id="${tabId}"]`)
    if (!$tab) {
      return;
    }
    $tab.remove()
  });

  browser.tabs.onUpdated.addListener(function (tabId, changeInfo, _tab) {
    const $tab = e(`button[data-id="${tabId}"]`)
    if (!$tab) {
      return;
    }
    if ('pinned' in changeInfo) {
      $tab.dataset.pinned = changeInfo.pinned;
    }
    if ('audible' in changeInfo) {
      $tab.dataset.audible = changeInfo.audible;
    }
    if ('mutedInfo' in changeInfo) {
      $tab.dataset.muted = changeInfo.mutedInfo?.muted;
    }
  });

  browser.tabs.onAttached.addListener(function (tabId, {newWindowId}) {
    const $win = e(`#tabs [data-win="${newWindowId}"]`);
    if (!$win) {
      return;
    }
    browser.tabs.get(tabId, (tab) => {
      const $tab = createTabElement(tab);
      $win
        .querySelectorAll(`button:nth-child(${tab.index})`)
        .forEach(($prevTab) => {
          $prevTab.insertAdjacentElement("afterend", $tab);
        });
    });
  });

  browser.tabs.onDetached.addListener(function (tabId) {
    const $tab = e(`button[data-id="${tabId}"]`)
    if (!$tab) {
      return;
    }
    $tab.remove()
  });

  browser.tabs.onMoved.addListener(async function (_tabId, {_toIndex, windowId}) {
    const $win = e(`#tabs [data-win="${windowId}"]`);
    if (!$win) {
      return;
    }
    const tabs = await browser.tabs.query({currentWindow: true});
    tabs.forEach((tab) => {
      const $tab = $win.querySelector(`button[data-id="${tab.id}"]`);
      if ($tab) {
        $win.appendChild($tab);
      }
    });
  });

  browser.tabs.onActivated.addListener(function ({tabId, windowId}) {
    const $win = e(`#tabs [data-win="${windowId}"]`);
    if (!$win) {
      return;
    }
    $win
      .querySelectorAll(`button[data-active="true"]:not([data-id="${tabId}"])`)
      .forEach(($tab) => {
        $tab.dataset.active = false;
      });
    $win
      .querySelectorAll(`button[data-id="${tabId}"]`)
      .forEach(($tab) => {
        $tab.dataset.active = true;
      });
  });


  browser.contextualIdentities.query({}).then(containers => {
    containers.forEach(function (contextualIdentity) {
      containerCache[contextualIdentity.cookieStoreId] = contextualIdentity;
    })
    containerStyles()
  })


  browser.contextualIdentities.onCreated.addListener(function ({contextualIdentity}) {
    containerCache[contextualIdentity.cookieStoreId] = contextualIdentity;
    containerStyles()
  })
  browser.contextualIdentities.onUpdated.addListener(function ({contextualIdentity}) {
    containerCache[contextualIdentity.cookieStoreId] = contextualIdentity;
    containerStyles()
  })
  browser.contextualIdentities.onRemoved.addListener(function ({contextualIdentity}) {
    delete containerCache[contextualIdentity.cookieStoreId]
    containerStyles()
  })

  document.adoptedStyleSheets = [stylesheet];
}

document.addEventListener("DOMContentLoaded", render, false);
