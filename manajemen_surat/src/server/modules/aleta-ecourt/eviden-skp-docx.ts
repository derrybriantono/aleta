import type { NaskahEvidenSkp, TabelNaskah } from "@/lib/eviden-skp-cetak";
import { buatDocx, type AlineaDocx, type BarisTabelDocx, type BlokDocx, type SelTabelDocx } from "@/lib/docx";
import {
  hitungLebarKolom,
  hurufUkur,
  pecahSel,
  ruangSelTabel,
  ukurTeks,
  type HurufUkur,
} from "@/server/modules/aleta-ecourt/eviden-skp-ukur";

/**
 * ============================================================================
 * PENGGAMBAR WORD EVIDEN SKP (2.40.0)
 * ============================================================================
 *
 * Naskah yang sama dengan PDF dan Excel-nya, ditulis dengan lib/docx.ts:
 * kertas mendatar, kop berupa tabel tanpa garis (logo | teks | ruang seimbang)
 * dengan garis ganda di bawahnya, tabel berlebar tetap yang baris kepalanya
 * diulang Word di tiap halaman, dan kaki halaman "Halaman x dari y".
 *
 * Lebar kolom tabel rincian dihitung dengan pengukur yang sama dengan PDF
 * (Arial berukuran sama dengan Helvetica), lalu tabel dikunci berlebar tetap -
 * Word tidak menyusun ulang kolomnya menurut isi, jadi yang dicetak Word
 * sebentuk dengan PDF-nya.
 */

const MARGIN_CM: [number, number, number, number] = [1.3, 1.5, 1.6, 1.5];
const LEBAR_KERTAS_MENDATAR_CM: Record<"A4" | "F4", number> = { A4: 29.7, F4: 33 };
const TINGGI_LOGO_CM = 2.05;

const titikKeCm = (pt: number) => (pt / 72) * 2.54;
const cmKeTitik = (cm: number) => (cm / 2.54) * 72;

/** Ukuran gambar PNG dari kepala IHDR-nya; null bila bukan PNG. */
function ukuranPng(data: Uint8Array): { lebar: number; tinggi: number } | null {
  if (data.length < 24) return null;
  const buf = Buffer.from(data);
  if (buf.readUInt32BE(0) !== 0x89504e47) return null;
  const lebar = buf.readUInt32BE(16);
  const tinggi = buf.readUInt32BE(20);
  return lebar > 0 && tinggi > 0 ? { lebar, tinggi } : null;
}

const alinea = (teks: string, p: Partial<AlineaDocx> = {}): AlineaDocx => ({
  jenis: "alinea",
  teks,
  rata: "kiri",
  spasi: 1,
  jarakSesudah: 0,
  ...p,
});

