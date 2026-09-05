// @vitest-environment node
import { describe, expect, it } from "vitest";

import { adukan, bacaKeadaan, adalahSubsidair, pilihTemplatAmar } from "@/lib/amar-petitum";
import { hitungBiaya, hitungPanggilan, kalimatBiaya, rupiah, terbilang } from "@/lib/biaya-perkara";
import { susunDudukPerkara } from "@/lib/duduk-perkara";
import { pilihButir } from "@/lib/pemilih-butir";
import { IRAH_IRAH, kepalaPutusan, naskahDariKerangka, susunKerangka } from "@/lib/susunan-putusan";
import type { Sidang } from "@/lib/rangkaian-sidang";

/**
 * Perakit putusan (F1-F6).
 *
 * ============================================================================
 * CONTOH DI SINI MENIRUKAN BENTUK NASKAH, BUKAN MENYATAKAN HUKUM
 * ============================================================================
 *
 * Bunyi petitum, amar, dan komponen biaya di bawah ditulis menyerupai bentuk
 * yang lazim supaya pemadanannya teruji. Angkanya karangan dan tidak boleh
 * dibaca sebagai tarif yang berlaku.
 *
 * ============================================================================
 * YANG DIJAGA
 * ============================================================================
 *
 * Tiga kekeliruan yang menghasilkan naskah rapi tetapi cacat:
 *
 *   - petitum yang terlewat tidak meninggalkan bekas di halaman;
 *   - butir bersyarat yang faktanya belum diketahui ikut terpakai; dan
 *   - tarif yang belum disetel menyumbang nol ke total tanpa mengeluh.
 */

// ── F1 susunan baku ────────────────────────────────────────────────────────

describe("susunan baku putusan", () => {
  it("urutan bagiannya tetap, apa pun urutan isian diberikan", () => {
    const kerangka = susunKerangka({
      amar: { isi: "MENGADILI" },
      kepala: { isi: "PUTUSAN" },
      penutup: { isi: "Demikian" },
    });
    expect(kerangka.bagian.map((item) => item.kunci)).toEqual([
      "kepala",
      "identitas",
      "dudukPerkara",
      "pertimbangan",
      "amar",
      "penutup",
    ]);
  });

  it("bagian yang tidak diisi TETAP muncul, dengan sebabnya", () => {
    // Bagian yang hilang dari naskah tidak terlihat siapa pun; bagian kosong
    // yang bertuliskan sebabnya terlihat pembaca pertama.
    const kerangka = susunKerangka({ kepala: { isi: "PUTUSAN" } });
    const duduk = kerangka.bagian.find((item) => item.kunci === "dudukPerkara")!;
    expect(duduk.isi).toBe("");
    expect(duduk.halangan).toContain("belum terisi");
    expect(naskahDariKerangka(kerangka)).toContain("[Duduk perkara belum terisi.]");
  });

  it("bagian wajib yang kosong menahan tanda tangan", () => {
    expect(susunKerangka({}).siapDitandatangani).toBe(false);
    const penuh = susunKerangka({
      kepala: { isi: "a" },
      identitas: { isi: "b" },
      dudukPerkara: { isi: "c" },
      pertimbangan: { isi: "d" },
      amar: { isi: "e" },
      penutup: { isi: "f" },
    });
    expect(penuh.siapDitandatangani).toBe(true);
    expect(penuh.belumTerisi).toEqual([]);
  });

  it("kepala putusan selalu memuat irah-irah", () => {
    // Ketiadaannya membatalkan putusan, jadi ia tidak diparameterkan.
    const kepala = kepalaPutusan({ nomorPerkara: "545/Pdt.G/2026/PA.Dgl", pengadilan: "Pengadilan Agama Donggala" });
    expect(kepala.isi).toContain(IRAH_IRAH);
  });

  it("nomor perkara kosong TIDAK menghasilkan kepala bernomor tanda hubung", () => {
    // Putusan bernomor "-" yang tercetak rapi akan terlanjur dibagikan.
    const kepala = kepalaPutusan({ nomorPerkara: "", pengadilan: "Pengadilan Agama Donggala" });
    expect(kepala.isi).toBeUndefined();
    expect(kepala.halangan).toContain("Nomor perkara");
  });
});

// ── F2 duduk perkara ───────────────────────────────────────────────────────

