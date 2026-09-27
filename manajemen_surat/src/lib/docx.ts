import { deflateRawSync } from "node:zlib";

/**
 * Penulis DOCX (Tahap 4 - Kemandirian Blangko).
 *
 * ============================================================================
 * TANPA PUSTAKA TAMBAHAN, DAN ITU DISENGAJA
 * ============================================================================
 *
 * DOCX adalah berkas ZIP berisi beberapa XML. Menuliskannya sendiri di atas
 * zlib bawaan Node menghindarkan satu dependensi baru - dan dependensi baru
 * berarti package.json ikut berubah, yang justru berkas paling mudah bentrok
 * antara dua sesi yang bekerja bersamaan.
 *
 * Yang dibutuhkan naskah pengadilan sederhana: alinea, rata kiri atau tengah,
 * tebal, daftar bernomor, jarak baris, dan margin.
 *
 * ============================================================================
 * SEJAK 2.40.0: TABEL, GAMBAR, HALAMAN MENDATAR, DAN KAKI HALAMAN
 * ============================================================================
 *
 * Eviden SKP hakim (27 September 2026) menuntut kop berlogo, tabel perkara
 * yang kepalanya diulang di tiap halaman, kertas mendatar, dan nomor halaman.
 * Semuanya TAMBAHAN yang hanya muncul bila diminta: berkas yang disusun dengan
 * `alinea` saja - blangko penetapan - tidak mendapat satu pun unsur baru,
 * ruang nama baru, atau bagian ZIP baru.
 *
 * Satu perubahan menyentuh blangko lama, dan disengaja: urutan unsur di dalam
 * <w:pPr> kini mengikuti skema OOXML (spacing, ind, lalu jc). Sebelumnya jc
 * ditulis paling depan. Word dan LibreOffice membukanya sama saja, tetapi
 * pemeriksa skema menolaknya - dan unsur baru (keepNext, pBdr) HARUS berada
 * di depan spacing, sehingga urutan lama tidak dapat dipertahankan tanpa
 * menulis dua urutan yang berbeda untuk satu hal yang sama.
 *
 * ============================================================================
 * PENYANDIAN XML BUKAN HIASAN
 * ============================================================================
 *
 * Nama pihak dapat memuat "&" dan kutipan; kalimat hukum memuat "<" pada
 * rujukan tertentu. Satu saja yang lolos tanpa disandikan membuat seluruh
 * dokumen gagal dibuka Word - dan yang membukanya adalah panitera pada hari
 * sidang, bukan yang membuatnya.
 */

/** Satu alinea naskah beserta bentuk tampilnya. */
export type AlineaDocx = {
  teks: string;
  /** "kiri" | "tengah" | "kanan" | "justify". Bawaan justify - bentuk naskah pengadilan. */
  rata?: "kiri" | "tengah" | "kanan" | "justify";
  tebal?: boolean;
  /** Nomor daftar bila alinea ini butir bernomor. */
  nomor?: number;
  /** Menjorok dari kiri, dalam sentimeter. */
  jorok?: number;
  /** Jarak sesudah alinea, dalam titik. Bawaan 6. */
  jarakSesudah?: number;

  // --------------------------------------------------------------------------
  // Tambahan 2.40.0 - semuanya opsional. Tanpa satu pun di antaranya, alinea
  // ditulis persis seperti sebelumnya.
  // --------------------------------------------------------------------------
  /** Penanda jenis blok; boleh dihilangkan. */
  jenis?: "alinea";
  miring?: boolean;
  /** Garis bawah pada tulisannya (nama pejabat di tanda tangan). */
  garisBawah?: boolean;
  /** Ukuran huruf alinea ini dalam titik. Bawaan: ukuran berkas. */
  ukuran?: number;
  /** Jarak antarbaris: 1 = tunggal. Bawaan 1,5 - bentuk naskah pengadilan. */
  spasi?: number;
  /** Jarak sebelum alinea, dalam titik. */
  jarakSebelum?: number;
  /** Garis di bawah alinea (bukan di bawah tulisan) - garis ganda kop surat. */
  garisAlinea?: "ganda" | "tunggal";
  /** Warna tulisan "RRGGBB". */
  warna?: string;
  /** Jangan dipisahkan dari alinea sesudahnya oleh pindah halaman. */
  tetapBersama?: boolean;
};

