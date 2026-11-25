const CAPACITOR_CONTENT_ROUTE = "/_capacitor_content_/";

/**
 * Turn a granted Android content URI into Capacitor's same-origin streaming URL.
 * WebView blocks content:// directly in media elements, while Capacitor's local
 * server can stream this route from ContentResolver without duplicating the clip.
 */
export function getAndroidContentPreviewUrl(uri: string, appOrigin: string): string {
  if (!uri.startsWith("content://") || uri.length <= "content://".length) {
    throw new Error("Android video preview requires a granted content URI.");
  }
  const origin = appOrigin.replace(/\/$/, "");
  if (!/^https?:\/\/[^/]+$/i.test(origin)) {
    throw new Error("The app preview origin is not a valid local server origin.");
  }
  return `${origin}${CAPACITOR_CONTENT_ROUTE}${uri.slice("content://".length)}`;
}
