import { describe, expect, it } from "vitest";

import { sanitizeDiagnosticErrorMessage, suggestAiConnectionFix } from "@/server/shared/error-sanitizer";

/**
 * Uji Koneksi AI adalah alat diagnosis. Menyembunyikan sebab aslinya di balik
 * "Uji koneksi provider gagal diproses" membuat tombolnya tidak ada gunanya:
 * admin tak bisa membedakan API key salah, model tidak ada, API belum
 * diaktifkan, atau server memang tanpa akses internet — padahal penanganannya
 * berbeda semua.
 */
describe("sanitizeDiagnosticErrorMessage mempertahankan sebab, menyensor secret", () => {
  it("mempertahankan pesan asli dari penyedia", () => {
    const pesan = sanitizeDiagnosticErrorMessage("API key not valid. Please pass a valid API key.");
    expect(pesan).toContain("API key not valid");
  });

  it("menyensor API key Google yang muncul mentah", () => {
    const pesan = sanitizeDiagnosticErrorMessage("Request failed for key AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ01");
    expect(pesan).not.toContain("AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ01");
    expect(pesan).toContain("AIza[redacted]");
  });

  it("menyensor API key OpenAI dan parameter key pada URL", () => {
    expect(sanitizeDiagnosticErrorMessage("bad sk-proj-ABCDEFGHIJKLMNOP")).not.toContain("ABCDEFGHIJKLMNOP");
    expect(sanitizeDiagnosticErrorMessage("GET /v1beta?key=RAHASIA123456 failed")).not.toContain("RAHASIA123456");
  });

  it("mempertahankan sebab jaringan yang tergali dari rantai cause", () => {
    const hasil = sanitizeDiagnosticErrorMessage("fetch failed -> getaddrinfo ENOTFOUND googleapis.com");
    expect(hasil).toContain("ENOTFOUND");
    expect(hasil).toContain("fetch failed");
  });

  it("menghormati kalimat cadangan pilihan pemanggil", () => {
    expect(sanitizeDiagnosticErrorMessage("", "Gagal tanpa keterangan.")).toBe("Gagal tanpa keterangan.");
  });

  it("memakai kalimat cadangan bila pesan kosong", () => {
    expect(sanitizeDiagnosticErrorMessage("")).toBe("Gagal tanpa keterangan dari penyedia layanan.");
  });
});

describe("suggestAiConnectionFix menerjemahkan sebab jadi tindakan", () => {
  it("mengenali gangguan jaringan tanpa keterangan", () => {
    // Paling sering terjadi di jaringan kantor: server internal tanpa jalur keluar.
    expect(suggestAiConnectionFix("fetch failed")).toContain("internet");
  });

  it("memisahkan sebab jaringan sesuai lapisan yang putus", () => {
    // Dulu semuanya diarahkan ke "server tidak punya internet". Setelah rantai
    // `cause` bisa digali, saran ikut menyempit - dan itu penting karena
    // penanganan DNS, firewall, dan sertifikat disadap sama sekali berbeda.
    expect(suggestAiConnectionFix("fetch failed -> getaddrinfo ENOTFOUND googleapis.com")).toContain("DNS");
    expect(suggestAiConnectionFix("fetch failed -> connect ETIMEDOUT 1.2.3.4:443")).toMatch(/firewall|port 443/i);
    expect(suggestAiConnectionFix("unable to verify the first certificate")).toContain("NODE_EXTRA_CA_CERTS");
    expect(suggestAiConnectionFix("Tidak dapat menghubungi proxy 10.0.0.9:8080: connect ECONNREFUSED")).toContain(
      "HTTPS_PROXY"
    );
  });

  it("mengenali API key ditolak", () => {
    expect(suggestAiConnectionFix("API key not valid")).toContain("API key ditolak");
    expect(suggestAiConnectionFix("PERMISSION_DENIED")).toContain("API key ditolak");
  });

  it("mengenali model tidak dikenali", () => {
    expect(suggestAiConnectionFix("models/gemini-x is not found for API version v1beta")).toContain("Model tidak dikenali");
  });

  it("mengenali API Google belum diaktifkan", () => {
    expect(
      suggestAiConnectionFix("Generative Language API has not been used in project 123 before or it is disabled")
    ).toContain("belum diaktifkan");
  });

  it("mengenali kuota terlampaui", () => {
    expect(suggestAiConnectionFix("RESOURCE_EXHAUSTED: quota exceeded")).toContain("Kuota");
  });

  it("tidak menebak bila sebabnya tidak dikenali", () => {
    expect(suggestAiConnectionFix("sesuatu yang aneh terjadi")).toBe("");
    expect(suggestAiConnectionFix("")).toBe("");
  });
});
