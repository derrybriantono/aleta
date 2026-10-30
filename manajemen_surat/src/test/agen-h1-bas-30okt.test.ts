// @vitest-environment node
/**
 * ============================================================================
 * 30 OKT 2026 (G2a 2.4) - BAS SIDANG BERIKUTNYA TERSUSUN OTOMATIS (H-1)
 * ============================================================================
 * Yang dijaga (perilaku):
 *   1. hari kerja berikutnya: Jumat -> Senin, libur dilewati;
 *   2. golongan agenda (pembuktian, kesimpulan, pemeriksaan setempat, sumpah, mediasi, putusan, ikrar);
 *   3. blangko BAS menurut agenda lewat rekomendasiBlangko (BAS sela sumpah, pemeriksaan setempat, mediasi elektronik);
 *   4. agen: hanya sidang tanggal sasaran, satu draf per perkara, SIPP/ABT hanya dibaca (sumber suntikan tanpa tulis),
 *      draf disiapkan sendiri saat diminta bila portal baru berdiri, percobaan gagal tidak diulang tiap permintaan;
 *   5. penjadwal: hanya hari kerja, sesudah jamnya, sekali sehari, mati dengan ALETA_AGEN_H1=0;
 *   6. keputusan panel (ekstensi): buka / pilih sidang berikutnya / tidak.
 */
import { createRequire } from "node:module";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { drafH1Saya, hariKerjaBerikut, jenisAgendaH1, keteranganDrafH1, pilihBasH1, sasaranH1, susunDrafH1, teksLencanaH1, ringkasDrafH1, type BarisSidangH1 } from "@/lib/agen-h1-bas";
import { gabungLibur } from "@/lib/hari-libur";
import { agenH1JatuhTempo, bacaDrafH1, bacaDrafH1Saya, bersihkanAgenH1, detakAgenH1, jalankanAgenH1, jamAgenH1, type SumberAgenH1 } from "@/server/modules/aleta-ecourt/agen-h1-bas";

const req = createRequire(import.meta.url);
const DB = req(path.resolve(process.cwd(), "../ekstensi-sipp/blangko-derry-draf-bas.js"));

const B = (x: Partial<BarisSidangH1> & Record<string, unknown>): BarisSidangH1 => ({
  perkaraId: "1",
  nomorPerkara: "1/Pdt.G/2026/PA.Dgl",
  jenisPerkara: "Cerai Gugat",
  jenisPerkaraId: 347,
  alurPerkaraId: 15,
  tanggalSidang: "2026-11-02",
  agenda: "Pembuktian",
  urutanSidang: 3,
  dihadiriOleh: null,
  panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: false, penggugatPernahHadir: true },
  majelisNama: "Hakim Satu, S.H., Hakim Dua, M.H.",
  paniteraNama: "PP Satu",
  saksiPihak1: 2,
  saksiPihak2: 0,
  ...x,
});

