/**
 * ============================================================================
 * TIGA LAYAR YANG BERBOHONG - 25 SEPTEMBER 2026
 * ============================================================================
 *
 * Penjaga ini MENJALANKAN yang dijaganya. Tinjauan batch ini menemukan bahwa
 * hampir seluruh penjaga barunya hanya expect(teksBerkas).toContain(...) atas
 * kode sumbernya sendiri - hijau sementara kuerinya melempar galat. Karena itu
 * di sini:
 *
 *   - angka pada keterangan saklar dibuktikan dengan MENJALANKAN
 *     hitungWaktuPutus milik bot, bukan dengan menyisir teksnya;
 *   - pembantu tanggal dijalankan atas bentuk yang SUNGGUH tersimpan di
 *     aleta_bot_ecourt_documents;
 *   - catatan grafik diuji dengan MENGGAMBAR komponennya.
 *
 * Seluruh angka di bawah diukur di sipp_donggala pada 25 September 2026 dengan
 * penciri ghaib milik bot sendiri (perkara_pihak2.ghaib = 1 ATAU jarak
 * penetapan hari sidang ke sidang pertama >= 120 hari, yaitu
 * penilaianSippService.JARAK_PHS_GHAIB_HARI): 127 perkara belum putus, 13 di
 * antaranya ghaib, dan ke-13 itu TIDAK bermediasi sama sekali.
 */

import { createRequire } from "node:module";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  DiagramPerjalananSidang,
  type PitaUmur,
} from "@/components/portal/bentuk-sajian";
import {
  DaftarDokumen,
  capWaktuPengadilan,
} from "@/components/portal/aleta-ecourt-arsip-berkas";
import { SAKLAR_TAMPILAN } from "@/lib/tampilan-antrian-sidang";
import { tanggalHariPendek } from "@/lib/tanggal-indonesia";
import { susunPerjalananSidang } from "@/lib/perjalanan-sidang";

const require_ = createRequire(import.meta.url);
const penilaian = require_(
  "../../../aleta_bot/services/penilaianSippService.js"
) as {
  JARAK_PHS_GHAIB_HARI: number;
  hitungWaktuPutus: (f: Record<string, unknown>) => {
    kotor: number;
    bersih: number;
    mediasi: number;
    potongan: { hari: number; hariMentah: number; sebab: string };
    nilai: number;
  } | null;
};

/**
 * Ke-13 perkara ghaib yang belum putus di sipp_donggala, beserta tanggal
 * pendaftarannya - hasil kueri, bukan karangan. Diukur terhadap 2026-09-25.
 */
const GHAIB_BELUM_PUTUS: Array<[string, string]> = [
  ["232/Pdt.G/2026", "2026-04-15"],
  ["322/Pdt.G/2026", "2026-06-03"],
  ["367/Pdt.G/2026", "2026-06-17"],
  ["390/Pdt.G/2026", "2026-07-01"],
  ["392/Pdt.G/2026", "2026-07-02"],
  ["396/Pdt.G/2026", "2026-07-06"],
  ["421/Pdt.G/2026", "2026-07-13"],
  ["425/Pdt.G/2026", "2026-07-14"],
  ["432/Pdt.G/2026", "2026-07-15"],
  ["456/Pdt.G/2026", "2026-07-23"],
  ["460/Pdt.G/2026", "2026-07-24"],
  ["515/Pdt.G/2026", "2026-08-14"],
  ["518/Pdt.G/2026", "2026-08-19"],
];

const DIUKUR_PADA = "2026-09-25";

/** Menjalankan tangga bot, bukan menirunya. Mediasi nol - terukur begitu. */
function hitungGhaib(tanggalDaftar: string) {
  const h = penilaian.hitungWaktuPutus({
    tanggalDaftar,
    tanggalPutus: DIUKUR_PADA,
    hariMediasi: 0,
    perkaraGhaib: true,
  });
  if (!h) throw new Error(`hitungWaktuPutus menolak ${tanggalDaftar}`);
  return h;
}

const keteranganUmur = () =>
  SAKLAR_TAMPILAN.find((x) => x.kunci === "umur-perkara")?.keterangan ?? "";

