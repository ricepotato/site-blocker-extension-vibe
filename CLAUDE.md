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

When a blocked domain is matched, `blockTab()` reads `closeTabOnBlock` from storage and either calls `chrome.tabs.remove()` or redirects to `blocked.html`.

**Popup (`popup.html` / `popup.js`)** — renders on icon click, reads/writes `chrome.storage.sync` directly. No message passing to the background worker.

## Storage schema

All data lives in `chrome.storage.sync` under two keys:

```js
{
  blockedDomains: string[],   // e.g. ["evil.com", "phish.example.org"]
  closeTabOnBlock: boolean    // false = show blocked.html, true = close tab
}
```

## Domain matching logic

`isDomainBlocked(hostname, blockedDomains)` in `background.js` matches:
- exact hostname (`evil.com === evil.com`)
- subdomain (`sub.evil.com`.endsWith(`.evil.com`))

Registering `evil.com` does **not** block `notevil.com` — the dot-prefix check prevents partial matches.

## Blocked page

`blocked.html` is a standalone page bundled with the extension. It reads the blocked domain from the `?domain=` query param and has no JS dependencies.
