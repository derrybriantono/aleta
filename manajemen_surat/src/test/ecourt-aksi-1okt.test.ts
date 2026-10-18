// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { NextRequest } from "next/server";
import { newDb } from "pg-mem";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IN_MEMORY_TABLE_PERSISTENCE_ORDER, createAletaDatabase, type AletaDatabase } from "@/server/db/client";
import { DDL_ECOURT_AKSI_JEJAK } from "@/server/db/schema";
import { catatJejakAksi, kalimatAlasan } from "@/server/modules/aleta-ecourt/ecourt-aksi";
import { LencanaKeadaanPutusan } from "@/components/portal/ecourt-aksi-perkara";

/**
 * ============================================================================
 * PERBAIKAN 1 OKT 2026 - AGEN E: E9, E10, E11, 16b (kontrak K5, K6), migrasi 0055
 * ============================================================================
 *
 * Seluruhnya diuji dengan TIRUAN e-Court (pengemudi peramban palsu). Tidak ada
 * peramban, tidak ada jaringan ke e-Court, tidak ada kredensial sungguhan.
 *
 * Penjaga terpenting:
 *   - passphrase TTE tidak tersimpan, tidak tercatat (jejak keamanan bot,
 *     aleta_ecourt_aksi_jejak, audit_logs), tidak terpantul di jawaban;
 *   - sandi e-Court tidak tersimpan; cookie sesi tersimpan TERSANDI;
 *   - tulis ke e-Court hanya dengan konfirmasi, hanya dengan sesi milik
 *     pengguna itu sendiri dan peran yang cocok;
 *   - pemantau putusan sopan: jarak, batas per jam, mundur, satu per detak.
 */

const AKAR = path.resolve(process.cwd(), "..");
const SEMENTARA = path.resolve("D:/Aplikasi/aleta/tmp", `uji-ecourt-aksi-${process.pid}`);
mkdirSync(SEMENTARA, { recursive: true });
// WAJIB sebelum modul bot dimuat: kunci dan simpanan sesi tidak boleh jatuh ke
// folder rumah (drive C:).
process.env.ALETA_ECOURT_SESSION_DIR = SEMENTARA;
process.env.ALETA_ECOURT_KREDENSIAL_DIR = SEMENTARA;
// NODE_ENV=test disetel vitest: pemantau putusan tidak dinyalakan saat rute bot dimuat.

const require_ = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const muatBot = <T,>(rel: string) => require_(path.join(AKAR, "aleta_bot", rel)) as T;

type SesiSvc = {
  kirimSambung: (a: Record<string, unknown>, o: { pengemudi: unknown }) => Promise<Record<string, any>>;
  mulaiSambung: (a: Record<string, unknown>, o: { pengemudi: unknown }) => Promise<Record<string, any>>;
  daftarSesi: (id: string) => Array<Record<string, any>>;
  ambilCookies: (id: string, peran: string) => Array<Record<string, any>> | null;
  pilihSesi: (id: string, aksi: string) => Record<string, any> | null;
  simpanSesi: (a: Record<string, unknown>) => { ok: boolean };
  tandaiKedaluwarsa: (id: string, peran: string) => boolean;
  hapusSesi: (id: string, peran: string) => unknown;
  jalurSimpanan: () => string;
};
const sesi = muatBot<SesiSvc>("services/ecourtSesiPenggunaService.js");
const aksiModul = muatBot<{ buatLayanan: (d: Record<string, unknown>) => Record<string, any> }>("services/ecourtAksiService.js");
const pantau = muatBot<Record<string, any>>("services/ecourtPantauPutusanService.js");
const putusanSvc = muatBot<{ simpulkan: (s: unknown, e: unknown) => Record<string, any> }>("services/putusanEcourtService.js");
const sapuRahasia = muatBot<{ sapuRahasia: (t: string, r: string[]) => string }>(
  "services/ecourtPerambanAksiService.js"
).sapuRahasia;

const SANDI = "SandiRahasia-Uji-9f3k!";
const PASSPHRASE = "Passphrase-TTE-Uji-77x#";
const COOKIE_RAHASIA = "ci_session_nilai_rahasia_abc123";

/** Seluruh isi folder sementara (rekursif) sebagai satu teks. */
function isiSemuaBerkas(dir = SEMENTARA): string {
  if (!existsSync(dir)) return "";
  let teks = "";
  for (const nama of readdirSync(dir)) {
    const j = path.join(dir, nama);
    teks += statSync(j).isDirectory() ? isiSemuaBerkas(j) : readFileSync(j).toString("latin1");
  }
  return teks;
}

/** Tiruan e-Court: mencatat apa yang diterimanya. */
function tiruanEcourt(over: Record<string, any> = {}) {
  const panggilan: Array<{ fungsi: string; arg: any }> = [];
  const catat = (fungsi: string, arg: any) => panggilan.push({ fungsi, arg });
  return {
    panggilan,
    mulaiLogin: async () => (catat("mulaiLogin", null), { ok: true, token: "tok-1", captcha: "data:image/png;base64,AAA" }),
    kirimLogin: async (token: string, arg: any) => (
      catat("kirimLogin", { token, ...arg }),
      { ok: true, namaAkun: "Hakim Uji", cookies: [{ name: "ci_session", value: COOKIE_RAHASIA, domain: "ecourt.mahkamahagung.go.id" }] }
    ),
    batalLogin: (token: string) => catat("batalLogin", token),
    periksaSesi: async (arg: any) => (catat("periksaSesi", arg), { ok: true, berlaku: true, namaAkun: "Hakim Uji", cookies: arg.cookies }),
    verifikasi: async (arg: any) => (catat("verifikasi", arg), { ok: true, statusSesudah: "Valid", cookies: arg.cookies }),
    tteSalinan: async (arg: any) => (
      catat("tteSalinan", { ...arg, passphraseDiterima: arg.passphrase === PASSPHRASE }),
      { ok: true, cookies: arg.cookies, putusanEcourt: { adaTab: true, adaBaris: true, panitera: { sudahTte: true } } }
    ),
    unggahSalinan: async (arg: any) => (
      catat("unggahSalinan", { ...arg, adaBerkas: existsSync(arg.jalurBerkas) }),
      { ok: true, cookies: arg.cookies, putusanEcourt: { adaTab: true, adaBaris: true, dokumenSalinan: { ada: true } } }
    ),
    unduhDokumen: async (arg: any) => (catat("unduhDokumen", arg), { ok: true, isi: Buffer.from("%PDF-1.4"), contentType: "application/pdf", cookies: arg.cookies }),
    ...over,
  };
}

