// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it } from "vitest";

/**
 * ============================================================================
 * KASIR PER KEJADIAN (11 Okt 2026, Agen K)
 * ============================================================================
 *
 *   MESIN       susunKejadian (bot) atas perkara SUNGGUHAN satker yang
 *               dianonimkan: tiap baris jurnal dan tiap usulan berada di tepat
 *               satu kejadian; pendaftaran ditulis SIPP (tidak diusulkan);
 *               kejadian selesai = tanpa usulan tercentang; ringkasan lencana.
 *   UJI BALIK   src/test/kasir-kejadian-nyata.json, dibangkitkan
 *               aleta_bot/tools/ukur-kasir-kejadian.js dari sipp_donggala:
 *               kejadian yang dijalankan seolah belum dijurnal -> usulan =
 *               yang ditulis kasir (sidang ditunda dengan/tanpa panggilan,
 *               tambahan panjar di hari putusan dan hari ikrar); ambang
 *               ketepatan per jenis kejadian dijaga.
 *   ATURAN BARU tambahan panjar bila saldo kurang (jumlah = kekurangan,
 *               sekurangnya Rp10.000, tepat sebelum biaya yang kekurangan),
 *               satu amplop (resi sama) satu baris, mediasi tanpa biaya.
 *   EKSTENSI    tab Kasir per perkara tersusun per kejadian di jsdom; yang
 *               sudah ada bertanda tanpa kotak centang; Simpan tetap dua
 *               tekanan; aletaKasirRingkas untuk lencana memakai SATU GET
 *               yang juga dipakai tabnya.
 */

const AKAR = path.resolve(process.cwd(), "..");
const requireBot = createRequire(path.join(AKAR, "aleta_bot/package.json"));
const kasir = requireBot(path.join(AKAR, "aleta_bot/services/kasirJurnalService.js"));
const NYATA = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-keadaan-nyata.json"), "utf8"));
const KEJADIAN = JSON.parse(readFileSync(path.join(process.cwd(), "src/test/kasir-kejadian-nyata.json"), "utf8"));

type Komponen = { sumber: "jurnal" | "usulan"; jurnalId?: number; kunci?: string; jenisBiayaId: number; jumlah: number | null; pilih?: boolean; sisaOtomatis?: boolean; tambahPanjar?: boolean; tanggal: string };
type Kejadian = { kunci: string; jenis: string; tanggal: string; judul: string; keterangan: string; status: string; usulan: number; sudah: number; tanpaBiaya: boolean; komponen: Komponen[] };
type Usul = { kunci: string; jenisBiayaId: number; jenisTransaksi: number; jumlah: number | null; pilih: boolean; sisaOtomatis: boolean; kejadian: string; tanggal: string; tambahPanjar?: boolean; yakin: string };

const salin = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const JENIS_224 = { id: 224, nama: "Tambahan Panjar Biaya Perkara", kategoriId: 1, jenisTransaksi: 1, jumlahBawaan: 0 };
const dipilih = (u: Usul) => u.pilih && (!u.sisaOtomatis || Number(u.jumlah) > 0);

/** Kasir mencentang tambahan panjar yang ditawarkan (pihak sudah membayar) - sisa dihitung ulang seperti layar. */
function centangTambahPanjar(h: { usulan: Usul[]; saldo: number }) {
  for (const u of h.usulan) if (u.tambahPanjar) u.pilih = true;
  kasir.hitungSisaOtomatis(h.usulan, h.saldo);
  return h.usulan;
}

function susun(k: unknown) {
  const h = kasir.susunUsulan(salin(k));
  const kj = kasir.susunKejadian(salin(k), h);
  return { h, kj, usulan: h.usulan as Usul[], kejadian: kj.kejadian as Kejadian[] };
}

