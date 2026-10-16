/**
 * ============================================================================
 * 16 OKT 2026 - F3.3 SET PERTANYAAN SAKSI DASAR PER JENIS PERKARA
 * ============================================================================
 *
 * A. lib/set-pertanyaan-saksi.ts (murni): setiap set punya dasar hukum,
 *    pertanyaan berakhir "?", jawaban kerangka berakhir ";", semua huruf dapat
 *    disimpan ABT (cp1252), tidak ada tanda {..} tersisa; jenis perkara dari
 *    nama SIPP/folder Derry; huruf alasan #8503#; set gabungan per huruf
 *    (D+F memuat kekerasan DAN pisah rumah); G hanya cerai gugat; sebutan
 *    suami/isteri terbalik pada cerai talak; kumulasi hak asuh/itsbat
 *    disarankan menurut folder; set tambahan hanya bagian inti.
 * B. GET /aleta-ecourt/blangko-derry/set-saksi: huruf dari isian layar, bila
 *    kosong dari #8503# lewat abt.nilaiPenanda (hanya perkara cerai), bot
 *    diam = tetap menjawab (F); kewenangan "panel"; tidak menulis.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { barisSet, hurufAlasan, isiTanda, kodeJenisSaksi, semuaSetSaksi, tawarkanSetSaksi } from "@/lib/set-pertanyaan-saksi";

/** Huruf yang dapat disimpan kolom latin1 ABT (cp1252). */
const CP1252_EKSTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const bisaAbt = (s: string) => [...s].every((c) => c.charCodeAt(0) < 256 || CP1252_EKSTRA.has(c));

