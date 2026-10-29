import { PDFDocument } from "pdf-lib";

import { buangGrupTersembunyiRtf } from "@/lib/buang-grup-tersembunyi-rtf";
import { bakuNamaTtd, intiNamaTtd, type BarisTtd } from "@/lib/ttd-milik-sendiri";
import { postGatewayKonversiNaskah, getGatewayAbtPdf } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import { ApiError } from "@/server/shared/errors";

import { BATAS_KONVERSI, kenaliBentukNaskah } from "./konversi-naskah";
import { bacaItemPdf, bubuhkanTtdPdf, padatkan, susunBaris, type AturTtd, type Baris } from "./pdf-bubuh-ttd";

/**
 * ============================================================================
 * BAS DARI WORD KE PDF BERTANDA TANGAN SCAN (30 Okt 2026)
 * ============================================================================
 *
 * Jendela e-Doc BAS di SIPP (Jadwal Sidang > Kelola Dokumen Elektronik) menolak berkas yang bukan PDF. Petugas biasanya
 * menyunting BAS di Word (RTF, DOCX, DOC), jadi ekstensi memintanya diubah di sini lalu menaruh PDF-nya di kotak pilih berkas
 * SIPP - SIPP sendiri yang mengunggah (akun dan jejaknya sama dengan unggahan biasa).
 *
 *   Word -> PDF   RTF lewat jalur PDF Direktori Putusan (abt/pdf di bot), DOCX/DOC langsung lewat konversi-naskah ke=pdf
 *                 (satu kali soffice, tanpa dibulatkan lewat RTF).
 *   Tanda tangan  blok tanda tangan DIBACA DARI PDF-nya (label "Panitera Pengganti" / "Ketua Majelis" / "Hakim Tunggal" dan nama di
 *                 bawahnya, dipasangkan menurut kolom), bukan ditebak dari RTF. Gambar scan yang SAH dibubuhkan di atas nama masing-masing
 *                 dengan pembubuh yang sama dengan PDF Blangko Derry (pdf-bubuh-ttd).
 *
 * Hak tanda tangan SAMA dengan rute tanda-tangan/[id]/gambar: akun dengan kapabilitas "blangko-abt" (admin) boleh memasang tanda
 * tangan siapa pun yang sudah disahkan; akun lain hanya miliknya sendiri. Yang tidak terpasang TIDAK menggagalkan PDF - PDF tetap
 * jadi dan tiap penanda tangan dilaporkan (terpasang / belum punya tanda tangan tersahkan / bukan hak akun ini / tidak terpasang).
 *
 * Tidak ada yang disimpan dan tidak ada yang ditulis ke SIPP. Metadata PDF dijaga bebas dari tanda ALETA.
 */

export type BentukWord = "rtf" | "docx" | "doc";
export type StatusPenanda = "terpasang" | "belum-ada" | "bukan-hak" | "tidak-terpasang" | "dimatikan";
export type PeranPenanda = "pp" | "ketua" | "anggota";

export type Penanda = {
  peran: PeranPenanda;
  jabatan: string;
  nama: string;
  status: StatusPenanda;
  keterangan: string;
};

export type HasilWordPdf = {
  pdf: Uint8Array;
  namaBerkas: string;
  bentukAsal: BentukWord;
  /** "ditemukan" | "tidak-dikenali" (blok tanda tangan tidak terbaca di PDF) | "dimatikan" (petugas tidak meminta tanda tangan). */
  blokTtd: "ditemukan" | "tidak-dikenali" | "dimatikan";
  penandatangan: Penanda[];
  peringatan: string[];
};

export const BATAS_WORD_PDF = BATAS_KONVERSI;

// ----------------------------------------------------------------------------
// Mengenali berkas Word dari ISINYA (bukan namanya)
// ----------------------------------------------------------------------------
function ada(bita: Uint8Array, pola: Uint8Array, dari = 0, sampai = bita.length): boolean {
  if (!pola.length) return true;
  const akhir = Math.min(sampai, bita.length) - pola.length;
  let i = Math.max(0, dari);
  while (i <= akhir) {
    i = bita.indexOf(pola[0], i);
    if (i < 0 || i > akhir) return false;
    let cocok = true;
    for (let k = 1; k < pola.length; k += 1) {
      if (bita[i + k] !== pola[k]) {
        cocok = false;
        break;
      }
    }
    if (cocok) return true;
    i += 1;
  }
  return false;
}
const ascii = (s: string) => new Uint8Array(Array.from(s, (c) => c.charCodeAt(0)));
const utf16 = (s: string) => new Uint8Array(Array.from(s, (c) => [c.charCodeAt(0), 0]).flat());