function sidang(sidangKe: number, tanggal: string, agenda = "Pembuktian"): Sidang {
  return {
    sidangKe,
    tanggal,
    hari: "",
    jam: "",
    agenda,
    ruangan: "",
    ditunda: false,
    alasanDitunda: "",
    tanggalDitunda: "",
    sebelumnya: null,
  };
}

const DUDUK_DASAR = {
  nomorPerkara: "545/Pdt.G/2026/PA.Dgl",
  tanggalDaftar: "2026-03-02",
  penggugat: "Reka Febrianti binti Rajab",
  tergugat: "Andi Saputra bin Yusuf",
  rangkaian: [sidang(1, "2026-04-01", "Pembacaan gugatan"), sidang(2, "2026-04-15")],
  catatan: [
    { sidangKe: 1, kehadiranPenggugat: "hadir", kehadiranTergugat: "tidak hadir", agenda: "Pembacaan gugatan", hasil: "sidang ditunda untuk pemanggilan ulang" },
    { sidangKe: 2, kehadiranPenggugat: "hadir", kehadiranTergugat: "tidak hadir", agenda: "Pembuktian", hasil: "" },
  ],
  saksi: [],
};

describe("duduk perkara dirangkai dari yang tercatat", () => {
  it("tiap sidang menjadi satu alinea, ditambah alinea pembuka", () => {
    const duduk = susunDudukPerkara(DUDUK_DASAR);
    expect(duduk.alinea).toHaveLength(3);
    expect(duduk.alinea[0].teks).toContain("didaftarkan");
    expect(duduk.teks).toContain("sidang ke-1");
    expect(duduk.teks).toContain("sidang ke-2");
  });

  it("kehadiran yang BELUM dicatat tidak ditulis sebagai hadir", () => {
    // Kalimat "para pihak hadir" benar pada kebanyakan sidang, dan justru
    // karena hampir selalu benar ia akan lolos pemeriksaan pada perkara yang
    // tergugatnya tidak pernah datang.
    const duduk = susunDudukPerkara({ ...DUDUK_DASAR, catatan: [] });
    expect(duduk.teks).not.toMatch(/Tergugat hadir/);
    expect(duduk.teks).toContain("belum dicatat");
    expect(duduk.kekurangan.join(" ")).toContain("kehadiran para pihak");
  });

  it("sidang diurutkan menurut nomornya, bukan urutan barisnya", () => {
    const acak = { ...DUDUK_DASAR, rangkaian: [sidang(2, "2026-04-15"), sidang(1, "2026-04-01")] };
    const nomor = susunDudukPerkara(acak)
      .alinea.filter((item) => item.sidangKe > 0)
      .map((item) => item.sidangKe);
    expect(nomor).toEqual([1, 2]);
  });

  it("sebutan pihak mengikuti jenis perkaranya", () => {
    const duduk = susunDudukPerkara({
      ...DUDUK_DASAR,
      sebutanPenggugat: "Pemohon",
      sebutanTergugat: "Termohon",
    });
    expect(duduk.alinea[0].teks).toContain("Pemohon Reka Febrianti");
    expect(duduk.alinea[0].teks).toContain("permohonan");
  });

  it("perkara tanpa sidang dinyatakan tanpa sidang", () => {
    const duduk = susunDudukPerkara({ ...DUDUK_DASAR, rangkaian: [], catatan: [] });
    expect(duduk.kekurangan.join(" ")).toContain("Belum ada satu pun sidang");
  });

  it("saksi yang lembarnya masih kosong disebut kekurangannya", () => {
    const duduk = susunDudukPerkara({
      ...DUDUK_DASAR,
      saksi: [{ sidangKe: 2, nama: "Hasan bin Umar", jumlahJawaban: 0 }],
    });
    expect(duduk.teks).toContain("Hasan bin Umar");
    expect(duduk.kekurangan.join(" ")).toContain("lembar keterangan saksi masih kosong");
  });
});

// ── F3 pemilihan butir ─────────────────────────────────────────────────────

