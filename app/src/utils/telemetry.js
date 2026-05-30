import { getSettings } from './settings.js';

/**
 * Dispatches and forwards sanitized feature usage events to the telemetry proxy.
 * Checks user opt-out configuration prior to execution.
 * 
 * @param {string} name - The action/event name in snake_case
 * @param {Object} data - Configuration parameters containing component and properties
 */
export function trackEvent(name, data = {}) {
    let settings;
    try {
        settings = getSettings();
    } catch (err) {
        console.warn('[Telemetry] Settings failed to load, skipping tracking', err);
        return;
    }

    // Ensure telemetry is explicitly enabled
    if (!settings.telemetry || settings.telemetry.enabled === false) {
        return;
    }

    const endpoint = settings.telemetry.endpoint;
    if (!endpoint) {
        return;
    }

    // Structured metadata properties (Sanitized of custom user filenames / strings)
    const sanitizedProperties = {};
    if (data.properties) {
        Object.keys(data.properties).forEach(key => {
            const val = data.properties[key];
            // Only allow safe, primitive telemetry values (numbers, booleans, preset categories)
            if (typeof val === 'number' || typeof val === 'boolean' || typeof val === 'string') {
                sanitizedProperties[key] = val;
            }
        });
    }

    const eventPayload = {
        product: 'zumilabs-studio',
        component: data.component || 'core',
        action: name,
        timestamp: Date.now(),
        properties: sanitizedProperties
    };

    // 1. Dispatch custom DOM event for third-party scripts/plugins running locally
    try {
        const domEvent = new CustomEvent('zumilabs:action', {
            detail: eventPayload,
            bubbles: true,
            composed: true
        });
        window.dispatchEvent(domEvent);
    } catch (e) {
        console.warn('[Telemetry] DOM dispatch failed', e);
    }

    // 2. Transmit to Cloudflare proxy in background
    fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Product-Id': 'zumilabs-studio'
        },
        body: JSON.stringify(eventPayload),
        keepalive: true
    }).catch(err => {
        // Fail silently to prevent console warnings to end-user
        console.debug('[Telemetry] Send failed:', err);
    });
}
