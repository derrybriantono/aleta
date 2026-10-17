// @vitest-environment node
/**
 * ============================================================================
 * F4.1 (17 Okt 2026) - UNGGAH MASSAL e-DOC PUTUSAN & BAS KE SIPP
 * ============================================================================
 *
 *   A. Bot unggahMassalService (basis data TIRUAN): hanya SELECT, putusan/BAS/tertahan,
 *      jejak ABT per sidang, galat disebut - bukan dijawab kosong
 *   B. Bot basUnggahService (cakram + basis data TIRUAN): nama & folder persis SIPP
 *      (fileupload_c.php), dobel tidak diganti, balapan dua tab, hak lapis kedua
 *   C. Portal unggah-massal.ts: hak per peran, "milik saya", pemeriksa isi BAS, riwayat
 *   D. Rute portal (bot & akses ditiru): 403 per peran, 409 isi/dobel, peranPenekan
 *   E. Ekstensi abt.js 17OKT-F41 di jsdom: mesin (berhenti aman, dobel, cek tepat
 *      sebelum tulis, anonim yang belum diperiksa tidak diunggah) dan layar
 *   F. Titik sambung: penyatu M2, Blangko Derry, tanpa tanyajawab_template
 *
 * Tidak ada yang ditulis ke SIPP/ABT sungguhan: seluruh jaringan dan basis data tiruan.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  bersihkanRingkasan,
  hakUnggahMassal,
  hitungRingkasan,
  periksaBerkasBas,
  susunDaftarUnggahMassal,
} from "@/server/modules/aleta-ecourt/unggah-massal";
import type { UnggahMassalDaftarBot } from "@/server/modules/aleta-bot/whatsapp-gateway-client";

const AKAR = path.resolve(process.cwd(), "..");
const req = createRequire(import.meta.url);
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");

const AKTOR = {
  hakim: { id: "usr_h", name: "Hakim Satu", roleId: "hakim", additionalRoleIds: [] },
  ketua: { id: "usr_k", name: "Ketua Satu", roleId: "ketua", additionalRoleIds: [] },
  pp: { id: "usr_p", name: "Andini Puspita Sari", roleId: "panitera-pengganti", additionalRoleIds: [] },
  panitera: { id: "usr_pn", name: "Panitera Satu", roleId: "panitera", additionalRoleIds: [] },
  js: { id: "usr_j", name: "JS Satu", roleId: "jurusita", additionalRoleIds: [] },
  analis: { id: "usr_an", name: "Analis Satu", roleId: "analis-perkara", additionalRoleIds: [] },
  admin: { id: "usr_a", name: "Admin", roleId: "admin", additionalRoleIds: [] },
} as const;

// ----------------------------------------------------------------------------
// A. unggahMassalService
// ----------------------------------------------------------------------------
describe("A. bot unggahMassalService - daftar e-Doc yang menunggu (SELECT saja)", () => {
  const layanan = req(path.join(AKAR, "aleta_bot/services/unggahMassalService.js"));
  function deps(o: { gagalAbt?: boolean; tanpaKolom?: boolean } = {}) {
    const sql: string[] = [];
    return {
      sql,
      d: {
        hariIni: async () => "2026-10-17",
        tabelAda: async () => true,
        kolomAda: async () => !o.tanpaKolom,
        kueriSipp: async (s: string) => {
          sql.push(s);
          if (/FROM perkara_putusan pp/.test(s)) {
            return [
              { perkara_id: 9851, nomor_perkara: "348/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Gugat", alur_perkara_id: 15, tanggal_putusan: "2026-07-09", status_putusan: "Dikabulkan", putusan_verstek: "Y", ada_putusan: 1, ada_anonim: 0, majelis: "Hakim Satu, S.H.|Hakim Dua", panitera: "Andini Puspita Sari, S.Sy." },
            ];
          }
          if (/FROM perkara_jadwal_sidang js\s+JOIN perkara p ON p.perkara_id = js.perkara_id\s+LEFT JOIN perkara_putusan/.test(s)) {
            return [{ perkara_id: 10200, nomor_perkara: "600/Pdt.G/2026/PA.Dgl", tanggal: "2026-10-16", majelis: "Hakim Satu" }];
          }
          if (/edoc_bas IS NULL/.test(s)) {
            return [
              { id: 501, perkara_id: 10134, nomor_perkara: "582/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Gugat", alur_perkara_id: 15, urutan: 2, tanggal: "2026-10-15", agenda: "pemeriksaan pokok perkara", ditunda: "Y", alasan_ditunda: "", ikrar_talak: "T", panitera: "Andini Puspita Sari, S.Sy.", majelis: "Hakim Satu" },
              { id: 502, perkara_id: 10135, nomor_perkara: "583/Pdt.G/2026/PA.Dgl", jenis_perkara_nama: "Cerai Talak", alur_perkara_id: 15, urutan: 1, tanggal: "2026-10-17", agenda: "sidang pertama", ditunda: "T", alasan_ditunda: "", ikrar_talak: "T", panitera: "PP Lain", majelis: "Hakim Dua" },
            ];
          }
          return [];
        },
        kueriAbt: async (s: string) => {
          sql.push(s);
          if (o.gagalAbt) throw new Error("ER_ACCESS_DENIED");
          return [{ perkara_id: 10134, sidang_id: 501, n: 14, saksi: 2 }];
        },
      },
    };
  }

  it("putusan, tertahan, dan BAS dibaca dengan SELECT berparameter; nama majelis dipecah '|' (gelar berkoma utuh)", async () => {
    const t = deps();
    const h = await layanan.buatLayanan(t.d).daftar({ sejakHari: 120 });
    expect(h.ok).toBe(true);
    expect(h.sejak).toBe("2026-06-19");
    expect(t.sql.every((s) => /^\s*SELECT/i.test(s))).toBe(true);
    expect(h.putusan[0]).toMatchObject({ perkaraId: "9851", adaPutusan: true, adaAnonim: false, verstek: true, majelis: ["Hakim Satu, S.H.", "Hakim Dua"] });
    expect(h.tertahan[0]).toMatchObject({ nomorPerkara: "600/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-16" });
    expect(h.bas.map((b: { sidangId: string }) => b.sidangId)).toEqual(["501", "502"]);
    expect(h.bas[0].saksiAbt).toEqual({ saksi: 2, tanyaJawab: 14 });
    expect(h.bas[1].saksiAbt).toEqual({ saksi: 0, tanyaJawab: 0 });
    // majelis putusan = penetapan PEMERIKSAAN (tahapan 10), aktif maupun tidak (ikrar menonaktifkannya)
    const sqlPutusan = t.sql.find((s) => /FROM perkara_putusan pp/.test(s))!;
    expect(sqlPutusan).toMatch(/h\.tahapan_id = 10\)/);
    expect(sqlPutusan).not.toMatch(/h\.aktif/);
  });

  it("ABT tidak terbaca -> disebut di galat, BAS tetap tampil dengan saksiAbt null (bukan 0 palsu)", async () => {
    const t = deps({ gagalAbt: true });
    const h = await layanan.buatLayanan(t.d).daftar({});
    expect(h.abtTerbaca).toBe(false);
    expect(h.galat).toEqual([expect.objectContaining({ sumber: "abt", langkah: "keterangan saksi" })]);
    expect(h.bas[0].saksiAbt).toBeNull();
  });

  it("kolom edoc_bas tidak ada -> bas null + galat, putusan tetap", async () => {
    const h = await layanan.buatLayanan(deps({ tanpaKolom: true }).d).daftar({});
    expect(h.bas).toBeNull();
    expect(h.putusan).toHaveLength(1);
    expect(h.galat[0].langkah).toBe("BAS tanpa e-Doc");
  });

  it("cek: putusan & BAS membaca keadaan e-Doc SAAT INI, hanya nama berkasnya yang dipulangkan", async () => {
    const d = {
      kueriSipp: async (s: string) =>
        /perkara_putusan/.test(s)
          ? [{ tanggal_putusan: "2026-07-09", amar_putusan_dok: "resources/file/doc/2026/07/PADgl_2026_PdtG_348_putusan_akhir.rtf", amar_putusan_anonimisasi_dok: null }]
          : [{ urutan: 2, tanggal: "2026-10-15", edoc_bas: "resources/file/doc/2026/09/PADgl_2026_PdtG_582_bas_2_1.rtf" }],
    };
    const l = layanan.buatLayanan(d);
    expect(await l.cek({ jenis: "putusan", perkaraId: "9851" })).toMatchObject({ ok: true, adaBaris: true, adaPutusan: true, adaAnonim: false, jalurPutusan: "PADgl_2026_PdtG_348_putusan_akhir.rtf" });
    expect(await l.cek({ jenis: "bas", perkaraId: "10134", sidangId: "501" })).toMatchObject({ ok: true, adaBas: true, jalur: "PADgl_2026_PdtG_582_bas_2_1.rtf", urutan: 2 });
    expect(await l.cek({ jenis: "bas", perkaraId: "10134", sidangId: "x" })).toEqual({ ok: false, alasan: "sidang_tidak_sah" });
  });
});

// ----------------------------------------------------------------------------
// B. basUnggahService
// ----------------------------------------------------------------------------
describe("B. bot basUnggahService - e-Doc BAS persis tingkap SIPP, dobel tidak diganti", () => {
  const svc = req(path.join(AKAR, "aleta_bot/services/basUnggahService.js"));
  const RTF = Buffer.from("{\\rtf1 BERITA ACARA SIDANG}", "latin1");

  it("nama & folder sama dengan berkas buatan SIPP di server (PADgl_2026_PdtG_497_bas_7_<cap>.pdf, folder tahun/bulan DAFTAR)", () => {
    expect(svc.namaBerkasBas("497/Pdt.G/2026/PA.Dgl", 7, 1792096162, "pdf")).toBe("PADgl_2026_PdtG_497_bas_7_1792096162.pdf");
    expect(svc.jalurBas("497/Pdt.G/2026/PA.Dgl", "2026-08-03", 7, 1792096162, "pdf")).toBe("resources/file/doc/2026/08/PADgl_2026_PdtG_497_bas_7_1792096162.pdf");
    expect(svc.namaBerkasBas("12/Pdt.P/2026", 1, 1, "rtf")).toBe("");
    expect(svc.namaBerkasBas("497/Pdt.G/2026/PA.Dgl", 1, 1, "../x")).toBe("");
  });

  it("hak lapis kedua: hanya golongan BAS (PP/panitera/panmud/analis/admin)", () => {
    expect(svc.periksaHakUnggahBas({ peranPenekan: "pp" }).ok).toBe(true);
    expect(svc.periksaHakUnggahBas({ peranPenekan: "admin" }).ok).toBe(true);
    expect(svc.periksaHakUnggahBas({ peranPenekan: "hakim" })).toMatchObject({ ok: false, status: 403 });
    expect(svc.periksaHakUnggahBas({})).toMatchObject({ ok: false, alasan: "peran_penekan_tidak_disebut" });
  });

  function tiruan(o: { edoc?: string; tanggal?: string; terubah?: number; akarTulis?: boolean; lamaAda?: boolean } = {}) {
    const kejadian: string[] = [];
    const jejak: Array<Record<string, unknown>> = [];
    const d = {
      kueri: async (s: string, p: unknown[]) => {
        kejadian.push(`${s.trim().split(/\s+/)[0]} ${JSON.stringify(p)}`);
        if (/^SELECT/.test(s.trim())) {
          return [{ id: 501, urutan: 2, tanggal: o.tanggal ?? "2026-10-15", edoc_bas: o.edoc ?? null, nomor_perkara: "582/Pdt.G/2026/PA.Dgl", tanggal_daftar: "2026-09-22" }];
        }
        kejadian.push(s.includes("(edoc_bas IS NULL OR edoc_bas = '')") ? "UPDATE-bersyarat" : "UPDATE-ganti");
        return { affectedRows: o.terubah ?? 1 };
      },
      tabelAda: async () => true,
      kolomAda: async () => true,
      kenaliDokumen: (b: Buffer) => (b.subarray(0, 5).toString("latin1") === "{\\rtf" ? "rtf" : ""),
      periksaAkar: () => (o.akarTulis === false ? { dapatDitulis: false, alasan: "akar_hanya_baca", pesan: "hanya baca" } : { dapatDitulis: true, akar: "/sipp" }),
      tulisBerkas: (penuh: string) => kejadian.push(`TULIS ${penuh.replace(/\\/g, "/")}`),
      hapusBerkas: (penuh: string) => kejadian.push(`HAPUS ${penuh.replace(/\\/g, "/")}`),
      pindahBerkas: (dari: string, ke: string) => {
        kejadian.push(`PINDAH ${dari.replace(/\\/g, "/")} -> ${ke.replace(/\\/g, "/")}`);
        return o.lamaAda !== false;
      },
      sekarang: () => new Date("2026-10-17T01:02:03Z"),
      samakanPemilik: () => undefined,
      akunSipp: async (u: string) => ({ username: u ? "andini" : "", terpetakan: Boolean(u) }),
      catatJejak: async (j: Record<string, unknown>) => {
        jejak.push(j);
        return true;
      },
      capWaktu: () => 1792200000,
      hariIni: async () => "2026-10-17",
    };
    return { d, kejadian, jejak };
  }
  const MASUK = { perkaraId: "10134", sidangId: "501", nomorPerkara: "582/Pdt.G/2026/PA.Dgl", isi: RTF, olehUsername: "Andini", operator: "Andini (ALETA)", ip: "192.168.10.5" };

  it("berkas DULU lalu UPDATE bersyarat 'masih kosong'; jejak ALETA mencatat jalur; tanpa sys_audittrail", async () => {
    const t = tiruan();
    const h = await svc.buatLayanan(t.d).unggahBas(MASUK);
    expect(h).toMatchObject({ ok: true, nama: "PADgl_2026_PdtG_582_bas_2_1792200000.rtf", urutan: 2, diganti: false });
    expect(h.jalur).toBe("resources/file/doc/2026/09/PADgl_2026_PdtG_582_bas_2_1792200000.rtf");
    const urut = t.kejadian.map((k) => k.split(" ")[0]);
    expect(urut.indexOf("TULIS")).toBeLessThan(urut.indexOf("UPDATE"));
    expect(t.kejadian).toContain("UPDATE-bersyarat");
    expect(t.kejadian.join("\n")).not.toMatch(/sys_audittrail|INSERT/);
    expect(t.jejak[0]).toMatchObject({ aksi: "unggah", jenis: "edoc_bas", berhasil: true, akunSipp: "andini", operator: "Andini (ALETA)" });
  });

  it("e-Doc sudah ada -> TIDAK ditulis apa pun tanpa `ganti`; dengan ganti berkas lama DIPINDAH ke folder terhapus (butir 44)", async () => {
    const t = tiruan({ edoc: "resources/file/doc/2026/09/lama.rtf" });
    const h = await svc.buatLayanan(t.d).unggahBas(MASUK);
    expect(h).toMatchObject({ ok: false, alasan: "sudah_ada", jalurLama: "lama.rtf" });
    expect(t.kejadian.some((k) => /^(TULIS|UPDATE)/.test(k))).toBe(false);
    const t2 = tiruan({ edoc: "resources/file/doc/2026/09/lama.rtf" });
    const h2 = await svc.buatLayanan(t2.d).unggahBas({ ...MASUK, ganti: true });
    expect(h2).toMatchObject({ ok: true, diganti: true, jalurLama: "lama.rtf" });
    expect(t2.kejadian).toContain("UPDATE-ganti");
    expect(t2.kejadian.some((k) => k.startsWith("HAPUS"))).toBe(false);
    // Butir 44 (17 Okt): dipindah SESUDAH baris diganti, ke <folder>/terhapus/<nama>_<waktu WITA>.
    const urut = t2.kejadian.map((k) => k.split(" ")[0]);
    expect(urut.indexOf("UPDATE")).toBeLessThan(urut.indexOf("PINDAH"));
    expect(t2.kejadian).toContain(
      "PINDAH /sipp/resources/file/doc/2026/09/lama.rtf -> /sipp/resources/file/doc/2026/09/terhapus/lama_20261017-090203.rtf"
    );
    expect(h2).toMatchObject({ lamaDipindah: "resources/file/doc/2026/09/terhapus/lama_20261017-090203.rtf", peringatanLama: "" });
    // Jejak hanya di ALETA - menyebut jalur lama & barunya.
    expect(String((t2.jejak[0].langkah as Array<{ keterangan: string }>)[0].keterangan)).toContain("berkas lama dipindah ke resources/file/doc/2026/09/terhapus/");
    // Berkas lama yang tidak ada di cakram: penggantian tetap jalan, sebabnya dilaporkan.
    const t3 = tiruan({ edoc: "resources/file/doc/2026/09/lama.rtf", lamaAda: false });
    const h3 = await svc.buatLayanan(t3.d).unggahBas({ ...MASUK, ganti: true });
    expect(h3).toMatchObject({ ok: true, diganti: true, lamaDipindah: "" });
    expect(h3.peringatanLama).toMatch(/tidak ditemukan/);
  });

  it("jalurTerhapus: folder dokumen yang sama, tanpa '..', di luar resources/file/doc ditolak", () => {
    expect(svc.jalurTerhapus("resources/file/doc/2026/08/PADgl_2026_PdtG_497_bas_7_1792096162.pdf", new Date("2026-10-17T01:02:03Z"))).toBe(
      "resources/file/doc/2026/08/terhapus/PADgl_2026_PdtG_497_bas_7_1792096162_20261017-090203.pdf"
    );
    expect(svc.jalurTerhapus("resources/file/doc/../../etc/x.rtf", new Date())).toBe("");
    expect(svc.jalurTerhapus("/etc/passwd", new Date())).toBe("");
  });

  it("balapan dua tab (UPDATE 0 baris) -> berkas kita dibuang, milik orang lain dibiarkan, alasan sudah_ada", async () => {
    const t = tiruan({ terubah: 0 });
    const h = await svc.buatLayanan(t.d).unggahBas(MASUK);
    expect(h).toMatchObject({ ok: false, alasan: "sudah_ada" });
    expect(t.kejadian.some((k) => k.startsWith("HAPUS /sipp/resources/file/doc/2026/09/PADgl_2026_PdtG_582_bas_2_"))).toBe(true);
  });

  it("menolak: sidang belum berlangsung, nomor tidak cocok, bukan dokumen, folder hanya-baca", async () => {
    expect(await svc.buatLayanan(tiruan({ tanggal: "2026-10-20" }).d).unggahBas(MASUK)).toMatchObject({ alasan: "sidang_belum_berlangsung" });
    expect(await svc.buatLayanan(tiruan().d).unggahBas({ ...MASUK, nomorPerkara: "583/Pdt.G/2026/PA.Dgl" })).toMatchObject({ alasan: "nomor_tidak_cocok" });
    expect(await svc.buatLayanan(tiruan().d).unggahBas({ ...MASUK, isi: Buffer.from("halo dunia") })).toMatchObject({ alasan: "bentuk_tidak_dikenali" });
    const t = tiruan({ akarTulis: false });
    expect(await svc.buatLayanan(t.d).unggahBas(MASUK)).toMatchObject({ ok: false, alasan: "akar_hanya_baca" });
    expect(t.jejak[0]).toMatchObject({ berhasil: false, alasan: "akar_hanya_baca" });
  });
});

// ----------------------------------------------------------------------------
// C. Portal - fungsi murni
// ----------------------------------------------------------------------------
const DATA_BOT: UnggahMassalDaftarBot = {
  ok: true,
  hariIni: "2026-10-17",
  sejak: "2026-06-19",
  abtTerbaca: true,
  galat: [],
  putusan: [
    { perkaraId: "9851", nomorPerkara: "348/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, tanggalPutusan: "2026-07-09", statusPutusan: "Dikabulkan", verstek: false, adaPutusan: true, adaAnonim: false, majelis: ["Hakim Satu, S.H.", "Hakim Dua"], panitera: [] },
    { perkaraId: "9900", nomorPerkara: "400/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", alurPerkaraId: 15, tanggalPutusan: "2026-10-10", statusPutusan: "Dikabulkan", verstek: false, adaPutusan: false, adaAnonim: false, majelis: ["Hakim Lain"], panitera: [] },
  ],
  tertahan: [{ perkaraId: "10200", nomorPerkara: "600/Pdt.G/2026/PA.Dgl", tanggalSidang: "2026-10-16", majelis: ["Hakim Satu"] }],
  bas: [
    { sidangId: "501", perkaraId: "10134", nomorPerkara: "582/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Gugat", alurPerkaraId: 15, urutan: 2, tanggalSidang: "2026-10-15", agenda: "pemeriksaan", ditunda: true, alasanDitunda: "", ikrar: false, panitera: ["Andini Puspita Sari, S.Sy."], majelis: ["Hakim Satu"], saksiAbt: { saksi: 2, tanyaJawab: 14 } },
    { sidangId: "502", perkaraId: "10135", nomorPerkara: "583/Pdt.G/2026/PA.Dgl", jenisPerkara: "Cerai Talak", alurPerkaraId: 15, urutan: 1, tanggalSidang: "2026-10-17", agenda: "sidang pertama", ditunda: false, alasanDitunda: "", ikrar: false, panitera: ["PP Lain"], majelis: ["Hakim Dua"], saksiAbt: { saksi: 0, tanyaJawab: 0 } },
  ],
};

describe("C. portal unggah-massal.ts - hak, milik saya, pemeriksa isi, riwayat", () => {
  it("hak per peran: hakim hanya putusan (miliknya), PP hanya BAS (miliknya), Ketua/Admin boleh 'semua', JS tidak sama sekali", () => {
    expect(hakUnggahMassal(AKTOR.hakim as never)).toMatchObject({ putusan: true, bas: false, semua: { putusan: false, bas: false }, peranPutusan: "hakim" });
    expect(hakUnggahMassal(AKTOR.ketua as never)).toMatchObject({ putusan: true, bas: false, semua: { putusan: true } });
    expect(hakUnggahMassal(AKTOR.pp as never)).toMatchObject({ putusan: false, bas: true, semua: { bas: false }, peranBas: "pp" });
    expect(hakUnggahMassal(AKTOR.panitera as never)).toMatchObject({ putusan: false, bas: true, semua: { bas: true }, peranBas: "panitera" });
    expect(hakUnggahMassal(AKTOR.admin as never)).toMatchObject({ putusan: true, bas: true, semua: { putusan: true, bas: true }, peranBas: "admin" });
    expect(hakUnggahMassal(AKTOR.js as never)).toMatchObject({ putusan: false, bas: false });
  });

  it("butir 46 (17 Okt): Analis Perkara boleh melihat SEMUA BAS (bukan putusan)", () => {
    expect(hakUnggahMassal(AKTOR.analis as never)).toMatchObject({ putusan: false, bas: true, semua: { putusan: false, bas: true }, peranBas: "analis" });
    const h = susunDaftarUnggahMassal({ data: DATA_BOT, hak: hakUnggahMassal(AKTOR.analis as never), namaAkun: "Analis Satu", saringanDiminta: { bas: "semua" } });
    expect(h.saringan.bas).toBe("semua");
    expect(h.bas.map((x) => x.kunci)).toEqual(["bas:501", "bas:502"]);
    expect(h.putusan).toEqual([]);
  });

  it("butir 43 (17 Okt): BAS yang sudah ada (basAda) ikut bertanda adaBas, tetapi tidak dihitung menunggu", () => {
    const data = {
      ...DATA_BOT,
      bas: [...(DATA_BOT.bas || []), { ...(DATA_BOT.bas || [])[0], sidangId: "503", urutan: 3, tanggalSidang: "2026-10-16", adaBas: true, jalurBas: "PADgl_2026_PdtG_582_bas_3_1.rtf" }],
    } as UnggahMassalDaftarBot;
    const h = susunDaftarUnggahMassal({ data, hak: hakUnggahMassal(AKTOR.pp as never), namaAkun: "Andini Puspita Sari" });
    expect(h.bas.map((x) => [x.kunci, Boolean(x.adaBas)])).toEqual([["bas:501", false], ["bas:503", true]]);
    expect(h.bas[1].jalurBas).toBe("PADgl_2026_PdtG_582_bas_3_1.rtf");
    expect(h.jumlah).toMatchObject({ basSaya: 1, basTertunggak: 1 });
  });

  it("hakim: putusan majelisnya saja (saringan 'semua' diabaikan), BAS dikosongkan; tertahan disebut", () => {
    const h = susunDaftarUnggahMassal({ data: DATA_BOT, hak: hakUnggahMassal(AKTOR.hakim as never), namaAkun: "Hakim Satu", saringanDiminta: { putusan: "semua" } });
    expect(h.saringan.putusan).toBe("saya");
    expect(h.putusan.map((x) => x.nomorPerkara)).toEqual(["348/Pdt.G/2026/PA.Dgl"]);
    expect(h.putusan[0]).toMatchObject({ kunci: "put:9851", perlu: { putusan: false, anonim: true }, milikSaya: true });
    expect(h.bas).toEqual([]);
    expect(h.tertahan.map((x) => x.nomorPerkara)).toEqual(["600/Pdt.G/2026/PA.Dgl"]);
  });

  it("PP: BAS sidangnya (nama bergelar cocok), jejak ABT seperti penyatu M2; hari ini ditandai, tidak dihitung tertunggak", () => {
    const h = susunDaftarUnggahMassal({ data: DATA_BOT, hak: hakUnggahMassal(AKTOR.pp as never), namaAkun: "Andini Puspita Sari" });
    expect(h.putusan).toEqual([]);
    expect(h.bas.map((x) => x.kunci)).toEqual(["bas:501"]);
    expect(h.bas[0].bukti).toEqual(["ABT: keterangan 2 saksi (14 tanya-jawab) sudah diisi"]);
    const adm = susunDaftarUnggahMassal({ data: DATA_BOT, hak: hakUnggahMassal(AKTOR.admin as never), namaAkun: "Admin" });
    expect(adm.bas.map((x) => [x.kunci, x.hariIni])).toEqual([["bas:501", false], ["bas:502", true]]);
    expect(adm.jumlah).toMatchObject({ basSemua: 2, basTertunggak: 1, putusanSemua: 2 });
  });

  it("bagian yang gagal dibaca disebut (tidak dijawab kosong)", () => {
    const h = susunDaftarUnggahMassal({ data: { ...DATA_BOT, bas: null, abtTerbaca: false, galat: [{ sumber: "sipp", langkah: "BAS tanpa e-Doc", sebab: "Unknown column 'edoc_bas' in 'field list'" }] }, hak: hakUnggahMassal(AKTOR.pp as never), namaAkun: "Andini Puspita Sari" });
    expect(h.galat.join(" ")).toMatch(/SIPP - BAS tanpa e-Doc: belum dapat dibaca saat ini/);
    // Audit 17 Okt: pesan SQL mentah dari bot tidak sampai ke layar.
    expect(h.galat.join(" ")).not.toMatch(/Unknown column|field list/);
    expect(h.galat.join(" ")).toMatch(/Daftar BAS belum dapat dibaca/);
  });

  it("pemeriksa isi BAS: RTF harus berita acara, nomor lain ditolak, tanpa nomor hanya peringatan", () => {
    const rtf = (t: string) => new Uint8Array(Buffer.from(`{\\rtf1\\ansi ${t}}`, "latin1"));
    expect(periksaBerkasBas(rtf("BERITA ACARA SIDANG Nomor 582/Pdt.G/2026/PA.Dgl"), "582/Pdt.G/2026/PA.Dgl").tolak).toBeNull();
    expect(periksaBerkasBas(rtf("BERITA ACARA SIDANG Nomor 583/Pdt.G/2026/PA.Dgl"), "582/Pdt.G/2026/PA.Dgl").tolak).toMatch(/583\/Pdt\.G\/2026\/PA\.Dgl, bukan 582/);
    expect(periksaBerkasBas(rtf("PUTUSAN Nomor 582/Pdt.G/2026/PA.Dgl"), "582/Pdt.G/2026/PA.Dgl").tolak).toMatch(/bukan berita acara/);
    const tanpa = periksaBerkasBas(rtf("BERITA ACARA SIDANG"), "582/Pdt.G/2026/PA.Dgl");
    expect(tanpa.tolak).toBeNull();
    expect(tanpa.peringatan[0]).toMatch(/tidak menyebut nomor/);
    expect(periksaBerkasBas(new Uint8Array(Buffer.from("%PDF-1.4")), "582/Pdt.G/2026/PA.Dgl")).toMatchObject({ tolak: null, bentuk: "pdf" });
  });

  it("ringkasan putaran dibersihkan sebelum dicatat: hasil dikenal saja, panjang dibatasi", () => {
    const r = bersihkanRingkasan({ jenis: "bas", mulai: "a", selesai: "b", berhenti: true, sebabBerhenti: "x".repeat(900), butir: [{ nomor: "582/Pdt.G/2026/PA.Dgl", sidang: 2, hasil: "berhasil", catatan: "ok" }, { nomor: "x", hasil: "aneh" }] });
    expect(r!.butir).toHaveLength(1);
    expect(r!.sebabBerhenti).toHaveLength(300);
    expect(hitungRingkasan(r!)).toEqual({ berhasil: 1, gagal: 0, dilewati: 0, dobel: 0, total: 1 });
    expect(bersihkanRingkasan({ jenis: "relaas", butir: [] })).toBeNull();
  });
});

// ----------------------------------------------------------------------------
// D. Rute portal
// ----------------------------------------------------------------------------
const rute = vi.hoisted(() => ({
  aktor: null as unknown,
  daftar: null as unknown,
  unggahBas: [] as Array<Record<string, unknown>>,
  jawabBas: { ok: true, data: { ok: true, jalur: "resources/file/doc/2026/09/x.rtf", nama: "x.rtf", urutan: 2, bentuk: "rtf", diganti: false, jalurLama: "" } } as Record<string, unknown>,
}));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll: async () => [] }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "usr_uji" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: async () => rute.aktor }));
vi.mock("@/server/shared/admin-access-audit", () => ({
  handleAdminRouteError: (galat: unknown) => {
    throw galat;
  },
}));
vi.mock("@/server/modules/aleta-bot/whatsapp-gateway-client", () => ({
  getGatewayUnggahMassalDaftar: async () => ({ ok: true, data: rute.daftar }),
  getGatewayUnggahMassalCek: async () => ({ ok: true, data: { ok: true, adaBas: false } }),
  gatewayUnggahBasSipp: async (m: Record<string, unknown>) => {
    rute.unggahBas.push(m);
    return rute.jawabBas;
  },
}));

describe("D. rute portal unggah massal", () => {
  beforeEach(() => {
    rute.daftar = DATA_BOT;
    rute.unggahBas = [];
    rute.jawabBas = { ok: true, data: { ok: true, jalur: "resources/file/doc/2026/09/x.rtf", nama: "x.rtf", urutan: 2, bentuk: "rtf", diganti: false, jalurLama: "" } };
  });

  async function daftar(aktor: unknown, q = "") {
    rute.aktor = aktor;
    const mod = await import("@/app/api/aleta-ecourt/unggah-massal/route");
    const r = await mod.GET(new NextRequest(`http://uji.local/aleta/api/aleta-ecourt/unggah-massal${q}`));
    return { status: r.status, isi: await r.json() };
  }

  it("GET daftar: juru sita 403; hakim hanya putusan majelisnya; admin 'semua'", async () => {
    expect((await daftar(AKTOR.js)).status).toBe(403);
    const h = await daftar(AKTOR.hakim);
    expect(h.status).toBe(200);
    expect(h.isi.data.putusan.map((x: { kunci: string }) => x.kunci)).toEqual(["put:9851"]);
    expect(h.isi.data.bas).toEqual([]);
    const a = await daftar(AKTOR.admin, "?bas=semua&putusan=semua");
    expect(a.isi.data.bas).toHaveLength(2);
    expect(a.isi.data.putusan).toHaveLength(2);
  });

  async function unggahBas(aktor: unknown, isi: string, tambah: Record<string, string> = {}) {
    rute.aktor = aktor;
    const mod = await import("@/app/api/aleta-ecourt/bas/unggah-sipp/route");
    const f = new FormData();
    f.set("perkaraId", "10134");
    f.set("sidangId", "501");
    f.set("nomorPerkara", "582/Pdt.G/2026/PA.Dgl");
    f.set("bas", new Blob([Buffer.from(isi, "latin1")], { type: "application/rtf" }), "582_Pdt.G_2026_PA.Dgl - BAS.rtf");
    for (const [k, v] of Object.entries(tambah)) f.set(k, v);
    const r = await mod.POST(new NextRequest("http://uji.local/aleta/api/aleta-ecourt/bas/unggah-sipp", { method: "POST", body: f }));
    return { status: r.status, isi: await r.json() };
  }
  const BAS_RTF = "{\\rtf1 BERITA ACARA SIDANG Nomor 582/Pdt.G/2026/PA.Dgl}";

  it("POST BAS: hakim 403 (tanpa memanggil bot); PP diteruskan dengan peranPenekan 'pp' dan ganti=false", async () => {
    expect((await unggahBas(AKTOR.hakim, BAS_RTF)).status).toBe(403);
    expect(rute.unggahBas).toHaveLength(0);
    const h = await unggahBas(AKTOR.pp, BAS_RTF);
    expect(h.status).toBe(200);
    expect(h.isi.data).toMatchObject({ ok: true, nama: "x.rtf" });
    expect(rute.unggahBas[0]).toMatchObject({ perkaraId: "10134", sidangId: "501", peranPenekan: "pp", ganti: false, operator: "Andini Puspita Sari" });
    expect(Buffer.from(String(rute.unggahBas[0].basBase64), "base64").toString("latin1")).toBe(BAS_RTF);
  });

  it("POST BAS: isi bukan BAS / nomor lain -> 409 sebelum bot dipanggil; bot 'sudah_ada' -> 409 dobel", async () => {
    const r1 = await unggahBas(AKTOR.pp, "{\\rtf1 PUTUSAN Nomor 582/Pdt.G/2026/PA.Dgl}");
    expect(r1.status).toBe(409);
    expect(rute.unggahBas).toHaveLength(0);
    rute.jawabBas = { ok: false, error: "e-Doc BAS sidang ini sudah ada di SIPP (lama.rtf). Tidak diganti.", kode: "sudah_ada", status: 200 };
    const r2 = await unggahBas(AKTOR.pp, BAS_RTF);
    expect(r2.status).toBe(409);
    expect(r2.isi.data).toMatchObject({ alasan: "sudah_ada" });
  });
});

// ----------------------------------------------------------------------------
// E. Ekstensi abt.js 17OKT-F41
// ----------------------------------------------------------------------------
function bagianF41(): string {
  const isi = baca("ekstensi-sipp/abt.js");
  const awal = isi.indexOf("/* === 17OKT-F41:");
  const akhir = isi.indexOf("/* === AKHIR 17OKT-F41 === */", awal);
  if (awal < 0 || akhir < 0) throw new Error("bagian 17OKT-F41 tidak ada di abt.js");
  return isi.slice(awal, akhir);
}