const BUTIR = [
  { id: "b-umum", teks: "alinea pembuka", isu: "maksud", syarat: {}, jumlahPemakaian: 900 },
  { id: "b-verstek", teks: "alinea verstek", isu: "verstek", syarat: { tergugatHadir: false }, jumlahPemakaian: 400 },
  { id: "b-saksi", teks: "alinea saksi", isu: "pembuktian", syarat: { minimalSaksi: 2 }, jumlahPemakaian: 300 },
  { id: "b-biaya", teks: "alinea biaya", isu: "biaya", syarat: {}, jumlahPemakaian: 800 },
];

describe("pemilihan butir pertimbangan", () => {
  it("fakta yang TIDAK DIKETAHUI membuat butirnya tidak dipilih", () => {
    // Menganggapnya terpenuhi menghasilkan butir verstek pada perkara yang
    // tergugatnya hadir, hanya karena kehadirannya kebetulan belum tercatat.
    const hasil = pilihButir(BUTIR, { saksi: 2 });
    expect(hasil.terpilih.map((item) => item.butir.id)).not.toContain("b-verstek");
    const lewat = hasil.dilewati.find((item) => item.butir.id === "b-verstek")!;
    expect(lewat.karenaBelumDiketahui).toBe(true);
    expect(hasil.faktaKurang).toContain("tergugatHadir");
  });

  it("fakta yang diketahui dan bertentangan juga membuang butirnya, tetapi bukan karena tak diketahui", () => {
    const hasil = pilihButir(BUTIR, { tergugatHadir: true, saksi: 2 });
    const lewat = hasil.dilewati.find((item) => item.butir.id === "b-verstek")!;
    expect(lewat.karenaBelumDiketahui).toBe(false);
    expect(hasil.faktaKurang).not.toContain("tergugatHadir");
  });

  it("butir tanpa syarat selalu terpilih", () => {
    const hasil = pilihButir(BUTIR, {});
    expect(hasil.terpilih.map((item) => item.butir.id)).toEqual(["b-umum", "b-biaya"]);
  });

  it("minimal dibandingkan sebagai angka", () => {
    expect(pilihButir(BUTIR, { saksi: 1 }).terpilih.map((i) => i.butir.id)).not.toContain("b-saksi");
    expect(pilihButir(BUTIR, { saksi: 2 }).terpilih.map((i) => i.butir.id)).toContain("b-saksi");
  });

  it("urutannya urutan penalaran, bukan urutan popularitas", () => {
    // b-biaya dipakai 800 kali dan b-saksi 300, tetapi biaya dipertimbangkan
    // paling akhir. Naskah yang membahas biaya sebelum pembuktian akan
    // membuat pembacanya berhenti percaya pada seluruh naskah.
    const hasil = pilihButir(BUTIR, { tergugatHadir: false, saksi: 2 });
    expect(hasil.terpilih.map((item) => item.butir.id)).toEqual(["b-umum", "b-verstek", "b-saksi", "b-biaya"]);
  });

  it("urutan disebut di syarat mengalahkan urutan isu", () => {
    const khusus = [
      { id: "x", teks: "", isu: "biaya", syarat: { urutan: 1 }, jumlahPemakaian: 0 },
      { id: "y", teks: "", isu: "maksud", syarat: {}, jumlahPemakaian: 0 },
    ];
    expect(pilihButir(khusus, {}).terpilih.map((item) => item.butir.id)).toEqual(["x", "y"]);
  });

  it("dua perakitan atas fakta yang sama menghasilkan urutan yang sama", () => {
    // Tanpa pemutus terakhir yang tetap, riwayat versi mencatat perubahan
    // susunan yang tidak pernah diputuskan siapa pun.
    const seri = [
      { id: "b-kedua", teks: "", isu: "tak dikenal", syarat: {}, jumlahPemakaian: 5 },
      { id: "b-awal", teks: "", isu: "tak dikenal", syarat: {}, jumlahPemakaian: 5 },
    ];
    const satu = pilihButir(seri, {}).terpilih.map((item) => item.butir.id);
    const dua = pilihButir([...seri].reverse(), {}).terpilih.map((item) => item.butir.id);
    expect(satu).toEqual(dua);
    expect(satu).toEqual(["b-awal", "b-kedua"]);
  });
});

// ── F4 amar diadu dengan petitum ───────────────────────────────────────────