describe("A. set pertanyaan saksi", () => {
  it("semua set: id unik, dasar hukum, pertanyaan '?', jawaban ';', cp1252, unsur, tanda terisi", () => {
    const semua = semuaSetSaksi();
    expect(new Set(semua.map((s) => s.id)).size).toBe(semua.length);
    expect(semua.length).toBeGreaterThanOrEqual(21);
    for (const s of semua) {
      expect(s.dasar.length, s.id).toBeGreaterThan(0);
      expect(s.ukur, s.id).toMatch(/ABT server/);
      const butir = [...s.pembuka, ...s.inti, ...s.penutup];
      expect(s.inti.length, s.id).toBeGreaterThanOrEqual(4);
      for (const b of butir) {
        expect(b.tanya.trim(), `${s.id}: ${b.tanya}`).toMatch(/\?$/);
        expect(b.jawab.trim(), `${s.id}: ${b.jawab}`).toMatch(/;$/);
        expect(b.unsur.trim().length, `${s.id}: ${b.tanya}`).toBeGreaterThan(3);
        expect(bisaAbt(b.tanya + b.jawab), `${s.id}: ${b.tanya}`).toBe(true);
      }
      for (const jenis of s.jenis) {
        for (const r of barisSet(s, jenis, { sebutanP: "Penggugat", sebutanT: "Tergugat" })) {
          expect(`${r.tanya} ${r.jawab}`, s.id).not.toMatch(/\{\w+\}/);
          expect(r.tanya.charAt(0)).toBe(r.tanya.charAt(0).toUpperCase());
        }
      }
    }
  });

  it("jenis perkara dari nama SIPP, folder Derry, dan sebutan", () => {
    expect(kodeJenisSaksi("Cerai Gugat")).toBe("cg");
    expect(kodeJenisSaksi("Cerai Talak")).toBe("ct");
    expect(kodeJenisSaksi("Pengesahan Perkawinan/Istbat Nikah")).toBe("itsbat");
    expect(kodeJenisSaksi("Dispensasi Kawin")).toBe("dk");
    expect(kodeJenisSaksi("P3HP/Penetapan Ahli Waris")).toBe("paw");
    expect(kodeJenisSaksi("Kewarisan")).toBe("waris");
    expect(kodeJenisSaksi("Wali Adhol")).toBe("wa");
    expect(kodeJenisSaksi("Perwalian")).toBe("perwalian");
    expect(kodeJenisSaksi("Asal Usul Anak")).toBe("aua");
    expect(kodeJenisSaksi("Izin Poligami")).toBe("ip");
    expect(kodeJenisSaksi("Harta Bersama")).toBe("hb");
    expect(kodeJenisSaksi("Lain-Lain", "", "9a Lain-Lain (Pengangkatan Anak) - BAS")).toBe("angkat");
    expect(kodeJenisSaksi("", "", "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS")).toBe("cg");
    expect(kodeJenisSaksi("", "1/Pdt.G/2026/PA.Dgl", "ALUR 02 Cerai Verstek 2 Sidang", "Pemohon")).toBe("ct");
    expect(kodeJenisSaksi("", "1/Pdt.G/2026/PA.Dgl", "ALUR 02 Cerai Verstek 2 Sidang", "Penggugat")).toBe("cg");
    expect(kodeJenisSaksi("Lain-Lain")).toBe("umum");
  });

  it("huruf alasan #8503#: huruf A-H saja, urut, tanpa ganda", () => {
    expect(hurufAlasan("BF")).toBe("BF");
    expect(hurufAlasan("fb")).toBe("BF");
    expect(hurufAlasan("F·perselisihan")).toBe("F");
    expect(hurufAlasan("FDF")).toBe("DF");
    expect(hurufAlasan("")).toBe("");
  });

  it("cerai gugat tanpa huruf: F disarankan; berisi pisah rumah, melihat sendiri, upaya damai, penutup", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", sebutanP: "Penggugat", sebutanT: "Tergugat" });
    expect(t.jenis).toBe("cg");
    const utama = t.set.filter((s) => s.utama);
    expect(utama.map((s) => s.id)).toEqual(["cerai-F"]);
    const tanya = utama[0].baris.map((r) => r.tanya).join("\n");
    expect(tanya).toMatch(/masih tinggal serumah/);
    expect(tanya).toMatch(/melihat atau mendengar sendiri/);
    expect(tanya).toMatch(/merukunkan Penggugat dan Tergugat/);
    expect(utama[0].baris.at(-1)!.tanya).toBe("Apakah masih ada yang ingin Saudara sampaikan?");
    expect(utama[0].baris.map((r) => r.no)).toEqual(utama[0].baris.map((_, i) => String(i + 1)));
    // Nafkah: isteri = Penggugat pada cerai gugat.
    expect(utama[0].baris.find((r) => /nafkah/.test(r.tanya))!.tanya).toBe("Selama berpisah, apakah Tergugat masih memberi nafkah kepada Penggugat?");
    // G (taklik) ditawarkan pada cerai gugat; semua huruf A-H ada.
    expect(t.set.map((s) => s.id)).toEqual(expect.arrayContaining(["cerai-A", "cerai-B", "cerai-C", "cerai-D", "cerai-E", "cerai-G", "cerai-H", "tambah-hak-asuh", "tambah-nafkah", "tambah-itsbat"]));
  });

  it("huruf D+F (dari #8503#): satu set gabungan berisi unsur kekerasan DAN perselisihan; maksud = gugatan cerai", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", huruf: "FD", sebutanP: "Penggugat", sebutanT: "Tergugat" });
    expect(t.huruf).toBe("DF");
    const u = t.set[0];
    expect(u).toMatchObject({ id: "cerai-DF", utama: true, judul: "Cerai - alasan D, F" });
    const isi = u.baris.map((r) => `${r.tanya} ${r.jawab}`).join("\n");
    expect(isi).toMatch(/melakukan kekerasan terhadap Penggugat/);
    expect(isi).toMatch(/visum/);
    expect(isi).toMatch(/perselisihan dan pertengkaran/);
    expect(isi).toMatch(/untuk mengajukan gugatan cerai terhadap Tergugat;/);
    // Unsur huruf D didahulukan sebelum pola harian F.
    const iD = u.baris.findIndex((r) => /kekerasan/.test(r.tanya));
    const iF = u.baris.findIndex((r) => /perselisihan dan pertengkaran, dan sejak kapan/.test(r.tanya));
    expect(iD).toBeLessThan(iF);
    expect(u.dasar.join(" ")).toMatch(/Pasal 19 huruf d/);
  });

  it("cerai talak: sebutan Pemohon/Termohon, suami = Pemohon, tanpa set taklik (G), maksud = izin ikrar talak", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Talak", huruf: "G F", sebutanP: "Pemohon", sebutanT: "Termohon" });
    expect(t.jenis).toBe("ct");
    expect(t.set[0].id).toBe("cerai-F");
    expect(t.set.some((s) => s.id === "cerai-G")).toBe(false);
    const isi = t.set[0].baris.map((r) => `${r.tanya} ${r.jawab}`).join("\n");
    expect(isi).toMatch(/apakah Pemohon masih memberi nafkah kepada Termohon\?/);
    expect(isi).toMatch(/memohon izin menjatuhkan talak terhadap Termohon/);
    expect(isi).not.toMatch(/Penggugat|Tergugat/);
  });

  it("kumulasi: folder hak asuh / itsbat -> set tambahan disarankan; tambahan tanpa pembuka & penutup", () => {
    const t = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", folder: "1d Putusan Cerai Gugat Kumulasi Hak Asuh Anak - BAS", sebutanP: "Penggugat", sebutanT: "Tergugat" });
    const ha = t.set.find((s) => s.id === "tambah-hak-asuh")!;
    expect(ha.utama).toBe(true);
    expect(ha.tambahan).toBe(true);
    expect(ha.baris[0].tanya).toMatch(/nama dan berapa umur anak/);
    expect(ha.baris.some((r) => /masih ada yang ingin/.test(r.tanya))).toBe(false);
    const it2 = tawarkanSetSaksi({ namaJenis: "Cerai Gugat", folder: "1c Perceraian Kumulasi Itsbat Nikah - BAS", sebutanP: "Penggugat", sebutanT: "Tergugat" });
    const its = it2.set.find((s) => s.id === "tambah-itsbat")!;
    expect(its.utama).toBe(true);
    expect(its.baris.map((r) => r.tanya).join("\n")).toMatch(/wali nikah Tergugat/);
  });

  it("jenis lain: set khusus disarankan + set umum; itsbat para Pemohon I/II; dispensasi dua pilihan anak", () => {
    const it1 = tawarkanSetSaksi({ namaJenis: "Pengesahan Perkawinan/Istbat Nikah", sebutanP: "Pemohon", jumlahP: 2 });
    expect(it1.set[0]).toMatchObject({ id: "itsbat", utama: true });
    expect(it1.set[0].baris[0].tanya).toBe("Apakah Saudara kenal dengan para Pemohon? Apa hubungan Saudara dengan para Pemohon?");
    expect(it1.set[0].baris.map((r) => r.tanya).join("\n")).toMatch(/Apa mahar yang diberikan Pemohon I kepada Pemohon II\?/);
    expect(it1.set.at(-1)).toMatchObject({ id: "umum", utama: false });
    const dk = tawarkanSetSaksi({ namaJenis: "Dispensasi Kawin", sebutanP: "Pemohon", jumlahP: 2 });
    expect(dk.set.map((s) => [s.id, s.utama])).toEqual([["dk-anak-perempuan", true], ["dk-anak-laki", false], ["umum", false]]);
    expect(dk.set[0].baris.map((r) => r.tanya).join("\n")).toMatch(/ada paksaan/);
    expect(dk.set[0].baris.map((r) => r.tanya).join("\n")).toMatch(/calon suami anak para Pemohon/);
    for (const [nama, id] of [["P3HP/Penetapan Ahli Waris", "ahli-waris"], ["Perwalian", "perwalian"], ["Wali Adhol", "wali-adhal"], ["Asal Usul Anak", "asal-usul-anak"], ["Izin Poligami", "izin-poligami"], ["Harta Bersama", "harta-bersama"], ["Kewarisan", "kewarisan"]]) {
      expect(tawarkanSetSaksi({ namaJenis: nama }).set[0], nama).toMatchObject({ id, utama: true });
    }
    expect(tawarkanSetSaksi({ namaJenis: "Lain-Lain" }).set.map((s) => [s.id, s.utama])).toEqual([["umum", true], ["pengangkatan-anak", false]]);
  });

  it("isiTanda: huruf pertama kalimat besar; tanda tak dikenal dibiarkan", () => {
    expect(isiTanda("{Pp} menghadap", "itsbat", { sebutanP: "Pemohon", jumlahP: 2 })).toBe("Para Pemohon menghadap");
    expect(isiTanda("x {tidakada}", "cg", {})).toBe("X {tidakada}");
  });
});

