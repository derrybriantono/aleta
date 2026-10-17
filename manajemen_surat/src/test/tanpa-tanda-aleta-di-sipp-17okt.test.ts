// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { naskahKeRtf } from "@/lib/hasil-mediasi-rtf";
import { masalahAlasan, teksAlasan } from "@/lib/penetapan-kembali";
import { menyebutAleta } from "@/lib/tanda-aleta";

/**
 * Keputusan 17 Okt 2026 butir 45: TIDAK BOLEH ada keterangan/tanda ALETA apa pun
 * di database SIPP - jejak hanya di ALETA.
 *
 * Audit baca-saja atas server (17 Okt pagi) menemukan dua bekas:
 *   - 34 baris sys_audittrail 28 Sep-1 Okt "ALETA - Unggah Dokumen Putusan" /
 *     "lewat ALETA" / "Ditulis otomatis oleh ALETA" (jalur lama, sudah diganti
 *     "UPLOAD E-DOCS ..." sebelum keputusan 2 Okt; data lama TIDAK diubah);
 *   - 19 baris ipaddress 172.18.0.2 (alamat peti portal) 29 Sep-16 Okt dari
 *     tunda/putus sidang: portal tidak mengirim alamat peramban, bot jatuh ke
 *     alamat soket.
 * Penjaga ini memastikan keduanya tidak terulang, dan isian bebas yang tersimpan
 * di SIPP menolak kata ALETA.
 */
const AKAR = path.resolve(process.cwd(), "..");
const baca = (b: string) => readFileSync(path.join(AKAR, b), "utf8").replace(/\r\n/g, "\n");
const req = createRequire(import.meta.url);

function fungsi(sumber: string, kepala: string) {
  const mulai = sumber.indexOf(kepala);
  expect(mulai, kepala).toBeGreaterThanOrEqual(0);
  return sumber.slice(mulai, sumber.indexOf("\n}", mulai));
}

describe("butir 45 - alamat audit SIPP tidak pernah alamat peti ALETA", () => {
  it("kedua alamatAudit bot: alamat peramban kiriman portal, selain itu KOSONG", () => {
    for (const berkas of ["aleta_bot/routes/internalGatewayRoutes.js", "aleta_bot/routes/jadwalSidangRoutes.js"]) {
      const f = fungsi(baca(berkas), "function alamatAudit(req) {");
      expect(f, berkas).not.toMatch(/req\.ip|remoteAddress/);
      expect(f, berkas).toContain('return "";');
    }
  });

  it("rute portal yang menulis ke SIPP lewat alamatAudit mengirim alamat peramban", () => {
    for (const rute of [
      "sidang-tunda/route.ts",
      "sidang-putus/route.ts",
      "sidang/mediator/route.ts",
      "sidang/skors/route.ts",
      "sidang/berjalan/route.ts",
      "sidang/court-calendar/route.ts",
      "sidang/kasir/route.ts",
      "bas/unggah-sipp/route.ts",
      "putusan/unggah-sipp/route.ts",
    ]) {
      const isi = baca(`manajemen_surat/src/app/api/aleta-ecourt/${rute}`);
      expect(isi, rute).toContain("alamatIpPeramban(request)");
    }
    // sidang-putus punya DUA jalur tulis (fakta diputus & putusan hakim) - keduanya.
    expect(baca("manajemen_surat/src/app/api/aleta-ecourt/sidang-putus/route.ts").match(/ip: alamatIpPeramban\(request\)/g)?.length).toBe(2);
  });
});