describe("amar diadu dengan petitum", () => {
  const petitum = [
    { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
    { nomor: 2, teks: "Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;" },
    { nomor: 3, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
    { nomor: 4, teks: "Atau apabila Majelis berpendapat lain, mohon putusan yang seadil-adilnya;" },
  ];

  it("petitum yang terlewat dilaporkan, bukan didiamkan", () => {
    // Infra petita tidak meninggalkan bekas apa pun di halaman - yang tampak
    // hanyalah amar berisi dua butir yang seluruhnya benar.
    const hasil = adukan(petitum, [
      { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
      { nomor: 2, teks: "Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;" },
    ]);
    expect(hasil.belumTerjawab.map((item) => item.nomor)).toEqual([3]);
    expect(hasil.halangan.join(" ")).toContain("Petitum 3 belum terjawab");
  });

  it("petitum subsidair tidak dihitung terlewat", () => {
    expect(adalahSubsidair("mohon putusan yang seadil-adilnya")).toBe(true);
    expect(adalahSubsidair("ex aequo et bono")).toBe(true);
    const hasil = adukan(petitum, [
      { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
      { nomor: 2, teks: "Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;" },
      { nomor: 3, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
    ]);
    expect(hasil.subsidair.map((item) => item.nomor)).toEqual([4]);
    expect(hasil.belumTerjawab).toEqual([]);
    expect(hasil.halangan).toEqual([]);
  });

  it("amar yang tidak menjawab satu pun petitum dilaporkan sebagai risiko ultra petita", () => {
    const hasil = adukan([{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }], [
      { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
      { nomor: 2, teks: "Menghukum Tergugat membayar nafkah madhiyah sejumlah lima juta rupiah;" },
    ]);
    expect(hasil.amarTanpaPetitum.map((item) => item.nomor)).toEqual([2]);
    expect(hasil.halangan.join(" ")).toContain("tidak menjawab satu pun petitum");
  });

  it("amar biaya perkara BUKAN ultra petita meskipun tanpa petitum", () => {
    // Biaya dijatuhkan karena undang-undang, bukan karena diminta.
    const hasil = adukan([{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }], [
      { nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" },
      { nomor: 2, teks: "Menghukum Penggugat untuk membayar biaya perkara sejumlah Rp 500.000,00;" },
    ]);
    expect(hasil.amarTanpaPetitum).toEqual([]);
  });

  it("satu butir amar hanya menjawab satu petitum", () => {
    // Tanpa aturan itu, satu amar bertele-tele "menjawab" lima petitum
    // sekaligus dan seluruh pemeriksaan kehilangan gunanya.
    const hasil = adukan(
      [
        { nomor: 1, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
        { nomor: 2, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" },
      ],
      [{ nomor: 1, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" }]
    );
    expect(hasil.belumTerjawab.map((item) => item.nomor)).toEqual([2]);
  });

  it("padanan yang lemah dinyatakan TIDAK berpadanan", () => {
    const hasil = adukan([{ nomor: 1, teks: "Menetapkan hak asuh anak bernama Aulia kepada Penggugat;" }], [
      { nomor: 1, teks: "Menjatuhkan talak satu bain sughra Tergugat terhadap Penggugat;" },
    ]);
    expect(hasil.belumTerjawab).toHaveLength(1);
    expect(hasil.padanan[0].amar).toBeNull();
  });

  it("petitumKe dari templat mengalahkan hitungan kata", () => {
    const hasil = adukan([{ nomor: 7, teks: "Menetapkan sesuatu yang bunyinya sama sekali berbeda;" }], [
      { nomor: 1, teks: "Menetapkan hak asuh anak;", petitumKe: 7 },
    ]);
    expect(hasil.belumTerjawab).toEqual([]);
    expect(hasil.padanan[0].disebutTemplat).toBe(true);
  });

  it("keadaan dibaca dari kata kerja amarnya", () => {
    expect(bacaKeadaan("Mengabulkan gugatan Penggugat")).toBe("dikabulkan");
    expect(bacaKeadaan("Menolak gugatan Penggugat")).toBe("ditolak");
    // "tidak dapat diterima" diperiksa lebih dulu: kalimatnya memuat keduanya.
    expect(bacaKeadaan("Menyatakan gugatan Penggugat tidak dapat diterima")).toBe("tidakDiterima");
  });

  it("petitum pertama yang lazim tetap berpadanan meski katanya umum belaka", () => {
    // Cacat yang pernah ada: kata "gugatan", "penggugat", dan "seluruhnya"
    // ikut dibuang sebagai kata umum, sehingga petitum ini kehilangan SELURUH
    // katanya dan dilaporkan terlewat pada hampir tiap perkara. Laporan palsu
    // yang muncul di setiap perkara mengajari petugas melewati daftar
    // halangan - dan sesudah itu, halangan yang sungguhan ikut terlewat.
    const hasil = adukan(
      [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }],
      [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }]
    );
    expect(hasil.belumTerjawab).toEqual([]);
    expect(hasil.padanan[0].skor).toBe(1);
  });

  it("kata kerja amar TIDAK ikut menghitung kemiripan", () => {
    // "Mengabulkan X" dan "Menolak X" menjawab petitum yang SAMA; yang
    // membedakannya adalah keadaan, bukan padanannya.
    const hasil = adukan(
      [{ nomor: 1, teks: "Mengabulkan gugatan Penggugat seluruhnya;" }],
      [{ nomor: 1, teks: "Menolak gugatan Penggugat seluruhnya;" }]
    );
    expect(hasil.belumTerjawab).toEqual([]);
    expect(hasil.padanan[0].keadaan).toBe("ditolak");
  });

  it("petitum atau amar yang belum ada disebut sebagai halangan", () => {
    expect(adukan([], []).halangan.join(" ")).toContain("Petitum belum tercatat");
    expect(adukan([{ nomor: 1, teks: "Mengabulkan;" }], []).halangan.join(" ")).toContain("Amar belum tersusun");
  });
});

describe("pemilihan templat amar", () => {
  const templat = [
    { id: "t1", nama: "Kabul Verstek Cerai Gugat", jenisPerkara: "Cerai Gugat", keadaan: "dikabulkan", aktif: true, isi: "..." },
    { id: "t2", nama: "Tolak Cerai Gugat", jenisPerkara: "Cerai Gugat", keadaan: "ditolak", aktif: true, isi: "..." },
    { id: "t3", nama: "Kabul Cerai Talak", jenisPerkara: "Cerai Talak", keadaan: "dikabulkan", aktif: true, isi: "..." },
  ];

  it("memilih menurut jenis perkara dan keadaannya", () => {
    const hasil = pilihTemplatAmar(templat, { jenisPerkara: "Cerai Gugat", keadaan: "dikabulkan" });
    expect(hasil.templat?.id).toBe("t1");
  });

  it("templat tidak aktif TIDAK dipakai meski satu-satunya yang cocok", () => {
    // Templat dimatikan karena ada yang salah padanya, dan "satu-satunya yang
    // ada" bukan alasan memakai yang sudah dinyatakan tidak boleh dipakai.
    const mati = [{ ...templat[0], aktif: false }];
    const hasil = pilihTemplatAmar(mati, { jenisPerkara: "Cerai Gugat", keadaan: "dikabulkan" });
    expect(hasil.templat).toBeNull();
    expect(hasil.sebab).toContain("aktif");
  });

  it("tidak ada yang cocok menghasilkan kosong beserta sebabnya, bukan templat terdekat", () => {
    const hasil = pilihTemplatAmar(templat, { jenisPerkara: "Itsbat Nikah", keadaan: "dikabulkan" });
    expect(hasil.templat).toBeNull();
    expect(hasil.sebab).toContain("Itsbat Nikah");
  });

  it("dua templat sama cocok tetap menghasilkan satu, dengan peringatan", () => {
    const kembar = [templat[0], { ...templat[0], id: "t1b", nama: "Kabul Verstek Cerai Gugat (lama)" }];
    const hasil = pilihTemplatAmar(kembar, { jenisPerkara: "Cerai Gugat", keadaan: "dikabulkan" });
    expect(hasil.templat).not.toBeNull();
    expect(hasil.sebab).toContain("Periksa sebelum ditandatangani");
  });
});

// ── F5 biaya perkara ───────────────────────────────────────────────────────

describe("biaya perkara dihitung", () => {
  const komponen = [
    { nama: "Pendaftaran", banyak: 1, tarif: 30000 },
    { nama: "Panggilan Penggugat", banyak: 2, tarif: 100000 },
    { nama: "Panggilan Tergugat", banyak: 3, tarif: 150000 },
    { nama: "Redaksi", banyak: 1, tarif: 10000 },
    { nama: "Meterai", banyak: 1, tarif: 10000 },
  ];

  it("total dijumlahkan dari rinciannya", () => {
    const hasil = hitungBiaya(komponen, 700000);
    expect(hasil.ok).toBe(true);
    expect(hasil.total).toBe(30000 + 200000 + 450000 + 10000 + 10000);
    expect(hasil.totalRupiah).toBe("Rp 700.000,00");
  });

  it("tarif yang BELUM DISETEL menghentikan perhitungan, tidak dianggap nol", () => {
    // Rp 0 tetap berupa angka rupiah yang rapi, tetap terbilang dengan benar,
    // tetap tercetak tanpa keluhan. Kekurangannya baru ketahuan di kasir.
    const hasil = hitungBiaya([...komponen, { nama: "Panggilan luar wilayah", banyak: 1, tarif: null }]);
    expect(hasil.ok).toBe(false);
    expect(hasil.total).toBe(0);
    expect(hasil.totalRupiah).toBe("");
    expect(hasil.halangan.join(" ")).toContain('Tarif "Panggilan luar wilayah" belum disetel');
  });

  it("komponen yang banyaknya nol tidak menuntut tarif", () => {
    // Perkara tanpa saksi tidak boleh terhalang tarif sumpah yang tidak
    // relevan baginya.
    const hasil = hitungBiaya([...komponen, { nama: "Sumpah", banyak: 0, tarif: null }], 700000);
    expect(hasil.ok).toBe(true);
  });

  it("selisih terhadap panjar dinyatakan, bukan didiamkan", () => {
    expect(hitungBiaya(komponen, 800000).arahSelisih).toBe("sisa");
    expect(hitungBiaya(komponen, 800000).selisih).toBe(100000);
    expect(hitungBiaya(komponen, 500000).arahSelisih).toBe("kurang");
    expect(hitungBiaya(komponen, 700000).arahSelisih).toBe("");
  });

  it("kalimat amar memuat angka dan terbilangnya sekaligus", () => {
    const hasil = hitungBiaya(komponen, 700000);
    const kalimat = kalimatBiaya(hasil, "Penggugat");
    expect(kalimat).toContain("Rp 700.000,00");
    expect(kalimat).toContain("(tujuh ratus ribu rupiah)");
  });

  it("perhitungan yang terhalang TIDAK menghasilkan kalimat amar", () => {
    const gagal = hitungBiaya([{ nama: "Panggilan", banyak: 1, tarif: null }]);
    expect(kalimatBiaya(gagal, "Penggugat")).toBe("");
  });

  it("panggilan dihitung dari relaas, bukan dari jumlah sidang", () => {
    // Sidang yang para pihaknya sudah hadir tidak didahului panggilan baru.
    const peta = hitungPanggilan([
      { pihak: "Penggugat", tanggal: "2026-03-20" },
      { pihak: "Tergugat", tanggal: "2026-03-20" },
      { pihak: "Tergugat", tanggal: "2026-04-05" },
    ]);
    expect(peta.get("Penggugat")).toBe(1);
    expect(peta.get("Tergugat")).toBe(2);
  });
});

describe("terbilang", () => {
  it("bentuk se- dipakai sebagaimana ditulis di amar", () => {
    // "satu ribu rupiah" pada amar putusan akan dikoreksi pembanding.
    expect(terbilang(11)).toBe("sebelas");
    expect(terbilang(100)).toBe("seratus");
    expect(terbilang(1000)).toBe("seribu");
    expect(terbilang(1500)).toBe("seribu lima ratus");
  });

  it("angka besar tersusun sampai satuan terkecilnya", () => {
    expect(terbilang(0)).toBe("nol");
    expect(terbilang(19)).toBe("sembilan belas");
    expect(terbilang(21)).toBe("dua puluh satu");
    expect(terbilang(700000)).toBe("tujuh ratus ribu");
    expect(terbilang(2_345_678)).toBe("dua juta tiga ratus empat puluh lima ribu enam ratus tujuh puluh delapan");
    expect(terbilang(1_000_000_000)).toBe("satu miliar");
  });

  it("rupiah ditulis dengan titik ribuan dan koma desimal", () => {
    expect(rupiah(1234567)).toBe("Rp 1.234.567,00");
    expect(rupiah(0)).toBe("Rp 0,00");
  });
});
