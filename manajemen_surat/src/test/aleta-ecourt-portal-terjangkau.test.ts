/**
 * Aplikasi portal punya DUA gerbang yang harus dilewati sebelum terlihat
 * pegawai, dan keduanya diam saat menolak:
 *
 *   1. portalApps[].roleIds   - didaftarkan di mock-data
 *   2. DEFAULT_PORTAL_APP_IDS - daftar tetap di app-state
 *
 * Mendaftarkan aplikasi hanya di (1) membuatnya terlihat super-admin saja.
 * Persis itu yang terjadi pada "ALETA e-Court": halaman, menu, dan API-nya
 * sudah jadi, tetapi tidak ada satu pun pegawai yang bisa melihatnya - tanpa
 * pesan kesalahan apa pun yang menjelaskan sebabnya.
 *
 * Uji ini menutup celah tersebut untuk aplikasi berikutnya.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_PORTAL_APP_IDS } from "@/lib/app-state";
import { moduleVisibility, portalApps, roles } from "@/lib/mock-data";
import { getAccessiblePortalApps } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

describe("keterjangkauan aplikasi portal", () => {
  // Daftar ini dikunci dengan sengaja. DEFAULT_PORTAL_APP_IDS bukan sekadar
  // cerminan portalApps: aplikasi yang belum siap dilepas ke pegawai
  // (judicia-legal-form, aleta-sipp, e-status, dan seterusnya) memang ditahan di
  // sini agar hanya terlihat super-admin. Karena itu tidak ada aturan umum yang
  // bisa diuji - yang bisa dijaga adalah bahwa perubahan daftarnya selalu
  // disengaja, bukan efek samping.
  const TERLIHAT_PEGAWAI = [
    "aleta-bot",
    "aleta-ecourt",
    "aps-badilag",
    "asisten-hakim",
    "audit-trail",
    // Alat bantu tulis BAS. Yang paling membutuhkannya panitera, bukan super
    // admin - jadi ia memang harus ada di daftar bawaan.
    "bas",
    "e-kepegawaian",
    "manajemen-surat",
    // Ruang kerja perkara (H1-H4). Yang membukanya hakim dan panitera setiap
    // hari sidang, jadi ia memang harus ada di daftar bawaan.
    "perkara",
    "sipp",
  ];

  it("daftar aplikasi yang terlihat pegawai tidak berubah tanpa sengaja", () => {
    expect([...DEFAULT_PORTAL_APP_IDS].sort()).toEqual(TERLIHAT_PEGAWAI);
  });

  it("daftar bawaan tidak memuat id aplikasi yang sudah tidak ada", () => {
    const idTerdaftar = new Set<string>(portalApps.map((app) => app.id));
    const hantu = [...DEFAULT_PORTAL_APP_IDS].filter((id) => !idTerdaftar.has(id));

    expect(hantu, `Id ini tidak lagi punya aplikasi: ${hantu.join(", ")}`).toEqual([]);
  });

  it("ALETA e-Court terjangkau pegawai biasa", () => {
    const app = portalApps.find((item) => item.id === "aleta-ecourt");
    expect(app, "aplikasi aleta-ecourt hilang dari portalApps").toBeDefined();
    expect(app?.href).toBe("/aleta-ecourt");
    expect(app?.roleIds).toContain("staf");
    expect(DEFAULT_PORTAL_APP_IDS.has("aleta-ecourt")).toBe(true);
  });

  // Ini uji yang sebenarnya penting: bukan "apakah terdaftar", melainkan
  // "apakah benar-benar sampai ke layar pegawai". Kekeliruan sebelumnya lolos
  // dari pemeriksaan pendaftaran karena entrinya memang ada - hanya saja di
  // larik modules, bukan portalApps.
  it("setiap peran benar-benar mendapat kartu ALETA e-Court di hub", () => {
    const gagal: string[] = [];

    for (const peran of roles) {
      const pengguna = { id: `uji-${peran.id}`, roleId: peran.id } as unknown as UserPersona;
      const terjangkau = getAccessiblePortalApps(pengguna, moduleVisibility);

      const lolosVisibilitas = terjangkau.some((app) => app.id === "aleta-ecourt");
      const lolosDaftarBawaan =
        peran.id === "super-admin" || DEFAULT_PORTAL_APP_IDS.has("aleta-ecourt");

      if (!lolosVisibilitas || !lolosDaftarBawaan) gagal.push(peran.id);
    }

    expect(gagal, `Peran ini tidak akan melihat ALETA e-Court: ${gagal.join(", ")}`).toEqual([]);
  });
});
