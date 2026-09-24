/**
 * ============================================================================
 * SEPULUH BENTUK SAJIAN - DIUJI DENGAN DATA BATAS
 * ============================================================================
 *
 * Bentuk sajian ditulis sekali dan dipakai seratus delapan puluh lima butir.
 * Satu bentuk yang meledak pada data kosong akan meledak pada puluhan butir
 * sekaligus - dan justru data kosong yang paling sering muncul pada aplikasi
 * yang baru berjalan.
 *
 * Empat keadaan batas diuji pada setiap bentuk:
 *
 *   1. kosong          - belum ada data sama sekali
 *   2. satu baris      - tidak cukup untuk kecenderungan
 *   3. seluruhnya nol  - ada datanya, tetapi nilainya nol semua
 *   4. sangat banyak   - seribu baris
 *
 * Yang ketiga paling menipu: nol bukan "tidak ada", dan bentuk yang
 * memperlakukannya sama dengan kosong akan menyembunyikan keadaan yang
 * sebenarnya perlu dilihat.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AngkaPokok,
  BentukResmi,
  DiagramArea,
  DiagramBatang,
  DiagramGaris,
  DiagramPai,
  DiagramPerjalananSidang,
  DiagramSebar,
  GarisMini,
  HURUF_DIKENALI,
  Kesimpulan,
  PetaKendali,
  TabelRincian,
  hurufTakDikenali,
  type PitaUmur,
  type TitikData,
} from "@/components/portal/bentuk-sajian";
import { susunPerjalananSidang } from "@/lib/perjalanan-sidang";
import { PITA_WAKTU_PUTUS } from "@/lib/pita-waktu-putus";

const KOSONG: TitikData[] = [];
const SATU: TitikData[] = [{ label: "Januari", nilai: 12 }];
const NOL: TitikData[] = ["Jan", "Feb", "Mar", "Apr"].map((l) => ({ label: l, nilai: 0 }));
const BANYAK: TitikData[] = Array.from({ length: 1000 }, (_, i) => ({
  label: `Baris ${i + 1}`,
  nilai: (i * 37) % 250,
}));
const DUA_BELAS: TitikData[] = Array.from({ length: 12 }, (_, i) => ({
  label: `Bulan ${i + 1}`,
  nilai: 80 + ((i * 7) % 19),
}));

const KOLOM = [
  { kunci: "nomor", label: "Nomor Perkara" },
  { kunci: "hari", label: "Hari", angka: true },
];

describe("sepuluh bentuk sajian tahan data batas", () => {
  it("angka pokok: kosong berkata apa adanya, terisi menampilkan angkanya", () => {
    const { unmount } = render(<AngkaPokok ubin={[]} />);
    expect(screen.getByText(/belum ada angka pokok/i)).toBeInTheDocument();
    unmount();

    render(
      <AngkaPokok
        ubin={[
          { label: "Perkara diperiksa", nilai: "1.204", keadaan: "netral" },
          { label: "Cakupan", nilai: "13,3", satuan: "persen", cakupan: "cakupan rendah" },
          { label: "Nilai", nilai: "94,2", rentang: "88,1 - 97,4" },
        ]}
      />
    );
    expect(screen.getByText("1.204")).toBeInTheDocument();
    expect(screen.getByText(/rentang 88,1 - 97,4/)).toBeInTheDocument();
    expect(screen.getByText("cakupan rendah")).toBeInTheDocument();
  });

  it("tabel rincian: menyebut bila dipotong, dan menyebut bila utuh", () => {
    const { unmount } = render(<TabelRincian kolom={KOLOM} baris={[]} />);
    expect(screen.getByText(/tidak ada baris/i)).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = render(
      <TabelRincian kolom={KOLOM} baris={[{ nomor: "1/Pdt.G", hari: 3 }]} />
    );
    expect(screen.getByText(/1 baris, seluruhnya/)).toBeInTheDocument();
    u2();

    render(<TabelRincian kolom={KOLOM} baris={[{ nomor: "1/Pdt.G", hari: 3 }]} jumlahSebenarnya={9000} />);
    expect(screen.getByText(/1 dari 9000 baris ditampilkan/)).toBeInTheDocument();
  });

  it("tabel rincian: sel kosong ditulis strip, bukan dibiarkan hampa", () => {
    render(<TabelRincian kolom={KOLOM} baris={[{ nomor: "", hari: null }]} />);
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("kesimpulan tergambar pada keempat keadaan", () => {
    (["baik", "perhatian", "buruk", "netral"] as const).forEach((k) => {
      const { unmount } = render(<Kesimpulan isi={`kesimpulan ${k}`} keadaan={k} />);
      expect(screen.getByText(`kesimpulan ${k}`)).toBeInTheDocument();
      unmount();
    });
  });

  it("diagram batang: kosong, nol semua, dan seribu baris", () => {
    const { unmount } = render(<DiagramBatang data={KOSONG} />);
    expect(screen.getByText(/belum ada data/i)).toBeInTheDocument();
    unmount();

    // Nol BUKAN kosong. Keempat labelnya harus tetap tergambar.
    const { unmount: u2 } = render(<DiagramBatang data={NOL} />);
    NOL.forEach((d) => expect(screen.getByTitle(d.label)).toBeInTheDocument());
    u2();

    render(<DiagramBatang data={BANYAK} />);
    expect(screen.getByTitle("Baris 1")).toBeInTheDocument();
    expect(screen.getByTitle("Baris 1000")).toBeInTheDocument();
  });

  it("diagram batang: garis ambang tergambar dan disebutkan", () => {
    render(<DiagramBatang data={DUA_BELAS} ambang={{ nilai: 90, label: "90 persen menurut SK" }} />);
    expect(screen.getByText(/Garis ambang: 90 persen menurut SK/)).toBeInTheDocument();
  });

  it("diagram garis menolak menggambar kecenderungan di bawah tiga titik", () => {
    // Dua titik selalu membentuk garis lurus, dan garis lurus terbaca seperti
    // pola padahal belum tentu ada polanya.
    const { unmount } = render(<DiagramGaris data={SATU} />);
    expect(screen.getByText(/tidak digambar di bawah tiga titik/i)).toBeInTheDocument();
    unmount();

    render(<DiagramGaris data={DUA_BELAS} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("diagram garis membawa garis sasaran dan penanda peristiwa", () => {
    render(
      <DiagramGaris
        data={DUA_BELAS}
        sasaran={{ nilai: 95, label: "95 menurut Perjanjian Kinerja" }}
        peristiwa={[{ label: "Mutasi panitera", padaIndeks: 4 }]}
      />
    );
    expect(screen.getByText(/Garis sasaran: 95 menurut Perjanjian Kinerja/)).toBeInTheDocument();
    expect(screen.getByText("Mutasi panitera")).toBeInTheDocument();
  });

  it("penanda peristiwa di luar jangkauan tidak meledak", () => {
    render(<DiagramGaris data={DUA_BELAS} peristiwa={[{ label: "di luar", padaIndeks: 999 }]} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("diagram area tergambar pada data yang cukup", () => {
    render(<DiagramArea data={DUA_BELAS} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("diagram sebar: kosong berkata apa adanya, terisi menyebut jumlah titiknya", () => {
    const { unmount } = render(<DiagramSebar titik={[]} />);
    expect(screen.getByText(/belum ada pasangan nilai/i)).toBeInTheDocument();
    unmount();

    render(
      <DiagramSebar
        titik={[
          { x: 1, y: 2, label: "a" },
          { x: 3, y: 4, label: "b" },
        ]}
      />
    );
    expect(screen.getByText("2 titik")).toBeInTheDocument();
  });

  it("diagram pai menyatukan sisa irisan dan mengatakannya", () => {
    const banyakMacam: TitikData[] = Array.from({ length: 20 }, (_, i) => ({
      label: `Jenis ${i + 1}`,
      nilai: 20 - i,
    }));
    render(<DiagramPai data={banyakMacam} />);
    // 20 macam, bawaan 6 irisan: lima tergambar sendiri, lima belas disatukan.
    //
    // Angka 15 adalah TURUNAN dari bawaan, bukan angka yang berdiri sendiri.
    // Bawaannya dulu 8 - dan diturunkan menjadi 6 karena pemeriksa palet
    // menunjukkan tidak ada palet delapan warna yang lulus: pada palet lama,
    // irisan pertama gagal pita terang dan lantai kroma sekaligus, dan bahkan
    // palet acuan yang tervalidasi pun gagal pada delapan slot.
    //
    // Yang DIJAGA uji ini tetap sama: sisa irisan disatukan, dan jumlah yang
    // disatukan DIKATAKAN. Pai yang menyembunyikan potongannya menyesatkan.
    expect(screen.getByText(/15 bagian terkecil disatukan/)).toBeInTheDocument();
  });

  it("diagram pai: seluruhnya nol dianggap tidak ada bagian untuk digambar", () => {
    // Pai dari angka nol tidak bermakna - tidak ada yang dapat dibagi.
    render(<DiagramPai data={NOL} />);
    expect(screen.getByText(/belum ada bagian/i)).toBeInTheDocument();
  });

  it("peta kendali menolak menghitung batas di bawah delapan titik", () => {
    const tujuh = DUA_BELAS.slice(0, 7);
    const { unmount } = render(<PetaKendali data={tujuh} />);
    expect(screen.getByText(/tidak dihitung di bawah delapan titik/i)).toBeInTheDocument();
    unmount();

    render(<PetaKendali data={DUA_BELAS} />);
    expect(screen.getByText(/tiga simpangan baku/)).toBeInTheDocument();
  });

  it("peta kendali menandai titik di luar batas", () => {
    const denganPencilan: TitikData[] = [
      ...Array.from({ length: 11 }, (_, i) => ({ label: `B${i}`, nilai: 100 })),
      { label: "Pencilan", nilai: 400 },
    ];
    render(<PetaKendali data={denganPencilan} />);
    // Ditanya lewat teksnya, bukan getByTitle: <title> di sini anak dari
    // <circle>, sedangkan getByTitle hanya mengenali atribut title atau
    // <title> yang menjadi anak langsung <svg>.
    expect(screen.getByText(/Pencilan: 400 - di luar batas kendali/)).toBeInTheDocument();
  });

  it("bentuk resmi selalu membawa kakinya", () => {
    // Lembar cetak tanpa kaki tidak dapat dipertanggungjawabkan enam bulan
    // kemudian, ketika tidak seorang pun ingat aturan apa yang berlaku saat
    // angkanya dihitung.
    render(
      <BentukResmi
        judul="Laporan Ketaatan"
        kolom={KOLOM}
        baris={[{ nomor: "1/Pdt.G", hari: 3 }]}
        tanggalHitung="2026-09-07"
      />
    );
    expect(screen.getByText("Tanggal hitung:")).toBeInTheDocument();
    expect(screen.getByText(/belum disandingkan/)).toBeInTheDocument();
  });

  it("bentuk resmi tanpa baris tetap membawa kakinya", () => {
    render(<BentukResmi judul="Kosong" kolom={KOLOM} baris={[]} tanggalHitung="2026-09-07" />);
    expect(screen.getByText(/tidak ada baris/i)).toBeInTheDocument();
    expect(screen.getByText("Tanggal hitung:")).toBeInTheDocument();
  });

  it("garis mini menolak menggambar di bawah tiga titik", () => {
    // Riwayat dua titik selalu lurus, dan garis lurus sekecil ini terbaca
    // seperti "tidak berubah" - padahal belum tentu ada yang diketahui.
    const { unmount } = render(<GarisMini nilai={[10, 20]} />);
    expect(screen.getByTitle("riwayat belum cukup untuk digambar")).toBeInTheDocument();
    unmount();

    render(<GarisMini nilai={[10, 20, 15, 30]} />);
    expect(screen.getByText(/4 periode terakhir/)).toBeInTheDocument();
  });

  it("garis mini menyebut arahnya, dan mengabaikan nilai kosong", () => {
    const { unmount } = render(<GarisMini nilai={[30, 20, 10]} />);
    expect(screen.getByText(/turun/)).toBeInTheDocument();
    unmount();

    render(<GarisMini nilai={[10, null, 20, 30]} />);
    expect(screen.getByText(/3 periode terakhir, naik/)).toBeInTheDocument();
  });

  it("kesepuluh huruf dikenali, dan huruf asing dilaporkan", () => {
    expect(HURUF_DIKENALI).toHaveLength(10);
    expect(hurufTakDikenali("NTBGR")).toEqual([]);
    expect(hurufTakDikenali("NTZ")).toEqual(["Z"]);
    expect(hurufTakDikenali("")).toEqual([]);
  });

  it("nilai null tidak digambar sebagai nol", () => {
    // Kosong bukan nol. Nilai yang belum dapat dihitung harus hilang dari
    // gambar, bukan menjadi batang setinggi nol yang terbaca sebagai "buruk".
    const bercampur: TitikData[] = [
      { label: "Ada", nilai: 10 },
      { label: "Belum", nilai: null },
      { label: "Ada lagi", nilai: 20 },
    ];
    render(<DiagramBatang data={bercampur} />);
    expect(screen.getByTitle("Ada")).toBeInTheDocument();
    expect(screen.queryByTitle("Belum")).not.toBeInTheDocument();
  });
});

/* ==========================================================================
 * PERJALANAN SIDANG - UMUR PERKARA PADA TIAP SIDANG
 * ========================================================================== */

