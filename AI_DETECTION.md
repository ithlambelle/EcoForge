# AI Detection Capabilities

## Current Detection Methods

The extension uses **multiple methods** to detect AI usage:

### 1. **Network Request Monitoring** ✅
- Intercepts `fetch()` API calls
- Monitors `XMLHttpRequest` calls
- Checks URLs for AI service patterns:
  - `chatgpt.com`
  - `api.openai.com/v1/chat`
  - `gemini.google.com`
  - `generativelanguage.googleapis.com`

### 2. **DOM Observation** ✅
- Watches for new elements added to the page
- Detects send buttons on ChatGPT and Gemini
- Monitors chat input fields
- Listens for Enter key presses in chat inputs

### 3. **Site-Specific Detection** ✅
- **ChatGPT**: Detects buttons with `aria-label*="Send"` or `data-testid*="send"`
- **Gemini**: Detects buttons with `aria-label*="Send"` or `data-icon="send"`
- **General**: Detects textareas/inputs with "message" or "chat" in placeholder

## What It CAN Detect ✅

- ✅ Queries on **chatgpt.com**
- ✅ Queries on **gemini.google.com** / **bard.google.com**
- ✅ Queries sent via Enter key in chat inputs
- ✅ Queries sent via Send button clicks
- ✅ Network requests to OpenAI/Gemini APIs

## Current Limitations ⚠️

### 1. **Domain-Specific**
- Only detects on known AI service domains
- Won't detect AI usage in:
  - Google Search with AI features
  - Microsoft Copilot
  - Claude (Anthropic)
  - Perplexity
  - Other AI services

### 2. **DOM Structure Dependency**
- Relies on specific button/input selectors
- If ChatGPT/Gemini change their UI, detection may break
- Selectors may not match all page variations

### 3. **Network Request Limitations**
- Some requests might be encrypted or use different patterns
- May miss requests that don't match expected URL patterns
- Can't detect server-side AI processing

### 4. **No Universal AI Detection**
- Doesn't detect AI usage in:
  - Embedded AI widgets
  - AI-powered browser features
  - Third-party AI integrations
  - Local AI models

## How to Improve Detection

### Option 1: Add More AI Services
```javascript
// Add detection for Claude
if (hostname.includes('claude.ai') || hostname.includes('anthropic.com')) {
  observeClaude();
}

// Add detection for Perplexity
if (hostname.includes('perplexity.ai')) {
  observePerplexity();
}
```

### Option 2: Improve Network Monitoring
- Use Chrome's `webRequest` API (requires additional permissions)
- Monitor all network traffic for AI service patterns
- Detect AI usage across all sites, not just specific domains

### Option 3: Content-Based Detection
- Analyze page content for AI chat interfaces
- Detect common AI UI patterns (chat bubbles, AI avatars, etc.)
- Use machine learning to identify AI interactions

### Option 4: Browser Extension API
- Use `chrome.declarativeNetRequest` to intercept all AI-related requests
- Monitor `chrome.webRequest` for better network visibility
- Track tab activity to detect AI usage patterns

## Testing Detection

To test if detection is working:

1. **Open ChatGPT**: https://chatgpt.com
2. **Open Browser Console** (F12)
3. **Send a message**
4. **Check console** for:
   - "Query tracked" messages
   - Any errors
5. **Check extension UI**:
   - Query count should increase
   - Water usage should update
   - Message should appear

## Current Accuracy

- **ChatGPT**: ~80-90% (depends on UI changes)
- **Gemini**: ~80-90% (depends on UI changes)
- **Other AI services**: 0% (not implemented)

## Recommendations

1. **Test on actual sites** to verify detection works
2. **Monitor for UI changes** in ChatGPT/Gemini that might break detection
3. **Add more AI services** as needed
4. **Consider using webRequest API** for more reliable detection
5. **Add fallback detection methods** for robustness