export async function gambarDocxEvidenSkp(naskah: NaskahEvidenSkp): Promise<Buffer> {
  const huruf: HurufUkur = await hurufUkur();
  const kertas = naskah.tataLetak.kertas;
  const lebarIsiCm = LEBAR_KERTAS_MENDATAR_CM[kertas] - MARGIN_CM[1] - MARGIN_CM[3];
  const W = cmKeTitik(lebarIsiCm);
  const blok: BlokDocx[] = [];

  // --------------------------------------------------------------------------
  // Kop: logo | teks terpusat | ruang selebar logo (supaya teksnya di pusat halaman)
  // --------------------------------------------------------------------------
  const logo = naskah.kop.logo ? Buffer.from(naskah.kop.logo) : null;
  const ukuranLogo = logo ? ukuranPng(logo) : null;
  const lebarLogoCm = ukuranLogo ? (TINGGI_LOGO_CM * ukuranLogo.lebar) / ukuranLogo.tinggi : 0;
  const kolomLogoCm = ukuranLogo ? lebarLogoCm + 0.45 : 0.01;
  const barisKop: AlineaDocx[] = naskah.kop.baris.map((b) =>
    alinea(b.teks, { rata: "tengah", tebal: b.tebal, ukuran: b.ukuran, jarakSesudah: 1 })
  );
  blok.push({
    jenis: "tabel",
    garis: "tanpa",
    ruangSel: 0,
    lebarKolom: [kolomLogoCm, lebarIsiCm - 2 * kolomLogoCm, kolomLogoCm],
    baris: [
      {
        tidakTerpecah: true,
        sel: [
          {
            isi:
              logo && ukuranLogo
                ? [{ jenis: "gambar", data: logo, lebar: lebarLogoCm, tinggi: TINGGI_LOGO_CM, keterangan: "Logo Mahkamah Agung" }]
                : "",
            rataTegak: "tengah",
          },
          { isi: barisKop.length > 0 ? barisKop : "", rataTegak: "tengah" },
          { isi: "" },
        ],
      },
    ],
  });
  // Garis ganda kop - garis bawah alinea tipis selebar isi halaman.
  blok.push(alinea("", { ukuran: 3, garisAlinea: "ganda", jarakSesudah: 10 }));

  // --------------------------------------------------------------------------
  // Judul
  // --------------------------------------------------------------------------
  blok.push(alinea(naskah.judul, { rata: "tengah", tebal: true, ukuran: 13, jarakSesudah: 2 }));
  if (naskah.subjudul) blok.push(alinea(naskah.subjudul, { rata: "tengah", tebal: true, ukuran: 11, jarakSesudah: 1 }));
  if (naskah.rentang) blok.push(alinea(naskah.rentang, { rata: "tengah", ukuran: 9, warna: "555555" }));
  blok.push(alinea("", { ukuran: 6 }));

  // --------------------------------------------------------------------------
  // Identitas: label | ":" | nilai
  // --------------------------------------------------------------------------
  const UK_ID = 9.5;
  const lebarLabelCm = titikKeCm(Math.max(...naskah.identitas.map((i) => ukurTeks(huruf.biasa, i.label, UK_ID))) + 8);
  blok.push({
    jenis: "tabel",
    garis: "tanpa",
    ruangSel: 0.05,
    ukuran: UK_ID,
    lebarKolom: [lebarLabelCm, 0.35, lebarIsiCm - lebarLabelCm - 0.35],
    baris: naskah.identitas.map((i) => ({
      sel: [
        { isi: i.label },
        { isi: ":" },
        { isi: i.nilai, tebal: i.label === "Nama" },
      ],
    })),
  });
  blok.push(alinea("", { ukuran: 6 }));

  // --------------------------------------------------------------------------
  // Tabel
  // --------------------------------------------------------------------------
  const judulBagian = (teks: string) => blok.push(alinea(teks, { tebal: true, ukuran: 10, jarakSesudah: 3, tetapBersama: true }));
  const RATA: Record<string, SelTabelDocx["rata"]> = { kiri: "kiri", tengah: "tengah", kanan: "kanan" };

  const tabelDocx = (tabel: TabelNaskah, ukuran: number, p: { selang: boolean; kosong: string }): BlokDocx => {
    const RUANG = ruangSelTabel(tabel.kolom.length);
    const lebar = hitungLebarKolom({ kolom: tabel.kolom, baris: tabel.baris, lebarTersedia: W, ukuran, huruf, ruang: 2 * RUANG });
    const kepala: BarisTabelDocx = {
      kepala: true,
      sel: tabel.kolom.map((k) => ({ isi: k.judul, tebal: true, rata: "tengah", latar: "DCE6F0", rataTegak: "tengah" })),
    };
    const isi: BarisTabelDocx[] =
      tabel.baris.length === 0
        ? [{ sel: [{ isi: p.kosong, gabung: tabel.kolom.length, rata: "tengah" }] }]
        : tabel.baris.map((b, nomor) => {
            // Baris pendek tidak dibelah dua halaman; baris sangat panjang
            // dibiarkan terbelah - baris tak terbelah yang lebih tinggi dari
            // satu halaman dipotong Word, bukan dipindah.
            const barisTerbanyak = Math.max(
              1,
              ...tabel.kolom.map((k, i) => pecahSel(huruf.biasa, b[k.kunci] ?? "", ukuran, lebar[i] - 2 * RUANG).baris.length)
            );
            return {
              tidakTerpecah: barisTerbanyak <= 12,
              sel: tabel.kolom.map((k) => ({
                isi: b[k.kunci] ?? "",
                rata: RATA[k.rata ?? "kiri"] ?? "kiri",
                ...(p.selang && nomor % 2 === 1 ? { latar: "F6F8FA" } : {}),
              })),
            };
          });
    return {
      jenis: "tabel",
      garis: "penuh",
      ukuran,
      ruangSel: titikKeCm(RUANG),
      lebarKolom: lebar.map(titikKeCm),
      baris: [kepala, ...isi],
    };
  };

  if (naskah.indikator) {
    judulBagian(naskah.judulIndikator);
    blok.push(tabelDocx(naskah.indikator, 8.5, { selang: false, kosong: naskah.tabelKosong }));
    blok.push(alinea("", { ukuran: 8 }));
  }
  // Tabel tanpa kolom tidak ditulis: Word menolak tabel tanpa kisi dan sel.
  if (naskah.tabel.kolom.length > 0) {
    judulBagian(naskah.judulTabel);
    blok.push(tabelDocx(naskah.tabel, naskah.tataLetak.ukuranTabel, { selang: true, kosong: naskah.tabelKosong }));
    blok.push(alinea("", { ukuran: 8 }));
  }

  // --------------------------------------------------------------------------
  // Catatan
  // --------------------------------------------------------------------------
  if (naskah.catatan.length > 0) {
    blok.push(alinea("Catatan:", { tebal: true, ukuran: 9, jarakSesudah: 2, tetapBersama: true }));
    naskah.catatan.forEach((c, i) => blok.push(alinea(c, { nomor: i + 1, ukuran: 8.5, jarakSesudah: 1 })));
    blok.push(alinea("", { ukuran: 10 }));
  }

  // --------------------------------------------------------------------------
  // Tanda tangan: satu baris tabel tanpa garis yang tidak boleh terbelah
  // --------------------------------------------------------------------------
  const UK_T = 10;
  const { kiri, kanan } = naskah.tandaTangan;
  const jumlahAtas = Math.max(kiri.atas.length, kanan.atas.length);
  const blokTtd = (b: typeof kiri): AlineaDocx[] => [
    ...Array.from({ length: jumlahAtas - b.atas.length }, () => alinea("", { rata: "tengah", ukuran: UK_T })),
    ...b.atas.map((t) => alinea(t, { rata: "tengah", ukuran: UK_T })),
    // Ruang tanda tangan kira-kira 2 cm.
    alinea("", { rata: "tengah", ukuran: UK_T, jarakSesudah: 46 }),
    alinea(b.nama, { rata: "tengah", ukuran: UK_T, tebal: b.namaTerisi, garisBawah: b.namaTerisi }),
    alinea(b.nip, { rata: "tengah", ukuran: UK_T }),
  ];
  blok.push({
    jenis: "tabel",
    garis: "tanpa",
    ruangSel: 0.1,
    ukuran: UK_T,
    lebarKolom: [lebarIsiCm * 0.03, lebarIsiCm * 0.38, lebarIsiCm * 0.18, lebarIsiCm * 0.38, lebarIsiCm * 0.03],
    baris: [
      {
        tidakTerpecah: true,
        sel: [{ isi: "" }, { isi: blokTtd(kiri) }, { isi: "" }, { isi: blokTtd(kanan) }, { isi: "" }],
      },
    ],
  });

  return buatDocx({
    blok,
    huruf: "Arial",
    ukuran: 10,
    margin: MARGIN_CM,
    kertas,
    mendatar: true,
    kaki: { teks: naskah.kaki, nomorHalaman: true, ukuran: 7.5 },
  });
}