/**
 * "rtf" | "docx" | "doc" bila isinya berkas Word; "pdf" bila sudah PDF; "" bila bukan keduanya. ZIP lain (xlsx, arsip) dan OLE lain (xls) BUKAN
 * Word, supaya berkas unggahan yang sah tidak dibelokkan. DOCX/DOCM/DOTX dan ODT (zip) semuanya diperlakukan "docx" - soffice membukanya.
 */
export function kenaliBerkasWord(bita: Uint8Array): BentukWord | "pdf" | "" {
  const dasar = kenaliBentukNaskah(bita);
  if (dasar === "pdf") return "pdf";
  if (dasar === "rtf") return "rtf";
  if (dasar === "docx") {
    // Direktori pusat zip ada di ujung berkas; entri pertama ada di pangkal.
    const ujung = Math.max(0, bita.length - 512 * 1024);
    const word = ascii("word/");
    const odt = ascii("application/vnd.oasis.opendocument.text");
    if (ada(bita, word, 0, 64 * 1024) || ada(bita, word, ujung) || ada(bita, odt, 0, 4096)) return "docx";
    return "";
  }
  if (dasar === "doc") return ada(bita, utf16("WordDocument")) ? "doc" : "";
  return "";
}

// ----------------------------------------------------------------------------
// Nama berkas
// ----------------------------------------------------------------------------
/** "BAS 12 Aleta.docx" -> "BAS 12.pdf". Tanpa jalur, tanpa kata ALETA, tanpa tanda yang dilarang berkas. */
export function namaPdfDariWord(nama: unknown): string {
  const dasar = String(nama ?? "")
    .replace(/^.*[\\/]/, "")
    .replace(/\.(?:rtf|docx?|docm|dotx?|dotm|odt|ott|wps|txt)$/i, "")
    .replace(/a[\s._\-*]*l[\s._\-*]*e[\s._\-*]*t[\s._\-*]*a/gi, "")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s._-]+|[\s._-]+$/g, "")
    .slice(0, 150)
    .trim();
  return `${dasar || "BAS"}.pdf`;
}

// ----------------------------------------------------------------------------
// Blok tanda tangan BAS dari baris-baris PDF
// ----------------------------------------------------------------------------
type Segmen = { teks: string; xMin: number; xMax: number; y: number; tinggi: number; halaman: number };
export type PenandaDiPdf = { peran: PeranPenanda; jabatan: string; nama: string };

const POLA_PERAN: Array<{ pola: RegExp; peran: PeranPenanda; jabatan: string }> = [
  { pola: /panitera\s+pengganti/gi, peran: "pp", jabatan: "Panitera Pengganti" },
  { pola: /hakim\s+tunggal/gi, peran: "ketua", jabatan: "Hakim Tunggal" },
  { pola: /ketua\s+majelis/gi, peran: "ketua", jabatan: "Ketua Majelis" },
  { pola: /hakim\s+ketua/gi, peran: "ketua", jabatan: "Hakim Ketua" },
  { pola: /hakim\s+anggota(?:\s*[1-9ivx]+)?/gi, peran: "anggota", jabatan: "Hakim Anggota" },
];

/** Peran bila SELURUH teks segmen hanyalah label jabatan ("Ketua Majelis,"), selain itu null. Kalimat "…oleh Ketua Majelis dan Panitera Pengganti." bukan label. */
function peranLabel(teks: string): { peran: PeranPenanda; jabatan: string } | null {
  let sisa = teks;
  let temu: { peran: PeranPenanda; jabatan: string } | null = null;
  for (const p of POLA_PERAN) {
    const pola = new RegExp(p.pola.source, "gi");
    if (pola.test(sisa)) {
      temu = temu ?? { peran: p.peran, jabatan: p.jabatan };
      sisa = sisa.replace(new RegExp(p.pola.source, "gi"), " ");
    }
  }
  if (!temu) return null;
  return sisa.replace(/[\s,.:;()\-–—]/g, "") === "" ? temu : null;
}

