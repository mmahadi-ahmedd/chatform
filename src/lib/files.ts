import { ALLOWED_UPLOAD_TYPES } from "./types";

/** Don't trust the browser's MIME type: check the file's first bytes match what it claims to be. */
export function sniffOk(mime: string, buf: Buffer): boolean {
  if (!(mime in ALLOWED_UPLOAD_TYPES)) return false;
  const starts = (...b: number[]) => b.every((x, i) => buf[i] === x);
  switch (mime) {
    case "image/png": return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg": return starts(0xff, 0xd8, 0xff);
    case "image/gif": return starts(0x47, 0x49, 0x46, 0x38);
    case "image/webp": return buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
    case "application/pdf": return buf.subarray(0, 5).toString() === "%PDF-";
    default: // text/plain, text/csv: must be valid UTF-8 without NUL bytes
      return !buf.includes(0) && Buffer.from(buf.toString("utf8"), "utf8").equals(buf);
  }
}

export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^\w.\- ()]+/g, "_").replace(/^\.+/, "").slice(-100);
  return cleaned || "file";
}