// ============================================================================
// 1. MESIN - SUSUNAN PER KEJADIAN ATAS PERKARA NYATA
// ============================================================================
describe("1. susunKejadian atas perkara nyata satker", () => {
  const semua = Object.entries(NYATA.contoh as Record<string, Array<{ keadaan: Record<string, unknown> }>>);

  for (const [nama, daftar] of semua) {
    it(`${nama}: tiap baris jurnal dan tiap usulan tepat di satu kejadian; pendaftaran ditulis SIPP; status mengikuti usulan`, () => {
      const k = daftar[0].keadaan as { jurnal: Array<{ id: number }> };
      const { usulan, kejadian, kj } = susun(k);
      const idJurnal = kejadian.flatMap((e) => e.komponen.filter((c) => c.sumber === "jurnal").map((c) => c.jurnalId));
      expect(idJurnal.sort()).toEqual(k.jurnal.map((b) => b.id).sort());
      const kunciUsul = kejadian.flatMap((e) => e.komponen.filter((c) => c.sumber === "usulan").map((c) => c.kunci));
      expect(kunciUsul.sort()).toEqual(usulan.map((u) => u.kunci).sort());

      // Pendaftaran: kejadian pertama, berisi Panjar/PNBP/ATK yang sudah ada, tanpa usulan.
      const daftarKej = kejadian.find((e) => e.jenis === "daftar")!;
      expect(kejadian[0].jenis).toBe("daftar");
      expect(daftarKej.status).toBe("selesai");
      expect(daftarKej.komponen.map((c) => c.jenisBiayaId).sort((a, b) => a - b)).toEqual([1, 61, 155]);
      expect(daftarKej.komponen.every((c) => c.sumber === "jurnal")).toBe(true);
      expect(usulan.some((u) => [1, 61, 155].includes(u.jenisBiayaId))).toBe(false);

      for (const e of kejadian) {
        const adaUsul = e.komponen.some((c) => c.sumber === "usulan" && c.pilih && (!c.sisaOtomatis || Number(c.jumlah) > 0));
        if (e.jenis !== "daftar") expect(e.status, e.judul).toBe(adaUsul ? "terbuka" : "selesai");
      }
      // Ringkasan lencana = hitungan yang sama dengan layar.
      expect(kj.ringkas.usulan).toBe(usulan.filter(dipilih).length);
      expect(kj.ringkas.kejadian).toBe(kejadian.filter((e) => e.status === "terbuka").length);
      expect(kj.ringkas.keadaan).toBe(kasir.keadaanPerkara(k).nama);
      // Urutan kejadian menurut tanggal.
      const tgl = kejadian.map((e) => e.tanggal || "9999");
      expect(tgl).toEqual([...tgl].sort());
    });
  }

  it("verstek (contoh pengguna): putusan terbuka dengan Redaksi, Meterai, Biaya Pemberitahuan, PNBP pemberitahuan, sisa panjar; kejadian lain selesai", () => {
    const { kejadian } = susun(NYATA.contoh.verstek[0].keadaan);
    const put = kejadian.find((e) => e.jenis === "putusan")!;
    expect(put.status).toBe("terbuka");
    expect(put.komponen.filter((c) => c.sumber === "usulan" && c.pilih).map((c) => c.jenisBiayaId)).toEqual([157, 152, 29, 389, 151]);
    // Sisa panjar tetap baris terakhir kejadian putusan dan menghabiskan saldo.
    expect(put.komponen[put.komponen.length - 1].sisaOtomatis).toBe(true);
    for (const e of kejadian.filter((x) => x.jenis !== "putusan")) expect(e.status, e.judul).toBe("selesai");
    const pertama = kejadian.find((e) => e.jenis === "pertama")!;
    expect(pertama.komponen.map((c) => c.jenisBiayaId)).toEqual([236, 14, 237]);
    expect(pertama.komponen.every((c) => c.sumber === "jurnal")).toBe(true);
  });

  it("baru didaftar: panggilan sidang pertama terbuka (PNBP Penggugat, Biaya Panggilan, PNBP Tergugat); belum ada kejadian putusan", () => {
    const { kejadian, kj } = susun(NYATA.contoh["baru-gugatan"][0].keadaan);
    expect(kejadian.map((e) => e.jenis)).toEqual(["daftar", "pertama"]);
    const p = kejadian[1];
    expect(p.status).toBe("terbuka");
    expect(p.komponen.filter((c) => c.pilih).map((c) => c.jenisBiayaId)).toEqual([236, 14, 237]);
    expect(kj.ringkas).toMatchObject({ usulan: 3, kejadian: 1, kunciKeadaan: "baru" });
  });

  it("cerai talak ikrar: kejadian putusan (pemberitahuan) dan ikrar (panggilan ikrar + sisa panjar) terpisah", () => {
    const { kejadian } = susun(NYATA.contoh.ikrar[0].keadaan);
    const put = kejadian.find((e) => e.jenis === "putusan")!;
    const ikr = kejadian.find((e) => e.jenis === "ikrar")!;
    expect(put.komponen.filter((c) => c.pilih).map((c) => c.jenisBiayaId)).toEqual([157, 152, 29, 389]);
    expect(ikr.komponen.filter((c) => c.pilih).map((c) => c.jenisBiayaId)).toEqual([14, 151]);
    expect(kejadian.indexOf(ikr)).toBeGreaterThan(kejadian.indexOf(put));
  });
});