const terbuka: JSDOM[] = [];
afterEach(() => {
  while (terbuka.length) terbuka.pop()!.window.close();
});

type Panggilan = { url: string; opsi: any };
function bukaEkstensi() {
  const dom = new JSDOM(`<!doctype html><html><head></head><body></body></html>`, { url: "http://192.168.10.10/aps_badilag/abt/main/beranda", runScripts: "outside-only" });
  terbuka.push(dom);
  const w = dom.window as any;
  w.__aletaF41Uji = true;
  w.eval(`${bagianF41()}\nwindow.__f41 = { f41Mesin, f41Hitung, f41KalimatHasil, f41Tanggal, aletaUnggahMassalBuka };`);
  return { w, f: w.__f41 };
}

const RTF_PUT = new TextEncoder().encode("{\\rtf1 PUTUSAN}").buffer;
const RTF_ANON = new TextEncoder().encode("{\\rtf1 PENGGUGAT}").buffer;
const jsonRes = (status: number, isi: unknown) => ({ ok: status < 400, status, json: async () => isi });

function depsTiruan(o: {
  cek?: (q: URLSearchParams, kali: number) => Record<string, unknown>;
  unggah?: (url: string, badan: any, kali: number) => { status: number; isi: unknown };
  anonimSisa?: number;
  blangkoGagal?: boolean;
} = {}) {
  const minta: Panggilan[] = [];
  let kaliCek = 0;
  let kaliUnggah = 0;
  const pratinjau: string[] = [];
  const deps = {
    ambil: async (url: string, opsi: any) => {
      minta.push({ url, opsi });
      if (url.startsWith("/aleta/api/aleta-ecourt/unggah-massal/cek")) {
        kaliCek += 1;
        const q = new URL(url, "http://x").searchParams;
        return jsonRes(200, { ok: true, data: { ok: true, adaBaris: true, adaPutusan: false, adaAnonim: false, adaBas: false, ...(o.cek ? o.cek(q, kaliCek) : {}) } });
      }
      if (url === "/aleta/api/aleta-ecourt/unggah-massal/jejak") {
        if (opsi && opsi.method === "POST") return jsonRes(200, { ok: true, data: { id: "adt_1", jumlah: {} } });
        return jsonRes(200, { ok: true, data: { semua: false, riwayat: [{ jenis: "bas", dicatat: "2026-10-17T09:12:00Z", jumlah: { berhasil: 2, gagal: 0, dilewati: 0, dobel: 1, total: 3 }, butir: [{ nomor: "582/Pdt.G/2026/PA.Dgl", sidang: 2, hasil: "berhasil", catatan: "masuk" }] }] } });
      }
      if (url.startsWith("/aleta/api/aleta-ecourt/unggah-massal")) return jsonRes(200, { ok: true, data: { ok: true, ...SUSUN_PP } });
      if (url === "/aleta/api/aleta-ecourt/putusan/unggah-sipp" || url === "/aleta/api/aleta-ecourt/bas/unggah-sipp") {
        kaliUnggah += 1;
        const j = o.unggah ? o.unggah(url, opsi.body, kaliUnggah) : { status: 200, isi: { ok: true, data: { ok: true, nama: "x.rtf" } } };
        return jsonRes(j.status, j.isi);
      }
      throw new Error(`tak terduga ${url}`);
    },
    klien: () => ({
      periksaHakBuka: async () => ({ ok: true, diizinkan: true }),
      cetak: async () => ({ ok: true, rtf: RTF_PUT, ukuran: 20480, periksa: { penandaSisa: 0 } }),
      anonim: async () => ({ ok: false, pesan: "ABT tidak dipakai" }),
    }),
    blangkoPutusan: async () => (o.blangkoGagal ? { sebab: "blangko putusan untuk Cerai Gugat belum dipetakan" } : { a: "A", b: "B", berkas: "[01] [Kabul] Cerai" }),
    blangkoBas: async () => ({ a: "A", b: "B", berkas: "BAS 2 Saksi" }),
    anonim: async () => ({ ok: true, rtf: RTF_ANON, ringkas: { "nama pihak": 2 }, sisa: Array.from({ length: o.anonimSisa ?? 0 }, () => ({ jenis: "nama saksi", kata: "Haeruddin", konteks: "saksi Haeruddin" })), potongan: [] }),
    pratinjauAnonim: async (h: unknown, x: { nomor: string }) => {
      pratinjau.push(x.nomor);
      return "unggah";
    },
    namaBaku: (nomor: string, berkas: string) => `${nomor.replace(/\//g, "_")} - ${berkas}.rtf`,
    olehUsername: () => "andini",
    jeda: async () => undefined,
    jedaMs: 0,
    catat: () => undefined,
    antrean: () => ({ maju: () => undefined, selesai: () => undefined }),
    sekarang: () => "2026-10-17T10:00:00.000Z",
  };
  return { deps, minta, pratinjau, get kaliUnggah() { return kaliUnggah; } };
}