/** Gambar PNG atau JPEG sebagai satu alinea tersendiri (logo kop). */
export type GambarDocx = {
  jenis: "gambar";
  data: Buffer;
  /** Ukuran tampil dalam sentimeter. */
  lebar: number;
  tinggi: number;
  rata?: "kiri" | "tengah" | "kanan";
  /** Keterangan gambar untuk pembaca layar. */
  keterangan?: string;
  /** Jarak sesudah alinea gambarnya, dalam titik. Bawaan 0. */
  jarakSesudah?: number;
};

/** Satu sel tabel. */
export type SelTabelDocx = {
  /**
   * Isi sel. Teks biasa menjadi alinea berspasi tunggal; "\n" di dalamnya
   * memulai alinea baru di sel yang sama. Susunan alinea/gambar dipakai apa
   * adanya.
   */
  isi: string | Array<AlineaDocx | GambarDocx>;
  /** Jumlah kolom yang diliputi sel ini (gabung ke kanan). Bawaan 1. */
  gabung?: number;
  /** Warna latar "RRGGBB". */
  latar?: string;
  rataTegak?: "atas" | "tengah" | "bawah";
  /** Bentuk teks bila isinya teks biasa. */
  tebal?: boolean;
  miring?: boolean;
  rata?: "kiri" | "tengah" | "kanan" | "justify";
};

export type BarisTabelDocx = {
  sel: SelTabelDocx[];
  /** Baris kepala: diulang Word di puncak tiap halaman. */
  kepala?: boolean;
  /** Baris tidak boleh terbelah di dua halaman. */
  tidakTerpecah?: boolean;
};

export type TabelDocx = {
  jenis: "tabel";
  /** Lebar tiap kolom dalam sentimeter - tabel berlebar tetap. */
  lebarKolom: number[];
  baris: BarisTabelDocx[];
  /** Garis sel. Bawaan "penuh". */
  garis?: "penuh" | "tanpa";
  /** Ukuran huruf isi tabel (titik). Bawaan: ukuran berkas. */
  ukuran?: number;
  /** Ruang dalam sel kiri-kanan, dalam sentimeter. Bawaan 0,1. */
  ruangSel?: number;
  /** Letak tabel di halaman. Bawaan kiri. */
  rata?: "kiri" | "tengah";
};

export type BlokDocx = AlineaDocx | GambarDocx | TabelDocx;

export type BerkasDocx = {
  /** Alinea naskah - bentuk lama, tetap berlaku. */
  alinea?: AlineaDocx[];
  /** Blok campuran alinea/tabel/gambar, ditulis SESUDAH `alinea`. */
  blok?: BlokDocx[];
  /** Huruf naskah. Bawaan Times New Roman - yang dipakai blangko pengadilan. */
  huruf?: string;
  /** Ukuran huruf dalam titik. Bawaan 12. */
  ukuran?: number;
  /** Margin dalam sentimeter: [atas, kanan, bawah, kiri]. */
  margin?: [number, number, number, number];
  /** Ukuran kertas. Bawaan F4 (215 x 330 mm) - kertas naskah pengadilan. */
  kertas?: "A4" | "F4" | "Letter";
  /** Kertas mendatar (landscape). */
  mendatar?: boolean;
  /** Kaki halaman: teks di kiri dan/atau "Halaman x dari y" di kanan. */
  kaki?: { teks?: string; nomorHalaman?: boolean; ukuran?: number };
};

