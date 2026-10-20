// @vitest-environment node
/**
 * ============================================================================
 * 20 OKT 2026 - FAKTA PERKARA (agen U6): satu sumber fakta per perkara
 * ============================================================================
 *
 * Yang dijaga (perilaku):
 *   A  peta fakta -> kode: kode hanya di satu fakta, bentuk sah, tanpa kata "ALETA";
 *   B  penimbangan: isian petugas menang dan tetap "pasti"; dua sumber berbeda -> "ragu" + bertentangan; sepakat -> gabungan sumber;
 *   C  faktaPerkara: tanggal nikah dari SIPP dan posita, koreksi petugas di satu kode dibaca kode setara (anak.nama 5110/8603)
 *      dan TIDAK menimpa kode yang sudah diisi petugas; nilai yang memuat "Aleta" dibuang;
 *   D  pembungkus tidak menghapus pengisi lama: usulan dariSipp yang tak berpeta tetap terbaca lewat `kode`.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { describe, expect, it } from "vitest";

const AKAR = path.resolve(process.cwd(), "..");
const require_ = createRequire(path.join(AKAR, "aleta_bot", "package.json"));
const FP = require_(path.join(AKAR, "aleta_bot", "services", "faktaPerkara.js")) as {
  faktaPerkara: (m: unknown, o?: Record<string, unknown>) => Promise<any>;
  timbang: (tipe: string, daftar: any[]) => any;
  kanon: (tipe: string, v: string) => string;
  sama: (tipe: string, a: string, b: string) => boolean;
  tulisBentuk: (n: string, b: string) => string;
  muatPeta: (p?: unknown) => any;
  nilaiKode: (h: any, k: string) => string;
  PRIO: Record<string, number>;
};
const peta = JSON.parse(readFileSync(path.join(AKAR, "aleta_bot", "config", "peta-fakta-variabel.json"), "utf8"));

const perkara = (extra: Record<string, unknown> = {}) => ({ id: 777, nomor: "777/Pdt.G/2026/PA.Dgl", jenis: 347, alur: 3, posita: "", petitum: "", ...extra });
const dasar = { tanpaDariSipp: true, tanpaBas: true, runAbt: null, sippSaksi: null };

describe("A. peta fakta -> kode", () => {
  it("setiap kode hanya tercantum pada satu fakta dan berbentuk angka 4 digit", () => {
    const lihat = new Map<string, string>();
    for (const [kunci, d] of Object.entries<any>(peta.fakta)) {
      for (const k of d.kode || []) {
        const kode = typeof k === "string" ? k : k.kode;
        expect(kode, `${kunci}`).toMatch(/^\d{4,5}$/);
        expect(lihat.has(kode), `kode ${kode} ganda: ${kunci} dan ${lihat.get(kode)}`).toBe(false);
        lihat.set(kode, kunci);
      }
      expect(peta.tipe[d.tipe], `${kunci}: tipe ${d.tipe}`).toBeTruthy();
    }
    expect(lihat.size).toBeGreaterThan(60);
  });
  it("tanpa kata ALETA di peta", () => {
    expect(JSON.stringify(peta)).not.toMatch(/aleta/i);
  });
  it("kunci saksi lama tidak dipakai dua fakta", () => {
    const lihat = new Set<string>();
    for (const d of Object.values<any>(peta.fakta)) {
      if (!d.kunciSaksi) continue;
      expect(lihat.has(d.kunciSaksi)).toBe(false);
      lihat.add(d.kunciSaksi);
    }
  });
});

describe("B. penimbangan antar sumber", () => {
  const c = (nilai: string, prio: number, yakin = "cukup", sumber = "x") => ({ nilai, yakin, prio, sumber, kutipan: "", kode: "", urut: 0 });
  it("isian petugas menang dan tetap pasti walau SIPP berbeda; perbedaan dicatat", () => {
    const t = FP.timbang("tanggal", [c("2018-02-05", FP.PRIO.sipp, "pasti"), c("2018-02-06", FP.PRIO.petugas, "pasti")]);
    expect(t.nilai).toBe("2018-02-06");
    expect(t.yakin).toBe("pasti");
    expect(t.bertentangan).toHaveLength(1);
  });
  it("dua sumber otomatis yang berbeda menjadi ragu dengan keterangan pertentangan", () => {
    const t = FP.timbang("tanggal", [c("2018-02-05", FP.PRIO.sipp, "pasti"), c("2019-03-01", FP.PRIO.posita, "cukup")]);
    expect(t.yakin).toBe("ragu");
    expect(t.catatan).toMatch(/Periksa mana yang benar/);
  });
  it("dua sumber sepakat menggabungkan sumber dan mengambil keyakinan tertinggi", () => {
    const t = FP.timbang("angka", [c("26", FP.PRIO.posita, "ragu"), c(FP.kanon("angka", "26 tahun"), FP.PRIO.sipp, "cukup")]);
    expect(t.yakin).toBe("cukup");
    expect(t.sumber).toBe("data SIPP + posita/gugatan");
    expect(t.bertentangan).toHaveLength(0);
  });
  it("pembanding per tipe: tanggal berbeda format sama, nama bin/binti diabaikan, rupiah dibaca angkanya", () => {
    expect(FP.sama("tanggal", FP.kanon("tanggal", "5 Februari 2018"), FP.kanon("tanggal", "2018-02-05"))).toBe(true);
    expect(FP.sama("daftar", FP.kanon("daftar", "Aisilah Putri binti Ican"), FP.kanon("daftar", "Aisilah Putri"))).toBe(true);
    expect(FP.kanon("rupiah", "Rp4.000.000,00 (empat juta rupiah)")).toBe("4000000");
    expect(FP.sama("jumlahAnak", FP.kanon("jumlahAnak", "telah dikaruniai seorang anak"), "1")).toBe(true);
    expect(FP.tulisBentuk("2025-11-17", "slash")).toBe("17/11/2025");
    expect(FP.tulisBentuk("2025-11-17", "indo")).toBe("17 November 2025");
  });
});

describe("C. faktaPerkara dengan data tiruan", () => {
  const usulan = [
    { kode: "5110", nama: "Nama anak", nilai: "Aisilah Putri binti Ican Riansya", keyakinan: "ragu", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP anak" }] },
    { kode: "5197", nama: "Tanggal nikah", nilai: "5 Februari 2018", keyakinan: "pasti", sumber: [{ saksi: 0, asal: "sipp", kalimat: "perkara_data_pernikahan" }] },
    { kode: "9999", nama: "Kode tak berpeta", nilai: "isi bebas", keyakinan: "cukup", sumber: [] },
  ];
  it("satu fakta dibaca dari kode mana pun dan kode tak berpeta tetap terbaca (pengisi lama tidak hilang)", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan });
    expect(f.ok).toBe(true);
    expect(f.fakta["nikah.tanggal"].nilai).toBe("2018-02-05");
    expect(FP.nilaiKode(f, "5197")).toBe("2018-02-05");
    expect(f.kode["9999"].nilai).toBe("isi bebas");
    expect(f.kode["8603"].nilai).toMatch(/Aisilah/);
  });
  it("koreksi petugas pada satu kode dibaca kode setara dan tidak menimpa kode yang sudah diisi petugas", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan, isian: { "5110": "Aisilah Putri Ramadhani binti Ican Riansya" } });
    expect(f.fakta["anak.nama"].nilai).toMatch(/Ramadhani/);
    expect(f.fakta["anak.nama"].yakin).toBe("pasti");
    const s = f.usulanSetara.find((u: any) => u.kode === "8603");
    expect(s).toBeTruthy();
    expect(s.keyakinan).toBe("pasti");
    expect(s.jagaIsianLama).toBe(true);
    expect(s.sumber[0].asal).toBe("isian-petugas");
    expect(f.usulanSetara.some((u: any) => u.kode === "5110")).toBe(false);
    // petugas sudah mengisi 8603 sendiri: tidak diusulkan lagi
    const g = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan, isian: { "5110": "Aisilah Putri Ramadhani", "8603": "Aisilah P. R." } });
    expect(g.usulanSetara.some((u: any) => u.kode === "8603")).toBe(false);
  });
  it("kode setara dari fakta otomatis diturunkan: pasti tidak melompat menjadi lebih pasti", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan });
    const s = f.usulanSetara.find((u: any) => u.kode === "8603");
    expect(s.keyakinan).toBe("ragu");
    expect(s.sumber[0].asal).toBe("fakta-setara");
  });
  it("nilai yang memuat nama aplikasi tidak pernah masuk", async () => {
    const f = await FP.faktaPerkara(777, { perkara: perkara(), ...dasar, usulan: [{ kode: "5105", nama: "x", nilai: "Aleta tempat", keyakinan: "pasti", sumber: [] }], isian: { "5178": "KUA Aleta" } });
    expect(JSON.stringify(f.fakta)).not.toMatch(/aleta/i);
    expect(JSON.stringify(f.kode)).not.toMatch(/aleta/i);
  });
  it("perkara tak ditemukan dijawab ok:false tanpa galat", async () => {
    const f = await FP.faktaPerkara("999/Pdt.G/2026/PA.Dgl", { ...dasar, runQuery: async () => [] });
    expect(f.ok).toBe(false);
    expect(f.fakta).toEqual({});
  });
  it("petitum ikut dikembalikan dan peta bersama tidak tercemar fakta dinamis", async () => {
    const f = await FP.faktaPerkara(
      777,
      { ...dasar, perkara: perkara({ petitum: "<div>1. Mengabulkan Gugatan Penggugat;</div><div>2. Menjatuhkan talak satu ba'in shughra Tergugat terhadap Penggugat;</div><div>3. Membebankan biaya perkara;</div>", posita: "Bahwa Penggugat dan Tergugat menikah pada tanggal 5 Februari 2018 di KUA Kecamatan Labuan." }) }
    );
    expect(f.petitum.map((b: any) => b.jenis)).toEqual(["kabul", "cerai-talak", "biaya"]);
    expect(Object.keys(FP.muatPeta().fakta).some((k) => k.startsWith("saksi."))).toBe(false);
  }, 30000);
});

// ============================================================================
describe("E. tanya jawab saksi/BAS membaca fakta bersama; koreksi petugas tidak menimpa", () => {
  const servis = require_(path.join(AKAR, "aleta_bot", "services", "isiJawabanSaksiService.js")) as { isiBaris: (o: any) => Record<string, any>; sertakanFaktaBersama: (f: any, b: any) => any };
  const baris = [
    { kunci: "itsbat-nikah/q-waktu-tempat/melihat", tanya: "Kapan dan di mana Pemohon I dan Pemohon II menikah?", jawab: "pada waktu itu saya berada di tempat kejadian dan melihat bahwa Pemohon I dan Pemohon II melangsungkan pernikahan di ... yaitu pada tanggal ..." },
    { kunci: "itsbat-nikah/q-saksi/melihat", tanya: "Siapa saja yang menjadi saksi nikah ketika akad nikah itu berlangsung?", jawab: "akad nikah itu disaksikan oleh dua orang saksi yaitu ... dan ..., dan hal itu saya lihat dengan mata kepala saya sendiri" },
  ];
  const dasarSaksi = { jenisPerkara: "360", alur: "16", pelaku: "Termohon", lawan: "Pemohon", saksiIsi: [{ kunci: "saksi 1 p", ke: 1, modus: "melihat", baris }] };
  const fakta = (kunci: string, nilai: string) => ({ label: kunci, tipe: "teks", nilai, yakin: "pasti", sumber: "isian petugas", kutipan: "Isian petugas", kode: [], kodeAsal: [], bertentangan: [], catatan: "", hanyaSaran: false });

  it("fakta bersama (satu sumber) menghasilkan jawaban yang SAMA dengan isian blangko yang bernilai sama", async () => {
    const bersama = await FP.faktaPerkara(777, {
      ...dasar,
      perkara: perkara({ jenis: 360, alur: 16 }),
      usulan: [
        { kode: "5197", nama: "Tgl nikah", nilai: "17 November 2025", keyakinan: "pasti", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] },
        { kode: "5105", nama: "Tempat", nilai: "Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah", keyakinan: "cukup", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] },
        { kode: "0650", nama: "Saksi nikah 1", nilai: "Azumar", keyakinan: "cukup", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] },
        { kode: "0651", nama: "Saksi nikah 2", nilai: "Luthfi Hakim", keyakinan: "cukup", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] },
      ],
    });
    const lewatBersama = servis.isiBaris({ ...dasarSaksi, faktaBersama: bersama });
    const lewatIsian = servis.isiBaris({
      ...dasarSaksi,
      isian: { "5197": { nilai: "17 November 2025", keyakinan: "pasti" }, "5105": { nilai: "Desa Lembantongoa, Kecamatan Palolo, Kabupaten Sigi, Provinsi Sulawesi Tengah", keyakinan: "cukup" }, "0650": { nilai: "Azumar" }, "0651": { nilai: "Luthfi Hakim" } },
    });
    expect(lewatBersama["itsbat-nikah/q-waktu-tempat/melihat"].teks).toContain("pada tanggal 17 November 2025");
    expect(lewatBersama["itsbat-nikah/q-saksi/melihat"].teks).toContain("yaitu Azumar dan Luthfi Hakim");
    expect(lewatBersama["itsbat-nikah/q-waktu-tempat/melihat"].teks).toBe(lewatIsian["itsbat-nikah/q-waktu-tempat/melihat"].teks);
    expect(lewatBersama["itsbat-nikah/q-saksi/melihat"].teks).toBe(lewatIsian["itsbat-nikah/q-saksi/melihat"].teks);
  });
  it("koreksi petugas pada fakta bersama menang atas SIPP dalam jawaban saksi", async () => {
    const f = await FP.faktaPerkara(777, {
      ...dasar,
      perkara: perkara({ jenis: 360, alur: 16 }),
      usulan: [{ kode: "5197", nama: "Tgl nikah", nilai: "17 November 2025", keyakinan: "pasti", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] }],
      isian: { "5197": "3 Desember 2025" },
    });
    expect(f.fakta["nikah.tanggal"].nilai).toBe("2025-12-03");
    const j = servis.isiBaris({ ...dasarSaksi, faktaBersama: f });
    expect(j["itsbat-nikah/q-waktu-tempat/melihat"].teks).toContain("3 Desember 2025");
    expect(j["itsbat-nikah/q-waktu-tempat/melihat"].teks).not.toContain("17 November 2025");
  });
  it("tanpa fakta bersama, jawaban sama seperti sebelumnya (pengisi lama tidak berubah)", () => {
    const a = servis.isiBaris({ ...dasarSaksi });
    const b = servis.isiBaris({ ...dasarSaksi, faktaBersama: null });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(servis.sertakanFaktaBersama(null, fakta("x", "y"))).toBeNull();
  });
});

describe("F. Blangko Derry: usulan kode setara hanya mengisi yang kosong", () => {
  const mesin = (() => {
    const g = globalThis as Record<string, unknown>;
    new Function(readFileSync(path.join(AKAR, "ekstensi-sipp", "isi-sipp-bersama.js"), "utf8"))();
    return g.AletaIsiSipp as {
      pilihPerKode: (s: any[][], boleh?: Set<string>) => Map<string, any>;
      rencanakan: (u: Map<string, any>, katalog: any[], keIso: (t: string) => string, semua: any[][]) => { tulis: Array<{ kode: string; nilai: string }>; saran: Array<{ kode: string }>; lewati: Array<{ kode: string; sebab: string }> };
    };
  })();
  const setara = async () =>
    (
      await FP.faktaPerkara(777, {
        ...dasar,
        perkara: perkara(),
        usulan: [{ kode: "5110", nama: "Nama anak", nilai: "Aisilah", keyakinan: "ragu", sumber: [{ saksi: 0, asal: "sipp", kalimat: "SIPP" }] }],
        isian: { "5110": "Aisilah Putri Ramadhani" },
      })
    ).usulanSetara;
  const katalog = (kosong: boolean) => [{ kode: "8603", nama: "Nama anak yang dimohonkan", jenis: "teks", opsi: [], kosong }];
  it("kode setara kosong -> ditulis dengan nilai koreksi petugas; sudah ada isinya -> tidak ditimpa", async () => {
    const u = await setara();
    expect(u).toHaveLength(1);
    const kosong = mesin.rencanakan(mesin.pilihPerKode([u]), katalog(true), (t) => t, [u]);
    expect(kosong.tulis).toEqual([expect.objectContaining({ kode: "8603", nilai: "Aisilah Putri Ramadhani" })]);
    const terisi = mesin.rencanakan(mesin.pilihPerKode([u]), katalog(false), (t) => t, [u]);
    expect(terisi.tulis).toEqual([]);
    expect(terisi.lewati).toContainEqual({ kode: "8603", sebab: "sudah ada isinya" });
  });
});