const BARIS_PUT = (id: string, perlu = { putusan: true, anonim: true }) => ({ kunci: `put:${id}`, jenis: "putusan", perkaraId: id, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, jenisPerkara: "Cerai Gugat", tanggal: "2026-10-15", perlu, petugas: [], milikSaya: true, statusPutusan: "Dikabulkan" });
const BARIS_BAS = (id: string, urutan = 2) => ({ kunci: `bas:${id}`, jenis: "bas", perkaraId: `1${id}`, sidangId: id, urutan, nomorPerkara: `${id}/Pdt.G/2026/PA.Dgl`, jenisPerkara: "Cerai Gugat", tanggal: "2026-10-15", petugas: ["Andini"], milikSaya: true, bukti: [] });
const SUSUN_PP = {
  hariIni: "2026-10-17",
  sejak: "2026-06-19",
  hak: { putusan: false, bas: true, semua: { putusan: false, bas: false }, peranPutusan: null, peranBas: "pp" },
  saringan: { putusan: "saya", bas: "saya" },
  putusan: [],
  bas: [BARIS_BAS("501"), BARIS_BAS("502", 1)],
  tertahan: [],
  jumlah: { putusanSaya: 0, putusanSemua: 0, basSaya: 2, basSemua: 2, basTertunggak: 2 },
  galat: [],
};