/** Menyandikan teks untuk badan XML. */
export function sandikanXml(teks: string): string {
  return String(teks ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Bita kendali tidak sah di XML 1.0 dan membuat Word menolak berkasnya
    // seluruhnya. Yang tersisa dari penguraian RTF kadang memuatnya.
    .replace(/[\0-\b\v\f\x0e-\x1f]/g, "");
}

/** Sentimeter ke twip (1/1440 inci) - satuan yang dipakai OOXML. */
function cmKeTwip(cm: number): number {
  return Math.round((cm / 2.54) * 1440);
}

/** Sentimeter ke EMU (1/360.000 cm) - satuan gambar DrawingML. */
function cmKeEmu(cm: number): number {
  return Math.round(cm * 360000);
}

const KERTAS: Record<string, { lebar: number; tinggi: number }> = {
  A4: { lebar: cmKeTwip(21), tinggi: cmKeTwip(29.7) },
  F4: { lebar: cmKeTwip(21.5), tinggi: cmKeTwip(33) },
  Letter: { lebar: cmKeTwip(21.59), tinggi: cmKeTwip(27.94) },
};

const RATA_OOXML: Record<string, string> = {
  kiri: "left",
  tengah: "center",
  kanan: "right",
  justify: "both",
};

const RATA_TEGAK: Record<string, string> = { atas: "top", tengah: "center", bawah: "bottom" };

const NS_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const NS_WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const NS_PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";

/** Warna "RRGGBB" yang sah, atau kosong - warna tak sah membuat Word menolak berkas. */
function warnaSah(warna: string | undefined): string {
  const w = String(warna ?? "").replace(/^#/, "").toUpperCase();
  return /^[0-9A-F]{6}$/.test(w) ? w : "";
}

// ============================================================================
// Konteks penyusunan: gambar yang disematkan dan nomor pengenal gambar
// ============================================================================

type MediaDocx = { nama: string; data: Buffer; rId: string; jenis: "png" | "jpeg" };

type KonteksDocx = {
  media: MediaDocx[];
  nomorGambar: number;
};

function jenisGambar(data: Buffer): "png" | "jpeg" {
  if (data.length >= 8 && data.readUInt32BE(0) === 0x89504e47) return "png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpeg";
  throw new Error("Gambar DOCX harus PNG atau JPEG.");
}

/** Gambar yang sama (logo di kop tiap dokumen) disimpan sekali saja. */
function daftarkanMedia(konteks: KonteksDocx, data: Buffer): MediaDocx {
  const ada = konteks.media.find((m) => m.data.equals(data));
  if (ada) return ada;
  const jenis = jenisGambar(data);
  const nomor = konteks.media.length + 1;
  const media: MediaDocx = {
    nama: `gambar${nomor}.${jenis === "png" ? "png" : "jpeg"}`,
    data,
    rId: `rIdGbr${nomor}`,
    jenis,
  };
  konteks.media.push(media);
  return media;
}

// ============================================================================
// Alinea
// ============================================================================

function alineaXml(a: AlineaDocx, ukuran: number): string {
  const rata = RATA_OOXML[a.rata ?? "justify"] ?? "both";
  const setengahTitik = Math.round((a.ukuran ?? ukuran) * 2);
  const jarak = Math.round((a.jarakSesudah ?? 6) * 20);
  const sebelum = a.jarakSebelum ? ` w:before="${Math.round(a.jarakSebelum * 20)}"` : "";
  const baris = Math.round(240 * (a.spasi ?? 1.5));
  const jorok = a.jorok ? ` w:left="${cmKeTwip(a.jorok)}"` : "";

  const bagian: string[] = [];
  bagian.push("<w:p><w:pPr>");
  // Urutan menurut skema CT_PPrBase: keepNext, pBdr, spacing, ind, jc.
  if (a.tetapBersama) bagian.push("<w:keepNext/>");
  if (a.garisAlinea === "ganda") {
    bagian.push('<w:pBdr><w:bottom w:val="double" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>');
  } else if (a.garisAlinea === "tunggal") {
    bagian.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/></w:pBdr>');
  }
  bagian.push(`<w:spacing${sebelum} w:after="${jarak}" w:line="${baris}" w:lineRule="auto"/>`);
  if (jorok) bagian.push(`<w:ind${jorok}/>`);
  bagian.push(`<w:jc w:val="${rata}"/>`);
  // Ukuran tanda alinea. Tinggi alinea kosong ditentukan tanda alineanya,
  // bukan tulisannya - tanpa ini alinea pemisah setinggi huruf bawaan.
  if (a.ukuran !== undefined) {
    bagian.push(`<w:rPr><w:sz w:val="${setengahTitik}"/><w:szCs w:val="${setengahTitik}"/></w:rPr>`);
  }
  bagian.push("</w:pPr>");

  // Nomor ditulis sebagai teks, bukan sebagai daftar otomatis Word.
  //
  // Daftar otomatis menyimpan penomorannya di berkas terpisah dan menomori
  // ulang sendiri saat alinea disisipkan. Pada blangko ABT sungguhan itulah
  // yang membuat bukti kedua kehilangan nomornya. Nomor sebagai teks tidak
  // dapat berubah sendiri - dan pada naskah resmi, tidak berubah sendiri jauh
  // lebih berharga daripada rapi otomatis.
  const isi = a.nomor ? `${a.nomor}. ${a.teks}` : a.teks;

  // Alinea berukuran-sendiri yang kosong (pemisah antarbagian) tanpa run.
  if (!isi && a.ukuran !== undefined) {
    bagian.push("</w:p>");
    return bagian.join("");
  }

  bagian.push("<w:r><w:rPr>");
  // Urutan menurut skema CT_RPr: b, i, color, sz, szCs, u.
  if (a.tebal) bagian.push("<w:b/>");
  if (a.miring) bagian.push("<w:i/>");
  const warna = warnaSah(a.warna);
  if (warna) bagian.push(`<w:color w:val="${warna}"/>`);
  bagian.push(`<w:sz w:val="${setengahTitik}"/><w:szCs w:val="${setengahTitik}"/>`);
  if (a.garisBawah) bagian.push('<w:u w:val="single"/>');
  bagian.push("</w:rPr>");
  bagian.push(`<w:t xml:space="preserve">${sandikanXml(isi)}</w:t>`);
  bagian.push("</w:r></w:p>");
  return bagian.join("");
}

// ============================================================================
// Gambar
// ============================================================================

function gambarXml(g: GambarDocx, konteks: KonteksDocx): string {
  const media = daftarkanMedia(konteks, g.data);
  konteks.nomorGambar += 1;
  const id = konteks.nomorGambar;
  const cx = cmKeEmu(g.lebar);
  const cy = cmKeEmu(g.tinggi);
  const rata = RATA_OOXML[g.rata ?? "kiri"] ?? "left";
  const jarak = Math.round((g.jarakSesudah ?? 0) * 20);
  const keterangan = sandikanXml(g.keterangan ?? "Gambar");

  return (
    "<w:p><w:pPr>" +
    `<w:spacing w:after="${jarak}" w:line="240" w:lineRule="auto"/>` +
    `<w:jc w:val="${rata}"/>` +
    "</w:pPr><w:r><w:drawing>" +
    '<wp:inline distT="0" distB="0" distL="0" distR="0">' +
    `<wp:extent cx="${cx}" cy="${cy}"/>` +
    `<wp:docPr id="${id}" name="Gambar ${id}" descr="${keterangan}"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="${NS_A}" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="${NS_A}"><a:graphicData uri="${NS_PIC}">` +
    `<pic:pic xmlns:pic="${NS_PIC}">` +
    `<pic:nvPicPr><pic:cNvPr id="${id}" name="${media.nama}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${media.rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>` +
    "</pic:pic></a:graphicData></a:graphic>" +
    "</wp:inline></w:drawing></w:r></w:p>"
  );
}

// ============================================================================
// Tabel
// ============================================================================

function garisTabelXml(garis: "penuh" | "tanpa"): string {
  const satu = (nama: string) =>
    garis === "penuh"
      ? `<w:${nama} w:val="single" w:sz="4" w:space="0" w:color="000000"/>`
      : `<w:${nama} w:val="nil"/>`;
  return `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(satu).join("")}</w:tblBorders>`;
}

function isiSelXml(
  sel: SelTabelDocx,
  ukuran: number,
  konteks: KonteksDocx
): string {
  if (typeof sel.isi === "string") {
    const baris = sel.isi.split(/\r?\n/);
    return baris
      .map((teks) =>
        alineaXml(
          {
            jenis: "alinea",
            teks,
            rata: sel.rata ?? "kiri",
            tebal: sel.tebal,
            miring: sel.miring,
            ukuran,
            spasi: 1,
            jarakSesudah: 0,
          },
          ukuran
        )
      )
      .join("");
  }
  // Sel Word wajib memuat sekurang-kurangnya satu alinea.
  if (sel.isi.length === 0) {
    return alineaXml({ jenis: "alinea", teks: "", ukuran, spasi: 1, jarakSesudah: 0 }, ukuran);
  }
  return sel.isi
    .map((b) => (b.jenis === "gambar" ? gambarXml(b, konteks) : alineaXml(b, ukuran)))
    .join("");
}

function tabelXml(t: TabelDocx, ukuranBerkas: number, konteks: KonteksDocx): string {
  const lebar = t.lebarKolom.map((cm) => Math.max(1, cmKeTwip(cm)));
  const total = lebar.reduce((a, b) => a + b, 0);
  const ruang = cmKeTwip(t.ruangSel ?? 0.1);
  const ukuran = t.ukuran ?? ukuranBerkas;

  const bagian: string[] = [];
  bagian.push("<w:tbl><w:tblPr>");
  // Urutan menurut skema CT_TblPr: tblW, jc, tblBorders, tblLayout, tblCellMar.
  bagian.push(`<w:tblW w:w="${total}" w:type="dxa"/>`);
  if (t.rata === "tengah") bagian.push('<w:jc w:val="center"/>');
  bagian.push(garisTabelXml(t.garis ?? "penuh"));
  // Lebar tetap: Word tidak menyusun ulang kolom menurut isinya, sehingga
  // lebar yang dihitung penyusun (dan dipakai PDF-nya) juga yang tampil.
  bagian.push('<w:tblLayout w:type="fixed"/>');
  bagian.push(
    `<w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="${ruang}" w:type="dxa"/>` +
      `<w:bottom w:w="0" w:type="dxa"/><w:right w:w="${ruang}" w:type="dxa"/></w:tblCellMar>`
  );
  bagian.push("</w:tblPr>");
  bagian.push(`<w:tblGrid>${lebar.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`);

  for (const baris of t.baris) {
    bagian.push("<w:tr>");
    if (baris.kepala || baris.tidakTerpecah) {
      // Urutan CT_TrPr: cantSplit sebelum tblHeader.
      bagian.push("<w:trPr>");
      if (baris.tidakTerpecah || baris.kepala) bagian.push("<w:cantSplit/>");
      if (baris.kepala) bagian.push("<w:tblHeader/>");
      bagian.push("</w:trPr>");
    }
    let kolom = 0;
    for (const sel of baris.sel) {
      const gabung = Math.max(1, Math.min(sel.gabung ?? 1, lebar.length - kolom));
      const lebarSel = lebar.slice(kolom, kolom + gabung).reduce((a, b) => a + b, 0);
      kolom += gabung;
      bagian.push("<w:tc><w:tcPr>");
      // Urutan CT_TcPr: tcW, gridSpan, shd, vAlign.
      bagian.push(`<w:tcW w:w="${lebarSel}" w:type="dxa"/>`);
      if (gabung > 1) bagian.push(`<w:gridSpan w:val="${gabung}"/>`);
      const latar = warnaSah(sel.latar);
      if (latar) bagian.push(`<w:shd w:val="clear" w:color="auto" w:fill="${latar}"/>`);
      bagian.push(`<w:vAlign w:val="${RATA_TEGAK[sel.rataTegak ?? "atas"] ?? "top"}"/>`);
      bagian.push("</w:tcPr>");
      bagian.push(isiSelXml(sel, ukuran, konteks));
      bagian.push("</w:tc>");
    }
    bagian.push("</w:tr>");
  }
  bagian.push("</w:tbl>");
  return bagian.join("");
}

// ============================================================================
// Dokumen
// ============================================================================

function adaTambahan(berkas: BerkasDocx): boolean {
  return Boolean(berkas.kaki) || (berkas.blok ?? []).some((b) => b.jenis === "gambar" || b.jenis === "tabel");
}

function badanXml(berkas: BerkasDocx, konteks: KonteksDocx): string {
  const ukuran = berkas.ukuran ?? 12;
  const bagian: string[] = (berkas.alinea ?? []).map((a) => alineaXml(a, ukuran));

  const blok = berkas.blok ?? [];
  for (let i = 0; i < blok.length; i += 1) {
    const b = blok[i];
    if (b.jenis === "tabel") {
      bagian.push(tabelXml(b, ukuran, konteks));
      // Dua tabel yang bersebelahan DILEBUR Word menjadi satu tabel; dan badan
      // yang berakhir dengan tabel ditambahi alinea oleh Word sendiri. Alinea
      // pemisah setipis mungkin menjaga keduanya tetap seperti yang disusun.
      const berikut = blok[i + 1];
      if (!berikut || berikut.jenis === "tabel") {
        bagian.push(alineaXml({ jenis: "alinea", teks: "", ukuran: 2, spasi: 1, jarakSesudah: 0 }, ukuran));
      }
    } else if (b.jenis === "gambar") {
      bagian.push(gambarXml(b, konteks));
    } else {
      bagian.push(alineaXml(b, ukuran));
    }
  }
  return bagian.join("");
}

function documentXml(berkas: BerkasDocx, konteks: KonteksDocx): string {
  const dasar = KERTAS[berkas.kertas ?? "F4"] ?? KERTAS.F4;
  const kertas = berkas.mendatar ? { lebar: dasar.tinggi, tinggi: dasar.lebar } : dasar;
  const [atas, kanan, bawah, kiri] = berkas.margin ?? [2, 2, 2, 3];
  const tambahan = adaTambahan(berkas);

  const isi = badanXml(berkas, konteks);
  const ruangNama = tambahan
    ? `xmlns:w="${NS_W}" xmlns:r="${NS_R}" xmlns:wp="${NS_WP}"`
    : `xmlns:w="${NS_W}"`;
  const orientasi = berkas.mendatar ? ' w:orient="landscape"' : "";
  const kaki = berkas.kaki ? '<w:footerReference w:type="default" r:id="rIdKaki"/>' : "";

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:document ${ruangNama}>` +
    "<w:body>" +
    isi +
    "<w:sectPr>" +
    kaki +
    `<w:pgSz w:w="${kertas.lebar}" w:h="${kertas.tinggi}"${orientasi}/>` +
    `<w:pgMar w:top="${cmKeTwip(atas)}" w:right="${cmKeTwip(kanan)}" w:bottom="${cmKeTwip(bawah)}" w:left="${cmKeTwip(kiri)}" w:header="720" w:footer="${berkas.kaki ? 454 : 720}" w:gutter="0"/>` +
    "</w:sectPr>" +
    "</w:body></w:document>"
  );
}

/** Satu medan Word (PAGE, NUMPAGES) beserta nilai sementaranya. */
function medanXml(perintah: string, rPr: string): string {
  return (
    `<w:r>${rPr}<w:fldChar w:fldCharType="begin"/></w:r>` +
    `<w:r>${rPr}<w:instrText xml:space="preserve"> ${perintah} </w:instrText></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="separate"/></w:r>` +
    `<w:r>${rPr}<w:t>1</w:t></w:r>` +
    `<w:r>${rPr}<w:fldChar w:fldCharType="end"/></w:r>`
  );
}

function kakiXml(berkas: BerkasDocx): string {
  const kaki = berkas.kaki ?? {};
  const setengahTitik = Math.round((kaki.ukuran ?? 8) * 2);
  const rPr = `<w:rPr><w:sz w:val="${setengahTitik}"/><w:szCs w:val="${setengahTitik}"/></w:rPr>`;
  const dasar = KERTAS[berkas.kertas ?? "F4"] ?? KERTAS.F4;
  const lebarKertas = berkas.mendatar ? dasar.tinggi : dasar.lebar;
  const [, kanan, , kiri] = berkas.margin ?? [2, 2, 2, 3];
  const tepiKanan = Math.max(0, lebarKertas - cmKeTwip(kanan) - cmKeTwip(kiri));

  const bagian: string[] = [];
  bagian.push(`<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="${tepiKanan}"/></w:tabs>`);
  bagian.push('<w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr>');
  if (kaki.teks) bagian.push(`<w:r>${rPr}<w:t xml:space="preserve">${sandikanXml(kaki.teks)}</w:t></w:r>`);
  if (kaki.nomorHalaman) {
    bagian.push(`<w:r>${rPr}<w:tab/></w:r>`);
    bagian.push(`<w:r>${rPr}<w:t xml:space="preserve">Halaman </w:t></w:r>`);
    bagian.push(medanXml("PAGE", rPr));
    bagian.push(`<w:r>${rPr}<w:t xml:space="preserve"> dari </w:t></w:r>`);
    bagian.push(medanXml("NUMPAGES", rPr));
  }
  bagian.push("</w:p>");

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<w:ftr xmlns:w="${NS_W}" xmlns:r="${NS_R}">` +
    bagian.join("") +
    "</w:ftr>"
  );
}

function stylesXml(berkas: BerkasDocx): string {
  const huruf = sandikanXml(berkas.huruf ?? "Times New Roman");
  const setengahTitik = (berkas.ukuran ?? 12) * 2;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:docDefaults><w:rPrDefault><w:rPr>" +
    `<w:rFonts w:ascii="${huruf}" w:hAnsi="${huruf}" w:cs="${huruf}"/>` +
    `<w:sz w:val="${setengahTitik}"/><w:szCs w:val="${setengahTitik}"/>` +
    "</w:rPr></w:rPrDefault></w:docDefaults>" +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>' +
    "</w:styles>"
  );
}