function depsUji(pengemudi: any, over: Record<string, any> = {}) {
  const jejak: any[] = [];
  const disimpan: any[] = [];
  const keputusan: any[] = [];
  const deps = {
    pengemudi,
    sesi,
    rincianArsip: async () => ({
      dokumen: [
        { documentKey: "dk-1", judulDokumen: "Jawaban Tergugat", agenda: "Jawaban", tanggalSidang: "2026-10-01T00:00:00", statusVerifikasi: "belum", adaPdf: true },
        { documentKey: "dk-2", judulDokumen: "Gugatan", agenda: "", tanggalSidang: null, statusVerifikasi: "belum" },
        { documentKey: "dk-3", judulDokumen: "Replik", agenda: "Replik", tanggalSidang: "2026-10-08T00:00:00", statusVerifikasi: "valid" },
      ],
    }),
    putusan: {
      keadaanBanyak: async (daftar: any[]) =>
        Object.fromEntries(
          daftar.map((x) => [
            x.nomorPerkara,
            putusanSvc.simpulkan(
              x,
              x.nomorPerkara.startsWith("1/")
                ? { adaBaris: true, dokumenAda: false, paniteraTte: false }
                : x.nomorPerkara.startsWith("2/")
                  ? { adaBaris: true, dokumenAda: true, paniteraTte: false }
                  : { adaBaris: true, dokumenAda: true, paniteraTte: true }
            ),
          ])
        ),
      catatanBanyak: async (nomor: string[]) =>
        Object.fromEntries(nomor.map((n) => [n, { dokumenAda: true, tanggalUnggahTeks: "Kamis, 01 Oktober 2026", diunggahOleh: "hakim@uji", paniteraTte: false }])),
      simpan: async (n: string, b: unknown) => disimpan.push({ n, b }),
    },
    identifikasiHakim: (nama: string) => (nama === "Hakim Uji" ? { nama, namaPencarian: nama } : null),
    cekMajelis: async (_n: string, nama: string) => ({ anggota: nama === "Hakim Uji" }),
    catatKeputusan: async (x: unknown) => keputusan.push(x),
    dokumenSatu: async (k: string) =>
      k === "dk-1" ? { documentKey: "dk-1", nomorPerkara: "1/Pdt.G/2026/PA.Dgl", judulDokumen: "Jawaban Tergugat", sumberUrl: "" } : null,
    alamatPerkara: async () => "https://ecourt.mahkamahagung.go.id/view_detil_pendaftaran/xyz",
    tanggalPutusanSipp: async (nomor: string[]) => Object.fromEntries(nomor.map((n) => [n, "2026-09-30"])),
    catat: (d: unknown) => jejak.push(d),
    folderSementara: () => path.join(SEMENTARA, "pengguna-tmp"),
    ...over,
  };
  return { deps, jejak, disimpan, keputusan };
}

async function sambung(penggunaId: string, peran: string, namaPengguna = "Hakim Uji") {
  const e = tiruanEcourt();
  await sesi.mulaiSambung({ penggunaId, peran }, { pengemudi: e });
  return sesi.kirimSambung({ penggunaId, peran, namaPengguna, email: "orang@uji.test", sandi: SANDI, captcha: "12ab" }, { pengemudi: e });
}

afterAll(() => {
  rmSync(SEMENTARA, { recursive: true, force: true });
});

// ============================================================================
describe("E10 - sesi e-Court pribadi: sandi tidak disimpan, cookie tersandi", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("sambung: sandi diteruskan ke e-Court sekali, TIDAK ada di berkas mana pun; cookie tersimpan tersandi", async () => {
    const e = tiruanEcourt();
    expect((await sesi.mulaiSambung({ penggunaId: "usr-hakim", peran: "hakim" }, { pengemudi: e })).ok).toBe(true);
    const h = await sesi.kirimSambung(
      { penggunaId: "usr-hakim", peran: "hakim", namaPengguna: "Hakim Uji", email: "orang@uji.test", sandi: SANDI, captcha: "12ab" },
      { pengemudi: e }
    );
    expect(h).toMatchObject({ ok: true, namaAkunEcourt: "Hakim Uji" });
    expect(e.panggilan.find((p) => p.fungsi === "kirimLogin")?.arg.sandi).toBe(SANDI);
    const semua = isiSemuaBerkas();
    expect(semua).not.toContain(SANDI);
    expect(semua).not.toContain(COOKIE_RAHASIA);
    expect(semua).not.toContain("orang@uji.test");
    expect(JSON.stringify(h)).not.toContain(SANDI);
    // Layar tidak pernah menerima cookie, tersandi pun tidak.
    const layar = sesi.daftarSesi("usr-hakim");
    expect(layar).toHaveLength(1);
    expect(JSON.stringify(layar)).not.toMatch(/cookie/i);
    expect(layar[0]).toMatchObject({ peran: "hakim", keadaan: "tersambung", namaAkunEcourt: "Hakim Uji" });
    // Hanya layanan aksi yang membukanya.
    expect(sesi.ambilCookies("usr-hakim", "hakim")?.[0].value).toBe(COOKIE_RAHASIA);
  });

  it("alasan gagal dari e-Court yang memantulkan sandi disapu", async () => {
    const e = tiruanEcourt({ kirimLogin: async () => ({ ok: false, alasan: `ditolak untuk ${SANDI}` }) });
    await sesi.mulaiSambung({ penggunaId: "usr-x", peran: "hakim" }, { pengemudi: e });
    const h = await sesi.kirimSambung({ penggunaId: "usr-x", peran: "hakim", email: "a@b", sandi: SANDI }, { pengemudi: e });
    expect(h.ok).toBe(false);
    expect(JSON.stringify(h)).not.toContain(SANDI);
  });

  it("tanpa formulir yang dibuka lebih dulu: ditolak, e-Court tidak disentuh", async () => {
    const e = tiruanEcourt();
    const h = await sesi.kirimSambung({ penggunaId: "usr-y", peran: "hakim", email: "a@b", sandi: SANDI }, { pengemudi: e });
    expect(h).toMatchObject({ ok: false, alasan: "sesi_login_kedaluwarsa" });
    expect(e.panggilan).toHaveLength(0);
  });

  it("peran dan pengguna tidak sah ditolak; sesi per pengguna per peran; kedaluwarsa membuang cookie", async () => {
    expect((await sesi.mulaiSambung({ penggunaId: "usr-hakim", peran: "dewa" }, { pengemudi: tiruanEcourt() })).ok).toBe(false);
    expect((await sesi.mulaiSambung({ penggunaId: "../etc", peran: "hakim" }, { pengemudi: tiruanEcourt() })).ok).toBe(false);
    await sambung("usr-panitera", "panitera", "Panitera Uji");
    expect(sesi.pilihSesi("usr-panitera", "tte")?.peran).toBe("panitera");
    expect(sesi.pilihSesi("usr-panitera", "verifikasi")).toBeNull();
    expect(sesi.pilihSesi("usr-hakim", "tte")).toBeNull();
    sesi.tandaiKedaluwarsa("usr-panitera", "panitera");
    expect(sesi.ambilCookies("usr-panitera", "panitera")).toBeNull();
    expect(sesi.daftarSesi("usr-panitera")[0].keadaan).toBe("kedaluwarsa");
    expect(isiSemuaBerkas()).not.toContain(COOKIE_RAHASIA);
  });
});