// ----------------------------------------------------------------------------
// B. Rute
// ----------------------------------------------------------------------------
const bridge = vi.fn();
const kapabilitas = vi.fn(async () => ({ id: "u1", name: "Panitera" }));
vi.mock("@/server/db/client", () => ({ getDatabase: async () => ({ queryAll: async () => [], queryOne: async () => null }) }));
vi.mock("@/server/shared/auth", () => ({ resolveActorUserId: async () => "u1" }));
vi.mock("@/server/modules/aleta-ecourt/akses", () => ({ pastikanKapabilitas: (...a: unknown[]) => kapabilitas(...(a as [])) }));
vi.mock("@/server/modules/aleta-sipp/aleta-sipp-datasource", () => ({ callAletaBotSippBridge: (...a: unknown[]) => bridge(...a) }));
vi.mock("@/server/shared/admin-access-audit", () => ({ handleAdminRouteError: (e: unknown) => new Response(JSON.stringify({ ok: false, alasan: String((e as Error)?.message || e) }), { status: 500 }) }));

const nextReq = (q: string) => Object.assign(new Request(`http://localhost/aleta/api/aleta-ecourt/blangko-derry/set-saksi${q}`), { nextUrl: new URL(`http://localhost/aleta/api/aleta-ecourt/blangko-derry/set-saksi${q}`) }) as never;
const GET = async (q: string) => (await (await import("@/app/api/aleta-ecourt/blangko-derry/set-saksi/route")).GET(nextReq(q))).json();