// ============================================================================
// 2. UJI BALIK PER KEJADIAN ATAS JURNAL NYATA
// ============================================================================
describe("2. uji balik per kejadian (kasir-kejadian-nyata.json)", () => {
  const contoh = Object.entries(KEJADIAN.contoh as Record<string, { kejadian: string; jenis: string; keadaan: unknown; harap: Array<{ jenisBiayaId: number; jumlah: number; tanggal: string }> }>);

  it("fixture memuat sidang ditunda dengan dan tanpa panggilan ulang, serta tambahan panjar", () => {
    const kunci = contoh.map(([k]) => k);
    for (const k of ["tunda-dipanggil", "tunda-tanpa-panggil", "putusan-tambah-panjar", "ikrar-tambah-panjar"]) expect(kunci).toContain(k);
  });

  for (const [nama, c] of contoh) {
    it(`${nama}: usulan tercentang kejadian ${c.kejadian} = baris yang ditulis kasir (jenis, jumlah, urutan)`, () => {
      const { usulan: awal, kejadian, h } = susun(c.keadaan);
      // Tambahan panjar ditawarkan TANPA centang; uji balik = kasir mencentangnya.
      expect(awal.filter((u) => u.tambahPanjar).every((u) => !u.pilih)).toBe(true);
      const usulan = centangTambahPanjar(h);
      const usul = usulan.filter((u) => u.kejadian === c.kejadian && dipilih(u));
      expect(usul.map((u) => `${u.jenisBiayaId}|${Number(u.jumlah)}`)).toEqual(c.harap.map((h) => `${h.jenisBiayaId}|${h.jumlah}`));
      const e = kejadian.find((x) => x.kunci === c.kejadian)!;
      expect(e.status).toBe(c.harap.length ? "terbuka" : "selesai");
      if (c.jenis === "tunda") expect(e.judul).toMatch(/^Sidang \d{2}\/\d{2}\/\d{4} ditunda ke \d{2}\/\d{2}\/\d{4}$/);
    });
  }

  it("tambahan panjar nyata: tepat sebelum biaya yang kekurangan, bertanggal sama, sisa panjar tetap terakhir", () => {
    const c = KEJADIAN.contoh["putusan-tambah-panjar"];
    const usulan = centangTambahPanjar(susun(c.keadaan).h);
    const i224 = usulan.findIndex((u) => u.jenisBiayaId === 224);
    expect(i224).toBeGreaterThanOrEqual(0);
    expect(usulan[i224].jenisTransaksi).toBe(1);
    expect(usulan[i224 + 1].tanggal).toBe(usulan[i224].tanggal);
    expect(usulan[usulan.length - 1].sisaOtomatis).toBe(true);
    // Saldo tidak pernah minus di sepanjang baris tercentang (pagar blangko SIPP).
    let saldo = kasir.susunUsulan(salin(c.keadaan)).saldo as number;
    for (const u of usulan.filter((x) => x.pilih && !x.sisaOtomatis)) {
      saldo += u.jenisTransaksi * Number(u.jumlah);
      expect(saldo).toBeGreaterThanOrEqual(0);
    }
  });

  it("ketepatan per jenis kejadian yang diukur (putusan Jul 2025 - Okt 2026) tidak turun di bawah ambangnya", () => {
    const r = KEJADIAN.ringkasB as Record<string, { kejadian: number; jenisTepat: number; jumlahTepat: number; presisiBaris: number; cakupanBaris: number }>;
    const tepat = (k: string) => r[k].jenisTepat / r[k].kejadian;
    expect(KEJADIAN.perkara).toBeGreaterThan(1000);
    expect(r.pertama.kejadian).toBeGreaterThan(1000);
    expect(r.tunda.kejadian).toBeGreaterThan(1500);
    expect(tepat("pertama")).toBeGreaterThanOrEqual(0.94);
    expect(tepat("tunda")).toBeGreaterThanOrEqual(0.93);
    expect(tepat("putusan")).toBeGreaterThanOrEqual(0.94);
    // Satu panggilan ikrar untuk rangkaian sidang ikrar (11 Okt): 82,7% -> 93,9%.
    expect(tepat("ikrar")).toBeGreaterThanOrEqual(0.92);
    for (const k of Object.keys(r)) {
      expect(r[k].presisiBaris, k).toBeGreaterThanOrEqual(0.92);
      expect(r[k].cakupanBaris, k).toBeGreaterThanOrEqual(0.95);
    }
    // Pendaftaran: seluruhnya ditulis SIPP saat daftar (sedetik dengan perkaranya).
    expect(KEJADIAN.ringkasA.daftar.berbaris).toBe(KEJADIAN.ringkasA.daftar.kejadian);
    expect(KEJADIAN.ringkasA.daftar.urutan[0].urutan).toBe("1>61>155");
    // Mediasi lazimnya tanpa biaya.
    expect(KEJADIAN.ringkasA.mediasi.berbaris / KEJADIAN.ringkasA.mediasi.kejadian).toBeLessThan(0.1);
  });
});