/**
 * Satu baris dipecah menjadi kolom: celah mendatar lebar (tabulasi, kolom tabel) ATAU tiga spasi berturut-turut (kolom yang disusun
 * dengan spasi - LibreOffice menulisnya sebagai satu potongan teks berspasi lebar).
 */
function segmenBaris(b: Baris): Segmen[] {
  const hasil: Segmen[] = [];
  let mulai = -1;
  let terakhir = -1;
  const tutup = () => {
    if (mulai >= 0) {
      const teks = b.teks.slice(mulai, terakhir + 1).replace(/\s+/g, " ").trim();
      if (teks) hasil.push({ teks, xMin: b.xAwal[mulai], xMax: b.xAkhir[terakhir], y: b.y, tinggi: b.tinggi, halaman: b.halaman });
    }
    mulai = -1;
  };
  for (let i = 0; i < b.teks.length; i += 1) {
    if (/\s/.test(b.teks[i])) continue;
    if (mulai < 0) {
      mulai = i;
      terakhir = i;
      continue;
    }
    const spasi = i - terakhir - 1;
    const celahX = b.xAwal[i] - b.xAkhir[terakhir];
    if (spasi >= 3 || celahX > Math.max(2 * b.tinggi, 14)) {
      tutup();
      mulai = i;
    }
    terakhir = i;
  }
  tutup();
  return hasil;
}

