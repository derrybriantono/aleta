/**
 * ============================================================================
 * TAHAP 0 - PAGAR ALETA e-AUDIT
 * ============================================================================
 *
 * Tahap 0 tidak menghasilkan satu butir penilaian pun. Yang dihasilkannya
 * pagar, dan pagar hanya berguna bila ia benar-benar menolak.
 *
 * Uji ini menjaga empat hal yang seluruhnya DIAM saat rusak:
 *
 *   1. Aplikasi terdaftar di KEDUA daftar - modules dan portalApps. Terdaftar
 *      di salah satunya saja membuatnya tidak terlihat tanpa pesan apa pun;
 *      itu sudah pernah terjadi pada ALETA e-Court.
 *
 *   2. Pengenalnya TIDAK ada di DEFAULT_PORTAL_APP_IDS. Selama tidak ada di
 *      sana, hanya super admin yang melihatnya. Bila kelak dibuka untuk peran
 *      lain, uji ini akan menggagalkan perubahan itu - sehingga membukanya
 *      menjadi keputusan sadar dan tercatat, bukan efek samping.
 *
 *   3. Halamannya menjaga aksesnya sendiri, tidak bersandar pada sidebar.
 *      Menyembunyikan kartu tidak menghalangi siapa pun mengetik alamatnya.
 *
 *   4. Sisi portal tidak pernah menyentuh SIPP langsung. Seluruh pembacaan
 *      SIPP melewati ALETA Bot, tempat penjaga baca-saja sudah berdiri.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { DEFAULT_PORTAL_APP_IDS } from "@/lib/app-state";
import { moduleVisibility, modules, portalApps, roles } from "@/lib/mock-data";
import { getAccessiblePortalApps } from "@/lib/permissions";
import type { UserPersona } from "@/lib/types";

const AKAR = process.cwd();
const ID = "aleta-e-audit";
const RUTE = "/aleta-e-audit";

function baca(berkas: string) {
  return readFileSync(path.join(AKAR, berkas), "utf8");
}

describe("pagar ALETA e-Audit", () => {
  it("terdaftar pada kedua daftar, dengan rute yang sama", () => {
    const modul = modules.find((m) => m.id === ID);
    const app = portalApps.find((a) => a.id === ID);

    expect(modul, "entri modules hilang - Akses Menu tidak akan mengenalnya").toBeDefined();
    expect(app, "entri portalApps hilang - kartunya tidak akan tergambar").toBeDefined();

    // Rute yang berbeda antara kedua daftar menghasilkan menu yang menunjuk
    // ke tempat yang salah, dan itu tidak menggagalkan apa pun.
    expect(modul?.href).toBe(RUTE);
    expect(app?.href).toBe(RUTE);
    expect(modul?.label).toBe("ALETA e-Audit");
    expect(app?.label).toBe("ALETA e-Audit");
  });

  it("halamannya benar-benar ada pada rute itu", () => {
    const halaman = baca("src/app/(portal)/aleta-e-audit/page.tsx");
    expect(halaman).toContain("export default function AletaEAuditPage");
    expect(halaman).toContain("AletaEAudit");
  });

  it("berada di dalam grup (portal), sehingga memakai kerangka yang sama", () => {
    // Sidebar, bilah atas, dan kaki halaman datang dari PortalShellV2 lewat
    // layout grup (portal). Halaman yang menggambar kerangkanya sendiri akan
    // perlahan menyimpang dari saudaranya tanpa ada yang berniat begitu.
    const layout = baca("src/app/(portal)/layout.tsx");
    expect(layout).toContain("PortalShellV2");

    // Yang dilarang MEMAKAI kerangkanya sendiri, bukan menyebutnya. Komentar
    // yang menerangkan dari mana kerangka itu datang justru berguna dibaca.
    const halaman = baca("src/app/(portal)/aleta-e-audit/page.tsx");
    expect(halaman).not.toContain("import { PortalShellV2");
    expect(halaman).not.toContain("<PortalShellV2");
    expect(halaman).not.toContain("<footer");
    expect(halaman).not.toContain("<nav");
  });

  it("untuk sekarang hanya super admin yang melihatnya", () => {
    // Inilah pemeriksaan yang paling menentukan pada tahap ini. Bila kelak
    // pengenal ini masuk ke daftar bawaan, uji ini GAGAL - dan itu memang
    // yang dikehendaki: membukanya harus disengaja dan tercatat.
    expect(
      DEFAULT_PORTAL_APP_IDS.has(ID),
      "e-Audit masuk daftar aplikasi bawaan - seluruh pegawai akan melihatnya. " +
        "Bila itu memang dikehendaki, ubah uji ini beserta alasannya."
    ).toBe(false);

    const gagal: string[] = [];
    for (const peran of roles) {
      const pengguna = { id: `uji-${peran.id}`, roleId: peran.id } as unknown as UserPersona;
      const terjangkau = getAccessiblePortalApps(pengguna, moduleVisibility);
      const lolosVisibilitas = terjangkau.some((a) => a.id === ID);
      // Tiruan penyaring pada app-state: super admin lolos, sisanya harus ada
      // pada daftar bawaan.
      const terlihat = peran.id === "super-admin" ? lolosVisibilitas : lolosVisibilitas && DEFAULT_PORTAL_APP_IDS.has(ID);

      if (peran.id === "super-admin" && !terlihat) gagal.push(`${peran.id} seharusnya melihat`);
      if (peran.id !== "super-admin" && terlihat) gagal.push(`${peran.id} seharusnya TIDAK melihat`);
    }
    expect(gagal, gagal.join("; ")).toEqual([]);
  });

  it("halamannya menjaga aksesnya sendiri, tidak bersandar pada sidebar", () => {
    // Menyembunyikan kartu tidak menghalangi siapa pun mengetik alamatnya.
    const halaman = baca("src/app/(portal)/aleta-e-audit/page.tsx");
    expect(halaman).toContain("accessiblePortalApps");
    expect(halaman).toContain(`app.id === "${ID}"`);
    expect(halaman).toContain("AccessDeniedCard");
  });

  it("sisi portal tidak menyentuh SIPP langsung", () => {
    // Seluruh pembacaan SIPP melewati ALETA Bot, tempat penjaga baca-saja
    // sudah berdiri dan diuji tiap putaran. Sambungan langsung dari portal
    // akan melewati penjaga itu sepenuhnya.
    const berkas = [
      "src/app/(portal)/aleta-e-audit/page.tsx",
      "src/components/portal/aleta-e-audit.tsx",
    ];
    const terlarang = [/\bmysql2?\b/, /createConnection\s*\(/, /\bSELECT\s+/i, /db_config/];
    const pelanggar: string[] = [];

    for (const b of berkas) {
      const isi = baca(b);
      terlarang.forEach((pola) => {
        if (pola.test(isi)) pelanggar.push(`${b} memuat ${pola}`);
      });
    }
    expect(pelanggar, pelanggar.join("; ")).toEqual([]);
  });

  it("tahap 0 tidak menampilkan satu butir penilaian pun", () => {
    // Menaruh butir di sini mendahului tahap yang belum dikerjakan, dan pada
    // tahap berikutnya butir itu harus dibongkar lagi. Yang boleh tampil:
    // keterangan bahwa isinya belum ada, beserta rencana pengisiannya.
    const komponen = baca("src/components/portal/aleta-e-audit.tsx");
    expect(komponen).toContain("Tahap 0");
    expect(komponen).toContain("belum berisi");

    // Halaman tahap 0 tidak boleh memanggil rute penilaian mana pun.
    expect(komponen).not.toContain("fetch(");
    expect(komponen).not.toContain("/api/aleta-e-audit");
  });

  it("dua belas bab pada layar berjumlah 185 butir", () => {
    // Angka pada layar diambil dari katalog prototipe. Bila jumlahnya bergeser
    // tanpa katalognya berubah, berarti ada yang salah salin.
    const komponen = baca("src/components/portal/aleta-e-audit.tsx");
    const butir = [...komponen.matchAll(/butir:\s*(\d+)/g)].map((m) => Number(m[1]));

    expect(butir.length, "dua belas bab").toBe(12);
    expect(butir.reduce((a, b) => a + b, 0)).toBe(185);

    const kode = [...komponen.matchAll(/kode:\s*(\d+)/g)].map((m) => Number(m[1]));
    const hitung = [...komponen.matchAll(/hitung:\s*(\d+)/g)].map((m) => Number(m[1]));
    const bebas = [...komponen.matchAll(/bebas:\s*(\d+)/g)].map((m) => Number(m[1]));

    expect(kode.reduce((a, b) => a + b, 0)).toBe(100);
    expect(hitung.reduce((a, b) => a + b, 0)).toBe(67);
    expect(bebas.reduce((a, b) => a + b, 0)).toBe(18);

    // Tiap bab: berkode + dihitung + teks bebas harus sama dengan jumlah butirnya.
    const timpang = butir
      .map((n, i) => ({ i, n, jml: kode[i] + hitung[i] + bebas[i] }))
      .filter((x) => x.n !== x.jml);
    expect(
      timpang,
      `bab ini jumlahnya tidak cocok: ${timpang.map((x) => `#${x.i + 1} ${x.n} vs ${x.jml}`).join(", ")}`
    ).toEqual([]);
  });
});