const CONTENT_TYPES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

function contentTypesXml(berkas: BerkasDocx, konteks: KonteksDocx): string {
  if (!adaTambahan(berkas) && konteks.media.length === 0) return CONTENT_TYPES;
  const jenis = new Set(konteks.media.map((m) => m.jenis));
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    (jenis.has("png") ? '<Default Extension="png" ContentType="image/png"/>' : "") +
    (jenis.has("jpeg") ? '<Default Extension="jpeg" ContentType="image/jpeg"/>' : "") +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    (berkas.kaki
      ? '<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>'
      : "") +
    "</Types>"
  );
}

const RELS_AKAR =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const RELS_DOKUMEN =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

function relsDokumenXml(berkas: BerkasDocx, konteks: KonteksDocx): string {
  if (!berkas.kaki && konteks.media.length === 0) return RELS_DOKUMEN;
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    konteks.media
      .map(
        (m) =>
          `<Relationship Id="${m.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${m.nama}"/>`
      )
      .join("") +
    (berkas.kaki
      ? '<Relationship Id="rIdKaki" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
      : "") +
    "</Relationships>"
  );
}

// ============================================================================
// Penulis ZIP
// ============================================================================

const TABEL_CRC = (() => {
  const tabel = new Int32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    tabel[i] = c;
  }
  return tabel;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) c = TABEL_CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