// ============================================================================
// 3. ATURAN BARU - TAMBAHAN PANJAR, SATU AMPLOP, SIDANG DITUNDA, MEDIASI
// ============================================================================
describe("3. aturan kejadian baru", () => {
  /** Perkara dicabut (nyata) dengan panjar dipangkas sampai saldo tertentu. */
  function cabutDenganSaldo(saldoTarget: number, dengan224 = true) {
    const k = salin(NYATA.contoh.cabut[0].keadaan);
    const panjar = k.jurnal.find((b: { jenisBiayaId: number }) => b.jenisBiayaId === 1);
    const saldo = kasir.susunUsulan(salin(k)).saldo;
    panjar.jumlah -= saldo - saldoTarget;
    if (dengan224) k.jenisBiaya[224] = { ...JENIS_224 };
    return k;
  }

  it("saldo kurang Rp10.000 untuk Redaksi+Meterai+PNBP cabut: tambahan panjar Rp10.000 DITAWARKAN TANPA CENTANG sebelum Redaksi; tidak terhitung usulan lencana", () => {
    const { usulan, kejadian, kj, h } = susun(cabutDenganSaldo(20000));
    expect(usulan.map((u) => u.jenisBiayaId)).toEqual([224, 157, 152, 404, 151]);
    const t = usulan[0];
    expect(t).toMatchObject({ jumlah: 10000, jenisTransaksi: 1, pihakKe: 1, kejadian: "putusan", pilih: false, uraian: "Tambahan Panjar Biaya Perkara" });
    expect(t.tanggal).toBe(usulan[1].tanggal);
    expect((t as unknown as { dasar: string }).dasar).toMatch(/kurang Rp10\.000/);
    // Tanpa centang: sisa minus, tidak terhitung dan tidak terkirim.
    expect(usulan[usulan.length - 1].jumlah).toBe(-10000);
    expect(kj.ringkas.usulan).toBe(3);
    expect(h.catatan.join(" ")).toMatch(/Tambahan Panjar Biaya Perkara ditawarkan \(belum dicentang\)/);
    const put = kejadian.find((e) => e.jenis === "putusan")!;
    expect(put.komponen[0]).toMatchObject({ tambahPanjar: true, pilih: false });
    // Kasir mencentangnya: sisa nol.
    centangTambahPanjar(h);
    expect(usulan[usulan.length - 1].jumlah).toBe(0);
  });

  it("kekurangan kecil (Rp2.000) dibulatkan ke Rp10.000 - sesudah dicentang kasir sisa Rp8.000 dikembalikan (pola 9657 & 238/2026)", () => {
    const { usulan, h } = susun(cabutDenganSaldo(28000));
    expect(usulan[0]).toMatchObject({ jenisBiayaId: 224, jumlah: 10000, pilih: false });
    const sisa = usulan[usulan.length - 1];
    expect(sisa).toMatchObject({ sisaOtomatis: true, pilih: true });
    expect(Number(sisa.jumlah)).toBeLessThan(0);
    centangTambahPanjar(h);
    expect(sisa).toMatchObject({ jumlah: 8000, pilih: true });
  });

  it("saldo cukup, jurnal sudah ditutup, atau jenis 224 tidak tersedia: tidak ada tambahan panjar", () => {
    expect(susun(cabutDenganSaldo(30000)).usulan.some((u) => u.jenisBiayaId === 224)).toBe(false);
    const tanpa = susun(cabutDenganSaldo(20000, false));
    expect(tanpa.usulan.some((u) => u.jenisBiayaId === 224)).toBe(false);
    expect(tanpa.h.catatan.join(" ")).toMatch(/KURANG/);
    const tutup = cabutDenganSaldo(0);
    tutup.jurnal.push({ id: 999999, jenisBiayaId: 151, jenisTransaksi: -1, jumlah: 5000, tanggal: "2026-09-22", pihakId: tutup.pihak[0].pihakId, pihakKe: 1, uraian: "Pengembalian Sisa Panjar", urutan: 0 });
    expect(susun(tutup).usulan.some((u) => u.jenisBiayaId === 224)).toBe(false);
  });

  it("satu amplop: tiga Tergugat dengan resi Pos sama pada sidang pertama - satu Biaya Panggilan + satu PNBP tercentang, sisanya ditawarkan", () => {
    const k = salin(NYATA.contoh["baru-gugatan"][0].keadaan);
    const t1 = k.pihak.find((p: { ke: number }) => p.ke === 2);
    k.pihak.push({ ...t1, id: t1.id + 1, pihakId: 990001, urutan: 2 }, { ...t1, id: t1.id + 2, pihakId: 990002, urutan: 3 });
    const r1 = k.relaas.find((r: { pihakId: number }) => r.pihakId === t1.pihakId);
    expect(r1 && r1.resi).toBeTruthy();
    k.relaas.push({ ...r1, id: 1, pihakId: 990001 }, { ...r1, id: 2, pihakId: 990002 });
    const { usulan } = susun(k);
    const pilih = usulan.filter((u) => u.pilih).map((u) => u.jenisBiayaId);
    expect(pilih.sort((a, b) => a - b)).toEqual([14, 236, 237]);
    expect(usulan.filter((u) => !u.pilih && u.jenisBiayaId === 14)).toHaveLength(2);
  });

  it("sidang ditunda: Tergugat tidak hadir -> panggilan ulang di kejadian sidang yang ditunda; semua hadir -> tanpa biaya", () => {
    const k = salin(NYATA.contoh["baru-gugatan"][0].keadaan);
    const s1 = k.sidang[0];
    // Jurnal panggilan pertama sudah ditulis.
    let id = 800000;
    for (const u of kasir.susunUsulan(salin(k)).usulan.filter((x: Usul) => x.pilih)) {
      k.jurnal.push({ id: (id += 1), jenisBiayaId: u.jenisBiayaId, jenisTransaksi: -1, jumlah: u.jumlah, tanggal: u.tanggal, pihakId: (u as unknown as { pihakId: number }).pihakId, pihakKe: (u as unknown as { pihakKe: number }).pihakKe, uraian: (u as unknown as { uraian: string }).uraian, urutan: 0 });
    }
    s1.dihadiriOleh = 2;
    s1.ditunda = true;
    const s2 = { ...s1, id: s1.id + 1, urutan: 2, tanggal: "2026-10-19", dihadiriOleh: null, ditunda: false, hasil: "" };
    k.sidang.push(s2);
    k.hariIni = "2026-10-13";
    const a = susun(k);
    const tunda = a.kejadian.find((e) => e.jenis === "tunda")!;
    expect(tunda.kunci).toBe(`tunda:${s1.id}`);
    expect(tunda.judul).toBe(`Sidang 12/10/2026 ditunda ke 19/10/2026`);
    expect(tunda.keterangan).toMatch(/Tergugat dipanggil ulang/);
    expect(tunda.komponen.filter((c) => c.sumber === "usulan").map((c) => c.jenisBiayaId)).toEqual([14]);
    expect(a.kejadian.find((e) => e.jenis === "pertama")!.status).toBe("selesai");

    s1.dihadiriOleh = 1;
    const b = susun(k);
    const t2 = b.kejadian.find((e) => e.jenis === "tunda")!;
    expect(t2).toMatchObject({ status: "selesai", tanpaBiaya: true });
    expect(t2.keterangan).toMatch(/Semua pihak hadir/);
  });

  /** Perkara ikrar nyata dengan sidang ikrar kedua (ikrar pertama ditunda). */
  function ikrarDuaSidang(ket2: string, resi2: string) {
    const k = salin(NYATA.contoh.ikrar[0].keadaan);
    const s1 = k.sidang.find((s: { ikrar: boolean }) => s.ikrar);
    s1.ditunda = true;
    s1.dihadiriOleh = 4;
    s1.hasil = "Termohon tidak hadir";
    const s2 = { ...s1, id: s1.id + 1, urutan: s1.urutan + 1, tanggal: "2026-10-14", ditunda: false, dihadiriOleh: 2, hasil: "telah ikrar talak" };
    k.sidang.push(s2);
    const t = k.pihak.find((p: { ke: number }) => p.ke === 2);
    k.relaas.push({ id: 1, sidangId: s2.id, pihakId: t.pihakId, ket: ket2, resi: resi2, tanggalRelaas: "2026-10-09", tanggalJursitPos: "2026-10-08" });
    k.ikrar = { tanggal: "2026-10-14" };
    k.hariIni = "2026-10-14";
    return k;
  }

  it("ikrar ditunda (dua sidang ikrar, keduanya ber-relaas Pos): SATU Biaya Panggilan Ikrar Talak untuk rangkaiannya (13/16 nyata, tidak pernah dua)", () => {
    const k = ikrarDuaSidang("S", "P2610080001234");
    const { usulan, kejadian } = susun(k);
    const ikrar = usulan.filter((u) => u.kejadian === "ikrar" && u.jenisBiayaId === 14);
    expect(ikrar).toHaveLength(1);
    expect(ikrar[0].pilih).toBe(true);
    expect((ikrar[0] as unknown as { dasar: string }).dasar).toMatch(/satu panggilan untuk 2 sidang ikrar/);
    expect(kejadian.find((e) => e.jenis === "ikrar")!.komponen.filter((c) => c.sumber === "usulan").map((c) => c.jenisBiayaId)).toEqual([14, 151]);
    // Panggilan ikrar yang sudah ditulis menutup seluruh rangkaian.
    k.jurnal.push({ id: 999100, jenisBiayaId: 14, jenisTransaksi: -1, jumlah: 29500, tanggal: "2026-09-24", pihakId: k.pihak[1].pihakId, pihakKe: 2, uraian: "Biaya Panggilan Ikrar Talak/P2609230049139", urutan: 0 });
    expect(susun(k).usulan.filter((u) => u.jenisBiayaId === 14)).toHaveLength(0);
  });

  it("ikrar: sidang ikrar pertama dipanggil tanpa biaya (E) dan tidak ada relaas berbiaya - panggilan ikrar ditawarkan tanpa centang", () => {
    const k = salin(NYATA.contoh.ikrar[0].keadaan);
    const s1 = k.sidang.find((s: { ikrar: boolean }) => s.ikrar);
    const t = k.pihak.find((p: { ke: number }) => p.ke === 2);
    const r = k.relaas.find((x: { sidangId: number; pihakId: number }) => x.sidangId === s1.id && x.pihakId === t.pihakId);
    r.ket = "E";
    r.resi = "";
    k.sidang.push({ ...s1, id: s1.id + 1, urutan: s1.urutan + 1, tanggal: "2026-10-14", hasil: "telah ikrar talak" });
    k.hariIni = "2026-10-14";
    const ikrar = susun(k).usulan.filter((u) => u.kejadian === "ikrar" && u.jenisBiayaId === 14);
    expect(ikrar.length).toBeLessThanOrEqual(1);
    expect(ikrar.every((u) => !u.pilih)).toBe(true);
  });

  it("mediasi: kejadian sendiri tanpa usulan; Biaya Panggilan Mediasi yang sudah ditulis masuk kejadian mediasi", () => {
    const k = salin(NYATA.contoh.verstek[0].keadaan);
    k.mediasi = [{ id: 7, tanggal: k.sidang[0].tanggal, selesai: k.sidang[0].tanggal, hasil: "T" }];
    let a = susun(k);
    const m = a.kejadian.find((e) => e.jenis === "mediasi")!;
    expect(m).toMatchObject({ status: "selesai", tanpaBiaya: true });
    expect(a.usulan.some((u) => u.kejadian.startsWith("mediasi"))).toBe(false);
    k.jurnal.push({ id: 999001, jenisBiayaId: 381, jenisTransaksi: -1, jumlah: 29500, tanggal: k.sidang[0].tanggal, pihakId: k.pihak[1].pihakId, pihakKe: 2, uraian: "Biaya Panggilan Mediasi Tergugat", urutan: 0 });
    a = susun(k);
    expect(a.kejadian.find((e) => e.jenis === "mediasi")!.komponen.map((c) => c.jurnalId)).toEqual([999001]);
  });

  it("bacaKeadaan membaca perkara_mediasi (baca saja); tabelnya terdaftar di skema SIPP", async () => {
    const sql: string[] = [];
    const kueri = async (s: string) => {
      sql.push(s);
      if (/DATE_FORMAT\(NOW\(\)/.test(s)) return [{ saat: "2026-10-09 10:00:00" }];
      if (/FROM perkara p LEFT JOIN perkara_penetapan/.test(s)) return [{ perkaraId: 5, nomorPerkara: "5/Pdt.G/2026/PA.Dgl", alurPerkaraId: 15, jenisPerkaraId: 347, tanggalDaftar: "2026-09-01" }];
      if (/FROM perkara_mediasi/.test(s)) return [{ id: 3, tanggal: "2026-09-20", selesai: "2026-09-27", hasil: "T" }];
      return [];
    };
    const layanan = kasir.buatLayanan({ kueri, tabelAda: async () => true });
    const b = await layanan.bacaKeadaan(5);
    expect(b.ok).toBe(true);
    expect(b.keadaan.mediasi).toEqual([{ id: 3, tanggal: "2026-09-20", selesai: "2026-09-27", hasil: "T" }]);
    expect(sql.filter((s) => /perkara_mediasi/.test(s)).every((s) => /^\s*SELECT/i.test(s))).toBe(true);
    const skema = readFileSync(path.join(AKAR, "aleta_bot/services/sippSkemaService.js"), "utf8");
    expect(skema).toContain('"perkara_mediasi"');
  });
});

// ============================================================================
// 4. EKSTENSI - TAB KASIR PER PERKARA PER KEJADIAN (jsdom)
// ============================================================================
const EKS = path.join(AKAR, "ekstensi-sipp");
const SUMBER = ["panel-alat.js", "basmassal.js"].map((b) => readFileSync(path.join(EKS, b), "utf8").replace(/\r\n/g, "\n")).join("\n;\n");
const tunggu = (ms = 0) => new Promise((r) => setTimeout(r, ms));
async function sampai<T>(periksa: () => T, ket: string, batas = 4000): Promise<NonNullable<T>> {
  const mulai = Date.now();
  for (;;) {
    let h: T | undefined;
    try {
      h = periksa();
    } catch {
      h = undefined;
    }
    if (h) return h as NonNullable<T>;
    if (Date.now() - mulai > batas) throw new Error(`tidak tercapai: ${ket}`);
    await tunggu(10);
  }
}
const terbuka: JSDOM[] = [];
afterEach(async () => {
  await tunggu(20);
  while (terbuka.length) terbuka.pop()!.window.close();
});

function bukaEkstensi(keadaan: unknown, p: { mode?: string } = {}) {
  const dom = new JSDOM(`<!doctype html><html><body><div id="wadah"></div></body></html>`, {
    url: "http://192.168.10.10/SIPP/perkara_detil_agama/ENC",
    runScripts: "outside-only",
    pretendToBeVisual: true,
  } as ConstructorParameters<typeof JSDOM>[1]);
  terbuka.push(dom);
  const w = dom.window as any;
  const simpanan: Record<string, unknown> = { ujiTampilan: p.mode ?? "baru", modeKering: false };
  w.chrome = {
    runtime: { id: "x", getManifest: () => ({ version: "1.192.0" }), getURL: (x: string) => x, lastError: undefined, sendMessage: (_m: unknown, b?: (x: unknown) => void) => setTimeout(() => b && b({ ok: true }), 0) },
    storage: {
      local: { get: async (k?: string | string[] | null) => Object.fromEntries((k == null ? Object.keys(simpanan) : [k].flat()).filter((x) => x in simpanan).map((x) => [x, simpanan[x]])), set: async () => undefined, remove: async () => undefined },
      session: { get: async () => ({}), set: async () => undefined },
      onChanged: { addListener: () => undefined },
    },
  };
  const k = salin(keadaan) as { perkara: { perkaraId: number }; hariIni: string };
  const h = kasir.susunUsulan(salin(k));
  const kj = kasir.susunKejadian(salin(k), h);
  const minta: Array<{ url: string; cara: string; badan: any }> = [];
  w.fetch = async (alamat: string, opsi?: { method?: string; body?: string }) => {
    const url = String(alamat);
    const cara = String(opsi?.method || "GET").toUpperCase();
    minta.push({ url, cara, badan: opsi?.body ? JSON.parse(opsi.body) : null });
    if (/\/sidang\/kasir\?perkaraId=/.test(url)) {
      return Response.json({
        ok: true,
        data: { available: true, ok: true, perkara: k.perkara, hariIni: k.hariIni, saldo: h.saldo, usulan: h.usulan, catatan: h.catatan, keadaan: kasir.keadaanPerkara(k), kejadian: kj.kejadian, ringkas: kj.ringkas, akun: { ok: true, username: "kasir", milik: ["kasir"] } },
      });
    }
    if (/\/sidang\/kasir$/.test(url) && cara === "POST") {
      const b = JSON.parse(String(opsi?.body || "{}"));
      return Response.json({ ok: true, data: { available: true, ok: true, kering: false, hasil: b.baris.map((_: unknown, i: number) => ({ ke: i, keadaan: "tersimpan", pesan: "tersimpan dan terbaca ulang di jurnal SIPP" })), ringkas: { tersimpan: b.baris.length }, ditolak: [], dilewati: [] } });
    }
    return new Response("{}", { status: 404 });
  };
  w.Response = Response;
  w.console.warn = () => {};
  w.eval(`${SUMBER}\n;window.__mode = () => alatUjiMode(); alatCobaMenahan = () => false;`);
  return { w, minta, wadah: w.document.getElementById("wadah") as HTMLElement, k, h, kj };
}

describe("4. ekstensi - Kasir per perkara tersusun per kejadian", () => {
  it("verstek: kejadian bertanggal; yang sudah ada bertanda tanpa kotak centang; putusan terbuka; pendaftaran & panggilan pertama selesai diciutkan", async () => {
    const e = bukaEkstensi(NYATA.contoh.verstek[0].keadaan);
    await sampai(() => e.w.__mode() === "baru", "mode baru");
    expect(await e.w.aletaKasirPasang(e.wadah, { perkaraId: String(e.k.perkara.perkaraId) })).toBe(true);
    await sampai(() => e.wadah.querySelector(".aleta-kasir-kejadian"), "kejadian");
    const kotak = Array.from(e.wadah.querySelectorAll(".aleta-kasir-kejadian")) as HTMLElement[];
    expect(kotak.map((x) => x.getAttribute("data-kejadian"))).toEqual((e.kj.kejadian as Kejadian[]).map((x) => x.jenis));
    const put = kotak.find((x) => x.getAttribute("data-kejadian") === "putusan") as HTMLDetailsElement;
    expect(put.getAttribute("data-status")).toBe("terbuka");
    expect(put.open).toBe(true);
    expect(put.querySelector("summary")!.textContent).toMatch(/5 usulan .*29\/09\/2026 · Putusan 29\/09\/2026/);
    expect(put.querySelectorAll("input[type=checkbox]:checked").length).toBe(5);
    const daftar = kotak.find((x) => x.getAttribute("data-kejadian") === "daftar") as HTMLDetailsElement;
    expect(daftar.open).toBe(false);
    expect(daftar.querySelectorAll("input[type=checkbox]").length).toBe(0);
    expect(daftar.querySelectorAll("tr.aleta-kasir-sudah").length).toBe(3);
    expect(daftar.textContent).toContain("sudah");
    // 28 Okt 2026: keterangan kejadian di balik ikon (i), bukan baris teks.
    expect(Array.from(daftar.querySelectorAll(".aleta-kasir-info")).map((i) => (i as HTMLElement).title).join(" ")).toContain("ditulis SIPP sendiri saat perkara didaftar");
    // Seluruh usulan tercentang tergambar; tidak ada angka hijau mati (warna lewat kelas token panel).
    const tercentang = (e.h.usulan as Usul[]).filter((u) => u.pilih).length;
    expect(e.wadah.querySelectorAll(".aleta-kasir-tabel input[type=checkbox]:checked").length).toBe(tercentang);
    expect(e.wadah.innerHTML).not.toMatch(/style="[^"]*(color|#[0-9a-f]{3,6})/i);
    // 28 Okt 2026: baris "N kejadian · M perlu dijurnal" dihapus; status ada di tanda tiap kejadian.
    expect(e.wadah.textContent).not.toContain("perlu dijurnal");
    expect(e.wadah.querySelectorAll('details.aleta-kasir-kejadian[data-status="terbuka"]').length).toBe(1);
  });

  it("aletaKasirRingkas: {usulan, kejadian, keadaan} dari SATU GET yang juga dipakai tab Kasir; Lama -> null tanpa permintaan", async () => {
    const e = bukaEkstensi(NYATA.contoh.verstek[0].keadaan);
    await sampai(() => e.w.__mode() === "baru", "mode baru");
    const r = await e.w.aletaKasirRingkas({ perkaraId: String(e.k.perkara.perkaraId), nomorPerkara: "x" });
    expect(r).toEqual({ usulan: 5, kejadian: 1, keadaan: "Putus verstek", saldo: e.h.saldo });
    await e.w.aletaKasirPasang(e.wadah, { perkaraId: String(e.k.perkara.perkaraId) });
    await sampai(() => e.wadah.querySelector(".aleta-kasir-kejadian"), "kejadian");
    expect(e.minta.filter((m) => m.url.includes("/kasir?perkaraId=")).length).toBe(1);
    expect(await e.w.aletaKasirRingkas({ perkaraId: "" })).toBeNull();
    // Susun ulang selalu membaca segar.
    (Array.from(e.wadah.querySelectorAll("button")).find((b) => /Susun ulang/.test(b.textContent || "")) as HTMLButtonElement).click();
    await sampai(() => e.minta.filter((m) => m.url.includes("/kasir?perkaraId=")).length === 2, "GET segar");

    const lama = bukaEkstensi(NYATA.contoh.verstek[0].keadaan, { mode: "lama" });
    await tunggu(30);
    expect(await lama.w.aletaKasirRingkas({ perkaraId: "1" })).toBeNull();
    expect(lama.minta.filter((m) => m.url.includes("/kasir"))).toEqual([]);
  });

  it("tambahan panjar ditawarkan tanpa centang; sesudah kasir mencentang, Simpan dua tekanan mengirim menurut urutan usulan (tambahan panjar sebelum biayanya, sisa panjar terakhir)", async () => {
    const k = salin(NYATA.contoh.cabut[0].keadaan);
    const saldo = kasir.susunUsulan(salin(k)).saldo;
    k.jurnal.find((b: { jenisBiayaId: number }) => b.jenisBiayaId === 1).jumlah -= saldo - 28000;
    k.jenisBiaya[224] = { ...JENIS_224 };
    const e = bukaEkstensi(k);
    const berubah: string[] = [];
    e.w.document.addEventListener("aleta-kasir-berubah", (ev: CustomEvent) => berubah.push(ev.detail.perkaraId));
    await sampai(() => e.w.__mode() === "baru", "mode baru");
    await e.w.aletaKasirPasang(e.wadah, { perkaraId: String(e.k.perkara.perkaraId) });
    await sampai(() => e.wadah.querySelector(".aleta-kasir-kejadian[data-kejadian=putusan]"), "putusan");
    // Tambahan panjar tampil sebagai usulan TANPA centang; kasir yang mencentangnya.
    const cek224 = e.wadah.querySelector('input[aria-label="Pilih Tambahan Panjar Biaya Perkara"]') as HTMLInputElement;
    expect(cek224.checked).toBe(false);
    expect(e.wadah.textContent).toContain("pastikan pihak sudah membayar tambahan panjar");
    cek224.checked = true;
    cek224.dispatchEvent(new e.w.Event("change"));
    await sampai(() => /Rp8\.000/.test(e.wadah.querySelector(".aleta-kasir-kejadian[data-kejadian=putusan]")!.textContent || ""), "sisa Rp8.000");
    const simpan = Array.from(e.wadah.querySelectorAll("button")).find((b) => /Simpan ke SIPP/.test(b.textContent || "")) as HTMLButtonElement;
    simpan.click();
    await tunggu(20);
    expect(e.minta.filter((m) => m.cara === "POST")).toEqual([]);
    simpan.click();
    await sampai(() => e.minta.some((m) => m.cara === "POST"), "POST");
    const post = e.minta.find((m) => m.cara === "POST")!;
    expect(post.badan.kering).toBe(false);
    expect(post.badan.baris.map((b: { jenisBiayaId: number; jumlah: number }) => `${b.jenisBiayaId}|${b.jumlah}`)).toEqual(["224|10000", "157|10000", "152|10000", "404|10000", "151|8000"]);
    await sampai(() => /tersimpan dan terbaca ulang/.test(e.wadah.textContent || ""), "kabar");
    expect(berubah).toEqual([String(e.k.perkara.perkaraId)]);
    // Sesudah tersimpan, kejadian putusan menjadi selesai.
    await sampai(() => e.wadah.querySelector(".aleta-kasir-kejadian[data-kejadian=putusan][data-status=selesai]"), "putusan selesai");
  });
});
