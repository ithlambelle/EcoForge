# Waterer Extension - Tracking Issue

## Problem
The extension successfully attaches event listeners to ChatGPT's textarea and send button, but `trackQuery()` is never called when messages are sent. The UI updates show `dailyUsage: 0` consistently.

## What Works
- ✅ Extension loads and initializes
- ✅ Content script runs on ChatGPT pages
- ✅ Event listeners are attached to textarea and send button (confirmed in console logs)
- ✅ UI elements (water bottle, query count) are created and update periodically
- ✅ Storage system works (verified with `window.watererTest()`)

## What Doesn't Work
- ❌ `trackQuery()` is never called when user sends a message
- ❌ No "Enter key pressed" or "Send button clicked" logs appear when sending messages
- ❌ `dailyUsage` stays at 0

## Console Evidence
- Logs show: "💧 Waterer: Attached tracking to textarea" and "💧 Waterer: Attached tracking to button"
- But NO logs for: "💧 Waterer: Enter key pressed" or "💧 Waterer: Send button clicked"
- This suggests ChatGPT is preventing the events from reaching our listeners, or the events are being handled differently

## Current Detection Methods
1. **keydown listener** on textarea (with capture phase)
2. **click listener** on send button (with capture phase)
3. **submit listener** on form (with capture phase)
4. **beforeinput listener** as backup
5. **input listener** to track text as user types

## Files to Review
- `content.js` - Main detection and tracking logic (lines 374-546 for ChatGPT detection)
- `manifest.json` - Extension configuration

## Test Commands Available
- `window.watererTest()` - Manually triggers tracking (works)
- `window.watererStatus()` - Shows current storage state
- `window.watererFindTextareas()` - Lists all textareas on page
- `window.watererSetupDetection()` - Manually triggers detection setup

## Hypothesis
ChatGPT may be:
1. Using React synthetic events that don't bubble normally
2. Clearing the textarea value before our listeners fire
3. Using a different event mechanism (like programmatic submission)
4. Preventing event propagation with `stopPropagation()` or `preventDefault()`

## Potential Solutions to Try
1. Monitor network requests instead of DOM events
2. Use MutationObserver to watch for textarea value changes
3. Intercept at a higher level (document/window level)
4. Use Chrome's declarativeNetRequest API to detect API calls
5. Monitor for specific DOM changes that indicate a message was sent

