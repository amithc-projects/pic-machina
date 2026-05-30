# ZumiLabs Telemetry: Client Integration & Event Strategy Guide

This guide establishes the client-side integration architecture for **ZumiLabs Studio** and our related products (e.g., Chrome Extensions, UX File Manager) to maintain a consistent, privacy-preserving tracking system.

---

## 1. Consistent Client-Side Integration Pattern

To keep components decoupled and reusable, we follow the **Event-Driven Custom DOM Event** pattern.

### A. The Core UI Component (e.g., UX File Manager, Audio Editor)
The UI elements do not handle API keys, network endpoints, or opt-out states. They simply dispatch standardized DOM events:

```javascript
// Inside a component or screen (e.g. when an action occurs)
function onActionSuccess(actionName, details) {
    const event = new CustomEvent('zumilabs:action', {
        detail: {
            action: actionName,
            timestamp: Date.now(),
            ...details
        },
        bubbles: true,
        composed: true // Allows the event to pass through Shadow DOM boundaries
    });
    this.dispatchEvent(event);
}
```

### B. The Host Application (The Telemetry Listener)
The main wrapper page or the Chrome Extension's background page registers a single listener to forward these events if the user has not opted out:

```javascript
import { trackEvent } from './telemetry-sender.js';

// Bind to target element or window
window.addEventListener('zumilabs:action', (e) => {
    const { action, ...data } = e.detail;
    
    // Forward to Cloudflare Worker
    trackEvent(action, data);
});

window.addEventListener('zumilabs:error', (e) => {
    trackEvent('system_error', { message: e.detail.message });
});
```

---

## 2. Event Taxonomy: What is Tracked?

To maintain our strict privacy guarantees, we classify events into clear tiers:

| Tier | Event Name Example | Data Tracked | Data Excluded (Blocked) |
| :--- | :--- | :--- | :--- |
| **Tier 1: Lifecycle** | `app_ready`, `extension_installed` | Application name, version, boot duration | Usernames, absolute disk paths |
| **Tier 2: Actions** | `reverb_applied`, `tts_generated` | Active settings (e.g., `wetMix: 0.3`), file format (`mp3`) | Input prompts, text values, output filenames |
| **Tier 3: Performance** | `batch_run_complete` | Number of files processed, processing time in ms | File contents, EXIF metadata tags |
| **Tier 4: Errors** | `diarization_failed` | Error code, stack trace signature | Sensitive path names, speaker identity |

---

## 3. Cloudflare Rate Limits & Costs

When utilizing the **Cloudflare Workers Free Tier**:

1. **Hard Limit**: The limit is exactly **100,000 requests per day** (UTC).
2. **Behavior on Over-Limit**: Once exceeded, Cloudflare immediately returns `HTTP 1014` or `HTTP 1030` errors (Rate Limit Exceeded) and drops subsequent requests.
3. **Charges**: **You will never be automatically charged.** Cloudflare requires manual authorization and credit card confirmation to transition from the Free tier to a Paid tier.
4. **Client Impact**: Telemetry requests are wrapped in silent `.catch()` blocks in ZumiLabs code. Dropped requests will fail silently behind the scenes, and the end-user will experience **zero performance degradation or UI popups**.
5. **Scale Options**: If ZumiLabs products scale past 100k daily pings, upgrading to Cloudflare's **Workers Paid Plan** costs **$5/month** and includes **10 million requests/month** ($0.30 per million thereafter).

---

## 4. Attaching Multiple Third-Party Client Libraries

Because DOM Custom Events bubble up globally, you can attach any number of client-side tracking, debugging, or logging libraries without modifying the core product code.

Here is how you can easily plug in multiple listeners:

```javascript
// Listener 1: Our Privacy-Preserving Cloudflare Gateway
window.addEventListener('zumilabs:action', (e) => {
    trackEvent(e.detail.action, e.detail.properties);
});

// Listener 2: Local Developer Console (Only in dev mode)
if (process.env.NODE_ENV === 'development') {
    window.addEventListener('zumilabs:action', (e) => {
        console.group(`%c[OTel Event] ${e.detail.action}`, 'color: #06b6d4; font-weight: bold;');
        console.log('Component:', e.detail.component);
        console.log('Properties:', e.detail.properties);
        console.groupEnd();
    });
}

// Listener 3: Sentry/Error Reporting (Only captures errors)
window.addEventListener('zumilabs:error', (e) => {
    if (window.Sentry) {
        window.Sentry.captureMessage(`App Error: ${e.detail.message}`, {
            extra: {
                component: e.detail.component,
                timestamp: e.detail.timestamp
            }
        });
    }
});
```

---

## 5. Standardized Event Payload Schema

To ensure consistency across multiple products and easy integration with any third-party library, we define a strict schema for all custom events:

```json
{
  "type": "zumilabs:action", 
  "detail": {
    "product": "zumilabs-studio",
    "component": "audio-editor",
    "action": "reverb_applied",
    "timestamp": 1779612394548,
    "properties": {
      "wet_mix": 0.3,
      "room_size": 0.8
    }
  }
}
```

### Schema Attributes:
* **`product`** *(String)*: Unique identifier of the product (e.g., `zumilabs-studio`, `chrome-extension`, `ux-file-manager`).
* **`component`** *(String)*: Screen or functional module originating the event (e.g., `audio-editor`, `speech-studio`, `file-grid`).
* **`action`** *(String)*: Snake-case event name (e.g., `diarize_track_clicked`, `clip_split`).
* **`timestamp`** *(Integer)*: Epoch milliseconds timestamp recorded at the event generation source.
* **`properties`** *(Object)*: Key-value map of event-specific parameters. All keys must be sanitized of PII before dispatch.
