// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
    expect(s).toContain('if (/aleta/i.test(alasanTunda) || /aleta/i.test(agendaBerikut)) return { ok: false, alasan: "teks_menyebut_aleta" };');
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
