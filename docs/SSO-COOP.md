# SSO and Cross-Origin-Opener-Policy (COOP)

**On web, the app now uses a redirect-based SSO flow** (same-tab redirect to Google/Microsoft and back) instead of a popup. That avoids COOP entirely: no `window.closed` or `window.close()` is used, so strict COOP headers do not break SSO.

If you still see issues or use an older build that relied on the popup, and you see in the console:

- `401` on `staging-api.../auth/refresh-tokens`
- `Cross-Origin-Opener-Policy policy would block the window.closed call`
- `Failed to refresh tokens`

then the OAuth **popup** flow is being blocked by the **Cross-Origin-Opener-Policy** (COOP) header.

## What’s going on

1. SSO uses a popup: the main window opens a popup to Google/Microsoft, then the provider redirects back to your app inside that popup.
2. The library (expo-auth-session) needs to detect when the popup closes and read the result. That uses `window.closed` / `window.close()` from the **opener** (main window) to the popup.
3. If the **web app** (or your CDN) sends a strict **Cross-Origin-Opener-Policy** (e.g. `same-origin` or `same-origin-allow-popups` in a way that isolates the popup), the browser blocks the opener from accessing the popup. Then:
   - The popup may not close or the opener never gets the success result.
   - You may still have old or no tokens, and a refresh attempt returns 401 and used to clear the session (we no longer clear session on refresh 401 so SSO can complete).

## Fix on staging / production

Ensure the **frontend** (web app) is **not** served with a COOP header that blocks the popup, or set it to allow the OAuth flow:

- **Option A (recommended for SSO popup):** Do **not** send `Cross-Origin-Opener-Policy` for the web app origin, **or** set:
  ```http
  Cross-Origin-Opener-Policy: unsafe-none
  ```
- **Option B:** If you need COOP for other reasons, you may need to switch the web app to a **redirect-based** OAuth flow (same tab redirect instead of popup) so it doesn’t rely on `window.closed` / `window.close()`.

Where to change this depends on hosting:

- **CloudFront:** Response headers policy or Lambda@Edge.
- **S3 static site:** Headers are usually added by CloudFront or another proxy.
- **Vercel / Netlify / etc.:** Security or custom headers in the dashboard or in `vercel.json` / `_headers`.

The **API** (staging-api) 401 on `/auth/refresh-tokens` is a consequence of the frontend not getting the new tokens from the popup (or using stale ones). After fixing COOP and the frontend behavior (we no longer clear auth on refresh 401), SSO should complete and the login form should be left behind.
