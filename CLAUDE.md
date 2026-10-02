# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Chrome Extension (Manifest V3) that blocks phishing/hijacking sites. Users register domains via a popup; the extension intercepts navigation and either redirects to a warning page or closes the tab immediately.

## Loading the extension

There is no build step. Load directly in Chrome:

1. Go to `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select this folder

After any code change, click the **reload** button on the extension card at `chrome://extensions` and reopen the popup.

## Architecture

The extension has two independent execution contexts that communicate only through `chrome.storage.sync`:

**Background service worker (`background.js`)** — runs persistently, listens to two events:
- `chrome.webNavigation.onBeforeNavigate` — fires before the page loads (primary, faster)
- `chrome.tabs.onUpdated` — fires on `loading` status (fallback)

When a blocked domain is matched, `blockTab()` reads `ignoreOnBlock` / `closeTabOnBlock` from storage and either ignores the navigation (`ignoreTab()`), calls `chrome.tabs.remove()`, or redirects to `blocked.html`.

**Ignore mode (`ignoreOnBlock`)** — tabs can't be prevented from being created via extension APIs, so this is layered:
- `ignore-guard.js` (isolated world) cancels link clicks / form submits to blocked domains and answers `window.open` checks from `ignore-guard-main.js` (MAIN world) via a synchronous cancelable `CustomEvent`. The blocklist stays in the isolated world.
- Fallback in `background.js`: new tabs targeting a blocked domain are removed (`tabs.onCreated`, `webNavigation.onCreatedNavigationTarget`); existing tabs are re-navigated to their last committed URL, with loop protection (closes the tab if the restored page redirects back within 5s).

**Popup (`popup.html` / `popup.js`)** — renders on icon click, reads/writes `chrome.storage.sync` directly. No message passing to the background worker.

## Storage schema

All data lives in `chrome.storage.sync` under two keys:

```js
{
  blockedDomains: string[],   // e.g. ["evil.com", "phish.example.org"]
  closeTabOnBlock: boolean,   // false = show blocked.html, true = close tab
  ignoreOnBlock: boolean      // true = ignore mode (don't open the tab); takes precedence, mutually exclusive with closeTabOnBlock in the popup
}
```

## Domain matching logic

`isDomainBlocked(hostname, blockedDomains)` in `background.js` matches:
- exact hostname (`evil.com === evil.com`)
- subdomain (`sub.evil.com`.endsWith(`.evil.com`))

Registering `evil.com` does **not** block `notevil.com` — the dot-prefix check prevents partial matches.

## Blocked page

`blocked.html` is a standalone page bundled with the extension. It reads the blocked domain from the `?domain=` query param and has no JS dependencies.