describe("butir 45 - tidak ada kata ALETA yang ditulis ke SIPP", () => {
  it("unggah e-Doc putusan: formname/judul/keterangan audit tanpa ALETA (bentuk lama 28 Sep-1 Okt tidak kembali)", () => {
    const s = baca("aleta_bot/services/putusanUnggahService.js");
    expect(s).not.toContain("ALETA - Unggah Dokumen Putusan");
    expect(s).not.toMatch(/lewat <b>ALETA<\/b>/);
    expect(s).not.toContain("Ditulis otomatis oleh ALETA");
  });

  it("tunda sidang: alasan/agenda yang menyebut ALETA ditolak dengan kalimat awam", () => {
    const s = baca("aleta_bot/services/sidangHasilService.js");
    expect(s).toContain('if (menyebutAleta(alasanTunda) || menyebutAleta(agendaBerikut)) return { ok: false, alasan: "teks_menyebut_aleta" };');
    expect(s).toContain('const { menyebutAleta } = require("./tandaAletaService");');
    expect(baca("aleta_bot/services/pesanHasilSidang.js")).toContain('case "teks_menyebut_aleta":');
  });

  it("Court Calendar: agenda/keterangan yang menyebut ALETA ditolak sebelum menulis", () => {
    const cc = req(path.join(AKAR, "aleta_bot/services/courtCalendarTulisService.js"));
    const baris = { tanggal: "2026-10-19", jam: "09:00", agenda: "Pembuktian", keterangan: "" };
    expect(cc.periksaBaris(baris, "2026-09-01")).toBe("");
    expect(cc.periksaBaris({ ...baris, agenda: "Pembuktian (ALETA)" }, "2026-09-01")).toBe(cc.PESAN.aleta);
    expect(cc.periksaBaris({ ...baris, keterangan: "dari aleta" }, "2026-09-01")).toBe(cc.PESAN.aleta);
  });

  it("e-Doc BAS: nama berkas baru dan folder 'terhapus' tanpa kata ALETA", () => {
    const bas = req(path.join(AKAR, "aleta_bot/services/basUnggahService.js"));
    expect(bas.namaBerkasBas("601/Pdt.G/2026/PA.Dgl", 2, 1792096162, "rtf")).not.toMatch(/aleta/i);
    expect(bas.jalurTerhapus("resources/file/doc/2026/08/x_bas_2_1.rtf", new Date("2026-10-17T01:02:03Z"))).not.toMatch(/aleta/i);
  });
});

// ============================================================================
// Tiga sisa audit agen A (integrasi 1.205.0, 17 Okt 2026)
// ============================================================================