// ============================================================================
describe("E9 - verifikasi majelis lewat sesi hakim sendiri (tiruan e-Court)", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("tanpa konfirmasi: ditolak dan e-Court tidak disentuh", async () => {
    await sambung("usr-hakim", "hakim");
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const h = await l.verifikasi({ penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "valid" });
    expect(h).toMatchObject({ ok: false, alasan: "konfirmasi_belum_diberikan" });
    expect(e.panggilan).toHaveLength(0);
  });

  it("bukan hakim / bukan anggota majelis / tanpa sesi hakim: ditolak, e-Court tidak disentuh", async () => {
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const dasar = { documentKey: "dk-1", keputusan: "valid", konfirmasi: true };
    expect((await l.verifikasi({ ...dasar, penggunaId: "usr-ahmad", nama: "Ahmad" })).alasan).toBe("bukan_hakim_terdaftar");
    // Hakim terdaftar, tetapi hanya punya sesi PANITERA - tidak dialihkan.
    await sambung("usr-hakim", "panitera");
    expect((await l.verifikasi({ ...dasar, penggunaId: "usr-hakim", nama: "Hakim Uji" })).alasan).toBe("akun_ecourt_belum_diisi");
    const l2 = aksiModul.buatLayanan(depsUji(e, { cekMajelis: async () => ({ anggota: false }) }).deps);
    await sambung("usr-hakim", "hakim");
    expect((await l2.verifikasi({ ...dasar, penggunaId: "usr-hakim", nama: "Hakim Uji" })).alasan).toBe("bukan_anggota_majelis");
    expect(e.panggilan).toHaveLength(0);
  });

  it("audit jejak 18 Okt: keterangan yang menyebut ALETA ditolak sebelum e-Court disentuh; yang bersih diketik apa adanya", async () => {
    await sambung("usr-hakim", "hakim");
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const dasar = { penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "tidak_valid", konfirmasi: true };
    for (const keterangan of ["dicek lewat ALETA", "A L E T A", "Aleta", "ＡＬＥＴＡ"]) {
      const h = await l.verifikasi({ ...dasar, keterangan });
      expect(h, keterangan).toMatchObject({ ok: false, alasan: "teks_menyebut_aleta" });
      expect(h.pesan).toBe(`Isian "Keterangan verifikasi" memuat kata 'ALETA'; hapus dulu sebelum dikirim ke e-Court.`);
    }
    expect(e.panggilan).toHaveLength(0);
    expect(kalimatAlasan("teks_menyebut_aleta")).toContain("e-Court");
    const h = await l.verifikasi({ ...dasar, keterangan: "Tanda tangan tidak terbaca" });
    expect(h.ok).toBe(true);
    expect(e.panggilan.find((p) => p.fungsi === "verifikasi")!.arg.keterangan).toBe("Tanda tangan tidak terbaca");
  });

  it("berhasil: cookie milik hakim itu yang dipakai, keputusan dicatat, jejak jujur", async () => {
    await sambung("usr-hakim", "hakim");
    await sambung("usr-lain", "hakim", "Orang Lain");
    const e = tiruanEcourt();
    const { deps, jejak, keputusan } = depsUji(e);
    const l = aksiModul.buatLayanan(deps);
    const h = await l.verifikasi({ penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "valid", konfirmasi: true });
    expect(h).toMatchObject({ ok: true, keputusan: "valid", akun: { nama: "Hakim Uji", peran: "Hakim" } });
    const v = e.panggilan.find((p) => p.fungsi === "verifikasi")!.arg;
    expect(v.judulDokumen).toBe("Jawaban Tergugat");
    expect(v.kering).toBe(false);
    expect(v.cookies[0].value).toBe(COOKIE_RAHASIA);
    expect(keputusan).toHaveLength(1);
    expect(jejak[0].metadata).toMatchObject({ lewat: "ALETA", penggunaId: "usr-hakim", hasil: "berhasil" });
    expect(JSON.stringify(jejak)).not.toContain(COOKIE_RAHASIA);
  });

  it("kering: dialog dibaca, keputusan TIDAK dicatat", async () => {
    await sambung("usr-hakim", "hakim");
    const e = tiruanEcourt({ verifikasi: async (a: any) => ({ ok: true, kering: a.kering, cookies: a.cookies }) });
    const { deps, keputusan } = depsUji(e);
    const h = await aksiModul
      .buatLayanan(deps)
      .verifikasi({ penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "valid", konfirmasi: true, kering: true });
    expect(h).toMatchObject({ ok: true, kering: true });
    expect(keputusan).toHaveLength(0);
  });

  it("sesi habis di tengah aksi: cookie dibuang, pengguna diminta masuk lagi", async () => {
    await sambung("usr-hakim", "hakim");
    const e = tiruanEcourt({ verifikasi: async () => ({ ok: false, alasan: "sesi_habis", cookies: [] }) });
    const h = await aksiModul
      .buatLayanan(depsUji(e).deps)
      .verifikasi({ penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "valid", konfirmasi: true });
    expect(h.alasan).toBe("sesi_habis");
    expect(sesi.daftarSesi("usr-hakim")[0].keadaan).toBe("kedaluwarsa");
  });

  it("ringkasan perkara: hanya dokumen persidangan, sidang ini ditandai, akun yang akan dipakai disebut", async () => {
    await sambung("usr-hakim", "hakim");
    const r = await aksiModul
      .buatLayanan(depsUji(tiruanEcourt()).deps)
      .ringkasPerkara({ nomorPerkara: "1/Pdt.G/2026/PA.Dgl", penggunaId: "usr-hakim", nama: "Hakim Uji", tanggalSidang: "2026-10-01" });
    expect(r.dokumen.map((d: any) => d.documentKey)).toEqual(["dk-1", "dk-3"]);
    expect(r.dokumen[0]).toMatchObject({ padaSidangIni: true, perluVerifikasi: true });
    expect(r.dokumen[1]).toMatchObject({ padaSidangIni: false, perluVerifikasi: false });
    expect(r.bolehVerifikasi).toBe(true);
    expect(r.akunVerifikasi).toMatchObject({ nama: "Hakim Uji", peran: "Hakim", sumber: "pribadi" });
    expect(r.akunTte).toBeNull();
    expect(JSON.stringify(r)).not.toContain(COOKIE_RAHASIA);
  });

  it("satu aksi per pengguna pada satu waktu (tidak berbondong)", async () => {
    await sambung("usr-hakim", "hakim");
    let lepas: () => void = () => {};
    const e = tiruanEcourt({
      verifikasi: (a: any) => new Promise((ok) => (lepas = () => ok({ ok: true, cookies: a.cookies }))),
    });
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const arg = { penggunaId: "usr-hakim", nama: "Hakim Uji", documentKey: "dk-1", keputusan: "valid", konfirmasi: true };
    const pertama = l.verifikasi(arg);
    await new Promise((r) => setTimeout(r, 5));
    expect((await l.verifikasi(arg)).alasan).toBe("aksi_lain_masih_berjalan");
    lepas();
    expect((await pertama).ok).toBe(true);
  });
});

