import { afterEach, describe, expect, it } from "vitest";
import { decrypt, encrypt, hmacHex, safeEqual } from "@/lib/crypto";
import { sniffOk, safeFilename } from "@/lib/files";
import { assertSafeWebhookUrl, isPrivateIp } from "@/lib/safeurl";

describe("encryption of integration secrets", () => {
  it("round-trips and never contains the plaintext", () => {
    const enc = encrypt("whsec_super_secret");
    expect(enc.startsWith("v1.")).toBe(true);
    expect(enc).not.toContain("super_secret");
    expect(decrypt(enc)).toBe("whsec_super_secret");
  });
  it("uses a fresh IV each time and detects tampering", () => {
    expect(encrypt("x")).not.toBe(encrypt("x"));
    const parts = encrypt("hello").split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(decrypt(parts.join("."))).toBeNull();
    expect(decrypt("garbage")).toBeNull();
  });
  it("hmac is deterministic and compare is constant-time safe", () => {
    expect(hmacHex("k", "d")).toBe(hmacHex("k", "d"));
    expect(hmacHex("k", "d")).not.toBe(hmacHex("k2", "d"));
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("webhook SSRF guard", () => {
  afterEach(() => { delete process.env.ALLOW_PRIVATE_WEBHOOKS; });
  it("classifies private and public addresses", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.1", "172.16.0.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) expect(isPrivateIp(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.32.0.1", "93.184.216.34", "2606:4700:4700::1111"]) expect(isPrivateIp(ip), ip).toBe(false);
  });
  it("rejects unsafe URLs", async () => {
    for (const url of ["http://example.com/hook", "https://localhost/hook", "https://127.0.0.1/hook", "https://169.254.169.254/latest/meta-data", "https://10.1.2.3/", "https://user:pass@example.com/", "ftp://example.com/", "not a url", "https://[::1]/"]) {
      await expect(assertSafeWebhookUrl(url), url).rejects.toThrow();
    }
  });
  it("accepts a public https IP literal", async () => {
    await expect(assertSafeWebhookUrl("https://93.184.216.34/hook")).resolves.toBeInstanceOf(URL);
  });
  it("allows local http only when explicitly enabled (dev/tests)", async () => {
    process.env.ALLOW_PRIVATE_WEBHOOKS = "true";
    await expect(assertSafeWebhookUrl("http://localhost:4010/hook")).resolves.toBeInstanceOf(URL);
    await expect(assertSafeWebhookUrl("https://user:pass@localhost/")).rejects.toThrow(/credentials/);
  });
});

describe("upload checks", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
  it("checks magic bytes match the claimed type", () => {
    expect(sniffOk("image/png", png)).toBe(true);
    expect(sniffOk("image/jpeg", png)).toBe(false);
    expect(sniffOk("application/pdf", Buffer.from("%PDF-1.7 ..."))).toBe(true);
    expect(sniffOk("application/pdf", Buffer.from("<html>"))).toBe(false);
    expect(sniffOk("text/plain", Buffer.from("hello"))).toBe(true);
    expect(sniffOk("text/plain", Buffer.from([0x68, 0, 0x69]))).toBe(false);
    expect(sniffOk("text/html", Buffer.from("<script>"))).toBe(false);
    expect(sniffOk("image/svg+xml", Buffer.from("<svg>"))).toBe(false);
  });
  it("sanitises file names", () => {
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("C:\\Users\\a\\cv final.pdf")).toBe("cv final.pdf");
    expect(safeFilename('a"b<c>.pdf')).not.toMatch(/["<>]/);
    expect(safeFilename("...")).toBe("file");
  });
});