/**
 * jsdom tidak punya ResizeObserver, jadi lebarnya jatuh ke 640 piksel dan jarak
 * antar titik pada delapan sidang 76 piksel - cukup lebar untuk menulis "+N hari".
 * Datanya 385/Pdt.G/2026/PA.Dgl dari sipp_donggala lokal.
 */
const PITA: PitaUmur[] = [
  { sampai: 90, singkat: "3 bln", label: "3 bulan", nada: "hijau" },
  { sampai: 120, singkat: "4 bln", label: "4 bulan", nada: "kuning" },
  { sampai: 150, singkat: "5 bln", label: "5 bulan - SEMA 2/2014", nada: "oranye" },
];

function p385(hariIni = "2026-09-17", bernomor = false) {
  const d: Array<[string, string, string]> = [
    ["2026-07-15", "Sidang Pertama", "proses mediasi"],
    ["2026-08-12", "hasil mediasi", "Jawaban Tergugat"],
    ["2026-08-18", "Jawaban", "Jawaban Tergugat"],
    ["2026-08-21", "Replik", "Duplik Tergugat"],
    ["2026-08-24", "Duplik", "Pembuktian Penggugat"],
    ["2026-08-26", "Pembuktian", "Panggil Tergugat"],
    ["2026-09-09", "Pembuktian", "Pembuktian Tergugat"],
    ["2026-09-16", "Pembuktian Tergugat", ""],
  ];
  return susunPerjalananSidang({
    tanggalDaftar: "2026-06-30",
    tanggalPutusan: "",
    hariMediasi: 26,
    hariIni,
    jadwal: d.map(([tanggalSidang, agenda, alasanDitunda], i) => ({
      sidangId: String(i + 1),
      tanggalSidang,
      agenda,
      alasanDitunda,
      ditunda: alasanDitunda !== "",
      // Nomor SIPP sengaja BERBEDA dari posisinya (mulai dari 3, seolah dua
      // sidang pertama tidak ikut terkirim) supaya terbukti mana yang dipakai.
      urutanSidang: bernomor ? i + 3 : 0,
    })),
    mediasi: [
      { tanggalMulai: "2026-07-15", tanggalDimulaiTercatat: "2026-07-15", tanggalLaporan: "2026-08-10", tanggalSelesai: "2026-08-10" },
    ],
  })!;
}