describe("E. ekstensi abt.js 17OKT-F41 - mesin unggah massal", () => {
  it("pratinjau putusan: cek dobel, blangko, hak ABT, RTF ABT, nama baku 'nomor - blangko', anonim ALETA", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    const m = f.f41Mesin(t.deps);
    const s = await m.siapkan(BARIS_PUT("348"));
    expect(s.keadaan).toBe("siap");
    expect(s.nama).toBe("348_Pdt.G_2026_PA.Dgl - [01] [Kabul] Cerai.rtf");
    expect(s.anonim.sumber).toBe("ALETA");
    expect(s.keputusanAnonim).toBe("unggah");
    expect(m.kiriman(s)).toEqual({ putusan: true, anonim: true });
    expect(t.minta[0].url).toBe("/aleta/api/aleta-ecourt/unggah-massal/cek?jenis=putusan&perkaraId=348");
  });

  it("anonim yang masih memuat data pribadi TIDAK diunggah sebelum diperiksa petugas", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan({ anonimSisa: 2, cek: (q) => (q.get("perkaraId") === "349" ? { adaPutusan: true, jalurPutusan: "PADgl_2026_PdtG_349_putusan_akhir.rtf" } : {}) });
    const m = f.f41Mesin(t.deps);
    const s = await m.siapkan(BARIS_PUT("348"));
    expect(s.keputusanAnonim).toBe("");
    expect(m.kiriman(s)).toEqual({ putusan: true, anonim: false });
    const s2 = await m.siapkan(BARIS_PUT("349", { putusan: false, anonim: true }));
    expect(s2.catatan[0]).toMatch(/hanya anonimisasi yang diunggah/);
    expect(m.kiriman(s2)).toBeNull();
    const r = await m.unggah(s2);
    expect(r.hasil).toBe("dilewati");
    expect(r.catatan).toMatch(/Periksa naskah anonim/);
  });

  it("dobel: e-Doc yang sudah ada saat pratinjau -> 'dobel'; yang diisi orang lain SESUDAH pratinjau juga tidak diganti", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan({ cek: (q, kali) => (q.get("sidangId") === "502" && kali > 2 ? { adaBas: true, jalur: "lain.rtf" } : {}) });
    const m = f.f41Mesin(t.deps);
    const s1 = await m.siapkan(BARIS_BAS("501"));
    const s2 = await m.siapkan(BARIS_BAS("502", 1));
    const h = await m.jalankan([s1, s2], {});
    expect(h.butir.map((b: { hasil: string }) => b.hasil)).toEqual(["berhasil", "dobel"]);
    expect(h.berhenti).toBe(false);
    expect(t.kaliUnggah).toBe(1);
    const t2 = depsTiruan({ cek: () => ({ adaBas: true, jalur: "ada.rtf" }) });
    const s3 = await f.f41Mesin(t2.deps).siapkan(BARIS_BAS("503"));
    expect(s3.keadaan).toBe("dobel");
    expect(s3.halangan).toMatch(/Sudah ada di SIPP \(ada\.rtf\)/);
  });

  it("butir 43-44 (17 Okt): Ganti - BAS yang sudah ada disiapkan sebagai PENGGANTI, dikirim dengan ganti=1; tanpa Ganti tetap dobel", async () => {
    const { f } = bukaEkstensi();
    const badan: any[] = [];
    const t = depsTiruan({
      cek: () => ({ adaBas: true, jalur: "lama.rtf" }),
      unggah: (_u, b) => {
        badan.push(b);
        return { status: 200, isi: { ok: true, data: { ok: true, nama: "baru.rtf", diganti: true, lamaDipindah: "resources/file/doc/2026/09/terhapus/lama_20261017-090203.rtf", peringatanLama: "" } } };
      },
    });
    const m = f.f41Mesin(t.deps);
    const biasa = await m.siapkan(BARIS_BAS("504"));
    expect(biasa.keadaan).toBe("dobel");
    expect(biasa.halangan).toMatch(/Tekan Ganti/);
    expect(m.kiriman(biasa)).toBeNull();
    const s = await m.siapkan(BARIS_BAS("504"), undefined, { ganti: true });
    expect(s).toMatchObject({ keadaan: "siap", ganti: true, jalurLama: "lama.rtf" });
    expect(s.catatan.join(" ")).toMatch(/folder "terhapus"/);
    expect(m.kiriman(s)).toEqual({ bas: true });
    const r = await m.unggah(s);
    expect(r.hasil).toBe("berhasil");
    expect(r.catatan).toMatch(/MENGGANTI e-Doc lama.*folder terhapus/);
    expect(badan[0].get("ganti")).toBe("1");
    // Putusan tidak punya Ganti.
    const tp = depsTiruan({ cek: () => ({ adaPutusan: true, adaAnonim: true, jalurPutusan: "p.rtf" }) });
    const sp = await f.f41Mesin(tp.deps).siapkan(BARIS_PUT("350", { putusan: false, anonim: false }), undefined, { ganti: true });
    expect(sp.keadaan).toBe("dobel");
  });

  it("berhenti aman: kegagalan PERTAMA menghentikan putaran, sisanya dilewati beserta sebabnya; BAS dikirim dengan sidangId & urutan", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan({ unggah: (_u, _b, kali) => (kali === 2 ? { status: 200, isi: { ok: true, data: { ok: false, sebab: "Folder e-Doc SIPP hanya-baca." } } } : { status: 200, isi: { ok: true, data: { ok: true, nama: "x.rtf" } } }) });
    const m = f.f41Mesin(t.deps);
    const siap = [];
    for (const id of ["501", "502", "503", "504"]) siap.push(await m.siapkan(BARIS_BAS(id)));
    const h = await m.jalankan(siap, {});
    expect(h.butir.map((b: { hasil: string }) => b.hasil)).toEqual(["berhasil", "gagal", "dilewati", "dilewati"]);
    expect(h.berhenti).toBe(true);
    expect(h.sebabBerhenti).toMatch(/502\/Pdt\.G\/2026\/PA\.Dgl gagal: BAS sidang ke-2: Folder e-Doc SIPP hanya-baca/);
    expect(h.butir[2].catatan).toMatch(/tidak dikerjakan/);
    expect(t.kaliUnggah).toBe(2);
    const kirim = t.minta.find((x) => x.url === "/aleta/api/aleta-ecourt/bas/unggah-sipp")!;
    expect(kirim.opsi.body.get("sidangId")).toBe("501");
    expect(kirim.opsi.body.get("bas").name).toBe("501_Pdt.G_2026_PA.Dgl - BAS 2 Saksi.rtf");
    expect(f.f41KalimatHasil(f.f41Hitung(h))).toBe("1 berhasil · 1 gagal · 2 dilewati");
    // yang sudah berhasil tidak ditawarkan lagi; yang gagal/dilewati boleh diulang
    expect(m.kiriman(siap[0])).toBeNull();
    expect(m.kiriman(siap[1])).toEqual({ bas: true });
  });

  it("Hentikan: sinyal dibatalkan -> tidak ada unggahan baru", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan();
    const m = f.f41Mesin(t.deps);
    const s = [await m.siapkan(BARIS_BAS("501")), await m.siapkan(BARIS_BAS("502"))];
    const h = await m.jalankan(s, { sinyal: { aborted: true } });
    expect(t.kaliUnggah).toBe(0);
    expect(h.sebabBerhenti).toBe("dihentikan petugas");
  });

  it("anonimisasi ditolak penjaga rute (409 slot anonim): putusan dikirim sendirian, baris dicatat gagal dengan sebabnya", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan({
      unggah: (_u, badan) =>
        badan.get("anonimisasi")
          ? { status: 409, isi: { ok: false, error: { message: "masih memuat nama pihak" }, data: { ok: false, slot: "anonimisasi", sebab: "masih memuat nama pihak" } } }
          : { status: 200, isi: { ok: true, data: { ok: true } } },
    });
    const m = f.f41Mesin(t.deps);
    const s = await m.siapkan(BARIS_PUT("348"));
    const r = await m.unggah(s);
    expect(r.hasil).toBe("gagal");
    expect(r.catatan).toMatch(/putusan masuk; anonimisasi ditolak: masih memuat nama pihak/);
    const kiriman = t.minta.filter((x) => x.url === "/aleta/api/aleta-ecourt/putusan/unggah-sipp");
    expect(kiriman).toHaveLength(2);
    expect(kiriman[1].opsi.body.get("anonimisasi")).toBeNull();
  });

  it("blangko yang belum dipetakan = halangan (bukan kegagalan putaran)", async () => {
    const { f } = bukaEkstensi();
    const t = depsTiruan({ blangkoGagal: true });
    const m = f.f41Mesin(t.deps);
    const s = await m.siapkan(BARIS_PUT("348"));
    expect(s.keadaan).toBe("halangan");
    expect(s.halangan).toMatch(/belum dipetakan/);
    const h = await m.jalankan([s], {});
    expect(h.butir[0].hasil).toBe("dilewati");
    expect(h.berhenti).toBe(false);
  });
});

