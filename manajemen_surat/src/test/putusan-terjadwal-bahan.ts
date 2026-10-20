import { deflateRawSync } from "node:zlib";

/**
 * Bahan bersama uji Unggah Putusan Terjadwal (21 Okt 2026, agen B3): RTF dan DOCX karangan,
 * penulis zip sederhana. Nama pihak karangan; tidak ada NIK atau alamat.
 */

export const NOMOR = "12/Pdt.G/2026/PA.Dgl";
export const NOMOR_LAIN = "13/Pdt.G/2026/PA.Dgl";
export const PENGGUGAT = "Wulandari binti Kartasasmita";
export const TERGUGAT = "Hendrawan bin Sulaiman";

/** Kerangka putusan berbentuk templat satker. anonim = nama diganti sebutan. */
export function barisPutusan(nomor = NOMOR, { anonim = false }: { anonim?: boolean } = {}): string[] {
  const p = anonim ? "Penggugat" : PENGGUGAT;
  const t = anonim ? "Tergugat" : TERGUGAT;
  return [
    "SALINAN",
    "PUTUSAN",
    `Nomor ${nomor}`,
    "DEMI KEADILAN BERDASARKAN KETUHANAN YANG MAHA ESA",
    "PENGADILAN AGAMA DONGGALA",
    "Memeriksa dan mengadili perkara tertentu pada tingkat pertama telah menjatuhkan putusan dalam perkara Cerai Gugat antara:",
    `${p}, sebagai Penggugat;`,
    "melawan",
    `${t}, sebagai Tergugat;`,
    "DUDUK PERKARA",
    `Bahwa Penggugat dengan surat gugatannya yang terdaftar dalam register Nomor ${nomor} mengemukakan hal-hal berikut;`,
    "PERTIMBANGAN HUKUM",
    "Menimbang, bahwa maksud dan tujuan gugatan Penggugat adalah sebagaimana diuraikan di atas;",
    "MENGADILI:",
    "1. Mengabulkan gugatan Penggugat secara verstek;",
    `2. Menjatuhkan talak satu ba'in sughra Tergugat (${t}) terhadap Penggugat (${p});`,
    "Demikian diputuskan dalam rapat musyawarah Majelis Hakim pada hari Selasa tanggal 1 September 2026;",
    `Putusan Nomor ${nomor}`,
  ];
}

export const BARIS_BAS = [
  "BERITA ACARA SIDANG",
  `Nomor ${NOMOR}`,
  "Sidang Pertama",
  "Pengadilan Agama Donggala yang memeriksa dan mengadili perkara Cerai Gugat pada tingkat pertama;",
  `${PENGGUGAT}, sebagai Penggugat;`,
];

export function rtf(baris: string[]): Uint8Array {
  return new TextEncoder().encode(`{\\rtf1\\ansi ${baris.join("\\par ")}}`);
}

function tulis16(n: number) {
  return Buffer.from([n & 0xff, (n >> 8) & 0xff]);
}
function tulis32(n: number) {
  return Buffer.from([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff]);
}

/** Zip sederhana (CRC tidak dihitung - pembaca di kode tidak memeriksanya). metode 8 = deflate, 0 = simpan. */
export function buatZip(entri: Array<{ nama: string; isi: string }>, metode: 0 | 8 = 8): Uint8Array {
  const bagian: Buffer[] = [];
  const pusat: Buffer[] = [];
  let posisi = 0;
  for (const e of entri) {
    const nama = Buffer.from(e.nama, "utf8");
    const mentah = Buffer.from(e.isi, "utf8");
    const data = metode === 8 ? deflateRawSync(mentah) : mentah;
    const lokal = Buffer.concat([
      tulis32(0x04034b50), tulis16(20), tulis16(0), tulis16(metode), tulis16(0), tulis16(0), tulis32(0),
      tulis32(data.length), tulis32(mentah.length), tulis16(nama.length), tulis16(0), nama, data,
    ]);
    pusat.push(
      Buffer.concat([
        tulis32(0x02014b50), tulis16(20), tulis16(20), tulis16(0), tulis16(metode), tulis16(0), tulis16(0), tulis32(0),
        tulis32(data.length), tulis32(mentah.length), tulis16(nama.length), tulis16(0), tulis16(0), tulis16(0), tulis16(0),
        tulis32(0), tulis32(posisi), nama,
      ])
    );
    bagian.push(lokal);
    posisi += lokal.length;
  }
  const dir = Buffer.concat(pusat);
  const akhir = Buffer.concat([tulis32(0x06054b50), tulis16(0), tulis16(0), tulis16(entri.length), tulis16(entri.length), tulis32(dir.length), tulis32(posisi), tulis16(0)]);
  return new Uint8Array(Buffer.concat([...bagian, dir, akhir]));
}

const lolos = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** DOCX minimal: satu paragraf per baris di word/document.xml. */
export function buatDocx(baris: string[], metode: 0 | 8 = 8): Uint8Array {
  const isi = baris.map((b) => `<w:p><w:r><w:t xml:space="preserve">${lolos(b)}</w:t></w:r></w:p>`).join("");
  return buatZip(
    [
      { nama: "[Content_Types].xml", isi: '<?xml version="1.0"?><Types/>' },
      { nama: "word/document.xml", isi: `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="x"><w:body>${isi}</w:body></w:document>` },
    ],
    metode
  );
}
