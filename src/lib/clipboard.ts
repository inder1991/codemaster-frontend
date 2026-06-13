/**
 * Robust copy-to-clipboard. Tries the async Clipboard API in a secure context,
 * falls back to a hidden <textarea> + execCommand for insecure contexts / older
 * browsers. Never throws; returns whether the copy succeeded so callers can
 * always render a result (the old silent-failure was the "Copy not working" bug).
 */
export async function copyText(text: string): Promise<boolean> {
  const clip =
    typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  const secure = typeof window !== "undefined" && window.isSecureContext;
  if (secure && clip && typeof clip.writeText === "function") {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      // fall through to the textarea fallback
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