describe("mekanisme yang harus diterangkan keterangan saklar Umur perkara", () => {
  it("potongan 120 hari perkara ghaib sungguh ada, dan angkanya 120", () => {
    // Kalau kelonggarannya hilang dari bot, keterangan yang menyebut 120 hari
    // menjadi keterangan yang berbohong - dan uji ini yang pertama merah.
    const h = hitungGhaib("2026-04-15");
    expect(h.potongan.sebab).toBe("perkara ghaib");
    expect(h.potongan.hariMentah).toBe(120);
    expect(penilaian.JARAK_PHS_GHAIB_HARI).toBe(120);
  });

  it("12 dari 13 perkara ghaib berjalan berhenti di 1 hari karena penjepitan", () => {
    // Inilah sebab angka kedua "· dari N" dipasang. Bila penjepitannya
    // berubah, angka 12 di sini harus diubah dengan sengaja - bukan
    // dilonggarkan.
    const bersihSatu = GHAIB_BELUM_PUTUS.filter(
      ([, daftar]) => hitungGhaib(daftar).bersih === 1
    );
    expect(bersihSatu).toHaveLength(12);
    expect(GHAIB_BELUM_PUTUS).toHaveLength(13);
  });

  it("322/Pdt.G/2026 sungguh turun 114 hari - 115 menjadi 1", () => {
    // Contoh yang DISEBUT keterangannya. Dipaku di sini supaya contohnya tidak
    // menjadi angka yang tidak pernah ada.
    const h = hitungGhaib("2026-06-03");
    expect(h.kotor).toBe(115);
    expect(h.bersih).toBe(1);
    expect(h.kotor - h.bersih).toBe(114);
    expect(keteranganUmur()).toContain("115 hari");
  });

  it("potongan mediasi NOL pada perkara ghaib itu - jadi mediasi saja tidak menerangkannya", () => {
    // Ke-13 perkara ghaib tidak punya satu pun baris perkara_mediasi (terukur).
    // Karena itu keterangan lama yang hanya menyebut mediasi menunjuk potongan
    // yang justru nol, dan menyesatkan bagi seluruh 13 baris tersebut.
    for (const [nomor, daftar] of GHAIB_BELUM_PUTUS) {
      expect(hitungGhaib(daftar).mediasi, nomor).toBe(0);
    }
  });

  it("keterangannya menyebut ketiga mekanisme beserta dasar hukumnya", () => {
    const k = keteranganUmur();
    // 1. potongan ghaib, dengan nomor SK yang utuh - bukan "048/2024" saja
    expect(k).toContain("120 hari");
    expect(k).toContain("ghaib");
    expect(k).toContain("048/DJA/SK.KP3.4.3/IV/2024");
    // 2. angka kedua
    expect(k).toContain("· dari N");
    // 3. lencana merah SEMA, beserta dasarnya
    expect(k).toContain("lewat 5 bulan");
    expect(k).toContain("SEMA 2/2014");
    // potongan mediasi tetap disebut - ia tidak hilang, hanya bukan satu-satunya
    expect(k).toContain("PERMA 1/2016");
  });

  it("keterangannya tidak lagi mengaku mediasi sebagai satu-satunya potongan", () => {
    // Bentuk lama: "hari mediasi tidak dihitung - berwarna menurut pita".
    // Kalimat itu benar tetapi tidak lengkap, dan ketidaklengkapannya justru
    // pada 13 baris yang paling membingungkan.
    expect(keteranganUmur()).not.toBe(
      "Lencana jumlah hari di bawah agenda - hari mediasi tidak dihitung - berwarna menurut pita Waktu Putus SK Dirjen Badilag 048/2024: hijau, kuning, oranye, merah. Rinciannya tetap ada di panel Rincian."
    );
  });
});