/** penetapanTulisService dengan basis data tiruan (pola jam-sipp-semua-penulis). */
function muatPenetapan(jawab: (sql: string, p: unknown[]) => unknown) {
  const reqBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
  const pasang = (berkas: string, exports: unknown) => {
    const jalur = reqBot.resolve(path.join(AKAR, "aleta_bot", berkas));
    reqBot.cache[jalur] = { id: jalur, filename: jalur, loaded: true, exports } as unknown as NodeJS.Module;
  };
  pasang("db_config.js", {
    query: (sql: string, p: unknown, cb: (g: unknown, h: unknown) => void) => cb(null, jawab(String(sql), Array.isArray(p) ? p : [])),
  });
  const jalurSkema = reqBot.resolve(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"));
  delete reqBot.cache[jalurSkema];
  const skema = reqBot(jalurSkema) as Record<string, unknown>;
  pasang("services/sippSkemaService.js", { ...skema, tabelAda: async () => true });
  const jalur = reqBot.resolve(path.join(AKAR, "aleta_bot/services/penetapanTulisService.js"));
  delete reqBot.cache[jalur];
  return reqBot(jalur) as Record<string, any>;
}

describe("sisa audit (i): perkara_data_pernikahan tanpa baris audit - SIPP tidak pernah mengauditnya", () => {
  it("Data Umum: tabel pernikahan ditulis, sys_audittrail hanya untuk perkara (bentuk SIPP)", async () => {
    const l = muatPenetapan((sql, p) => {
      if (/UTC_TIMESTAMP/.test(sql)) return [{ utc: "2026-10-17 01:00:00" }];
      if (/DATE_FORMAT\(NOW\(\)/.test(sql)) return [{ saat: "2026-10-17 09:00:00" }];
      if (/FROM perkara p\b/.test(sql) && /LEFT JOIN perkara_penetapan/.test(sql)) {
        return [{ perkaraId: 10229, nomorPerkara: "660/Pdt.G/2026/PA.Dgl", jenisPerkaraId: 347, tanggalDaftar: "2026-10-13" }];
      }
      if (/FROM perkara p WHERE/.test(sql)) return [{ tanggalSurat: null, nomorSurat: null }];
      if (/FROM sys_users WHERE username = \?/.test(sql)) {
        return String(p[0]) === "meja1g" ? [{ userid: 25, username: "meja1g", fullname: "Tiffany RS", block: 0 }] : [];
      }
      return [];
    });
    const r = await l.susunRencanaTulis({
      jenis: "dataUmum",
      perkaraId: 10229,
      tanggalPenetapan: "2026-10-17",
      olehUsername: "meja1g",
      operator: "UJI",
      ip: "192.168.9.82",
      dataUmum: { nomorSurat: "01/X/2026", tanggalMenikah: "2020-01-02", nomorAktaNikah: "123/45/I/2020" },
    });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    const langkah = r.langkah as Array<{ tabel: string; sql: string; params: unknown[] }>;
    expect(langkah.some((x) => x.tabel === "perkara_data_pernikahan" && /^INSERT INTO perkara_data_pernikahan/.test(x.sql))).toBe(true);
    const audit = langkah.filter((x) => /INSERT INTO sys_audittrail/.test(x.sql));
    expect(audit).toHaveLength(1);
    expect(audit[0].params).toContain("perkara");
    expect(audit.some((x) => x.params.includes("perkara_data_pernikahan"))).toBe(false);
    expect(JSON.stringify(langkah)).not.toMatch(/aleta/i);
  });
});

describe("sisa audit (ii): metadata berkas yang masuk SIPP tanpa tanda ALETA", () => {
  const cetak = req(path.join(AKAR, "aleta_bot/services/abtCetakService.js"));

  it("RTF: grup properti naskah yang menyebut ALETA dibuang, isi naskah tidak disentuh", () => {
    const rtf = Buffer.from("{\\rtf1{\\info{\\title Putusan}{\\author ALETA}{\\*\\company Aleta Bot}{\\operator pp}}\\pard Teks ALETA asli\\par}", "latin1");
    expect(cetak.tanpaTandaAletaMetadata(rtf).toString("latin1")).toBe("{\\rtf1{\\info{\\title Putusan}{\\operator pp}}\\pard Teks ALETA asli\\par}");
    const bersih = Buffer.from("{\\rtf1{\\info{\\title Putusan}}x}", "latin1");
    expect(cetak.tanpaTandaAletaMetadata(bersih)).toBe(bersih);
  });

  it("PDF: Title UTF-16, Producer/Creator literal, dan XMP dibersihkan dengan panjang SAMA (xref tetap benar)", () => {
    const hex = Buffer.from("﻿Laporan ALETA", "utf16le").swap16().toString("hex").toUpperCase();
    const pdf = Buffer.from(
      `%PDF-1.4\n1 0 obj<</Title<${hex}>/Producer(LibreOffice 7.4)/Creator(ALETA Writer)/Author(aleta)>>endobj\n<x:xmpmeta><pdf:Producer>ALETA</pdf:Producer></x:xmpmeta>\nxref\n%%EOF`,
      "latin1"
    );
    const hasil = cetak.tanpaTandaAletaMetadata(pdf) as Buffer;
    expect(hasil.length).toBe(pdf.length);
    const s = hasil.toString("latin1");
    expect(s).not.toMatch(/aleta/i);
    expect(s).toContain("/Producer(LibreOffice 7.4)");
    const judul = /\/Title<([0-9A-F]+)>/.exec(s)![1];
    expect(Buffer.from(judul, "hex").swap16().toString("utf16le")).toBe("﻿Laporan      ");
    const polos = Buffer.from("%PDF-1.4\n<</Producer(LibreOffice 7.4)/Creator(Writer)>>\n%%EOF", "latin1");
    expect(cetak.tanpaTandaAletaMetadata(polos)).toBe(polos);
  });

  it("semua jalan keluar konversi & tulis ke SIPP melewati penjaga metadata", () => {
    const c = baca("aleta_bot/services/abtCetakService.js");
    expect(c.match(/tanpaTandaAletaMetadata\(/g)?.length).toBeGreaterThanOrEqual(8);
    expect(c).not.toMatch(/return \{ ok: true, pdf(, | \})/);
    expect(c).not.toContain("berkas: hasil,");
    const pu = baca("aleta_bot/services/putusanUnggahService.js");
    const badan = pu.slice(pu.indexOf("async function unggahSatu("));
    const bersih = badan.indexOf("pdf = tanpaTandaAletaMetadata(pdf);");
    expect(bersih).toBeGreaterThan(-1);
    expect(badan.indexOf("kembaranBerkas.tulis(penuhAsli, pdf, { akar })")).toBeGreaterThan(bersih);
    expect(badan.indexOf("let pdfTerbit = bentuk")).toBeGreaterThan(bersih);
    expect(baca("aleta_bot/services/basUnggahService.js")).toContain("kembaranBerkas.tulis(penuh, tanpaTandaAletaMetadata(isi), { akar, flag: \"wx\" });");
  });

  it("Laporan Mediasi (RTF unduhan yang diunggah petugas) tanpa {\\author ALETA}", () => {
    const rtf = naskahKeRtf([{ jenis: "paragraf", teks: "Uji" }]);
    const info = /\{\\info[^]*?\}\}/.exec(rtf)?.[0] ?? "";
    expect(info).toContain("Laporan Mediasi");
    expect(info).not.toMatch(/aleta/i);
  });
});

describe("sisa audit (iii): penolak tanda ALETA seragam - tunda, Court Calendar, penetapan kembali 'Lainnya'", () => {
  const bot = req(path.join(AKAR, "aleta_bot/services/tandaAletaService.js"));
  const ditolak = ["ALETA", "aleta", "Aleta", "lewat ALETA", "viaALETA", "A L E T A", "a.l.e.t.a", "A-L-E-T-A", "ALE TA", "ＡＬＥＴＡ", "Alétà", "a​leta", "  a  l  e  t  a  "];
  const diterima = ["Cuti tahunan", "kepala letak", "Perjalanan dinas luar", "Pembuktian", "Saleh Tamrin", "", "ale"];

  it("bot dan portal memberi jawaban yang SAMA untuk tiap bentuk", () => {
    for (const t of ditolak) {
      expect(bot.menyebutAleta(t), t).toBe(true);
      expect(menyebutAleta(t), t).toBe(true);
    }
    for (const t of diterima) {
      expect(bot.menyebutAleta(t), t).toBe(false);
      expect(menyebutAleta(t), t).toBe(false);
    }
  });

  it("penetapan kembali (bot & pop-up portal) menolak alasan 'Lainnya' bertanda ALETA dalam bentuk apa pun", () => {
    const pk = req(path.join(AKAR, "aleta_bot/services/penetapanKembaliService.js"));
    for (const t of ["diisi lewat A L E T A", "Aleta", "A.L.E.T.A"]) {
      expect(pk.alasanBersih(t), t).toEqual({ ok: false, alasan: "alasan_menyebut_aleta" });
      expect(masalahAlasan(teksAlasan({ kode: "lainnya", lainnya: t })), t).toBe("alasan tidak boleh menyebut ALETA (tertulis di SIPP)");
    }
    expect(pk.alasanBersih("Hakim cuti mendadak")).toEqual({ ok: true, teks: "Hakim cuti mendadak" });
    expect(masalahAlasan("Hakim cuti mendadak")).toBe("");
  });

  it("Court Calendar menolak bentuk renggang; tunda memakai penolak yang sama", () => {
    const cc = req(path.join(AKAR, "aleta_bot/services/courtCalendarTulisService.js"));
    const baris = { tanggal: "2026-10-19", jam: "09:00", agenda: "Pembuktian", keterangan: "" };
    expect(cc.periksaBaris({ ...baris, keterangan: "A L E T A" }, "2026-09-01")).toBe(cc.PESAN.aleta);
    for (const b of ["sidangHasilService.js", "courtCalendarTulisService.js", "penetapanKembaliService.js"]) {
      const s = baca(`aleta_bot/services/${b}`);
      expect(s, b).toContain('const { menyebutAleta } = require("./tandaAletaService");');
      expect(s, b).not.toMatch(/\/aleta\/i\.test\(/);
    }
    expect(baca("manajemen_surat/src/lib/penetapan-kembali.ts")).not.toMatch(/\/aleta\/i\.test\(/);
  });
});