describe("E. ekstensi abt.js 17OKT-F41 - layar", () => {
  const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  async function sampai<T>(fn: () => T, ket: string): Promise<NonNullable<T>> {
    const mulai = Date.now();
    for (;;) {
      const h = fn();
      if (h) return h as NonNullable<T>;
      if (Date.now() - mulai > 4000) throw new Error(`tidak tercapai: ${ket}`);
      await tunggu(5);
    }
  }

  it("PP: hanya tab BAS + Riwayat, centang -> periksa -> unggah -> ringkasan & riwayat tercatat; tanpa istilah teknis", async () => {
    const { w, f } = bukaEkstensi();
    w.confirm = () => true;
    const t = depsTiruan();
    const tirai = f.aletaUnggahMassalBuka("", t.deps);
    const d = w.document as Document;
    await sampai(() => d.querySelector('[data-kunci="bas:501"]'), "baris BAS tergambar");
    expect(tirai.getAttribute("role")).toBe("dialog");
    const tab = Array.from(d.querySelectorAll("[data-f41-tab]")).map((x) => x.getAttribute("data-f41-tab"));
    expect(tab).toEqual(["bas", "riwayat"]);
    expect(d.querySelector('[data-f41="saringan"]')).toBeNull(); // PP: hanya miliknya
    expect(tirai.textContent).toContain("Sidang ke-2 · 15 Okt 2026");
    (d.querySelector('[data-f41="semua"]') as HTMLElement).click();
    expect(tirai.textContent).toContain("2 dari 2 dicentang");
    (d.querySelector('[data-f41="periksa"]') as HTMLElement).click();
    await sampai(() => (d.querySelector('[data-f41="unggah"]') as HTMLButtonElement).disabled === false, "tombol unggah aktif");
    expect(d.querySelector('[data-f41="unggah"]')!.textContent).toBe("Unggah 2 berkas");
    expect(d.querySelector('[data-kunci="bas:501"] .aleta-f41-rinci')!.textContent).toContain("501_Pdt.G_2026_PA.Dgl - BAS 2 Saksi.rtf");
    expect(d.querySelector('[data-kunci="bas:501"] .aleta-f41-rinci')!.textContent).toContain("belum ada di SIPP");
    (d.querySelector('[data-f41="unggah"]') as HTMLElement).click();
    await sampai(() => d.querySelector(".aleta-f41-pesan.baik"), "ringkasan selesai");
    expect(d.querySelector(".aleta-f41-pesan.baik")!.textContent).toContain("Selesai: 2 berhasil.");
    expect(d.querySelector(".aleta-f41-pesan.baik")!.textContent).toContain("Tercatat di Riwayat");
    const jejak = t.minta.find((x) => x.url === "/aleta/api/aleta-ecourt/unggah-massal/jejak" && x.opsi.method === "POST")!;
    expect(JSON.parse(jejak.opsi.body)).toMatchObject({ jenis: "bas", berhenti: false, butir: [{ nomor: "501/Pdt.G/2026/PA.Dgl", sidang: 2, hasil: "berhasil" }, { hasil: "berhasil" }] });
    (d.querySelector('[data-f41-tab="riwayat"]') as HTMLElement).click();
    await sampai(() => d.querySelector("details.aleta-f41-baris"), "riwayat tergambar");
    expect(d.querySelector("details.aleta-f41-baris")!.textContent).toContain("2 berhasil · 1 sudah ada (dobel)");
    expect(tirai.textContent).not.toMatch(/edoc_bas|perkara_id|sidangId|undefined|null/);
    // Esc menutup bila tidak sedang berjalan
    d.dispatchEvent(new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(d.querySelector(".aleta-f41-tirai")).toBeNull();
  });

  it("butir 43 (17 Okt): 'Tampilkan juga yang sudah ada' -> baris bertanda Sudah ada + Ganti; Ganti meminta konfirmasi lalu siap MENGGANTI", async () => {
    const { w, f } = bukaEkstensi();
    const tanya: string[] = [];
    w.confirm = (k: string) => {
      tanya.push(k);
      return true;
    };
    const t = depsTiruan({ cek: (q) => (q.get("sidangId") === "509" ? { adaBas: true, jalur: "lama_bas_3.rtf" } : {}) });
    const asli = t.deps.ambil;
    t.deps.ambil = async (url: string, opsi: any) => {
      if (url.startsWith("/aleta/api/aleta-ecourt/unggah-massal?") && url.includes("basAda=1")) {
        t.minta.push({ url, opsi });
        return jsonRes(200, { ok: true, data: { ok: true, ...SUSUN_PP, bas: [...SUSUN_PP.bas, { ...BARIS_BAS("509", 3), adaBas: true, jalurBas: "lama_bas_3.rtf" }] } });
      }
      return asli(url, opsi);
    };
    f.aletaUnggahMassalBuka("", t.deps);
    const d = w.document as Document;
    await sampai(() => d.querySelector('[data-kunci="bas:501"]'), "daftar awal");
    const saklar = d.querySelector('[data-f41="bas-ada"]') as HTMLInputElement;
    expect(saklar).not.toBeNull();
    saklar.checked = true;
    saklar.dispatchEvent(new w.Event("change", { bubbles: true }));
    const baris = await sampai(() => d.querySelector('[data-kunci="bas:509"]'), "BAS yang sudah ada tampil");
    expect(baris.textContent).toContain("Sudah ada di SIPP: lama_bas_3.rtf");
    // "Centang semua" tidak mencentang yang sudah ada.
    (d.querySelector('[data-f41="semua"]') as HTMLElement).click();
    expect((d.querySelector('[data-f41-centang="bas:509"]') as HTMLInputElement).checked).toBe(false);
    (d.querySelector('[data-f41-ganti="bas:509"]') as HTMLElement).click();
    await sampai(() => /MENGGANTI/.test(d.querySelector('[data-kunci="bas:509"] .aleta-f41-rinci')?.textContent || ""), "siap mengganti");
    expect(tanya[0]).toMatch(/dipindah ke folder "terhapus"/);
    expect((d.querySelector('[data-f41-centang="bas:509"]') as HTMLInputElement).checked).toBe(true);
    expect(d.querySelector('[data-f41="unggah"]')!.textContent).toBe("Unggah 1 berkas");
  });
});

// ----------------------------------------------------------------------------
// F. Titik sambung
// ----------------------------------------------------------------------------
describe("F. titik sambung F4.1", () => {
  it("bagian F4.1 tidak memanggil tanyajawab_template dan tidak menulis ke ABT", () => {
    const b = bagianF41();
    expect(b).not.toMatch(/tanyajawab_template[^\n]*hapus|fetch\([^)]*tanyajawab_template/);
    expect(b).not.toMatch(/edit_data|validasi_bas\?aksi|aksi=simpan/);
  });
  it("penyatu M2: tautan 'Unggah massal BAS di ABT' ke #aleta-unggah-massal=bas", () => {
    const m2 = baca("ekstensi-sipp/sipp-ide-m2.js");
    expect(m2).toContain('#aleta-unggah-massal=bas"');
    expect(m2).toContain("Unggah massal BAS di ABT");
  });
  it("Blangko Derry: alat 'Unggah massal ke e-Doc SIPP' untuk hakim dan PP, didaftarkan bagian F4.1", () => {
    const bd = baca("ekstensi-sipp/blangko-derry.js");
    expect(bd.match(/\["massal:unggah", "Unggah massal ke e-Doc SIPP"\]/g)).toHaveLength(2);
    expect(bagianF41()).toContain('bd.daftarkanAlat("massal:unggah"');
  });
  it("bot: rute gerbang terdaftar dan hak BAS lapis kedua dipanggil sebelum menulis", () => {
    const r = baca("aleta_bot/routes/internalGatewayRoutes.js");
    const i = r.indexOf('router.post("/sipp/bas-unggah"');
    expect(i).toBeGreaterThan(0);
    const potong = r.slice(i, i + 900);
    expect(potong.indexOf("periksaHakUnggahBas")).toBeLessThan(potong.indexOf("unggahBas("));
    expect(r).toContain('router.get("/sipp/unggah-massal/daftar"');
    expect(r).toContain('router.get("/sipp/unggah-massal/cek"');
  });
});
