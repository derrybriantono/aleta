import { describe, expect, it } from "vitest";

import { normalizePanelSettings, normalizePublicUrl } from "@/lib/panel-settings";

describe("panel settings normalization", () => {
  it("normalizes public access URLs and keeps method choices explicit", () => {
    expect(normalizePublicUrl("aleta.pa-donggala.go.id")).toBe("https://aleta.pa-donggala.go.id");

    const settings = normalizePanelSettings({
      publicAccess: {
        publicUrl: "aleta.pa-donggala.go.id/",
        method: "cloudflare-tunnel",
        notes: "DNS memakai tunnel.",
      },
    });

    expect(settings.publicAccess).toEqual({
      publicUrl: "https://aleta.pa-donggala.go.id",
      method: "cloudflare-tunnel",
      notes: "DNS memakai tunnel.",
    });
  });
});

/**
 * Cara sandi SIPP dikirim.
 *
 * ============================================================================
 * YANG DIJAGA DI SINI
 * ============================================================================
 *
 * Pemasangan yang berjalan tersimpan dengan passwordMode "md5", dan itulah
 * sebabnya masuk otomatis tidak pernah bekerja. SIPP mengacak sendiri di sisi
 * server - arr2md5(kode_aktivasi, sandi) atas sandi POLOS - sehingga md5 yang
 * dikirim akan teracak dua kali dan tidak pernah cocok. Kegagalannya BISU:
 * SIPP memantulkan ke login/index/ERR dan pemakai hanya melihat halaman masuk
 * terbuka kosong.
 *
 * Sama pentingnya, uji ini menjaga apa yang TIDAK boleh ikut diubah:
 * loginPath, dan pilihan APS Badilag.
 */
describe("cara sandi SIPP dikirim", () => {
  const sipp = (value: Record<string, unknown>) =>
    normalizePanelSettings({ externalApps: { sipp: { appId: "sipp", ...value } } }).externalApps.sipp;

  it("md5 ditolak - SIPP mengacak sendiri di sisi server", () => {
    expect(sipp({ passwordMode: "md5" }).passwordMode).toBe("plain");
  });

  it("loginPath TIDAK ikut diubah - ia halaman yang dibaca, bukan sasaran kiriman", () => {
    // Jembatan SSO mengambil alamat ini lalu membaca formulir di dalamnya;
    // sasaran kiriman yang sebenarnya diambil dari atribut action formulir
    // itu. Mengarahkannya ke "login/validation_credential" justru membuat
    // halaman yang dibaca memantul ke login/index/ERR lebih dulu.
    expect(sipp({ loginPath: "index.php/login" }).loginPath).toBe("index.php/login");
    expect(sipp({ loginPath: "login" }).loginPath).toBe("login");
  });

  it("APS Badilag tetap boleh memakai md5", () => {
    // Alamat masuknya belum pernah diperiksa langsung, jadi tidak ada yang
    // boleh disimpulkan tentangnya.
    const hasil = normalizePanelSettings({
      externalApps: {
        "aps-badilag": { appId: "aps-badilag", loginPath: "index.php/login", passwordMode: "md5" },
      },
    }).externalApps["aps-badilag"];
    expect(hasil.loginPath).toBe("index.php/login");
    expect(hasil.passwordMode).toBe("md5");
  });
});