describe("B. GET /aleta-ecourt/blangko-derry/set-saksi", () => {
  beforeEach(() => {
    bridge.mockReset();
    kapabilitas.mockClear();
  });

  it("huruf dari layar dipakai tanpa bertanya ke bot", async () => {
    const j = await GET("?jenis=Cerai%20Gugat&huruf=B&perkaraId=10154&sebutanP=Penggugat&sebutanT=Tergugat");
    expect(j.ok).toBe(true);
    expect(j.data).toMatchObject({ jenis: "cg", huruf: "B", sumberHuruf: "isian" });
    expect(j.data.set[0]).toMatchObject({ id: "cerai-B", utama: true });
    expect(bridge).not.toHaveBeenCalled();
    expect(kapabilitas).toHaveBeenCalledWith(expect.anything(), "u1", "panel");
  });

  it("huruf kosong: dibaca dari #8503# lewat abt.nilaiPenanda (baca saja)", async () => {
    bridge.mockResolvedValue({ ok: true, data: { ok: true, nilai: { "8503": { status: "terisi", teks: "AF" } } } });
    const j = await GET("?jenis=Cerai%20Talak&perkaraId=10154&sebutanP=Pemohon&sebutanT=Termohon");
    expect(bridge).toHaveBeenCalledWith("abt.nilaiPenanda", { perkaraId: "10154", sidangKe: 0, penanda: ["8503"] }, expect.anything());
    expect(j.data).toMatchObject({ jenis: "ct", huruf: "AF", sumberHuruf: "abt" });
    expect(j.data.set[0].id).toBe("cerai-AF");
  });

  it("bot diam: tetap menjawab dengan F; bukan perkara cerai: bot tidak ditanya", async () => {
    bridge.mockRejectedValue(new Error("bot mati"));
    const j = await GET("?jenis=Cerai%20Gugat&perkaraId=10154");
    expect(j.data).toMatchObject({ huruf: "", sumberHuruf: "" });
    expect(j.data.set[0].id).toBe("cerai-F");
    bridge.mockReset();
    const d = await GET("?jenis=Dispensasi%20Kawin&perkaraId=10154&sebutanP=Pemohon&jumlahP=2");
    expect(bridge).not.toHaveBeenCalled();
    expect(d.data.set[0].id).toBe("dk-anak-perempuan");
  });
});