describe("perjalanan sidang", () => {
  it("menolak menggambar di bawah tiga sidang", () => {
    const p = p385();
    render(<DiagramPerjalananSidang perjalanan={{ ...p, titik: p.titik.slice(0, 2) }} pita={PITA} />);
    expect(screen.getByText(/tidak digambar di bawah tiga sidang/i)).toBeInTheDocument();
  });

  it("jarak tiap penundaan tertulis, dan yang terpanjang disebut beserta alasannya", () => {
    render(<DiagramPerjalananSidang perjalanan={p385()} pita={PITA} />);
    expect(screen.getByText("+28 hari")).toBeInTheDocument();
    expect(screen.getByText("+14 hari")).toBeInTheDocument();
    expect(
      screen.getByText(/Jeda terpanjang \+28 hari, dari sidang ke-1 ke sidang ke-2 \(ditunda: proses mediasi\)/)
    ).toBeInTheDocument();
  });

  it("sumbu mendatar dan kalimat jeda menyebut nomor sidang SIPP, bukan posisinya", () => {
    render(<DiagramPerjalananSidang perjalanan={p385("2026-09-17", true)} pita={PITA} />);
    expect(screen.getByText("ke-3")).toBeInTheDocument();
    expect(screen.getByText("ke-10")).toBeInTheDocument();
    expect(screen.queryByText("ke-1")).not.toBeInTheDocument();
    expect(screen.getByText(/Jeda terpanjang \+28 hari, dari sidang ke-3 ke sidang ke-4/)).toBeInTheDocument();
  });

  it("sumbu tidak dipaksa sampai 150 - batas yang jauh DISEBUT, dan keterangan hanya pita yang tampak", () => {
    render(<DiagramPerjalananSidang perjalanan={p385()} pita={PITA} />);
    expect(screen.getByText(/5 bulan - SEMA 2\/2014: 150 hari/)).toBeInTheDocument();
    expect(screen.getByText(/sampai 90 hari · 3 bulan/)).toBeInTheDocument();
    expect(screen.queryByText(/lebih dari 150 hari/)).not.toBeInTheDocument();
    // Sumbu tegak BERANGKA - dulu tidak satu pun angka.
    for (const angka of ["0", "15", "30", "45", "60", "75", "90"]) {
      expect(screen.getAllByText(angka).length, angka).toBeGreaterThan(0);
    }
  });

  it("rentang mediasi diarsir dan disebut", () => {
    render(<DiagramPerjalananSidang perjalanan={p385()} pita={PITA} />);
    expect(screen.getByText("mediasi")).toBeInTheDocument();
    expect(screen.getByText("mediasi - tidak dihitung")).toBeInTheDocument();
  });

  it("sidang yang belum berlangsung digambar berongga", () => {
    const { container } = render(<DiagramPerjalananSidang perjalanan={p385("2026-09-10")} pita={PITA} />);
    expect(container.querySelectorAll("circle.fill-card")).toHaveLength(1);
    expect(screen.getByText("belum berlangsung")).toBeInTheDocument();
  });

  it("umur hari ini disebut terhadap batas terakhir", () => {
    render(<DiagramPerjalananSidang perjalanan={p385()} pita={PITA} hariIniDihitung={61} />);
    expect(screen.getByText(/Hari ini hari ke-61 yang dihitung - 89 hari lagi sampai batas 5 bulan - SEMA 2\/2014/)).toBeInTheDocument();
  });

  it("pita di atas batas terakhir merah, dan disebut", () => {
    // Puncak data melewati 150: seluruh empat pita tampak, termasuk merahnya.
    const p = p385();
    const tinggi = { ...p, titik: p.titik.map((t, i) => ({ ...t, hari: t.hari + i * 30 })) };
    const { container } = render(<DiagramPerjalananSidang perjalanan={tinggi} pita={PITA} />);
    expect(screen.getByText("lebih dari 150 hari")).toBeInTheDocument();
    expect(container.querySelector("rect.fill-red-500\\/15")).not.toBeNull();
  });
});