describe("tanggal murni tidak boleh berjam", () => {
  /**
   * Bentuk yang SUNGGUH tersimpan: kolom datetime yang jamnya selalu 00:00:00,
   * sebab botDbService.toMysqlDate memakai toISOString().slice(0,19) atas
   * tanggal tanpa jam.
   */
  const TERSIMPAN = "2026-10-07 00:00:00";

  it("formatDateTime memang menjawab berbeda di tiga zona - sebab penggantiannya", () => {
    // Dijalankan dengan opsi yang SAMA dengan src/lib/format.ts, zonanya
    // disebut tegas supaya ujinya tidak bergantung zona mesin penguji.
    const bentuk = (tz: string) =>
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: tz,
      }).format(new Date("2026-10-07"));
    expect(bentuk("UTC")).toBe("7 Okt 2026, 00.00");
    expect(bentuk("Asia/Makassar")).toBe("7 Okt 2026, 08.00");
    // Tanggalnya pun MUNDUR sehari di sebelah barat UTC.
    expect(bentuk("America/New_York")).toBe("6 Okt 2026, 20.00");
    // Ketiganya berbeda - itulah hydration mismatch-nya.
    expect(new Set([bentuk("UTC"), bentuk("Asia/Makassar"), bentuk("America/New_York")]).size).toBe(3);
  });

  it("tanggalHariPendek atas bentuk tersimpan: satu jawaban, tanpa jam", () => {
    const hasil = tanggalHariPendek(TERSIMPAN, "—");
    expect(hasil).toBe("Rab, 07-10-2026");
    // Tidak ada jam yang dikarang dari bentuk penyimpanan.
    expect(hasil).not.toMatch(/\d{2}[.:]\d{2}/);
    // Dan bentuk tanggal murni tanpa jam dijawab sama.
    expect(tanggalHariPendek("2026-10-07", "—")).toBe("Rab, 07-10-2026");
  });

  it("yang kosong dan yang tidak sah menjadi em dash, bukan Invalid Date", () => {
    expect(tanggalHariPendek(null, "—")).toBe("—");
    expect(tanggalHariPendek("", "—")).toBe("—");
    expect(tanggalHariPendek("0000-00-00", "—")).toBe("—");
  });

  /**
   * Tabelnya DIGAMBAR, bukan disisir sebagai teks. Inilah penjaga yang merah
   * bila seseorang mengembalikan formatDateTime ke kolom tanggal sidang.
   */
  describe("tabel dokumen digambar", () => {
    const satuDokumen = (tanggalSidang: string | null) => [
      {
        documentKey: "k1",
        judulDokumen: "Jawaban Tergugat",
        jenisDokumen: "Jawaban",
        peranPengunggah: "Tergugat",
        statusVerifikasi: "belum",
        tanggalSidang,
        agenda: "Jawaban",
        adaPdf: true,
        adaWord: false,
        ukuranByte: 120_000,
        diberitahukanPada: null,
      },
    ];

    it("tanggal sidang tertulis tanpa jam sama sekali", () => {
      const { container } = render(<DaftarDokumen dokumen={satuDokumen(TERSIMPAN)} />);
      expect(screen.getByText("Rab, 07-10-2026")).toBeInTheDocument();
      // Jam 00.00 adalah karangan bentuk penyimpanan - tidak boleh tercetak.
      expect(container.textContent ?? "").not.toContain("00.00");
      expect(container.textContent ?? "").not.toContain("7 Okt 2026");
    });

    it("tanggal sidang kosong menjadi em dash", () => {
      render(<DaftarDokumen dokumen={satuDokumen(null)} />);
      expect(screen.getByText("—")).toBeInTheDocument();
    });

    it("tanggal murni tanpa jam pun dijawab sama - bentuk lama e-Court", () => {
      render(<DaftarDokumen dokumen={satuDokumen("2026-10-07")} />);
      expect(screen.getByText("Rab, 07-10-2026")).toBeInTheDocument();
    });
  });
});

describe("cap waktu sungguhan: tanggal dan jam dari satu zona", () => {
  it("melintasi tengah malam WITA, tanggal mengikuti jamnya", () => {
    // 2026-10-06T17:30:00Z adalah 07-10-2026 pukul 01.30 WITA. Inilah kasus
    // yang membongkar pasangan yang bercampur zona: tanggal dari teks ISO
    // (06-10) ditempel pada jam WITA (01.30) akan menulis pasangan yang tidak
    // pernah ada.
    expect(capWaktuPengadilan("2026-10-06T17:30:00.000Z")).toBe("Rab, 07-10-2026 01.30");
  });

  it("jamnya sungguh ditulis - ia cap waktu, bukan tanggal murni", () => {
    expect(capWaktuPengadilan("2026-10-07T06:30:00.000Z")).toBe("Rab, 07-10-2026 14.30");
    expect(capWaktuPengadilan("2026-10-07T06:30:00.000Z")).toMatch(/\d{2}\.\d{2}$/);
  });

  it("bentuk tanggalnya sama dengan layar e-Court lain", () => {
    // Bukan "7 Okt 2026, 14.30". Selisih bentuk inilah yang membuat panitera
    // membaca dua bentuk tanggal pada satu portal.
    const hasil = capWaktuPengadilan("2026-10-07T06:30:00.000Z");
    expect(hasil.startsWith(tanggalHariPendek("2026-10-07"))).toBe(true);
    expect(hasil).not.toContain("Okt");
  });

  it("yang kosong dan yang tidak sah menjadi em dash", () => {
    expect(capWaktuPengadilan(null)).toBe("—");
    expect(capWaktuPengadilan(undefined)).toBe("—");
    expect(capWaktuPengadilan("")).toBe("—");
    expect(capWaktuPengadilan("bukan tanggal")).toBe("—");
  });
});