/** Pantas dibaca sebagai NAMA orang (bukan kalimat, nomor halaman, "ttd", atau penanda isian yang belum terisi). */
function miripNama(teks: string): boolean {
  const t = teks.trim();
  if (t.length < 4 || t.length > 90) return false;
  if (/[#\[\]{}_]|\d{3,}/.test(t)) return false;
  if (/^\(?\s*(?:ttd|tanda\s+tangan|ttd\.)\s*\)?[.,]?$/i.test(t)) return false;
  if (/halaman|hal\.\s*\d|untuk\s+salinan|nip\b|panitera\s*$|^dan$/i.test(t)) return false;
  if (!/\p{L}{3,}/u.test(t)) return false;
  if (t.split(/\s+/).length > 12) return false;
  return /\p{Lu}/u.test(t);
}

/**
 * Membaca blok tanda tangan terakhir naskah: baris label jabatan paling akhir (dan label di dekatnya pada halaman yang sama), lalu nama-nama
 * di bawahnya dipasangkan dengan label menurut kolom (jarak mendatar titik tengah), cadangan jarak tegak. Mengembalikan [] bila tak dikenali.
 */
export function bacaBlokTtdBas(baris: Baris[]): PenandaDiPdf[] {
  if (!baris.length) return [];
  const label: Array<Segmen & { peran: PeranPenanda; jabatan: string; indeks: number }> = [];
  baris.forEach((b, i) => {
    for (const s of segmenBaris(b)) {
      const p = peranLabel(s.teks);
      if (p) label.push({ ...s, ...p, indeks: i });
    }
  });
  if (!label.length) return [];
  const akhir = label.reduce((m, l) => (l.indeks > m.indeks ? l : m), label[0]);
  // Label yang sehalaman dan berdekatan dengan label terakhir (≤ 10 baris) = satu blok.
  const blok = label.filter((l) => l.halaman === akhir.halaman && akhir.indeks - l.indeks <= 10);
  const awal = Math.min(...blok.map((l) => l.indeks));
  const penanda: Array<{ label: (typeof blok)[number]; nama: Segmen }> = [];
  for (let i = awal; i < baris.length; i += 1) {
    if (baris[i].halaman !== akhir.halaman) continue;
    if (i > akhir.indeks + 8) break;
    for (const s of segmenBaris(baris[i])) {
      if (peranLabel(s.teks) || !miripNama(s.teks)) continue;
      // Label di atas nama itu (y lebih besar = lebih tinggi di halaman).
      const kandidat = blok.filter((l) => l.y >= s.y - 1);
      if (!kandidat.length) continue;
      const pusat = (s.xMin + s.xMax) / 2;
      let terbaik = kandidat[0];
      let skor = Infinity;
      for (const l of kandidat) {
        const dx = Math.abs((l.xMin + l.xMax) / 2 - pusat);
        const tumpang = Math.min(s.xMax, l.xMax) - Math.max(s.xMin, l.xMin);
        const sk = dx + (tumpang > 0 ? 0 : 200) + 0.5 * (l.y - s.y);
        if (sk < skor) {
          skor = sk;
          terbaik = l;
        }
      }
      penanda.push({ label: terbaik, nama: s });
    }
  }
  // Satu label, satu nama: bila ada dua nama di bawah satu label, yang tertera paling dekat di bawah label yang dipakai.
  const dipakai = new Map<string, { label: (typeof blok)[number]; nama: Segmen }>();
  for (const p of penanda) {
    const kunci = `${p.label.indeks}:${Math.round(p.label.xMin)}`;
    const ada = dipakai.get(kunci);
    if (!ada || p.label.y - p.nama.y < ada.label.y - ada.nama.y) dipakai.set(kunci, p);
  }
  return Array.from(dipakai.values())
    .sort((a, b) => a.label.xMin - b.label.xMin || b.label.y - a.label.y)
    .map((p) => ({ peran: p.label.peran, jabatan: p.label.jabatan, nama: p.nama.teks.replace(/[\s,;]+$/, "") }));
}

// ----------------------------------------------------------------------------
// Mencocokkan nama di PDF dengan baris tanda tangan yang SAH
// ----------------------------------------------------------------------------
type BarisSah = BarisTtd & { id: number; namaPejabat: string };

/** Sama dengan cocokkanBarisTtd di panel Blangko Derry: nama penuh dulu; lalu nama inti yang menunjuk SATU orang; terbaru/ditautkan didahulukan. */
export function cocokkanBarisTtd(nama: string, daftar: readonly BarisSah[], akunId = ""): BarisSah | null {
  const semua = daftar.filter((b) => b && b.disahkan !== false && String(b.namaPejabat || "").trim());
  const urut = (xs: BarisSah[]) =>
    xs.slice().sort((a, b) => (b.penggunaId ? 1 : 0) - (a.penggunaId ? 1 : 0) || String(b.disahkanPada || "").localeCompare(String(a.disahkanPada || "")) || Number(b.id) - Number(a.id))[0];
  if (akunId) {
    const sendiri = semua.filter((b) => String(b.penggunaId || "") === akunId && namaCocok(b.namaPejabat, nama));
    if (sendiri.length) return urut(sendiri);
  }
  const penuh = semua.filter((b) => bakuNamaTtd(b.namaPejabat) && bakuNamaTtd(b.namaPejabat) === bakuNamaTtd(nama));
  if (penuh.length) return urut(penuh);
  const inti = intiNamaTtd(nama);
  if (inti.length < 5) return null;
  const sebagian = semua.filter((b) => intiNamaTtd(b.namaPejabat) === inti);
  if (!sebagian.length) return null;
  if (new Set(sebagian.map((b) => bakuNamaTtd(b.namaPejabat))).size > 1) return null; // dua orang berbeda: tidak ditebak
  return urut(sebagian);
}
function namaCocok(a: string, b: string): boolean {
  const penuh = bakuNamaTtd(a);
  if (penuh && penuh === bakuNamaTtd(b)) return true;
  const inti = intiNamaTtd(a);
  return inti.length >= 5 && inti === intiNamaTtd(b);
}

// ----------------------------------------------------------------------------
// Metadata PDF tanpa tanda ALETA
// ----------------------------------------------------------------------------
const POLA_ALETA = /a[\s._\-*]*l[\s._\-*]*e[\s._\-*]*t[\s._\-*]*a/gi;
/** Judul/Penulis/Subjek/Kata kunci/Pembuat/Penghasil PDF yang menyebut ALETA dikosongkan di bagian itu saja. PDF tanpa tanda dikembalikan apa adanya. */
export async function pdfTanpaTandaAleta(bita: Uint8Array): Promise<Uint8Array> {
  try {
    const dok = await PDFDocument.load(bita, { updateMetadata: false });
    const bersih = (s: string | undefined) => (s ? s.replace(POLA_ALETA, "").replace(/\s{2,}/g, " ").trim() : s);
    const bidang: Array<[string, string | undefined, (v: string) => void]> = [
      ["Title", dok.getTitle(), (v) => dok.setTitle(v)],
      ["Author", dok.getAuthor(), (v) => dok.setAuthor(v)],
      ["Subject", dok.getSubject(), (v) => dok.setSubject(v)],
      ["Creator", dok.getCreator(), (v) => dok.setCreator(v)],
      ["Producer", dok.getProducer(), (v) => dok.setProducer(v)],
    ];
    let berubah = false;
    for (const [, nilai, tulis] of bidang) {
      if (nilai && new RegExp(POLA_ALETA.source, "i").test(nilai)) {
        tulis(bersih(nilai) ?? "");
        berubah = true;
      }
    }
    const kata = dok.getKeywords();
    if (kata && new RegExp(POLA_ALETA.source, "i").test(kata)) {
      dok.setKeywords([bersih(kata) ?? ""]);
      berubah = true;
    }
    return berubah ? await dok.save({ useObjectStreams: false, updateFieldAppearances: false }) : bita;
  } catch {
    return bita;
  }
}

// ----------------------------------------------------------------------------
// Pintu utama
// ----------------------------------------------------------------------------
export type DepsWordPdf = {
  /** Berkas Word -> PDF (soffice di bot). */
  ubahKePdf: (bita: Uint8Array, bentuk: BentukWord) => Promise<Uint8Array>;
  /** Semua baris tanda tangan yang SAH (belum disaring menurut akun). */
  daftarTtdSah: () => Promise<BarisSah[]>;
  /** Gambar tanda tangan (PNG/JPG) - null bila tidak terambil. */
  gambarTtd: (id: number) => Promise<Uint8Array | null>;
  /** Ukuran tanda tangan di PDF (satu set dengan PDF Blangko Derry). */
  atur?: Partial<AturTtd>;
};

export type MasukanWordPdf = {
  bita: Uint8Array;
  namaBerkas: string;
  denganTtd: boolean;
  /** Akun yang meminta; `bolehSemuaTtd` = punya kapabilitas "blangko-abt" (admin). */
  akun: { id: string; nama: string };
  bolehSemuaTtd: boolean;
};

const KET_STATUS: Record<StatusPenanda, string> = {
  terpasang: "tanda tangan terpasang",
  "belum-ada": "belum punya tanda tangan tersahkan - kolom tanda tangan dibiarkan kosong",
  "bukan-hak": "tanda tangannya hanya dapat dipasang oleh yang bersangkutan atau admin - dibiarkan kosong",
  "tidak-terpasang": "tanda tangan tidak dapat dipasang di PDF - dibiarkan kosong",
  dimatikan: "tanda tangan tidak diminta",
};

export async function wordKePdfBas(masukan: MasukanWordPdf, deps: DepsWordPdf): Promise<HasilWordPdf> {
  if (!masukan.bita || masukan.bita.length === 0) throw new ApiError(400, "Berkasnya kosong.");
  if (masukan.bita.length > BATAS_WORD_PDF) throw new ApiError(413, `Ukuran berkas melampaui ${BATAS_WORD_PDF / 1024 / 1024} MB.`);
  const bentuk = kenaliBerkasWord(masukan.bita);
  if (bentuk === "pdf") throw new ApiError(400, "Berkas ini sudah PDF; tidak perlu diubah.");
  if (!bentuk) throw new ApiError(400, "Isinya bukan berkas Word (RTF, DOCX, atau DOC) - dikenali dari isi berkasnya, bukan dari namanya.");

  const peringatan: string[] = [];
  const awal = bentuk === "rtf" ? buangGrupTersembunyiRtf(masukan.bita) : masukan.bita;
  let pdf = await deps.ubahKePdf(awal, bentuk);
  if (kenaliBentukNaskah(pdf) !== "pdf") throw new ApiError(502, "Hasil ubahan bukan PDF.");

  let penandatangan: Penanda[] = [];
  let blokTtd: HasilWordPdf["blokTtd"] = masukan.denganTtd ? "tidak-dikenali" : "dimatikan";

  if (masukan.denganTtd) {
    let baris: Baris[] = [];
    try {
      baris = susunBaris((await bacaItemPdf(pdf)).item);
    } catch {
      peringatan.push("Isi PDF tidak terbaca untuk mencari blok tanda tangan; PDF dibuat tanpa tanda tangan.");
    }
    const ditemukan = bacaBlokTtdBas(baris);
    if (ditemukan.length) {
      blokTtd = "ditemukan";
      let sah: BarisSah[] = [];
      let daftarGagal = false;
      try {
        sah = await deps.daftarTtdSah();
      } catch {
        daftarGagal = true;
      }
      if (daftarGagal) peringatan.push("Daftar tanda tangan belum dapat dibaca; PDF dibuat tanpa tanda tangan.");
      const boleh = masukan.bolehSemuaTtd ? sah : sah.filter((b) => (String(b.penggunaId || "").trim() ? String(b.penggunaId) === masukan.akun.id : namaCocok(b.namaPejabat, masukan.akun.nama)));
      const mau: Array<{ nama: string; gambar: Uint8Array; ke: Penanda }> = [];
      for (const d of ditemukan) {
        const p: Penanda = { peran: d.peran, jabatan: d.jabatan, nama: d.nama, status: "belum-ada", keterangan: "" };
        penandatangan.push(p);
        if (daftarGagal) {
          p.status = "tidak-terpasang";
          continue;
        }
        const milik = cocokkanBarisTtd(d.nama, boleh, masukan.akun.id);
        if (!milik) {
          p.status = cocokkanBarisTtd(d.nama, sah, masukan.akun.id) ? "bukan-hak" : "belum-ada";
          continue;
        }
        let gambar: Uint8Array | null = null;
        try {
          gambar = await deps.gambarTtd(Number(milik.id));
        } catch {
          gambar = null;
        }
        if (!gambar || !gambar.length) {
          p.status = "tidak-terpasang";
          continue;
        }
        mau.push({ nama: d.nama, gambar, ke: p });
      }
      if (mau.length) {
        const r = await bubuhkanTtdPdf(
          pdf,
          mau.map((m) => ({ nama: m.nama, gambar: m.gambar })),
          { atur: deps.atur }
        );
        if (r.dipasang.length) pdf = r.pdf;
        for (const m of mau) m.ke.status = r.dipasang.includes(m.nama) ? "terpasang" : "tidak-terpasang";
        if (r.galat) peringatan.push("Sebagian tanda tangan tidak dapat dipasang di PDF.");
      }
    } else {
      peringatan.push('Blok tanda tangan ("Panitera Pengganti", "Ketua Majelis") tidak terbaca di PDF; PDF dibuat tanpa tanda tangan. Periksa kembali susunan akhir BAS.');
    }
  } else {
    penandatangan = [];
  }
  for (const p of penandatangan) p.keterangan = KET_STATUS[p.status];

  pdf = await pdfTanpaTandaAleta(pdf);
  if (bentuk !== "rtf") peringatan.push("Berkas Word diubah langsung ke PDF; periksa tata letaknya (tabel, kolom, tanda tangan) sebelum disimpan.");
  return { pdf, namaBerkas: namaPdfDariWord(masukan.namaBerkas), bentukAsal: bentuk, blokTtd, penandatangan, peringatan };
}

// ----------------------------------------------------------------------------
// Penyambung bawaan ke bot
// ----------------------------------------------------------------------------
export async function ubahKePdfLewatBot(bita: Uint8Array, bentuk: BentukWord): Promise<Uint8Array> {
  if (bentuk === "rtf") {
    const jawab = await getGatewayAbtPdf(Buffer.from(bita).toString("base64"), { salinan: false });
    if (!jawab.ok) throw new ApiError(jawab.status === 422 ? 422 : 503, `Konversi di server gagal: ${jawab.error || "pengubah PDF belum dapat dihubungi"}`);
    return new Uint8Array(Buffer.from(String(jawab.data?.pdfBase64 || ""), "base64"));
  }
  const jawab = await postGatewayKonversiNaskah({ berkasBase64: Buffer.from(bita).toString("base64"), ke: "pdf" });
  if (!jawab.ok) {
    const status = jawab.status === 413 ? 413 : jawab.status === 422 ? 422 : 503;
    throw new ApiError(status, `Konversi di server gagal: ${jawab.error}`);
  }
  return new Uint8Array(Buffer.from(String(jawab.data?.berkasBase64 || ""), "base64"));
}

/** Dipakai pembaca teks PDF untuk uji: padatkan tersedia di modul pembubuh. */
export { padatkan };