describe("aturan murni", () => {
  it("hari kerja berikutnya: Jumat 30 Okt -> Senin 2 Nov; libur dilewati", () => {
    expect(hariKerjaBerikut("2026-10-30")).toBe("2026-11-02");
    expect(hariKerjaBerikut("2026-11-02")).toBe("2026-11-03");
    const peta = gabungLibur([{ tanggal: "2026-11-03", nama: "Libur uji", jenis: "daerah", aksi: "tambah" }]);
    expect(hariKerjaBerikut("2026-11-02", peta)).toBe("2026-11-04");
  });

  it("golongan agenda", () => {
    const g = (agenda: string, ikrar = false) => jenisAgendaH1({ agenda, sidangIkrarTalak: ikrar });
    expect(g("Pembuktian Penggugat")).toBe("pembuktian");
    expect(g("Mendengarkan keterangan saksi")).toBe("pembuktian");
    expect(g("Kesimpulan")).toBe("kesimpulan");
    expect(g("Pemeriksaan setempat objek sengketa")).toBe("pemeriksaan-setempat");
    expect(g("Pengucapan sumpah pelengkap")).toBe("sumpah");
    expect(g("Mendengarkan Laporan Hasil Mediasi")).toBe("mediasi");
    expect(g("Musyawarah Majelis")).toBe("putusan");
    expect(g("Pembacaan putusan")).toBe("putusan");
    expect(g("SIDANG IKRAR TALAK", true)).toBe("ikrar");
    expect(g("Replik Penggugat")).toBe("lain");
  });

  it("sasaran: hanya tanggal itu, belum memutus (kecuali ikrar)", () => {
    expect(sasaranH1(B({}), "2026-11-02")).toBe(true);
    expect(sasaranH1(B({ tanggalSidang: "2026-11-03" }), "2026-11-02")).toBe(false);
    expect(sasaranH1(B({ sudahPutus: true }), "2026-11-02")).toBe(false);
    expect(sasaranH1(B({ sudahPutus: true, agenda: "Sidang ikrar talak", sidangIkrarTalak: true }), "2026-11-02")).toBe(true);
    expect(sasaranH1(B({ perkaraId: "" }), "2026-11-02")).toBe(false);
  });

  it("blangko BAS menurut agenda: pembuktian cerai, sumpah pelengkap (BAS sela), pemeriksaan setempat harta bersama, mediasi elektronik", () => {
    const bukti = pilihBasH1(B({}));
    expect(bukti.utama?.folder).toMatch(/BAS/);
    expect(bukti.perkiraanKehadiran).toBe(true);
    const sumpah = pilihBasH1(B({ agenda: "Pengucapan sumpah pelengkap (suppletoir)" }));
    expect(sumpah.utama?.berkas).toMatch(/BAS SELA \[3\] Sumpah Pelengkap/);
    const ps = pilihBasH1(B({ jenisPerkara: "Harta Bersama", jenisPerkaraId: 348, agenda: "Pemeriksaan setempat", panggilan: { hadirSebelumnya: 1, tergugatPernahHadir: true, penggugatPernahHadir: true } }));
    expect(`${ps.utama?.berkas} ${ps.utama?.label}`).toMatch(/PS|setempat/i);
    const med = pilihBasH1(B({ urutanSidang: 1, agenda: "Mediasi secara elektronik" }));
    if (med.utama && /mediasi/i.test(med.utama.label)) expect(med.utama.label).toMatch(/elektronik/);
  });

  it("draf: catatan saksi dan kehadiran, tanpa istilah teknis", () => {
    const d = susunDrafH1(B({ saksiPihak1: 2 }), { tanyaJawab: [{ tanyaJawab: [{ pertanyaan: "a" }] }], kini: new Date("2026-10-30T07:30:00Z") });
    expect(d.jenisAgenda).toBe("pembuktian");
    expect(d.saksi).toEqual({ terdaftarP: 2, terdaftarT: 0, bertanyaJawab: 1 });
    expect(d.catatan.join(" ")).toMatch(/1 saksi belum punya tanya jawab; drafnya tersusun sendiri/);
    expect(d.catatan.join(" ")).toMatch(/Kehadiran sidang ini belum diketahui/);
    const tanpa = susunDrafH1(B({ saksiPihak1: 0 }));
    expect(tanpa.catatan.join(" ")).toMatch(/Saksi belum tercatat di SIPP/);
    const ket = keteranganDrafH1(d);
    expect(ket).toMatch(/^BAS sidang Senin, 2 November 2026 \(pembuktian\) disiapkan otomatis/);
    expect(ket).not.toMatch(/\b\d{4}\b(?! )|#|variabel|kode/i);
    expect(teksLencanaH1(ringkasDrafH1(d))).toBe("BAS disiapkan");
  });

  it("milik akun: PP atau majelis; admin semua", () => {
    const a = susunDrafH1(B({ perkaraId: "1", paniteraNama: "PP Satu" }));
    const b = susunDrafH1(B({ perkaraId: "2", paniteraNama: "PP Dua", majelisNama: "Hakim Tiga" }));
    const cocok = (n: string, t: string) => t.toLowerCase().includes(n.toLowerCase());
    expect(drafH1Saya([a, b], { nama: "PP Satu", lihatSemua: false, cocokNama: cocok }).map((d) => d.perkaraId)).toEqual(["1"]);
    expect(drafH1Saya([a, b], { nama: "Hakim Tiga", lihatSemua: false, cocokNama: cocok }).map((d) => d.perkaraId)).toEqual(["2"]);
    expect(drafH1Saya([a, b], { nama: "", lihatSemua: true, cocokNama: cocok })).toHaveLength(2);
  });
});

describe("agen (sumber suntikan, baca saja)", () => {
  beforeEach(() => bersihkanAgenH1());
  const buatSumber = (baris: BarisSidangH1[], o: { gagal?: boolean } = {}) => {
    const panggil = { jadwal: [] as string[], tanyaJawab: [] as string[] };
    const sumber: SumberAgenH1 = {
      async jadwal(dari, sampai) {
        panggil.jadwal.push(`${dari}..${sampai}`);
        if (o.gagal) return { ok: false, sidang: [], galat: "bot mati" };
        return { ok: true, sidang: baris.filter((b) => String(b.tanggalSidang) >= dari && String(b.tanggalSidang) <= sampai), galat: "" };
      },
      async tanyaJawab(pid) {
        panggil.tanyaJawab.push(pid);
        return [];
      },
    };
    return { sumber, panggil };
  };

  it("menyiapkan sidang hari kerja berikutnya saja, satu draf per perkara; tanya jawab dibaca hanya untuk agenda pembuktian", async () => {
    const { sumber, panggil } = buatSumber([B({ perkaraId: "1" }), B({ perkaraId: "1", jamSidang: "10:00" }), B({ perkaraId: "2", agenda: "Replik" }), B({ perkaraId: "3", tanggalSidang: "2026-11-03" })]);
    const j = await jalankanAgenH1({ pemicu: "tangan", hariIni: "2026-10-30", sumber, kini: new Date("2026-10-30T08:00:00Z") });
    expect(j.untuk).toBe("2026-11-02");
    expect(j.diperiksa).toBe(2);
    expect(panggil.jadwal).toEqual(["2026-11-02..2026-11-02"]);
    expect(panggil.tanyaJawab).toEqual(["1"]);
    const peta = await bacaDrafH1(["1", "2", "3"], { kini: new Date("2026-10-30T08:00:00Z"), sumber, env: { ALETA_AGEN_H1_JAM: "15:30" } });
    expect(Object.keys(peta).sort()).toEqual(["1", "2"]);
    expect(peta["1"].tanggalSidang).toBe("2026-11-02");
  });

  it("portal baru berdiri: draf hari ini disiapkan saat diminta; sesudah jam jalan juga hari kerja berikutnya; gagal tidak diulang tiap permintaan", async () => {
    const { sumber, panggil } = buatSumber([B({ perkaraId: "5", tanggalSidang: "2026-10-30" }), B({ perkaraId: "6", tanggalSidang: "2026-11-02" })]);
    const pagi = new Date("2026-10-30T01:00:00Z"); // 09.00 WITA
    expect(Object.keys(await bacaDrafH1(["5", "6"], { kini: pagi, sumber, env: {} }))).toEqual(["5"]);
    const sore = new Date("2026-10-30T08:00:00Z"); // 16.00 WITA
    expect(Object.keys(await bacaDrafH1(["5", "6"], { kini: sore, sumber, env: {} })).sort()).toEqual(["5", "6"]);
    expect(panggil.jadwal).toEqual(["2026-10-30..2026-10-30", "2026-11-02..2026-11-02"]);
    bersihkanAgenH1();
    const mati = buatSumber([], { gagal: true });
    await bacaDrafH1(["5"], { kini: pagi, sumber: mati.sumber, env: {} });
    await bacaDrafH1(["5"], { kini: new Date(pagi.getTime() + 60_000), sumber: mati.sumber, env: {} });
    expect(mati.panggil.jadwal).toHaveLength(1);
    await bacaDrafH1(["5"], { kini: new Date(pagi.getTime() + 6 * 60_000), sumber: mati.sumber, env: {} });
    expect(mati.panggil.jadwal).toHaveLength(2);
    expect(await bacaDrafH1(["5"], { kini: pagi, sumber, env: { ALETA_AGEN_H1: "0" } })).toEqual({});
  });

  it("draf milik akun untuk widget/daftar", async () => {
    const { sumber } = buatSumber([B({ perkaraId: "7", tanggalSidang: "2026-11-02", paniteraNama: "Nur Aini, S.H." })]);
    const h = await bacaDrafH1Saya({ nama: "Nur Aini", lihatSemua: false, kini: new Date("2026-10-30T08:00:00Z"), sumber, env: {} });
    expect(h.draf.map((d) => d.perkaraId)).toEqual(["7"]);
  });

  it("penjadwal: hari kerja, sesudah jamnya, sekali sehari; Sabtu tidak", async () => {
    expect(jamAgenH1({})).toBe("15:30");
    expect(jamAgenH1({ ALETA_AGEN_H1_JAM: "16:05" })).toBe("16:05");
    expect(jamAgenH1({ ALETA_AGEN_H1_JAM: "25:00" })).toBe("15:30");
    const kamisSore = new Date("2026-10-29T07:45:00Z"); // 15.45 WITA
    expect(agenH1JatuhTempo("15:30", kamisSore, false, true)).toBe(true);
    expect(agenH1JatuhTempo("15:30", kamisSore, true, true)).toBe(false);
    expect(agenH1JatuhTempo("15:30", kamisSore, false, false)).toBe(false);
    expect(agenH1JatuhTempo("15:30", new Date("2026-10-29T06:00:00Z"), false, true)).toBe(false);
    const { sumber, panggil } = buatSumber([B({ perkaraId: "8", tanggalSidang: "2026-10-30" })]);
    expect(await detakAgenH1({}, kamisSore, sumber)).not.toBeNull();
    expect(await detakAgenH1({}, new Date(kamisSore.getTime() + 600_000), sumber)).toBeNull();
    expect(await detakAgenH1({}, new Date("2026-10-31T08:00:00Z"), sumber)).toBeNull(); // Sabtu
    expect(await detakAgenH1({ ALETA_AGEN_H1: "0" }, new Date("2026-11-02T08:00:00Z"), sumber)).toBeNull();
    expect(panggil.jadwal).toEqual(["2026-10-30..2026-10-30"]);
  });
});

describe("keputusan panel ekstensi (blangko-derry-draf-bas.js)", () => {
  const draf = (t: string) => ({ tanggalSidang: t, blangko: { berkas: "BAS ALUR 02 [2].rtf", label: "BAS 2" } });
  const S = (tanggal: string, adaBas: boolean | null = null) => ({ tanggal, adaBas });
  it("buka bila sidang draf terpilih; pilih sidang berikutnya sore H-1 hanya bila BAS sidang lalu sudah terunggah", () => {
    const sid = [S("2026-10-15", true), S("2026-11-02")];
    expect(DB.putuskan({ draf: draf("2026-11-02"), sidang: sid, sidangDipilih: sid[1], hariIni: "2026-10-30" })).toMatchObject({ aksi: "buka", indeks: 1 });
    expect(DB.putuskan({ draf: draf("2026-11-02"), sidang: sid, sidangDipilih: sid[0], hariIni: "2026-10-30" })).toMatchObject({ aksi: "ganti-sidang", indeks: 1 });
    expect(DB.putuskan({ draf: draf("2026-11-02"), sidang: [S("2026-10-15", false), S("2026-11-02")], sidangDipilih: S("2026-10-15", false), hariIni: "2026-10-30" }).aksi).toBe("tidak");
    expect(DB.putuskan({ draf: draf("2026-11-02"), sidang: [S("2026-10-30", true), S("2026-11-02")], sidangDipilih: S("2026-10-30", true), hariIni: "2026-10-30" }).aksi).toBe("tidak");
    expect(DB.putuskan({ draf: draf("2026-11-09"), sidang: [S("2026-10-15", true), S("2026-11-02"), S("2026-11-09")], sidangDipilih: S("2026-10-15", true), hariIni: "2026-10-30" }).aksi).toBe("tidak");
    expect(DB.putuskan({ draf: draf("2026-11-02"), sidang: sid, sidangDipilih: sid[1], hariIni: "2026-10-30", sudah: true }).aksi).toBe("tidak");
    expect(DB.putuskan({ draf: { tanggalSidang: "2026-11-02", blangko: null }, sidang: sid, sidangDipilih: sid[1] }).aksi).toBe("tidak");
    expect(DB.putuskan({ draf: draf("2026-11-05"), sidang: sid, sidangDipilih: sid[1] }).aksi).toBe("tidak");
    expect(DB.kalimatBuka({ blangko: { label: "BAS 2 - saksi" } })).toMatch(/^BAS sidang ini sudah disiapkan: BAS 2 - saksi\./);
  });
});

describe("keputusan 44: agenda mediasi kontradiktoir, kesimpulan tanpa 'Tunda Panggil'", () => {
  it("sidang mediasi yang belum berlangsung: BAS kedua pihak hadir walau Tergugat belum pernah hadir", () => {
    for (const agenda of ["Mendengarkan Laporan Hasil Mediasi", "Pembacaan Laporan Hasil Mediasi", "Proses Mediasi"]) {
      const p = pilihBasH1(B({ urutanSidang: 2, agenda, panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: false, penggugatPernahHadir: true } }));
      expect(p.utama?.berkas, agenda).not.toMatch(/T Tidak Hadir|Verstek|Tunda Panggil/i);
    }
  });
  it("kehadiran yang sudah tercatat SIPP tetap dihormati (BAS laporan mediasi T tidak hadir)", () => {
    const p = pilihBasH1(B({ urutanSidang: 2, agenda: "Laporan Hasil Mediasi", dihadiriOleh: 2, panggilan: { hadirSebelumnya: 2, tergugatPernahHadir: false } }));
    expect(p.utama?.berkas ?? "").toMatch(/T Tidak Hadir|Verstek/);
  });
  it("kesimpulan: tidak pernah Tunda Panggil T Lagi; tanpa calon lain = tanpa saran", () => {
    const biasa = pilihBasH1(B({ urutanSidang: 4, agenda: "Kesimpulan" }));
    expect(biasa.utama?.berkas ?? "").not.toMatch(/Tunda Panggil/i);
    const kumulasi = pilihBasH1(B({ urutanSidang: 4, agenda: "Kesimpulan", kumulasi: { hakAsuh: true }, nomorPerkara: "534/Pdt.G/2026/PA.Dgl" }));
    expect(kumulasi.utama?.berkas ?? "").not.toMatch(/Tunda Panggil/i);
  });
});
