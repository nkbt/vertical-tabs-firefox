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
//  chrome.extension.getBackgroundPage().setValue(theValue);
//}
//
//function show() {
//  theValue = chrome.extension.getBackgroundPage().getValue();
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

function getTabs(query) {
  return new Promise((resolve) =>
    chrome.tabs.query({ currentWindow: true, ...query }, resolve)
  );
}

function moveTab({ id, index }) {
  return new Promise((resolve) => chrome.tabs.move(id, { index }, resolve));
}

function createTab() {
  return new Promise((resolve) =>
    chrome.tabs.create({ active: true }, resolve)
  );
}

function selectTab(id) {
  return new Promise((resolve) =>
    chrome.tabs.update(id, { active: true }, resolve)
  );
}

function duplicateTab(id) {
  return new Promise((resolve) => chrome.tabs.duplicate(id, resolve));
}

function removeTab(id) {
  return new Promise((resolve) => chrome.tabs.remove(id, resolve));
}

async function sortTabs() {
  const tabs = await getTabs({ pinned: false });
  const [{ index: first }] = tabs;
  let shouldReorder = false;
  const nextTabs = tabs
    .map(({ id, url, index }) => ({
      id,
      url,
      index,
      host: url ? new URL(url).host.split(".").slice(-2).join(".") : "___",
    }))
    .sort(({ host: h1 }, { host: h2 }) => h1.localeCompare(h2))
    .map(({ id, index }, i) => {
      if (i + first !== index) {
        shouldReorder = true;
      }
      return { id, index: i + first };
    });

  if (shouldReorder) {
    await Promise.all(nextTabs.map(moveTab));
  }
}

function createTabElement(tab) {
  // console.log(`createTabElement`, tab)

  const $tab = document.createElement("button");
  $tab.dataset.id = tab.id;
  $tab.dataset.pinned = tab.pinned;
  $tab.dataset.status = tab.status;
  $tab.dataset.url = tab.url;
  $tab.dataset.active = tab.active;
  $tab.dataset.host = tab.url
    ? new URL(tab.url).host.split(".").slice(-2).join(".")
    : "___";
  $tab.title = tab.title;
  $tab.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await selectTab(tab.id);
  };
  $tab.ondblclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await removeTab(tab.id);
  };

  $tab.style.backgroundImage = tab.favIconUrl
    ? `url("${tab.favIconUrl}")`
    : `url("chrome://favicon/${tab.url}")`;

  const $title = document.createElement("span");
  $title.innerHTML = tab.title;
  $tab.appendChild($title);

  return $tab;
}

async function render() {
  e("#sort").onclick = async () => {
    await sortTabs();
  };

  e("#duplicate").onclick = async () => {
    const [tab] = await getTabs({ active: true });
    await duplicateTab(tab.id);
  };

  e("html").ondblclick = async (e) => {
    console.log(`e.target`, e.target);
    await createTab();
  };

  const tabs = await getTabs();

  const $tabs = e("#tabs");
  tabs.map(createTabElement).forEach(($tab) => {
    $tabs.appendChild($tab);
  });

  chrome.tabs.onUpdated.addListener(function (tabId, info, tab) {
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
          : `url("chrome://favicon/${tab.url}")`;
      }

      if ("title" in info) {
        $tab.title = info.title;
        $tab.querySelectorAll("span").forEach(($title) => {
          $title.innerHTML = info.title;
        });
      }

      if ("status" in info) {
        $tab.dataset.status = info.status;

        if (info.status === "complete") {
          $tab.style.backgroundImage = tab.favIconUrl
            ? `url("${tab.favIconUrl}")`
            : `url("chrome://favicon/${tab.url}")`;
        }
      }
    });
  });

  chrome.tabs.onCreated.addListener(function (tab) {
    const $tabs = e("#tabs");
    const $tab = createTabElement(tab);
    $tabs
      .querySelectorAll(`button:nth-child(${tab.index})`)
      .forEach(($prevTab) => {
        $prevTab.insertAdjacentElement("afterend", $tab);
      });
  });

  chrome.tabs.onRemoved.addListener(function (tabId) {
    const $tabs = e("#tabs");
    $tabs.querySelectorAll(`button[data-id="${tabId}"]`).forEach(($tab) => {
      $tabs.removeChild($tab);
    });
  });

  chrome.tabs.onAttached.addListener(function (tabId, info) {
    const $tabs = e("#tabs");
    chrome.tabs.get(tabId, (tab) => {
      const $tab = createTabElement(tab);
      $tabs
        .querySelectorAll(`button:nth-child(${tab.index})`)
        .forEach(($prevTab) => {
          $prevTab.insertAdjacentElement("afterend", $tab);
        });
    });
  });

  chrome.tabs.onDetached.addListener(function (tabId) {
    const $tabs = e("#tabs");
    $tabs.querySelectorAll(`button[data-id="${tabId}"]`).forEach(($tab) => {
      $tabs.removeChild($tab);
    });
  });

  chrome.tabs.onMoved.addListener(async function (tabId, { toIndex }) {
    const $tabs = e("#tabs");
    const tabs = await getTabs();
    tabs.forEach((tab) => {
      const $tab = $tabs.querySelector(`button[data-id="${tab.id}"]`);
      if ($tab) {
        $tabs.appendChild($tab);
      }
    });
  });

  chrome.tabs.onActivated.addListener(function ({ tabId, windowId }) {
    const $tabs = e("#tabs");
    $tabs
      .querySelectorAll(`button[data-active="true"]:not([data-id="${tabId}"])`)
      .forEach(($tab) => {
        $tab.dataset.active = false;
      });
    $tabs.querySelectorAll(`button[data-id="${tabId}"]`).forEach(($tab) => {
      $tab.dataset.active = true;
    });
  });
}

document.addEventListener("DOMContentLoaded", render, false);
