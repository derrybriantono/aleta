// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import {
  TITIK_NAMA,
  TITIK_NIP,
  formatNip,
  pilihTataLetak,
  susunBarisKop,
  susunNaskahEvidenSkp,
  tempatDariInstansi,
  type NaskahEvidenSkp,
  type OpsiNaskahEvidenSkp,
} from "@/lib/eviden-skp-cetak";
import type { DokumenEvidenSkp, PaketEvidenSkp } from "@/lib/eviden-skp-tipe";
import {
  bersihkanNamaBerkas,
  judulTanpaPeriode,
  namaBerkasEvidenSkp,
  namaZipEvidenSkp,
} from "@/lib/eviden-skp-unduh";
import { gambarDocxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-docx";
import { gambarPdfEvidenSkp, type HasilPdfEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-pdf";
import { KOLOM_STATUS_PERKARA } from "@/lib/eviden-skp-katalog";
import {
  hitungLebarKolom,
  hurufUkur,
  lebarTeks,
  pecahBaris,
  pecahSel,
  ruangSelTabel,
  siapkanTeksPdf,
} from "@/server/modules/aleta-ecourt/eviden-skp-ukur";
import { gambarXlsxEvidenSkp } from "@/server/modules/aleta-ecourt/eviden-skp-xlsx";

import { bacaPdfUji, bacaZip, uraiXml, type HalamanPdfUji } from "./eviden-skp-baca";
import {
  INSTANSI_CONTOH,
  dokumenKosongContoh,
  dokumenRekapContoh,
  dokumenStatusContoh,
  paketContoh,
} from "./eviden-skp-contoh";

/**
 * ============================================================================
 * PENGGAMBAR EVIDEN SKP - PDF, EXCEL, WORD DARI SATU NASKAH
 * ============================================================================
 *
 * Berkas yang dihasilkan DIBUKA, bukan dipercaya: PDF dibaca pdfjs-dist
 * (jumlah halaman, teks, letak, lebar), XLSX dan DOCX dibuka sebagai ZIP dan
 * tiap XML-nya diurai pengurai XML yang ketat. Yang dijaga:
 *
 *   - kop dari pengaturan instansi, dan ruas yang kosong TIDAK dikarang;
 *   - tanda tangan: kiri orang yang membuat, kanan Ketua yang mengetahui;
 *     Ketua yang tidak terbaca menjadi titik-titik, bukan nama tebakan;
 *   - tidak ada teks tabel PDF yang melewati garis kolomnya - diukur dengan
 *     lebar huruf pdf-lib dan dicocokkan dengan letak yang dibaca pdfjs;
 *   - kepala tabel rincian ada di SETIAP halaman tabelnya;
 *   - A4 mendatar bawaan, F4 mendatar untuk tabel lebih dari 12 kolom;
 *   - huruf yang tidak dapat dicetak huruf baku PDF ditandai dan dilaporkan.
 *
 * Datanya karangan (eviden-skp-contoh.ts), mengikuti kontrak eviden-skp-tipe.
 */

const LOGO = readFileSync(path.join(process.cwd(), "public", "mahkamah-agung-logo.png"));
const OPSI: OpsiNaskahEvidenSkp = {
  instansi: INSTANSI_CONTOH,
  tanggalTandaTangan: "2026-06-30",
  sebutanOrang: "Hakim",
  logo: LOGO,
};

const naskah = (paket: PaketEvidenSkp, dokumen: DokumenEvidenSkp, opsi: Partial<OpsiNaskahEvidenSkp> = {}): NaskahEvidenSkp =>
  susunNaskahEvidenSkp(paket, dokumen, { ...OPSI, ...opsi });

const cm = (n: number) => (n / 2.54) * 72;

// ============================================================================
// NASKAH
// ============================================================================

describe("naskah - kop dari pengaturan instansi, tidak dikarang", () => {
  it("baris kop: Mahkamah Agung, nama satker, alamat, dan kontak dari pengaturan", () => {
    const baris = susunBarisKop(INSTANSI_CONTOH).map((b) => b.teks);
    expect(baris).toEqual([
      "MAHKAMAH AGUNG REPUBLIK INDONESIA",
      "PENGADILAN AGAMA DONGGALA",
      "Jalan Contoh Nomor 1, Kabupaten Donggala, Sulawesi Tengah",
      "Telepon (0457) 000000  ·  Surel surel.contoh@pa-contoh.go.id  ·  Laman www.pa-contoh.go.id",
    ]);
  });

  it("ruas yang kosong dilewati - tidak ada telepon, surel, atau alamat karangan", () => {
    const baris = susunBarisKop({ courtName: "Pengadilan Agama Donggala", address: "", phoneNumber: "", mobilePhone: "", email: "", website: "" });
    expect(baris.map((b) => b.teks)).toEqual(["MAHKAMAH AGUNG REPUBLIK INDONESIA", "PENGADILAN AGAMA DONGGALA"]);
    expect(susunBarisKop(null)).toEqual([]);
  });

  it("telepon kantor lebih dahulu; nomor seluler hanya bila telepon kantor kosong", () => {
    expect(susunBarisKop({ ...INSTANSI_CONTOH, phoneNumber: "" }).at(-1)?.teks).toContain("Telepon 0822-0000-0000");
    expect(susunBarisKop(INSTANSI_CONTOH).at(-1)?.teks).not.toContain("0822");
  });

  it("tempat tanda tangan dari nama satker; nama yang tidak berpola tidak ditebak", () => {
    expect(tempatDariInstansi(INSTANSI_CONTOH)).toBe("Donggala");
    expect(tempatDariInstansi({ courtName: "Pengadilan Agama Makassar Kelas IA" })).toBe("Makassar");
    expect(tempatDariInstansi({ courtName: "Satuan Kerja Uji" })).toBe("Donggala");
    expect(tempatDariInstansi(null)).toBe("Donggala");
  });

  it("NIP 18 angka ditulis berkelompok; yang lain apa adanya", () => {
    expect(formatNip("199001012015031001")).toBe("19900101 201503 1 001");
    expect(formatNip("1990 0101 2015 0310 01")).toBe("19900101 201503 1 001");
    expect(formatNip("12345")).toBe("12345");
    expect(formatNip(null)).toBe("");
  });
});

describe("naskah - tanda tangan kiri pembuat, kanan Ketua", () => {
  it("kiri: sebutan orangnya; kanan: tempat-tanggal, Mengetahui, jabatan Ketua - nama sebaris", () => {
    const n = naskah(paketContoh(), dokumenRekapContoh());
    expect(n.tandaTangan.kiri.atas).toEqual(["", "", "Hakim yang bersangkutan,"]);
    expect(n.tandaTangan.kanan.atas).toEqual(["Donggala, 30 Juni 2026", "Mengetahui,", "Ketua Pengadilan Agama Donggala,"]);
    expect(n.tandaTangan.kiri).toMatchObject({ nama: "Hakim Contoh Ma’ruf, S.H.I., M.H.", namaTerisi: true, nip: "NIP. 19900101 201503 1 001" });
    expect(n.tandaTangan.kanan).toMatchObject({ nama: "Dr. Ketua Contoh, S.Ag., M.H.", namaTerisi: true, nip: "NIP. 19700101 199503 1 002" });
  });

  it("penggambar tidak terikat peran: sebutannya datang dari pemanggil", () => {
    const n = naskah(paketContoh(), dokumenRekapContoh(), { sebutanOrang: "Panitera Pengganti" });
    expect(n.tandaTangan.kiri.atas.at(-1)).toBe("Panitera Pengganti yang bersangkutan,");
  });

  it("Ketua tidak terbaca: titik-titik, jabatannya dari nama satker", () => {
    const n = naskah(paketContoh({ ketua: null }), dokumenRekapContoh());
    expect(n.tandaTangan.kanan).toMatchObject({ nama: TITIK_NAMA, namaTerisi: false, nip: TITIK_NIP });
    expect(n.tandaTangan.kanan.atas.at(-1)).toBe("Ketua Pengadilan Agama Donggala,");
    const tanpaInstansi = naskah(paketContoh({ ketua: null }), dokumenRekapContoh(), { instansi: null });
    expect(tanpaInstansi.tandaTangan.kanan.atas).toEqual(["Donggala, 30 Juni 2026", "Mengetahui,", "Ketua Pengadilan Agama Donggala,"]);
  });

  it("NIP orang yang kosong: titik-titik, bukan \"NIP. -\"", () => {
    const paket = paketContoh();
    const n = naskah({ ...paket, orang: { ...paket.orang, nip: null } }, dokumenRekapContoh());
    expect(n.tandaTangan.kiri.nip).toBe(TITIK_NIP);
    expect(n.identitas.find((i) => i.label === "NIP")?.nilai).toBe("-");
  });
});

describe("naskah - identitas, catatan, dan kertas", () => {
  it("identitas lima baris + RHK; unit kerja dari pengaturan instansi", () => {
    const n = naskah(paketContoh(), dokumenRekapContoh());
    expect(n.identitas.map((i) => i.label)).toEqual(["Nama", "NIP", "Pangkat/Golongan", "Jabatan", "Unit Kerja", "Rencana Hasil Kerja"]);
    expect(n.identitas.find((i) => i.label === "Unit Kerja")?.nilai).toBe("Pengadilan Agama Donggala");
  });

  it("catatan memuat aturan periode, error data SIPP, dan waktu baca WITA", () => {
    const n = naskah(paketContoh(), dokumenRekapContoh());
    expect(n.catatan[0]).toContain("Perkara masuk periode");
    expect(n.catatan).toContain("Tidak terbaca dari SIPP: Tanggal musyawarah majelis tidak tercatat di SIPP untuk 3 perkara.");
    // 05:40 UTC = 13.40 WITA.
    expect(n.catatan.at(-1)).toBe("Data dibaca ALETA dari SIPP pada 27 September 2026 pukul 13.40 WITA.");
  });

  it("A4 mendatar sampai 12 kolom; F4 mendatar dan huruf kecil untuk kumulasi 25 kolom", () => {
    expect(pilihTataLetak(8)).toMatchObject({ kertas: "A4", ukuranTabel: 8.5 });
    expect(pilihTataLetak(12).kertas).toBe("A4");
    expect(pilihTataLetak(13).kertas).toBe("F4");
    expect(pilihTataLetak(25)).toMatchObject({ kertas: "F4", ukuranTabel: 6 });
  });
});

// ============================================================================
// PENGUKUR
// ============================================================================

describe("pengukur - tiap baris dijamin muat", () => {
  it("kata yang lebih lebar dari kolom dipotong - di garis miring bila bisa", async () => {
    const { biasa } = await hurufUkur();
    const baris = pecahBaris(biasa, "1000/Pdt.G/2026/PA.Dgl", 6, lebarTeks(biasa, "1000/Pdt.G/2026", 6));
    expect(baris).toEqual(["1000/Pdt.G/", "2026/PA.Dgl"]);
  });

  it("tidak ada baris yang melewati lebar, untuk lebar sempit mana pun", async () => {
    const { biasa, tebal } = await hurufUkur();
    const teks = [
      "Nurhayati binti Lamasigi Abdul Rahman Daeng Mappagau bin Haji Muhammad Saleh Lasulo",
      "1234/Pdt.G/2026/PA.Dgl 01-04-2026 Siti Ma’rifah & <Bersama>",
      "Hakimcontohsangatpanjangtanpaspasisamasekaliyangtidakpernahputus",
    ];
    for (const font of [biasa, tebal]) {
      for (const ukuran of [6, 8.5, 10]) {
        for (const lebar of [12, 20, 33, 57, 140]) {
          for (const t of teks) {
            for (const b of pecahSel(font, t, ukuran, lebar).baris) {
              const w = lebarTeks(font, b, ukuran);
              if (b.length > 1) expect(w, `"${b}" @${ukuran}pt dalam ${lebar}`).toBeLessThanOrEqual(lebar + 1e-9);
            }
          }
        }
      }
    }
  });

  it("lebar diukur TANPA kerning - seperti yang digambar drawText pdf-lib", async () => {
    // widthOfTextAtSize mengurangi kerning "Ta"; Tj yang ditulis drawText tidak.
    const { biasa } = await hurufUkur();
    const perHuruf = [..."Tanggal"].reduce((j, k) => j + biasa.widthOfTextAtSize(k, 10), 0);
    expect(lebarTeks(biasa, "Tanggal", 10)).toBeCloseTo(perHuruf, 9);
    expect(lebarTeks(biasa, "Tanggal", 10)).toBeGreaterThan(biasa.widthOfTextAtSize("Tanggal", 10));
  });

  it("padanan huruf dipasang, sisanya ditandai dan dihitung", async () => {
    const { biasa } = await hurufUkur();
    expect(siapkanTeksPdf(biasa, "putus ≤ 150 hari − Ma’ruf")).toEqual({ teks: "putus <= 150 hari - Ma’ruf", hilang: 0 });
    expect(siapkanTeksPdf(biasa, "Şükrü")).toEqual({ teks: "Sükrü", hilang: 0 });
    expect(siapkanTeksPdf(biasa, "Ahmad ﺩﺭﺀ")).toEqual({ teks: "Ahmad [?][?][?]", hilang: 3 });
  });

  it("lebar kolom: jumlahnya tepat selebar ruang, dan kata judul kolom tidak terpenggal", async () => {
    const huruf = await hurufUkur();
    const dok = dokumenStatusContoh();
    const W = 935.43 - 2 * cm(1.5);
    // Ruang sel yang sama dengan penggambar (tabel padat: lebih tipis).
    const ruang = 2 * ruangSelTabel(dok.tabel.kolom.length);
    const lebar = hitungLebarKolom({ kolom: dok.tabel.kolom, baris: dok.tabel.baris, lebarTersedia: W, ukuran: 6, huruf, ruang });
    expect(lebar.reduce((a, b) => a + b, 0)).toBeCloseTo(W, 6);
    dok.tabel.kolom.forEach((k, i) => {
      for (const kata of k.judul.split(/\s+/)) {
        expect(lebarTeks(huruf.tebal, kata, 6), `judul "${k.judul}"`).toBeLessThanOrEqual(lebar[i] - ruang + 1e-9);
      }
    });
    // Tanggal utuh sebaris di SETIAP kolom bertanggal - termasuk "PMH" dan "BHT"
    // yang judulnya jauh lebih sempit dari tanggalnya ("01-/04-/2026" dulu).
    for (const judul of ["Tanggal Daftar", "PMH", "BHT", "Minutasi"]) {
      const i = dok.tabel.kolom.findIndex((k) => k.judul === judul);
      expect(pecahSel(huruf.biasa, "01-04-2026", 6, lebar[i] - ruang).baris, judul).toEqual(["01-04-2026"]);
    }
  });
});

describe("pengukur - tabel padat 25 kolom berbentuk SIPP (kolom katalog sungguhan)", () => {
  // Bentuk isi diambil dari hasil SIPP lokal hakim_id 31 Triwulan II 2026:
  // alamat Direktori 106 titik tanpa spasi, majelis tiga baris, nama panjang.
  const ISI: Record<string, (i: number) => string> = {
    no: (i) => String(i + 1),
    nomor: (i) => `${600 + i}/Pdt.G/2026/PA.Dgl`,
    jenis: (i) => ["Cerai Gugat", "Kewarisan", "P3HP/Penetapan Ahli Waris", "Cerai Talak"][i % 4],
    daftar: (i) => `${String((i % 27) + 1).padStart(2, "0")}/01/2026`,
    pihak: (i) =>
      i % 2
        ? "Penggugat:\nWinarsih alias Winarsi binti Basri\nTergugat:\nSiswanto alias Bramin Siswanto bin Asgar alias Asgar Jalinasi"
        : "Pemohon:\nHasan A. alias Hasanudin bin Hiase alias Arase\nTermohon:\nSunarti binti Mad alias Made",
    majelis: () =>
      "Hakim Ketua: Himawan Tatura Wijaya, S.H.I.,M.H.\nHakim Anggota 1: Idris, S.H.I., M.H.\nHakim Anggota 2: Derry Briantono, S.H.",
    panitera: (i) => ["Qadariyah, S.H.", "Unun Fidiyasari Patangai, S.H.", "Sitti Nurhidayah, S.H.I., M.H."][i % 3],
    // Nama panjang yang JARANG: pengoptimal tinggi saja rela memenggalnya
    // (untungnya kecil), batas bawah kata-utuh tidak.
    jurusita: (i) => (i === 0 ? "Andriansyahputra Mokodompit" : ["Mohammad Syukri", "Tanty Restianty", "Mustini"][i % 3]),
    musyawarah: (i) => (i % 3 ? "-" : "Terlaksana MM"),
    durasi: (i) => String(60 + i),
    mediasi: (i) => ["-", "Tidak Berhasil", "Berhasil Sebagian"][i % 3],
    putusan: (i) => (i % 5 ? "Putus (Dikabulkan)" : "Putus (Digugurkan)"),
    minutasi: () => "Telah Di Minutasi",
    ikrar: (i) => (i % 7 ? "-" : "Telah Ikrar Talak"),
    ecourt: () => "E-Court",
    unggah: () => "Telah Di Upload",
    anonimisasi: () => "Telah Di Anonimisasi",
    direktori: (i) => `http://putusan.mahkamahagung.go.id/putusan/zaf149e60ca1c82a81493134323${String(63232 + i)}`,
  };
  const baris = Array.from({ length: 60 }, (_, i) =>
    Object.fromEntries(KOLOM_STATUS_PERKARA.map((k) => [k.kunci, (ISI[k.kunci] ?? (() => "-"))(i)]))
  );
  const W = 935.43 - 2 * cm(1.5);

  it("judul utuh, TIDAK ADA kata biasa terpenggal di tengah, dan tabel tidak lebih tinggi daripada bagi-bobot", async () => {
    const huruf = await hurufUkur();
    const ruang = 2 * ruangSelTabel(KOLOM_STATUS_PERKARA.length);
    const lebar = hitungLebarKolom({ kolom: KOLOM_STATUS_PERKARA, baris, lebarTersedia: W, ukuran: 6, huruf, ruang });
    expect(lebar.reduce((a, b) => a + b, 0)).toBeCloseTo(W, 6);

    const tinggi = (w: number[]) =>
      baris.reduce(
        (j, b) => j + Math.max(...KOLOM_STATUS_PERKARA.map((k, i) => pecahSel(huruf.biasa, b[k.kunci], 6, w[i] - ruang).baris.length)),
        0
      );
    KOLOM_STATUS_PERKARA.forEach((k, i) => {
      for (const kata of k.judul.split(/\s+/)) {
        expect(lebarTeks(huruf.tebal, kata, 6), `judul "${k.judul}"`).toBeLessThanOrEqual(lebar[i] - ruang + 1e-9);
      }
      for (const b of baris) {
        const potongan = new Set(pecahSel(huruf.biasa, b[k.kunci], 6, lebar[i] - ruang).baris.flatMap((x) => x.split(" ")));
        for (const kata of b[k.kunci].split(/\s+/).filter((x) => x && !/[/-]/.test(x))) {
          expect(potongan.has(kata), `"${kata}" di kolom ${k.judul} terpenggal`).toBe(true);
        }
      }
    });
    // Pembanding: lebar murni menurut bobot (cara lama saat batas bawah tidak muat).
    const jumlahBobot = KOLOM_STATUS_PERKARA.reduce((j, k) => j + (k.bobot ?? 1), 0);
    const bagiBobot = KOLOM_STATUS_PERKARA.map((k) => (W * (k.bobot ?? 1)) / jumlahBobot);
    expect(tinggi(lebar)).toBeLessThanOrEqual(tinggi(bagiBobot));
  });
});

// ============================================================================
// PDF
// ============================================================================

describe("PDF", () => {
  let rekap: HasilPdfEvidenSkp;
  let rekapHal: HalamanPdfUji[];
  let status: HasilPdfEvidenSkp;
  let statusHal: HalamanPdfUji[];

  beforeAll(async () => {
    const paket = paketContoh();
    rekap = await gambarPdfEvidenSkp(naskah(paket, dokumenRekapContoh()), { catatUkuran: true });
    rekapHal = await bacaPdfUji(rekap.berkas);
    status = await gambarPdfEvidenSkp(naskah(paket, dokumenStatusContoh()), { catatUkuran: true });
    statusHal = await bacaPdfUji(status.berkas);
  });

  it("sah dan terbaca pdfjs: jumlah halaman sama dengan yang dilaporkan", () => {
    expect(rekap.berkas.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(rekapHal.length).toBe(rekap.jumlahHalaman);
    expect(rekap.jumlahHalaman).toBeGreaterThan(1);
    expect(statusHal.length).toBe(status.jumlahHalaman);
  });

  it("A4 mendatar untuk rekap 8 kolom; F4 mendatar untuk kumulasi 25 kolom", () => {
    for (const h of rekapHal) {
      expect(h.lebar).toBeCloseTo(841.89, 1);
      expect(h.tinggi).toBeCloseTo(595.28, 1);
    }
    for (const h of statusHal) {
      expect(h.lebar).toBeCloseTo(935.43, 1);
      expect(h.tinggi).toBeCloseTo(609.45, 1);
    }
  });

  it("halaman pertama: kop, judul, periode, dan identitas", () => {
    const t = rekapHal[0].teks;
    for (const s of [
      "MAHKAMAH AGUNG REPUBLIK INDONESIA",
      "PENGADILAN AGAMA DONGGALA",
      "Jalan Contoh Nomor 1, Kabupaten Donggala, Sulawesi Tengah",
      "REKAP PERKARA",
      "Triwulan II Tahun 2026",
      "1 April 2026 s.d. 30 Juni 2026",
      "Hakim Contoh Ma’ruf, S.H.I., M.H.",
      "19900101 201503 1 001",
      "Penata Muda Tingkat I / III/b",
      "Realisasi Indikator Kinerja",
      "Rincian (18)",
    ]) {
      expect(t, s).toContain(s);
    }
  });

  it("halaman terakhir: tanda tangan kiri hakim, kanan Ketua - utuh dalam satu halaman", () => {
    const t = rekapHal.at(-1)!.teks;
    for (const s of [
      "Hakim yang bersangkutan,",
      "Donggala, 30 Juni 2026",
      "Mengetahui,",
      "Ketua Pengadilan Agama Donggala,",
      "Dr. Ketua Contoh, S.Ag., M.H.",
      "NIP. 19700101 199503 1 002",
      "NIP. 19900101 201503 1 001",
    ]) {
      expect(t, s).toContain(s);
    }
    // Kiri benar-benar di kiri, kanan di kanan.
    const pot = rekapHal.at(-1)!.potongan;
    const xHakim = pot.find((p) => p.str === "Hakim yang bersangkutan,")!.x;
    const xMengetahui = pot.find((p) => p.str === "Mengetahui,")!.x;
    expect(xHakim).toBeLessThan(841.89 / 2);
    expect(xMengetahui).toBeGreaterThan(841.89 / 2);
    // Nama sebaris.
    const yNamaKiri = pot.find((p) => p.str === "Hakim Contoh Ma’ruf, S.H.I., M.H.")!;
    const yNamaKanan = pot.find((p) => p.str === "Dr. Ketua Contoh, S.Ag., M.H.")!;
    expect(yNamaKiri.y).toBeCloseTo(yNamaKanan.y, 3);
  });

  it("\"Halaman x dari y\" di setiap halaman", () => {
    rekapHal.forEach((h, i) => expect(h.teks).toContain(`Halaman ${i + 1} dari ${rekapHal.length}`));
    statusHal.forEach((h, i) => expect(h.teks).toContain(`Halaman ${i + 1} dari ${statusHal.length}`));
  });

  it("kepala tabel rincian diulang di setiap halaman tabelnya", () => {
    // Diperiksa per KATA judul: judul boleh dilipat (kolomnya sempit), tetapi
    // katanya dijamin tidak terpenggal.
    for (const [hasil, halaman, judul] of [
      [rekap, rekapHal, ["Nomor", "Perkara", "Para", "Pihak", "Status"]],
      [status, statusHal, ["Penggugat/Pemohon", "Majelis", "Direktori"]],
    ] as const) {
      const rincian = hasil.tabel.find((t) => t.tabel === "rincian")!;
      expect(rincian.halaman.length).toBeGreaterThan(1);
      for (const nomor of rincian.halaman) {
        for (const j of judul) expect(halaman[nomor - 1].teks, `hal ${nomor}: ${j}`).toContain(j);
      }
    }
  });

  it("TIDAK ADA teks tabel yang melewati garis kolomnya - diukur pdf-lib, dicocokkan pdfjs", () => {
    for (const [hasil, halaman] of [
      [rekap, rekapHal],
      [status, statusHal],
    ] as const) {
      expect(hasil.teksSel.length).toBeGreaterThan(100);
      for (const t of hasil.teksSel) {
        expect(t.x, `"${t.teks}" keluar kiri`).toBeGreaterThanOrEqual(t.batasKiri - 0.01);
        expect(t.x + t.lebar, `"${t.teks}" keluar kanan`).toBeLessThanOrEqual(t.batasKanan + 0.01);
      }
      // Yang dicatat penggambar memang yang tertulis di berkas: setiap teks sel
      // ditemukan pdfjs di halaman dan letak yang sama, dengan lebar yang SAMA
      // (pengukur menjumlah lebar per huruf tanpa kerning, persis seperti Tj
      // yang ditulis pdf-lib), dan menurut pdfjs pun tidak melewati batas dalam
      // sel, apalagi garis kolomnya.
      let cocok = 0;
      for (const t of hasil.teksSel) {
        const p = halaman[t.halaman - 1].potongan.find((x) => Math.abs(x.x - t.x) < 0.05 && Math.abs(x.y - t.y) < 0.05 && x.str === t.teks);
        if (!p) continue;
        cocok += 1;
        expect(Math.abs(p.lebar - t.lebar), `"${t.teks}" lebar menurut pdfjs`).toBeLessThanOrEqual(t.lebar * 0.001 + 0.02);
        expect(p.x, `"${t.teks}" menurut pdfjs`).toBeGreaterThanOrEqual(t.batasKiri - 0.02);
        expect(p.x + p.lebar, `"${t.teks}" menurut pdfjs`).toBeLessThanOrEqual(t.batasKanan + 0.02);
        expect(p.x + p.lebar).toBeLessThan(t.garisKanan);
      }
      expect(cocok).toBe(hasil.teksSel.length);
      // Kolom memenuhi lebar isi halaman, tidak lebih.
      const rincian = hasil.tabel.find((x) => x.tabel === "rincian")!;
      const [lebarHal] = hasil.ukuranHalaman;
      expect(rincian.kolom[0].x0).toBeCloseTo(cm(1.5), 3);
      expect(rincian.kolom.at(-1)!.x1).toBeCloseTo(lebarHal - cm(1.5), 3);
    }
  });

  it("isi tabel tidak hilang: setiap nilai sel ada di PDF (dilipat boleh, terpotong tidak)", () => {
    const semua = statusHal.map((h) => h.potongan.map((p) => p.str).join("")).join("").replace(/\s+/g, "");
    const dok = dokumenStatusContoh();
    for (const b of dok.tabel.baris) {
      for (const k of dok.tabel.kolom) {
        const nilai = (b[k.kunci] ?? "").replace(/ﺩﺭﺀ/g, "[?][?][?]").replace(/\s+/g, "");
        expect(semua, nilai).toContain(nilai);
      }
    }
  });

  it("huruf yang tidak dapat dicetak ditandai \"[?]\" dan disebut di catatan PDF itu sendiri", () => {
    expect(status.hurufTakTercetak).toBe(3);
    const t = statusHal.map((h) => h.teks).join("\n");
    // Selnya dilipat; urutan potongannya tetap.
    expect(t.replace(/\s+/g, "")).toContain("Ahmadbin[?][?][?]Abdullah");
    expect(t).toMatch(/3 huruf tidak dapat dicetak huruf PDF/);
    // Padanan bukan kehilangan: ≤ menjadi <=, tanda kutip melengkung utuh.
    expect(rekap.hurufTakTercetak).toBe(0);
    const tr = rekapHal.map((h) => h.teks).join("\n");
    expect(tr).toContain("11 dari 12 perkara putus <= 150 hari sejak didaftarkan");
    expect(tr).toContain("Siti Ma’rifah binti La Ode Muhammad Ali");
    expect(tr).not.toContain("[?]");
  });

  it("tabel tanpa baris tetap berkepala dan menyebut kosongnya", async () => {
    const h = await bacaPdfUji((await gambarPdfEvidenSkp(naskah(paketContoh(), dokumenKosongContoh()))).berkas);
    expect(h.length).toBe(1);
    expect(h[0].teks).toContain("Tidak ada data pada periode ini.");
    expect(h[0].teks).toContain("Rincian (0)");
  });

  it("Ketua dan instansi tidak terbaca: kop tanpa baris karangan, tanda tangan Ketua titik-titik", async () => {
    const h = await bacaPdfUji(
      (await gambarPdfEvidenSkp(naskah(paketContoh({ ketua: null }), dokumenRekapContoh(), { instansi: null }))).berkas
    );
    const t = h.map((x) => x.teks).join("\n");
    expect(t).not.toContain("MAHKAMAH AGUNG");
    expect(t).not.toContain("Telepon");
    expect(t).toContain(TITIK_NAMA);
    expect(t).toContain(TITIK_NIP);
    expect(t).toContain("Ketua Pengadilan Agama Donggala,");
  });

  it("baris yang lebih tinggi dari satu halaman diteruskan ke halaman berikut, tidak terpotong", async () => {
    const dok = dokumenRekapContoh(2);
    const panjang = Array.from({ length: 70 }, (_, i) => `Pihak ke-${i + 1} bernama sangat panjang`).join("\n");
    dok.tabel.baris[0].pihak = panjang;
    const hasil = await gambarPdfEvidenSkp(naskah(paketContoh(), dok), { catatUkuran: true });
    const h = await bacaPdfUji(hasil.berkas);
    const semua = h.map((x) => x.teks).join("\n");
    expect(semua).toContain("Pihak ke-1 bernama sangat panjang");
    expect(semua).toContain("Pihak ke-70 bernama sangat panjang");
    expect(hasil.tabel.find((t) => t.tabel === "rincian")!.halaman.length).toBeGreaterThan(1);
  });
});

// ============================================================================
// EXCEL
// ============================================================================

/** Sel lembar: alamat -> { teks, gaya }. Sel kosong berekor "/>" ikut terbaca. */
function selLembar(xml: string): Map<string, { teks: string; gaya: number }> {
  const hasil = new Map<string, { teks: string; gaya: number }>();
  for (const m of xml.matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?(?: t="[a-zA-Z]+")?(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const teks = [...(m[3] ?? "").matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("");
    hasil.set(m[1], {
      teks: teks.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&"),
      gaya: Number(m[2] ?? 0),
    });
  }
  return hasil;
}

describe("Excel", () => {
  let rekap: Map<string, Buffer>;
  let status: Map<string, Buffer>;

  beforeAll(async () => {
    const paket = paketContoh();
    rekap = bacaZip(await gambarXlsxEvidenSkp(naskah(paket, dokumenRekapContoh())));
    status = bacaZip(await gambarXlsxEvidenSkp(naskah(paket, dokumenStatusContoh())));
  });

  it("bagian wajib ada dan SETIAP XML-nya sah (ruang nama terikat)", () => {
    for (const bagian of [
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/_rels/sheet1.xml.rels",
      "xl/drawings/drawing1.xml",
      "xl/drawings/_rels/drawing1.xml.rels",
      "xl/media/image1.png",
    ]) {
      expect(rekap.has(bagian), bagian).toBe(true);
    }
    for (const [nama, isi] of rekap) {
      if (/\.(xml|rels)$/.test(nama)) expect(() => uraiXml(isi.toString("utf8")), nama).not.toThrow();
    }
  });

  it("logo Mahkamah Agung tertanam dan ditambatkan di sel A1", () => {
    expect(rekap.get("xl/media/image1.png")!.equals(LOGO)).toBe(true);
    const gambar = rekap.get("xl/drawings/drawing1.xml")!.toString("utf8");
    expect(gambar).toContain("<xdr:col>0</xdr:col>");
    expect(gambar).toContain("<xdr:row>0</xdr:row>");
    expect(gambar).toContain('r:embed="rId1"');
    expect(rekap.get("xl/drawings/_rels/drawing1.xml.rels")!.toString("utf8")).toContain('Target="../media/image1.png"');
    expect(rekap.get("[Content_Types].xml")!.toString("utf8")).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8")).toContain('<drawing r:id="rId1"/>');
  });

  it("cetak mendatar, muat selebar halaman; A4 untuk rekap, Folio/F4 untuk 25 kolom", () => {
    const a = rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(a).toContain('<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>');
    expect(a).toMatch(/<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"\/>/);
    expect(a).toContain("Halaman &amp;P dari &amp;N");
    const b = status.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    expect(b).toMatch(/<pageSetup paperSize="14" orientation="landscape"/);
  });

  it("baris kepala rincian diulang di tiap halaman cetak (Print_Titles menunjuk baris kepala)", () => {
    const buku = rekap.get("xl/workbook.xml")!.toString("utf8");
    const nama = uraiXml(buku).getElementsByTagName("definedName")[0];
    expect(nama?.getAttribute("name")).toBe("_xlnm.Print_Titles");
    const cocok = /^'Rekap Perkara'!\$(\d+):\$(\d+)$/.exec(nama?.textContent ?? "");
    expect(cocok).not.toBeNull();
    const sel = selLembar(rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8"));
    expect(sel.get(`A${cocok![1]}`)?.teks).toBe("No");
    expect(sel.get(`B${cocok![1]}`)?.teks).toBe("Nomor Perkara");
  });

  it("isi lengkap: kop, judul, identitas, indikator, setiap sel rincian, catatan, dan tanda tangan", () => {
    const sel = [...selLembar(rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8")).values()].map((s) => s.teks);
    for (const s of [
      "PENGADILAN AGAMA DONGGALA",
      "REKAP PERKARA",
      "Triwulan II Tahun 2026",
      ": Hakim Contoh Ma’ruf, S.H.I., M.H.",
      "Realisasi Indikator Kinerja",
      "11 dari 12 perkara putus ≤ 150 hari sejak didaftarkan",
      "Hakim yang bersangkutan,",
      "Donggala, 30 Juni 2026",
      "Mengetahui,",
      "Ketua Pengadilan Agama Donggala,",
      "Dr. Ketua Contoh, S.Ag., M.H.",
      "NIP. 19700101 199503 1 002",
    ]) {
      expect(sel, s).toContain(s);
    }
    const dok = dokumenRekapContoh();
    for (const b of dok.tabel.baris) for (const k of dok.tabel.kolom) if (b[k.kunci]) expect(sel).toContain(b[k.kunci]);
  });

  it("garis ganda kop selebar halaman: sel yang tertutup gabungan ikut bergaya garis", () => {
    const gaya = rekap.get("xl/styles.xml")!.toString("utf8");
    expect(gaya).toContain('<bottom style="double">');
    const xml = rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    const sel = selLembar(xml);
    // Baris garis: sel A dan kolom terakhir kisi bergaya sama (gaya garis ganda).
    // xf pertama milik cellStyleXfs; sisanya cellXfs berurutan = nomor gaya sel.
    const xfs = [...gaya.matchAll(/<xf numFmtId="0" fontId="\d+" fillId="\d+" borderId="(\d+)"/g)].slice(1).map((m) => Number(m[1]));
    const borders = [...gaya.matchAll(/<border>([\s\S]*?)<\/border>/g)].map((m) => m[1]);
    const gayaGanda = xfs.findIndex((b) => /bottom style="double"/.test(borders[b] ?? ""));
    expect(gayaGanda).toBeGreaterThanOrEqual(3);
    const selGanda = [...sel.entries()].filter(([, s]) => s.gaya === gayaGanda).map(([ref]) => ref);
    expect(selGanda).toContain(selGanda.find((r) => r.startsWith("A")));
    expect(selGanda.length).toBe(8); // selebar 8 kolom rincian
  });

  it("tinggi baris ditulis: sel berlipat tiga-empat baris tidak terpotong", () => {
    const xml = rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    const baris = [...xml.matchAll(/<row r="(\d+)"(?: ht="([\d.]+)" customHeight="1")?>([\s\S]*?)<\/row>/g)];
    const pihakPanjang = baris.find((b) => b[3].includes("Nurhayati binti Lamasigi Abdul Rahman Daeng Mappagau"));
    expect(pihakPanjang).toBeDefined();
    // "... melawan ..." tiga alinea, salah satunya dilipat: sedikitnya 4 baris 8,5 titik.
    expect(Number(pihakPanjang![2])).toBeGreaterThanOrEqual(4 * 8.5 * 1.2);
    // Setiap baris berisi teks punya tinggi tertulis.
    for (const b of baris) if (/<t /.test(b[3])) expect(b[2], `baris ${b[1]}`).toBeDefined();
  });

  it("gabungan sel sah: tidak ada rentang yang tumpang tindih", () => {
    const xml = rekap.get("xl/worksheets/sheet1.xml")!.toString("utf8");
    const rentang = [...xml.matchAll(/<mergeCell ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g)].map((m) => {
      const kol = (s: string) => [...s].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
      return { r1: Number(m[2]), r2: Number(m[4]), c1: kol(m[1]), c2: kol(m[3]) };
    });
    expect(rentang.length).toBeGreaterThan(10);
    const terisi = new Set<string>();
    for (const r of rentang) {
      for (let y = r.r1; y <= r.r2; y += 1) {
        for (let x = r.c1; x <= r.c2; x += 1) {
          expect(terisi.has(`${y}:${x}`), `${y}:${x}`).toBe(false);
          terisi.add(`${y}:${x}`);
        }
      }
    }
  });
});

// ============================================================================
// WORD
// ============================================================================

describe("Word", () => {
  let rekap: Map<string, Buffer>;
  let status: Map<string, Buffer>;
  let dokRekap: string;

  beforeAll(async () => {
    const paket = paketContoh();
    rekap = bacaZip(await gambarDocxEvidenSkp(naskah(paket, dokumenRekapContoh())));
    status = bacaZip(await gambarDocxEvidenSkp(naskah(paket, dokumenStatusContoh())));
    dokRekap = rekap.get("word/document.xml")!.toString("utf8");
  });

  it("bagian wajib ada dan SETIAP XML-nya sah (ruang nama terikat)", () => {
    for (const bagian of [
      "[Content_Types].xml",
      "_rels/.rels",
      "word/document.xml",
      "word/_rels/document.xml.rels",
      "word/styles.xml",
      "word/footer1.xml",
      "word/media/gambar1.png",
    ]) {
      expect(rekap.has(bagian), bagian).toBe(true);
    }
    for (const [nama, isi] of [...rekap, ...status]) {
      if (/\.(xml|rels)$/.test(nama)) expect(() => uraiXml(isi.toString("utf8")), nama).not.toThrow();
    }
  });

  it("kertas mendatar: A4 untuk rekap, F4 untuk kumulasi 25 kolom", () => {
    expect(dokRekap).toContain('<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>');
    expect(status.get("word/document.xml")!.toString("utf8")).toContain('<w:pgSz w:w="18709" w:h="12189" w:orient="landscape"/>');
  });

  it("logo pada kop: gambar tertanam, dirujuk, dan bertipe png", () => {
    expect(rekap.get("word/media/gambar1.png")!.equals(LOGO)).toBe(true);
    expect(rekap.get("word/_rels/document.xml.rels")!.toString("utf8")).toContain(
      'Id="rIdGbr1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/gambar1.png"'
    );
    expect(rekap.get("[Content_Types].xml")!.toString("utf8")).toContain('<Default Extension="png" ContentType="image/png"/>');
    expect(dokRekap).toContain('<a:blip r:embed="rIdGbr1"/>');
    // Gambar pertama dokumen ada di tabel kop, sebelum judul.
    expect(dokRekap.indexOf("<w:drawing>")).toBeLessThan(dokRekap.indexOf("REKAP PERKARA"));
  });

  it("tabel: kop, identitas, indikator, rincian, tanda tangan - kepala rincian diulang tiap halaman", () => {
    expect(dokRekap.match(/<w:tbl>/g)?.length).toBe(5);
    expect(status.get("word/document.xml")!.toString("utf8").match(/<w:tbl>/g)?.length).toBe(4);
    const tabelRincian = dokRekap.split("<w:tbl>")[4];
    const barisPertama = tabelRincian.split("<w:tr>")[1];
    expect(barisPertama).toContain("<w:tblHeader/>");
    expect(barisPertama).toContain("Nomor Perkara");
    expect(tabelRincian).toContain('<w:tblLayout w:type="fixed"/>');
    // Hanya baris kepala yang berulang.
    expect(tabelRincian.match(/<w:tblHeader\/>/g)?.length).toBe(1);
  });

  it("kaki halaman \"Halaman x dari y\" dengan medan PAGE dan NUMPAGES", () => {
    const kaki = rekap.get("word/footer1.xml")!.toString("utf8");
    expect(kaki).toContain(" PAGE ");
    expect(kaki).toContain(" NUMPAGES ");
    expect(kaki).toContain("Halaman ");
    expect(dokRekap).toMatch(/<w:sectPr><w:footerReference w:type="default" r:id="rIdKaki"\/><w:pgSz/);
  });

  it("isi utuh dalam UTF-8: tanda kutip melengkung, ≤, huruf Arab, & dan < tersandikan", () => {
    for (const s of [
      "REKAP PERKARA",
      "Hakim Contoh Ma’ruf, S.H.I., M.H.",
      "Mengetahui,",
      "Dr. Ketua Contoh, S.Ag., M.H.",
      "Hakim yang bersangkutan,",
      "Donggala, 30 Juni 2026",
      "11 dari 12 perkara putus ≤ 150 hari sejak didaftarkan",
      "Andi Nur’aini &amp; Muh. Rasyid",
      "PT Maju &lt;Bersama&gt; Sejahtera",
    ]) {
      expect(dokRekap, s).toContain(s);
    }
    expect(status.get("word/document.xml")!.toString("utf8")).toContain("Ahmad bin ﺩﺭﺀ Abdullah");
  });

  it("nama Ketua dan hakim ditebalkan dan bergaris bawah; titik-titik tidak", async () => {
    expect(dokRekap).toMatch(/<w:b\/><w:sz w:val="20"\/><w:szCs w:val="20"\/><w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">Dr\. Ketua Contoh/);
    const tanpa = bacaZip(await gambarDocxEvidenSkp(naskah(paketContoh({ ketua: null }), dokumenRekapContoh())));
    const xml = tanpa.get("word/document.xml")!.toString("utf8");
    expect(xml).toContain(TITIK_NAMA);
    expect(xml).not.toMatch(/<w:u w:val="single"\/><\/w:rPr><w:t xml:space="preserve">\(\.\.\./);
  });
});

// ============================================================================
// TEPI: DOKUMEN TANPA KOLOM TABEL
// ============================================================================

describe("dokumen tersedia tanpa kolom tabel", () => {
  const tanpaKolom = (): DokumenEvidenSkp => ({ ...dokumenKosongContoh(), tabel: { kolom: [], baris: [] } });

  it("PDF, Excel, dan Word tetap tersusun sah - tanpa judul Rincian dan tanpa tabel kosong", async () => {
    const n = naskah(paketContoh(), tanpaKolom());
    const pdf = await gambarPdfEvidenSkp(n);
    const teks = (await bacaPdfUji(pdf.berkas)).map((h) => h.teks).join("\n");
    expect(teks).toContain("Realisasi Indikator Kinerja");
    expect(teks).not.toContain("Rincian (");
    expect(teks).toContain("Mengetahui,");

    const xlsx = bacaZip(await gambarXlsxEvidenSkp(n));
    for (const [nama, isi] of xlsx) if (/\.(xml|rels)$/.test(nama)) expect(() => uraiXml(isi.toString("utf8")), nama).not.toThrow();
    expect(xlsx.get("xl/workbook.xml")!.toString("utf8")).not.toContain("Print_Titles");

    const docx = bacaZip(await gambarDocxEvidenSkp(n));
    const dok = docx.get("word/document.xml")!.toString("utf8");
    expect(() => uraiXml(dok)).not.toThrow();
    expect(dok).not.toContain("<w:tblGrid></w:tblGrid>");
    expect(dok).not.toContain("Rincian (");
    // kop, identitas, indikator, tanda tangan
    expect(dok.match(/<w:tbl>/g)?.length).toBe(4);
  });
});

// ============================================================================
// NAMA BERKAS
// ============================================================================

describe("nama berkas", () => {
  const periode = paketContoh().periode;

  it("Eviden SKP <tahun> - <periode> - <judul tanpa periode> - <nama>.<ext>", () => {
    expect(
      namaBerkasEvidenSkp({ periode, judulLengkap: "Rekap Perkara Triwulan II Tahun 2026", nama: "Hakim Contoh, S.H.", format: "pdf" })
    ).toBe("Eviden SKP 2026 - Triwulan II - Rekap Perkara - Hakim Contoh, S.H.pdf");
    expect(namaZipEvidenSkp({ periode, nama: "Hakim Contoh", format: "xlsx" })).toBe(
      "Eviden SKP 2026 - Triwulan II - Semua dokumen (Excel) - Hakim Contoh.zip"
    );
  });

  it("huruf terlarang Windows dibuang, kutip melengkung jadi ', titik di ujung inti dibuang", () => {
    const nama = namaBerkasEvidenSkp({
      periode,
      judulLengkap: 'Rekap: "Perkara"/Minutasi*? <A>|B Triwulan II Tahun 2026',
      nama: "Ma’ruf \\ Nur\u0007 ...",
      format: "docx",
    });
    expect(nama).not.toMatch(/[\\/:*?"<>|\u0000-\u001f]/);
    expect(nama).toBe("Eviden SKP 2026 - Triwulan II - Rekap 'Perkara'-Minutasi A B - Ma'ruf - Nur.docx");
    expect(bersihkanNamaBerkas("  ...  ")).toBe("Eviden SKP");
    expect(bersihkanNamaBerkas("a".repeat(400)).length).toBeLessThanOrEqual(180);
  });

  it("judul tanpa periode - triwulan maupun tahunan", () => {
    expect(judulTanpaPeriode("Rekap Perkara Triwulan II Tahun 2026", periode)).toBe("Rekap Perkara");
    expect(
      judulTanpaPeriode("Rekap Perkara Tahun 2026", { label: "Tahunan", labelPanjang: "Tahun 2026", tahun: 2026 })
    ).toBe("Rekap Perkara");
    expect(judulTanpaPeriode("Laporan Tanpa Periode", periode)).toBe("Laporan Tanpa Periode");
  });
});