describe("warna pita perjalanan sidang selaras dengan pita waktu putus", () => {
  /**
   * Diminta 24 Sep 2026: hijau sampai 3 bulan, kuning 4 bulan, oranye 5 bulan,
   * merah lewat 5 bulan - satu arti, satu keluarga warna di seluruh portal.
   * Lencana umur perkara (lib/pita-waktu-putus.ts) dan pita grafik ini tidak
   * boleh menyebut dua warna berbeda untuk perkara yang sama. Kelas Tailwind
   * harus tertulis harfiah di sumbernya, jadi yang dicocokkan teks mentahnya.
   */
  const sumber = readFileSync(path.resolve(process.cwd(), "src/components/portal/bentuk-sajian.tsx"), "utf8").replace(
    /\r\n/g,
    "\n"
  );
  const awal = sumber.indexOf("const WARNA_PITA");
  const blok = sumber.slice(awal, sumber.indexOf("\n};", awal));

  it("keempat sebutan warna ada, masing-masing dengan keluarga yang sama", () => {
    expect(awal).toBeGreaterThan(-1);
    expect(PITA_WAKTU_PUTUS.map((p) => p.warna)).toEqual(["hijau", "kuning", "oranye", "merah"]);
    for (const p of PITA_WAKTU_PUTUS) {
      const keluarga = /\btext-([a-z]+)-700\b/.exec(p.kelasTeks)?.[1];
      expect(keluarga, p.warna).toBeTruthy();
      const i = blok.indexOf(`  ${p.warna}: {`);
      expect(i, `WARNA_PITA.${p.warna}`).toBeGreaterThan(-1);
      const entri = blok.slice(i, blok.indexOf("},", i));
      for (const ruas of ["latar", "garis", "teks", "contoh"]) {
        const kelas = new RegExp(`${ruas}: "([^"]*)"`).exec(entri)?.[1] ?? "";
        expect(kelas, `${p.warna}.${ruas}`).toContain(`-${keluarga}-`);
        // Portal ini bertema gelap secara bawaan - tiap kelas punya langkah gelapnya.
        expect(kelas, `${p.warna}.${ruas}`).toContain("dark:");
      }
    }
  });
});