// ============================================================================
describe("E10 - TTE panitera: passphrase tidak tersimpan, tidak tercatat, tidak terpantul", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));

  it("tanpa konfirmasi / tanpa passphrase / tanpa sesi panitera: ditolak, e-Court tidak disentuh", async () => {
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const n = { penggunaId: "usr-panitera", nama: "Panitera Uji", nomorPerkara: "2/Pdt.G/2026/PA.Dgl" };
    expect((await l.tte({ ...n, passphrase: PASSPHRASE })).alasan).toBe("konfirmasi_belum_diberikan");
    expect((await l.tte({ ...n, konfirmasi: true })).alasan).toBe("passphrase_kosong");
    expect((await l.tte({ ...n, passphrase: PASSPHRASE, konfirmasi: true })).alasan).toBe("akun_ecourt_belum_diisi");
    // Sesi HAKIM tidak dipakai untuk TTE.
    await sambung("usr-panitera", "hakim");
    expect((await l.tte({ ...n, passphrase: PASSPHRASE, konfirmasi: true })).alasan).toBe("akun_ecourt_belum_diisi");
    expect(e.panggilan).toHaveLength(0);
  });

  it("berhasil: passphrase sampai ke kolom e-Court, lalu tidak ada di jawaban, jejak, maupun berkas", async () => {
    await sambung("usr-panitera", "panitera", "Panitera Uji");
    const e = tiruanEcourt();
    const { deps, jejak, disimpan } = depsUji(e);
    const h = await aksiModul
      .buatLayanan(deps)
      .tte({ penggunaId: "usr-panitera", nama: "Panitera Uji", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", passphrase: PASSPHRASE, konfirmasi: true });
    expect(h).toMatchObject({ ok: true, akun: { peran: "Panitera" } });
    expect(e.panggilan.find((p) => p.fungsi === "tteSalinan")?.arg.passphraseDiterima).toBe(true);
    expect(disimpan).toHaveLength(1); // keadaan putusan diperbarui dari bacaan ulang
    expect(JSON.stringify(h)).not.toContain(PASSPHRASE);
    expect(JSON.stringify(jejak)).not.toContain(PASSPHRASE);
    expect(JSON.stringify(disimpan)).not.toContain(PASSPHRASE);
    expect(isiSemuaBerkas()).not.toContain(PASSPHRASE);
  });

  it("galat dan pesan e-Court yang memantulkan passphrase disapu sebelum keluar", async () => {
    await sambung("usr-panitera", "panitera", "Panitera Uji");
    const arg = { penggunaId: "usr-panitera", nama: "Panitera Uji", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", passphrase: PASSPHRASE, konfirmasi: true };
    const lempar = tiruanEcourt({ tteSalinan: async () => { throw new Error(`kolom berisi ${PASSPHRASE} ditolak`); } });
    const d1 = depsUji(lempar);
    const h1 = await aksiModul.buatLayanan(d1.deps).tte(arg);
    expect(h1.ok).toBe(false);
    expect(JSON.stringify(h1)).not.toContain(PASSPHRASE);
    expect(JSON.stringify(d1.jejak)).not.toContain(PASSPHRASE);

    const pantul = tiruanEcourt({
      tteSalinan: async (a: any) => ({ ok: false, alasan: `tte_belum_terbukti ${PASSPHRASE}`, pesan: `Passphrase ${PASSPHRASE} salah`, cookies: a.cookies }),
    });
    const d2 = depsUji(pantul);
    const h2 = await aksiModul.buatLayanan(d2.deps).tte(arg);
    expect(JSON.stringify(h2)).not.toContain(PASSPHRASE);
    expect(JSON.stringify(d2.jejak)).not.toContain(PASSPHRASE);
    expect(sapuRahasia(`x ${PASSPHRASE} y`, [PASSPHRASE])).toBe("x *** y");
  });
});

// ============================================================================
describe("16b / K6 - akun pengunggah dan unggah salinan putusan (tiruan e-Court)", () => {
  beforeEach(() => rmSync(path.join(SEMENTARA, "pengguna"), { recursive: true, force: true }));
  const PDF = Buffer.from("%PDF-1.7\n%uji\n");

  it("akunPutusan: null + alasan bila belum tersambung; nama & peran bila tersambung; salinan dari catatan", async () => {
    const l = aksiModul.buatLayanan(depsUji(tiruanEcourt()).deps);
    const kosong = await l.akunPutusan({ penggunaId: "usr-hakim", nomorPerkara: "3/Pdt.G/2026/PA.Dgl" });
    expect(kosong).toMatchObject({ ok: true, akun: null, alasan: "akun_ecourt_belum_diisi" });
    expect(kosong.salinan).toMatchObject({ sudahDiunggah: true, tanggal: "Kamis, 01 Oktober 2026", olehNama: "hakim@uji" });
    await sambung("usr-hakim", "hakim");
    const ada = await l.akunPutusan({ penggunaId: "usr-hakim", nomorPerkara: "3/Pdt.G/2026/PA.Dgl" });
    expect(ada.akun).toEqual({ nama: "Hakim Uji", peran: "Hakim", kodePeran: "hakim", tersambung: true, sumber: "pribadi" });
  });

  it("unggah: menolak bukan-PDF, tanpa konfirmasi, tanpa sesi - tanpa menyentuh e-Court", async () => {
    const e = tiruanEcourt();
    const l = aksiModul.buatLayanan(depsUji(e).deps);
    const n = { penggunaId: "usr-hakim", nama: "Hakim Uji", nomorPerkara: "3/Pdt.G/2026/PA.Dgl" };
    expect((await l.unggahSalinan({ ...n, isi: PDF })).alasan).toBe("konfirmasi_belum_diberikan");
    expect((await l.unggahSalinan({ ...n, isi: Buffer.from("bukan pdf"), konfirmasi: true })).alasan).toBe("berkas_bukan_pdf");
    expect((await l.unggahSalinan({ ...n, isi: PDF, konfirmasi: true })).alasan).toBe("akun_ecourt_belum_diisi");
    expect(e.panggilan).toHaveLength(0);
  });

  it("unggah berhasil: berkas sementara dibuat untuk e-Court lalu DIHAPUS; jawaban menyebut akunnya", async () => {
    await sambung("usr-hakim", "hakim");
    const e = tiruanEcourt();
    const { deps, disimpan } = depsUji(e);
    const h = await aksiModul
      .buatLayanan(deps)
      .unggahSalinan({ penggunaId: "usr-hakim", nama: "Hakim Uji", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", isi: PDF, konfirmasi: true });
    expect(h).toMatchObject({ ok: true, akun: { nama: "Hakim Uji", peran: "Hakim" } });
    expect(e.panggilan.find((p) => p.fungsi === "unggahSalinan")?.arg.adaBerkas).toBe(true);
    expect(readdirSync(path.join(SEMENTARA, "pengguna-tmp"))).toEqual([]);
    expect(disimpan).toHaveLength(1);
  });

  // Audit jejak 18 Okt 2026: salinan dulu sampai ke e-Court apa adanya (tanpa penjaga).
  const tiruanPenangkap = () => {
    const tangkap = { isi: "" };
    const e = tiruanEcourt({
      unggahSalinan: async (arg: any) => {
        tangkap.isi = readFileSync(arg.jalurBerkas, "latin1");
        return { ok: true, cookies: arg.cookies, putusanEcourt: { adaTab: true, adaBaris: true, dokumenSalinan: { ada: true } } };
      },
    });
    return { e, tangkap };
  };
  const unggah = (deps: any, isi: Buffer) =>
    aksiModul.buatLayanan(deps).unggahSalinan({ penggunaId: "usr-hakim", nama: "Hakim Uji", nomorPerkara: "3/Pdt.G/2026/PA.Dgl", isi, konfirmasi: true });

  it("audit jejak 18 Okt: metadata ber-ALETA dibersihkan (panjang sama) sebelum berkas sampai ke e-Court", async () => {
    await sambung("usr-hakim", "hakim");
    const { e, tangkap } = tiruanPenangkap();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Title(Salinan Putusan)/Producer(ALETA Writer)/Author(aleta)>>endobj\nxref\n%%EOF", "latin1");
    const h = await unggah(depsUji(e).deps, pdf);
    expect(h.ok, JSON.stringify(h)).toBe(true);
    expect(tangkap.isi.length).toBe(pdf.length);
    expect(tangkap.isi).not.toMatch(/aleta/i);
    expect(tangkap.isi).toContain("/Title(Salinan Putusan)");
  });

  it("audit jejak 18 Okt: teks tampak ber-ALETA menahan unggahan (e-Court tidak disentuh); nama pihak dari SIPP dikecualikan", async () => {
    await sambung("usr-hakim", "hakim");
    const naskah = (teks: string) =>
      Buffer.from(`%PDF-1.4\n1 0 obj<</Producer(LibreOffice 7.4)>>endobj\n2 0 obj<</Length 50>>stream\nBT /F1 12 Tf (${teks}) Tj ET\nendstream endobj\nxref\n%%EOF`, "latin1");
    const satu = tiruanPenangkap();
    const h = await unggah(depsUji(satu.e).deps, naskah("Disusun ALETA"));
    expect(h).toMatchObject({ ok: false, alasan: "isi_berkas_menyebut_aleta" });
    expect(String(h.pesan)).toContain("e-Court");
    expect(String(h.pesan)).not.toContain("SIPP");
    expect(satu.e.panggilan).toHaveLength(0);
    expect(kalimatAlasan("isi_berkas_menyebut_aleta")).toContain("e-Court");

    const dua = tiruanPenangkap();
    const h2 = await unggah(depsUji(dua.e, { pihakSippAleta: async () => ["ALETA SARI binti Hasan"] }).deps, naskah("Penggugat ALETA SARI binti Hasan"));
    expect(h2.ok, JSON.stringify(h2)).toBe(true);
    expect(dua.tangkap.isi).toContain("ALETA SARI binti Hasan");
  });
});

// ============================================================================
describe("E11 - keadaan putusan untuk lencana + pemantau yang sopan", () => {
  it("keadaanPutusanBanyak: belum diunggah / belum TTE / lengkap dari simpulan yang sama dengan Status Perkara", async () => {
    const l = aksiModul.buatLayanan(depsUji(tiruanEcourt()).deps);
    const { keadaan } = await l.keadaanPutusanBanyak(["1/Pdt.G/2026/PA.Dgl", "2/Pdt.G/2026/PA.Dgl", "3/Pdt.G/2026/PA.Dgl"]);
    expect(keadaan["1/Pdt.G/2026/PA.Dgl"]).toMatchObject({ belumDiunggah: true, belumTte: false, perluTindakan: true });
    expect(keadaan["2/Pdt.G/2026/PA.Dgl"]).toMatchObject({ belumDiunggah: false, belumTte: true, perluTindakan: true });
    expect(keadaan["3/Pdt.G/2026/PA.Dgl"]).toMatchObject({ perluTindakan: false });
  });

  it("lencana: teksnya, dan diam bila tidak perlu tindakan", () => {
    const html = (k: any) => renderToStaticMarkup(createElement(LencanaKeadaanPutusan, { keadaan: k }));
    expect(html({ keadaan: "salinan_belum_diunggah", sebutan: "x", perluTindakan: true, belumDiunggah: true, belumTte: false })).toContain(
      "Belum diunggah ke e-Court"
    );
    expect(html({ keadaan: "belum_tte_panitera", sebutan: "x", perluTindakan: true, belumDiunggah: false, belumTte: true })).toContain(
      "Belum TTE panitera"
    );
    expect(html({ keadaan: "lengkap", sebutan: "x", perluTindakan: false, belumDiunggah: false, belumTte: false })).toBe("");
    // Bentuk putusanEcourt baris Jadwal Sidang (tanpa bendera) - J dapat memberikannya langsung.
    expect(html({ keadaan: "belum_tte_panitera", sebutan: "Belum TTE oleh Panitera", perluTindakan: true })).toContain("Belum TTE panitera");
    expect(html({ keadaan: "salinan_belum_diunggah", sebutan: "s", perluTindakan: true })).toContain("Belum diunggah ke e-Court");
  });

  const SETEL = { aktif: true, jarakMenit: 20, maksPerJam: 3, jedaUlangJam: 12, rentangHari: 60 };
  const JADWAL = { pengaturan: { aktif: true }, dalamJamKerja: true, sedangJalan: false, adaPenarikanLain: false };
  const kosong = () => ({ terakhirPeriksa: 0, riwayat: [] as number[], gagalBeruntun: 0, menunggu: null });

  it("bolehPeriksa: mati, penjadwal mati, luar jam kerja, penarikan lain, jarak, batas per jam", () => {
    const t = 10 * 60 * 60 * 1000;
    const b = (o: any = {}) => pantau.bolehPeriksa({ sekarang: t, pengaturan: SETEL, keadaan: kosong(), penjadwal: JADWAL, ...o });
    expect(b().boleh).toBe(true);
    expect(b({ pengaturan: { ...SETEL, aktif: false } }).sebab).toBe("mati");
    expect(b({ penjadwal: { ...JADWAL, pengaturan: { aktif: false } } }).sebab).toBe("penjadwal_penarikan_mati");
    expect(b({ penjadwal: { ...JADWAL, dalamJamKerja: false } }).sebab).toBe("di_luar_jam_kerja");
    expect(b({ penjadwal: { ...JADWAL, sedangJalan: true } }).sebab).toBe("penarikan_lain_berjalan");
    expect(b({ keadaan: { ...kosong(), terakhirPeriksa: t - 5 * 60 * 1000 } }).sebab).toBe("belum_waktunya");
    expect(b({ keadaan: { ...kosong(), terakhirPeriksa: t - 21 * 60 * 1000 } }).boleh).toBe(true);
    const tigaKali = [t - 50 * 60 * 1000, t - 40 * 60 * 1000, t - 30 * 60 * 1000];
    expect(b({ keadaan: { ...kosong(), riwayat: tigaKali } }).sebab).toBe("batas_per_jam");
  });

  it("mundur sesudah gagal: jarak berlipat dua per kegagalan beruntun, dibatasi 4 jam; sesi habis langsung terjauh", () => {
    const t = 100 * 60 * 60 * 1000;
    const k = (gagal: number, lalu: number) => ({ ...kosong(), gagalBeruntun: gagal, terakhirPeriksa: t - lalu * 60 * 1000 });
    const b = (keadaan: any) => pantau.bolehPeriksa({ sekarang: t, pengaturan: SETEL, keadaan, penjadwal: JADWAL });
    expect(b(k(1, 30)).sebab).toBe("mundur_sesudah_gagal"); // butuh 40 menit
    expect(b(k(1, 41)).boleh).toBe(true);
    expect(b(k(2, 79)).sebab).toBe("mundur_sesudah_gagal"); // butuh 80 menit
    expect(b(k(10, 239)).sebab).toBe("mundur_sesudah_gagal"); // batas 4 jam
    expect(b(k(10, 241)).boleh).toBe(true);
    expect(pantau.catatHasil(3, 0)).toBe(0);
    expect(pantau.catatHasil(0, 1)).toBe(1);
    expect(pantau.catatHasil(0, 2)).toBe(10);
  });

  it("detak: SATU perkara per pemeriksaan, yang belum pernah/paling lama diperiksa dulu, tanpa acak", async () => {
    const t = Date.parse("2026-10-01T03:00:00Z");
    const dimulai: string[] = [];
    let jadwal: any = { ...JADWAL, terakhirSelesai: null, terakhirKode: null };
    const p = pantau.buatPemantau({
      pengaturan: () => SETEL,
      statusPenjadwal: () => jadwal,
      perkaraPutus: async () => ["9/Pdt.G/2026/PA.Dgl", "8/Pdt.G/2026/PA.Dgl", "7/Pdt.G/2026/PA.Dgl", "6/Pdt.G/2026/PA.Dgl"],
      dikenalEcourt: async () => new Set(["9/Pdt.G/2026/PA.Dgl", "8/Pdt.G/2026/PA.Dgl", "7/Pdt.G/2026/PA.Dgl"]),
      catatanPutusan: async () => ({
        "9/Pdt.G/2026/PA.Dgl": { adaBaris: true, dokumenAda: true, paniteraTte: true, diperiksaPada: "2026-09-01T00:00:00Z" },
        "8/Pdt.G/2026/PA.Dgl": { adaBaris: true, dokumenAda: true, paniteraTte: false, diperiksaPada: "2026-09-20T00:00:00Z" },
      }),
      mulaiPenarikan: (n: string) => (dimulai.push(n), { ok: true }),
    });
    const h1 = await p.detak(t);
    // 7 belum pernah diperiksa -> didahulukan; 9 sudah lengkap; 6 bukan perkara e-Court.
    expect(h1).toMatchObject({ diperiksa: "7/Pdt.G/2026/PA.Dgl", sisaCalon: 1 });
    expect((await p.detak(t + 60_000)).sebab).toBe("menunggu_hasil_sebelumnya");
    // Penarikan selesai GAGAL (kode 1): mundur.
    jadwal = { ...JADWAL, terakhirSelesai: new Date(t + 120_000).toISOString(), terakhirKode: 1 };
    expect((await p.detak(t + 25 * 60_000)).sebab).toBe("mundur_sesudah_gagal");
    expect(p.getStatus().gagalBeruntun).toBe(1);
    expect((await p.detak(t + 41 * 60_000)).diperiksa).toBe("7/Pdt.G/2026/PA.Dgl");
    expect(dimulai).toEqual(["7/Pdt.G/2026/PA.Dgl", "7/Pdt.G/2026/PA.Dgl"]);
  });
});

// ============================================================================
describe("rute bot /internal/aleta-bot/ecourt-* - token wajib, passphrase tidak terpantul", () => {
  it("tanpa token: 401; TTE tanpa sesi panitera ditolak dengan alasannya, passphrase tidak ada di jawaban", async () => {
    process.env.ALETA_BOT_INTERNAL_API_TOKEN = "token-uji-e";
    const express = require_("express") as any;
    const app = express();
    app.use(express.json());
    app.use("/internal/aleta-bot", muatBot("routes/ecourtAksiRoutes.js"));
    const server = await new Promise<any>((ok) => {
      const s = app.listen(0, "127.0.0.1", () => ok(s));
    });
    try {
      const alamat = `http://127.0.0.1:${server.address().port}/internal/aleta-bot`;
      const tanpa = await fetch(`${alamat}/ecourt-pengguna/sesi?penggunaId=usr-x`);
      expect(tanpa.status).toBe(401);
      const r = await fetch(`${alamat}/ecourt-aksi/tte`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-aleta-internal-token": "token-uji-e" },
        body: JSON.stringify({ penggunaId: "usr-tanpa-sesi", nama: "X", nomorPerkara: "2/Pdt.G/2026/PA.Dgl", passphrase: PASSPHRASE, konfirmasi: true }),
      });
      const teks = await r.text();
      expect(r.status).toBe(400);
      expect(JSON.parse(teks)).toMatchObject({ ok: false, alasan: "akun_ecourt_belum_diisi" });
      expect(teks).not.toContain(PASSPHRASE);
    } finally {
      server.close();
      delete process.env.ALETA_BOT_INTERNAL_API_TOKEN;
    }
  });
});

describe("jalur portal -> bot untuk aksi e-Court", () => {
  it("rute bot dipasang di app.js (dengan batas badan 28 MB untuk unggah) dan setiap jalur yang dipanggil portal ada", () => {
    const app = readFileSync(path.join(AKAR, "aleta_bot/app.js"), "utf8");
    expect(app).toContain('app.use("/internal/aleta-bot", require("./routes/ecourtAksiRoutes"))');
    expect(app).toContain('app.use("/internal/aleta-bot/ecourt-putusan/unggah", express.json({ limit: "28mb" }))');
    const router = readFileSync(path.join(AKAR, "aleta_bot/routes/ecourtAksiRoutes.js"), "utf8");
    const terdaftar = new Set([...router.matchAll(/router\.(?:get|post)\(\s*"([^"]+)"/g)].map((m) => m[1]));
    const akarRute = path.join(process.cwd(), "src/app/api/aleta-ecourt");
    const berkas = ["ecourt-sesi", "ecourt-aksi/perkara", "ecourt-aksi/keadaan", "ecourt-aksi/unduh", "ecourt-aksi/verifikasi", "ecourt-aksi/tte", "ecourt-aksi/pantau", "ecourt-putusan/akun", "ecourt-putusan/unggah"].map(
      (b) => readFileSync(path.join(akarRute, b, "route.ts"), "utf8")
    );
    const dipanggil = new Set(berkas.flatMap((isi) => [...isi.matchAll(/(?:panggilBot|ambilBerkasBot)(?:<[\s\S]*?>)?\(\s*[`"](\/[a-z-/]+)/g)].map((m) => m[1])));
    expect(dipanggil.size).toBeGreaterThanOrEqual(10);
    expect([...dipanggil].filter((j) => !terdaftar.has(j))).toEqual([]);
  });
});

// ============================================================================
describe("0055 - jejak aksi e-Court: diklaim sekali, tiga tempat pendaftaran", () => {
  const TAG = "0055_aleta_ecourt_aksi_jejak";
  const SQL = path.join(process.cwd(), "drizzle", `${TAG}.sql`);
  const pernyataan = (sql: string) =>
    sql
      .split("\n")
      .map((b) => b.replace(/--.*$/, ""))
      .join("\n")
      .split(";")
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter(Boolean);

  it("idx 55 bertag 0055_aleta_ecourt_aksi_jejak tepat sekali, jurnal tanpa lubang", () => {
    const j = JSON.parse(readFileSync(path.join(process.cwd(), "drizzle/meta/_journal.json"), "utf8")) as {
      entries: Array<{ idx: number; tag: string }>;
    };
    j.entries.forEach((e, i) => expect(e.idx).toBe(i));
    expect(j.entries.filter((e) => e.idx === 55)).toEqual([expect.objectContaining({ tag: TAG })]);
    expect(j.entries.filter((e) => e.tag.startsWith("0055_"))).toHaveLength(1);
    expect(existsSync(SQL)).toBe(true);
  });

  it("DDL berkas = DDL schema.ts; tabel ikut cadangan; pg-mem kosong membangunnya", () => {
    const dariBerkas = pernyataan(readFileSync(SQL, "utf8"));
    // 0074 menambah 'login_wa' ke daftar CHECK aksi (basis data baru langsung memakainya; yang lama lewat
    // 0074_aleta_ecourt_aksi_login_wa.sql). Selain itu DDL schema.ts tetap persis berkas 0055.
    const dariSkema = [...DDL_ECOURT_AKSI_JEJAK.tabel, ...DDL_ECOURT_AKSI_JEJAK.indeks].map((s) =>
      pernyataan(s)[0].replace(", 'login_wa'", "")
    );
    expect(dariBerkas).toEqual(dariSkema);
    expect(IN_MEMORY_TABLE_PERSISTENCE_ORDER).toContain("aleta_ecourt_aksi_jejak");
    const kosong = newDb();
    kosong.public.none(readFileSync(SQL, "utf8"));
    expect(kosong.public.many("SELECT * FROM aleta_ecourt_aksi_jejak")).toEqual([]);
  });
});

// ============================================================================
// Rute portal atas pg-mem berbenih; bot ditiru lewat fetch.
// ============================================================================
let db: AletaDatabase | null = null;
let aktor: string | null = "usr-panitera";
vi.mock("@/server/db/client", async (asli) => {
  const modul = await asli<typeof import("@/server/db/client")>();
  return { ...modul, getDatabase: async () => db };
});
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => aktor }));
const d = () => db as AletaDatabase;

type Kiriman = { url: string; badan: any };
let kiriman: Kiriman[] = [];
function tiruBot(jawab: (url: string, badan: any) => { status?: number; json?: unknown; teks?: string }) {
  kiriman = [];
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    const badan = init?.body ? JSON.parse(String(init.body)) : null;
    kiriman.push({ url: String(url), badan });
    const j = jawab(String(url), badan);
    return new Response(j.teks ?? JSON.stringify(j.json ?? {}), {
      status: j.status ?? 200,
      headers: { "content-type": j.teks ? "text/html" : "application/json" },
    });
  });
}

async function rute(modul: string, cara: "GET" | "POST", opsi: { query?: string; badan?: unknown; form?: FormData } = {}) {
  const r = (await import(`@/app/api/aleta-ecourt/${modul}/route`)) as Record<string, (q: NextRequest) => Promise<Response>>;
  const req = new NextRequest("http://localhost/api/x" + (opsi.query ? `?${opsi.query}` : ""), {
    method: cara,
    headers: opsi.badan !== undefined ? { "content-type": "application/json", "x-forwarded-for": "10.0.0.7" } : { "x-forwarded-for": "10.0.0.7" },
    body: opsi.form ?? (opsi.badan !== undefined ? JSON.stringify(opsi.badan) : undefined),
  });
  const j = await r[cara](req);
  return { status: j.status, isi: (await j.json()) as any };
}

async function semuaJejakDanAudit() {
  const a = await d().queryAll<Record<string, unknown>>("SELECT * FROM aleta_ecourt_aksi_jejak");
  const b = await d().queryAll<Record<string, unknown>>("SELECT * FROM audit_logs");
  return JSON.stringify(a) + JSON.stringify(b);
}

describe("rute portal - rahasia tidak tinggal, identitas dari akun yang login", () => {
  beforeEach(async () => {
    db = await createAletaDatabase({ useInMemory: true, seed: true });
    aktor = "usr-panitera";
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    await db?.close();
    db = null;
  });

  it("TTE: passphrase diteruskan ke bot SEKALI, tidak ada di jejak/audit/jawaban walau bot memantulkannya", async () => {
    tiruBot(() => ({ status: 400, json: { ok: false, alasan: `tte_belum_terbukti ${PASSPHRASE}`, pesan: `salah: ${PASSPHRASE}`, akun: { nama: "P", peran: "Panitera" } } }));
    const h = await rute("ecourt-aksi/tte", "POST", {
      badan: { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", passphrase: PASSPHRASE, konfirmasi: true, penggunaId: "usr-super" },
    });
    expect(h.status).toBe(200);
    expect(kiriman).toHaveLength(1);
    expect(kiriman[0].url).toContain("/internal/aleta-bot/ecourt-aksi/tte");
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-panitera", passphrase: PASSPHRASE, konfirmasi: true });
    expect(JSON.stringify(h.isi)).not.toContain(PASSPHRASE);
    const tersimpan = await semuaJejakDanAudit();
    expect(tersimpan).toContain("tte");
    expect(tersimpan).toContain("10.0.0.7");
    expect(tersimpan).not.toContain(PASSPHRASE);
  });

  it("TTE tanpa konfirmasi: bot tidak dipanggil", async () => {
    tiruBot(() => ({ json: { ok: true } }));
    const h = await rute("ecourt-aksi/tte", "POST", { badan: { nomorPerkara: "2/Pdt.G/2026/PA.Dgl", passphrase: PASSPHRASE } });
    expect(h.isi.data.alasan).toBe("konfirmasi_belum_diberikan");
    expect(kiriman).toHaveLength(0);
  });

  it("sambung sesi: sandi tidak ada di jejak/audit/jawaban; penggunaId dari akun yang login", async () => {
    aktor = "usr-hakim";
    tiruBot(() => ({ status: 400, json: { ok: false, alasan: `login_ditolak_ecourt ${SANDI}` } }));
    const h = await rute("ecourt-sesi", "POST", {
      badan: { aksi: "kirim", peran: "hakim", email: "a@b", sandi: SANDI, captcha: "x", penggunaId: "usr-super" },
    });
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-hakim", sandi: SANDI });
    expect(JSON.stringify(h.isi)).not.toContain(SANDI);
    expect(await semuaJejakDanAudit()).not.toContain(SANDI);
  });

  it("K6 GET akun: bentuk kontrak; bot lama (404 HTML) = 'belum tersedia di server', bukan error 500", async () => {
    aktor = "usr-hakim";
    tiruBot(() => ({ json: { ok: true, akun: { nama: "Hakim Uji", peran: "Hakim", kodePeran: "hakim", tersambung: true, sumber: "pribadi" }, alasan: "", salinan: { sudahDiunggah: false, tanggal: "", olehNama: "" } } }));
    const h = await rute("ecourt-putusan/akun", "GET", { query: "nomor=3%2FPdt.G%2F2026%2FPA.Dgl" });
    expect(h.isi.data).toMatchObject({
      ok: true,
      akun: { nama: "Hakim Uji", peran: "Hakim", tersambung: true, sumber: "pribadi" },
      salinan: { sudahDiunggah: false, tanggal: "", olehNama: "" },
    });
    expect(kiriman[0].url).toContain("penggunaId=usr-hakim");
    tiruBot(() => ({ status: 404, teks: "<html>Cannot GET</html>" }));
    const lama = await rute("ecourt-putusan/akun", "GET", { query: "nomor=3%2FPdt.G%2F2026%2FPA.Dgl" });
    expect(lama.status).toBe(200);
    expect(lama.isi.data).toMatchObject({ ok: false, akun: null, alasan: "fitur_belum_tersedia_di_server" });
    expect(kalimatAlasan("fitur_belum_tersedia_di_server")).toContain("belum tersedia di server");
  });

  it("K6 POST unggah: bukan PDF ditolak tanpa memanggil bot; PDF diteruskan sebagai base64 atas nama yang login", async () => {
    aktor = "usr-hakim";
    tiruBot(() => ({ json: { ok: true, akun: { nama: "Hakim Uji", peran: "Hakim" }, salinan: { sudahDiunggah: true, tanggal: "x", olehNama: "y" } } }));
    const f1 = new FormData();
    f1.set("nomor", "3/Pdt.G/2026/PA.Dgl");
    f1.set("berkas", new Blob(["bukan pdf"], { type: "application/pdf" }), "a.pdf");
    expect((await rute("ecourt-putusan/unggah", "POST", { form: f1 })).isi.data.alasan).toBe("berkas_bukan_pdf");
    expect(kiriman).toHaveLength(0);

    const f2 = new FormData();
    f2.set("nomor", "3/Pdt.G/2026/PA.Dgl");
    f2.set("berkas", new Blob(["%PDF-1.7 isi"], { type: "application/pdf" }), "salinan.pdf");
    const h = await rute("ecourt-putusan/unggah", "POST", { form: f2 });
    expect(h.isi.data).toMatchObject({ ok: true, akun: { nama: "Hakim Uji", peran: "Hakim" } });
    expect(kiriman[0].badan).toMatchObject({ penggunaId: "usr-hakim", nomor: "3/Pdt.G/2026/PA.Dgl", konfirmasi: true });
    expect(Buffer.from(kiriman[0].badan.berkasBase64, "base64").toString()).toBe("%PDF-1.7 isi");
    expect(await semuaJejakDanAudit()).toContain("unggah_salinan");
  });

  it("catatJejakAksi menyapu rahasia dari alasan sebelum menulis", async () => {
    await catatJejakAksi(
      d(),
      { penggunaId: "usr-panitera", aksi: "tte", hasil: "gagal", alasan: `x ${PASSPHRASE} y`, nomorPerkara: "2/Pdt.G/2026/PA.Dgl" },
      [PASSPHRASE]
    );
    const isi = await semuaJejakDanAudit();
    expect(isi).toContain("x *** y");
    expect(isi).not.toContain(PASSPHRASE);
  });

  it("pemantau: hanya admin yang mengubah pengaturannya", async () => {
    tiruBot(() => ({ json: { ok: true, pengaturan: {} } }));
    aktor = "usr-hakim";
    expect((await rute("ecourt-aksi/pantau", "POST", { badan: { aktif: false } })).status).toBe(403);
    expect(kiriman).toHaveLength(0);
    aktor = "usr-super";
    expect((await rute("ecourt-aksi/pantau", "POST", { badan: { aktif: false } })).status).toBe(200);
    expect(kiriman[0].badan).toEqual({ aktif: false });
  });
});