type EntriZip = { nama: string; isi: Buffer };

/**
 * Menyusun berkas ZIP dari beberapa entri.
 *
 * Waktu berkas disetel tetap, bukan waktu sekarang: dua penerbitan atas naskah
 * yang sama harus menghasilkan berkas yang sama persis, supaya keduanya dapat
 * dibandingkan. Berkas yang berubah hanya karena jamnya berbeda membuat
 * perbandingan mustahil.
 */
function susunZip(entri: EntriZip[]): Buffer {
  const potongan: Buffer[] = [];
  const pusat: Buffer[] = [];
  let offset = 0;

  for (const e of entri) {
    const nama = Buffer.from(e.nama, "utf8");
    const mampat = deflateRawSync(e.isi, { level: 9 });
    const crc = crc32(e.isi);

    const kepala = Buffer.alloc(30);
    kepala.writeUInt32LE(0x04034b50, 0);
    kepala.writeUInt16LE(20, 4); // versi minimal
    kepala.writeUInt16LE(0x0800, 6); // nama berkas dalam UTF-8
    kepala.writeUInt16LE(8, 8); // deflate
    kepala.writeUInt16LE(0, 10); // waktu tetap
    kepala.writeUInt16LE(0x21, 12); // tanggal tetap: 1 Januari 1980
    kepala.writeUInt32LE(crc, 14);
    kepala.writeUInt32LE(mampat.length, 18);
    kepala.writeUInt32LE(e.isi.length, 22);
    kepala.writeUInt16LE(nama.length, 26);
    kepala.writeUInt16LE(0, 28);

    potongan.push(kepala, nama, mampat);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x21, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(mampat.length, 20);
    dir.writeUInt32LE(e.isi.length, 24);
    dir.writeUInt16LE(nama.length, 28);
    dir.writeUInt16LE(0, 30);
    dir.writeUInt16LE(0, 32);
    dir.writeUInt16LE(0, 34);
    dir.writeUInt16LE(0, 36);
    dir.writeUInt32LE(0, 38);
    dir.writeUInt32LE(offset, 42);

    pusat.push(dir, nama);
    offset += kepala.length + nama.length + mampat.length;
  }

  const isiPusat = Buffer.concat(pusat);
  const akhir = Buffer.alloc(22);
  akhir.writeUInt32LE(0x06054b50, 0);
  akhir.writeUInt16LE(0, 4);
  akhir.writeUInt16LE(0, 6);
  akhir.writeUInt16LE(entri.length, 8);
  akhir.writeUInt16LE(entri.length, 10);
  akhir.writeUInt32LE(isiPusat.length, 12);
  akhir.writeUInt32LE(offset, 16);
  akhir.writeUInt16LE(0, 20);

  return Buffer.concat([...potongan, isiPusat, akhir]);
}

/** Menyusun berkas DOCX yang siap dibuka Word. */
export function buatDocx(berkas: BerkasDocx): Buffer {
  const konteks: KonteksDocx = { media: [], nomorGambar: 0 };
  // document.xml disusun lebih dulu: gambar yang ditemuinya menentukan isi
  // [Content_Types].xml dan rels-nya.
  const dokumen = documentXml(berkas, konteks);

  return susunZip([
    { nama: "[Content_Types].xml", isi: Buffer.from(contentTypesXml(berkas, konteks), "utf8") },
    { nama: "_rels/.rels", isi: Buffer.from(RELS_AKAR, "utf8") },
    { nama: "word/document.xml", isi: Buffer.from(dokumen, "utf8") },
    { nama: "word/_rels/document.xml.rels", isi: Buffer.from(relsDokumenXml(berkas, konteks), "utf8") },
    { nama: "word/styles.xml", isi: Buffer.from(stylesXml(berkas), "utf8") },
    ...(berkas.kaki ? [{ nama: "word/footer1.xml", isi: Buffer.from(kakiXml(berkas), "utf8") }] : []),
    ...konteks.media.map((m) => ({ nama: `word/media/${m.nama}`, isi: m.data })),
  ]);
}