const PITA: PitaUmur[] = [
  { sampai: 90, singkat: "3 bln", label: "3 bulan", nada: "hijau" },
  { sampai: 120, singkat: "4 bln", label: "4 bulan", nada: "kuning" },
  { sampai: 150, singkat: "5 bln", label: "5 bulan - SEMA 2/2014", nada: "oranye" },
];

/** Perkara berjalan dengan lima sidang - cukup untuk digambar (batas tiga). */
function perjalananLima() {
  return susunPerjalananSidang({
    tanggalDaftar: "2026-06-03",
    tanggalPutusan: "",
    hariMediasi: 0,
    hariIni: DIUKUR_PADA,
    jadwal: [
      ["2026-06-24", "Sidang Pertama", "panggil tergugat ghaib"],
      ["2026-07-22", "Sidang Pertama", "panggil tergugat ghaib"],
      ["2026-08-19", "Jawaban", "pembuktian"],
      ["2026-09-09", "Pembuktian", "pembuktian"],
      ["2026-09-23", "Pembuktian", ""],
    ].map(([tanggalSidang, agenda, alasanDitunda], i) => ({
      sidangId: String(i + 1),
      tanggalSidang,
      agenda,
      alasanDitunda,
      ditunda: alasanDitunda !== "",
      urutanSidang: i + 1,
    })),
    mediasi: [],
  })!;
}

describe("catatan grafik untuk perkara ghaib", () => {
  const pola =
    /Perkara ghaib: garis ini hari kalender di luar mediasi, dengan cara batas lima bulan SEMA 2\/2014 - TIDAK dipotong/;

  it("digambar ketika perkaranya ghaib", () => {
    render(<DiagramPerjalananSidang perjalanan={perjalananLima()} pita={PITA} ghaib />);
    expect(screen.getByText(pola)).toBeInTheDocument();
  });

  it("menyebut kelonggaran 120 hari dan bahwa ia TIDAK memotong garis ini", () => {
    // Satu-satunya tempat yang menerangkan selisih sampai 120 hari antara
    // grafik ini dan lencana umur di Antrian Sidang.
    render(<DiagramPerjalananSidang perjalanan={perjalananLima()} pita={PITA} ghaib />);
    const kalimat = screen.getByText(pola).textContent ?? "";
    expect(kalimat).toContain("120 hari");
    expect(kalimat).toContain("048/2024");
    expect(kalimat).toContain("penilaian kinerja");
    expect(kalimat).toContain("Antrian Sidang");
  });

  it("TIDAK digambar pada perkara biasa - ia kebisingan di sana", () => {
    render(<DiagramPerjalananSidang perjalanan={perjalananLima()} pita={PITA} />);
    expect(screen.queryByText(pola)).toBeNull();
  });

  it("bawaannya tidak ghaib - pemanggil yang belum mengirim ruasnya tidak berubah", () => {
    // Menggambar kalimat ghaib secara bawaan akan menyalakannya pada seluruh
    // perkara, dan keterangan yang selalu tampil berhenti dibaca.
    const { container } = render(
      <DiagramPerjalananSidang perjalanan={perjalananLima()} pita={PITA} />
    );
    expect(container.textContent ?? "").not.toContain("Perkara ghaib:");
  });

  it("garis dan titiknya TIDAK berubah oleh ruas ghaib - hanya catatannya", () => {
    // Kalau ruas ini sampai memotong garisnya, kewajiban lapor SEMA hilang dari
    // gambar. Dibuktikan dengan membandingkan seluruh path SVG-nya.
    const jalur = (ghaib: boolean) => {
      const { container } = render(
        <DiagramPerjalananSidang perjalanan={perjalananLima()} pita={PITA} ghaib={ghaib} />
      );
      return [...container.querySelectorAll("path,circle")].map((n) =>
        n.getAttribute("d") ?? `${n.getAttribute("cx")},${n.getAttribute("cy")}`
      );
    };
    expect(jalur(true)).toEqual(jalur(false));
  });
});
