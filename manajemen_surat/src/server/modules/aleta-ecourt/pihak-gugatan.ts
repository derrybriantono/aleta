import { uraiTeksIdentitas, type MedanIdentitas, type PeriksaNik } from "@/app/api/aleta-ecourt/saksi-scan/urai-ktp";
import { rapikanAlamat } from "@/lib/alamat-pihak";

/**
 * ============================================================================
 * IDENTITAS PARA PIHAK DARI KEPALA SURAT GUGATAN (perbaikan 5 Okt 2026 butir 28)
 * ============================================================================
 *
 * Kepala gugatan menulis identitas tiap pihak sebagai SATU KALIMAT:
 *
 *   "SITI AMINAH binti LA ODE, umur 29 tahun, agama Islam, pendidikan SLTP,
 *    pekerjaan Ibu Rumah Tangga, tempat kediaman di Desa Labuan, Kecamatan
 *    Labuan, Kabupaten Donggala, Provinsi Sulawesi Tengah, sebagai Penggugat;"
 *
 * Berkas ini memotong kalimat itu menjadi baris berlabel lalu menyerahkannya
 * ke PENGURAI YANG SAMA dengan foto KTP (uraiTeksIdentitas: agama, pekerjaan,
 * NIK diperiksa, tempat/tanggal lahir), dan alamatnya ke PERAPI ALAMAT YANG
 * SAMA dengan panel PTSP (rapikanAlamat). Tidak ada pengurai alamat kedua:
 * nama wilayah dibaca dari potongan alamat rapi yang BERSEBUTAN (Desa/
 * Kelurahan, Kecamatan, Kabupaten/Kota, Provinsi) - yang tidak bersebutan
 * tidak ditebak tingkatnya.
 *
 * Hasilnya USULAN per pihak, ditinjau di panel (terbaca vs kosong) lalu
 * diisikan ke blangko "Tambah Referensi Data Pihak" lewat kartu KTP - jalur
 * isian yang sama, Simpan oleh petugas.
 */

export type PeranPihak = "Penggugat" | "Pemohon" | "Tergugat" | "Termohon";

export type MedanPihakGugatan = MedanIdentitas & {
  /** Umur dalam tahun, bila gugatan menyebut umur alih-alih tanggal lahir. */
  umur: string;
  pendidikan: string;
  /** Domisili elektronik (surel) yang tertulis pada identitas pihak ini. */
  surel: string;
  /** Alamat lengkap sesudah dirapikan rapikanAlamat - yang diisikan ke SIPP. */
  alamatLengkap: string;
};

export type PihakGugatan = {
  peran: PeranPihak;
  /** "Penggugat", "Tergugat II", ... */
  sebutan: string;
  medan: MedanPihakGugatan;
  nik: PeriksaNik | null;
  catatan: string[];
  /** Medan yang terisi / yang tetap kosong - untuk pratinjau sebelum mengisi. */
  terbaca: string[];
  kosong: string[];
  /** Kalimat identitas apa adanya (dipotong) - supaya petugas dapat mencocokkan. */
  asal: string;
  /** Satu baris ringkas ("Penggugat: NAMA") - bentuk petikan yang digambar panel Lama/Baru. */
  nilai: string;
};

const POLA_PERAN =
  /(?:,|;)?\s*(?:selanjutnya\s+)?(?:dalam\s+hal\s+ini\s+)?(?:disebut\s+)?(?:sebagai\s+)(Penggugat|Pemohon|Tergugat|Termohon)(?:\s+(I{1,3}|IV|V|\d))?\b/gi;

const POLA_ALAMAT =
  /(?:bertempat\s+(?:tinggal|kediaman)|tempat\s+(?:tinggal|kediaman)|beralamat|alamat)\s*(?:di|:)?\s*:?\s*([\s\S]+?)(?=\s*[,;.]?\s*(?:domisili\s+elektronik|alamat\s+(?:surel|e-?mail)|e-?mail|surel|nomor\s+(?:telepon|hp|handphone|whatsapp)|no\.?\s*(?:telp|hp)\.?|telepon|dalam\s+hal\s+ini|selanjutnya|sebagai\s+(?:penggugat|pemohon|tergugat|termohon))|$)/i;

const POLA_SUREL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const BULAN: Record<string, string> = {
  januari: "01", februari: "02", pebruari: "02", maret: "03", april: "04", mei: "05", juni: "06",
  juli: "07", agustus: "08", september: "09", oktober: "10", nopember: "11", november: "11", desember: "12",
};

function bersih(x: string): string {
  return String(x || "").replace(/\s+/g, " ").trim();
}

/** "5 Mei 1990" / "05-05-1990" -> "05-05-1990" (bentuk yang dikenal cariTanggal). */
function tanggalBaris(teks: string): string {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(teks);
  if (m && BULAN[m[2].toLowerCase()]) return `${m[1].padStart(2, "0")}-${BULAN[m[2].toLowerCase()]}-${m[3]}`;
  const n = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(teks);
  return n ? `${n[1].padStart(2, "0")}-${n[2].padStart(2, "0")}-${n[3]}` : "";
}

/** Nama wilayah dari potongan alamat rapi yang BERSEBUTAN. */
function wilayahDariAlamat(alamatRapi: string) {
  const hasil = { kelurahan: "", kecamatan: "", kabupaten: "", provinsi: "", alamat: "", rt: "", rw: "" };
  const depan: string[] = [];
  const tanpaDomisili = alamatRapi.replace(/[.,]?\s*Domisili\s+elektronik[\s\S]*$/i, "");
  for (const potong of tanpaDomisili.split(",").map(bersih).filter(Boolean)) {
    let m: RegExpExecArray | null;
    if ((m = /^(?:Desa|Kelurahan|Kel\.?)\s+(.+)$/i.exec(potong)) && !hasil.kelurahan) hasil.kelurahan = m[1];
    else if ((m = /^(?:Kecamatan|Kec\.?)\s+(.+)$/i.exec(potong)) && !hasil.kecamatan) hasil.kecamatan = m[1];
    else if ((m = /^(Kabupaten|Kab\.?|Kota)\s+(.+)$/i.exec(potong)) && !hasil.kabupaten)
      hasil.kabupaten = `${/^kota$/i.test(m[1]) ? "Kota" : "Kabupaten"} ${m[2]}`;
    else if ((m = /^(?:Provinsi|Propinsi|Prov\.?)\s+(.+)$/i.exec(potong)) && !hasil.provinsi) hasil.provinsi = m[1];
    else if ((m = /^RT\.?\s*(\d{1,3})\s*[/,]?\s*RW\.?\s*(\d{1,3})$/i.exec(potong))) {
      hasil.rt = m[1].padStart(3, "0");
      hasil.rw = m[2].padStart(3, "0");
    } else if (!hasil.kelurahan) depan.push(potong);
  }
  hasil.alamat = depan.join(", ");
  return hasil;
}

/** Satu kalimat identitas -> medan pihak. */
function uraiSatu(kalimat: string, peran: PeranPihak, sebutan: string): PihakGugatan {
  let sisa = bersih(kalimat)
    .replace(/^(?:\d+\s*[.)]\s*)+/, "")
    .replace(/^(?:yang\s+bertanda\s+tangan\s+di\s+bawah\s+ini|dengan\s+hormat)\s*[,:;]?\s*/i, "")
    .replace(/^(?:melawan|lawan)\s*[:;,]?\s*/i, "");

  // Alamat dipotong lebih dulu: koma di dalamnya bukan pemisah ruas.
  let alamatMentah = "";
  const al = POLA_ALAMAT.exec(sisa);
  if (al) {
    alamatMentah = bersih(al[1]).replace(/[,;.]+$/, "");
    sisa = `${sisa.slice(0, al.index)}, ${sisa.slice(al.index + al[0].length)}`;
  }
  let surel = "";
  const sr = POLA_SUREL.exec(sisa) || POLA_SUREL.exec(kalimat);
  if (sr) surel = sr[0];
  let telepon = "";
  const tp = /(?:nomor\s+(?:telepon|hp|handphone|whatsapp)|no\.?\s*(?:telp|hp)\.?|telepon|hp)\s*:?\s*(\+?[\d][\d\s-]{7,})/i.exec(sisa);
  if (tp) telepon = tp[1].replace(/[^\d+]/g, "");

  // Tempat/tanggal lahir - "tempat dan tanggal lahir Donggala, 5 Mei 1990" / "lahir di Palu pada tanggal 05-05-1990".
  let ttl = "";
  const lahir =
    /(?:tempat\s*(?:dan|\/|&)?\s*tanggal\s+lahir|tempat,?\s*tgl\.?\s*lahir|lahir\s+di)\s*:?\s*([A-Za-z .'-]+?)\s*,?\s*(?:pada\s+)?(?:tanggal\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})/i.exec(sisa);
  if (lahir) {
    const tgl = tanggalBaris(lahir[2]);
    if (tgl) ttl = `${bersih(lahir[1])}, ${tgl}`;
    sisa = sisa.replace(lahir[0], "");
  }

  const ruas = sisa.split(/[,;]/).map(bersih).filter(Boolean);
  const nama = bersih((ruas.shift() || "").replace(/^nama(?:\s+lengkap)?\s*:?\s*/i, ""));
  let umur = "";
  let pendidikan = "";
  let agama = "";
  let pekerjaan = "";
  let nikMentah = "";
  for (const r of ruas) {
    let m: RegExpExecArray | null;
    if ((m = /^(?:umur|usia)\s*:?\s*(\d{1,3})\s*(?:tahun|thn)?/i.exec(r))) umur = m[1];
    else if ((m = /^(\d{1,3})\s*tahun$/i.exec(r))) umur = m[1];
    else if ((m = /^agama\s*:?\s*(.+)$/i.exec(r))) agama = m[1];
    else if ((m = /^pendidikan(?:\s+terakhir)?\s*:?\s*(.+)$/i.exec(r))) pendidikan = m[1];
    else if ((m = /^pekerjaan\s*:?\s*(.+)$/i.exec(r))) pekerjaan = m[1];
    else if ((m = /^(?:NIK|nomor\s+induk\s+kependudukan|no\.?\s*KTP)\s*:?\s*(.+)$/i.exec(r))) nikMentah = m[1];
  }

  // Pengurai yang SAMA dengan foto KTP.
  const baris = [
    nama ? `Nama : ${nama}` : "",
    nikMentah ? `NIK : ${nikMentah}` : "",
    ttl ? `Tempat/Tgl Lahir : ${ttl}` : "",
    agama ? `Agama : ${agama}` : "",
    pekerjaan ? `Pekerjaan : ${pekerjaan}` : "",
    telepon ? `No. HP : ${telepon}` : "",
  ].filter(Boolean);
  const u = uraiTeksIdentitas(baris.join("\n"));

  const rapi = alamatMentah ? rapikanAlamat(alamatMentah) : null;
  const wil = wilayahDariAlamat(rapi ? rapi.alamat : "");
  const catatan = [...u.catatan];
  let jenisKelamin = u.medan.jenisKelamin;
  if (!jenisKelamin) {
    if (/\bbinti\b/i.test(nama)) jenisKelamin = "P";
    else if (/\bbin\b/i.test(nama)) jenisKelamin = "L";
    if (jenisKelamin) catatan.push(`Jenis kelamin disimpulkan dari "${jenisKelamin === "P" ? "binti" : "bin"}" pada nama - periksa.`);
  }
  if (rapi && rapi.kurang.length) catatan.push(`Alamat belum menyebut ${rapi.kurang.join(", ")} - tidak ditambahkan sendiri.`);

  const medan: MedanPihakGugatan = {
    ...u.medan,
    jenisKelamin,
    alamat: wil.alamat,
    rt: wil.rt,
    rw: wil.rw,
    kelurahan: wil.kelurahan,
    kecamatan: wil.kecamatan,
    kabupaten: wil.kabupaten,
    provinsi: wil.provinsi,
    kewarganegaraan: u.medan.kewarganegaraan,
    umur,
    pendidikan: bersih(pendidikan),
    surel,
    alamatLengkap: rapi ? rapi.alamat : "",
  };
  const DAFTAR: Array<[keyof MedanPihakGugatan, string]> = [
    ["nama", "nama"],
    ["nik", "NIK"],
    ["tempatLahir", "tempat lahir"],
    ["tanggalLahir", "tanggal lahir"],
    ["umur", "umur"],
    ["jenisKelamin", "jenis kelamin"],
    ["agama", "agama"],
    ["pendidikan", "pendidikan"],
    ["pekerjaan", "pekerjaan"],
    ["alamatLengkap", "alamat"],
    ["kelurahan", "kelurahan/desa"],
    ["kecamatan", "kecamatan"],
    ["kabupaten", "kabupaten/kota"],
    ["provinsi", "provinsi"],
    ["surel", "domisili elektronik"],
    ["telepon", "telepon"],
  ];
  const terbaca = DAFTAR.filter(([k]) => Boolean(medan[k])).map(([, l]) => l);
  // Umur atau tanggal lahir - salah satu cukup.
  const kosong = DAFTAR.filter(([k]) => !medan[k])
    .filter(([k]) => !(k === "umur" && medan.tanggalLahir) && !(k === "tanggalLahir" && medan.umur) && !(k === "tempatLahir" && medan.umur))
    .map(([, l]) => l);
  return {
    peran,
    sebutan,
    medan,
    nik: u.nik,
    catatan,
    terbaca,
    kosong,
    asal: bersih(kalimat).slice(0, 400),
    nilai: `${sebutan}: ${medan.nama || "(nama tidak terbaca)"}`,
  };
}

/**
 * Seluruh pihak yang identitasnya ditulis "..., sebagai Penggugat/Tergugat"
 * di kepala gugatan. Kalimat identitas = teks di antara akhir pihak
 * sebelumnya (atau awal bagian identitas) dan sebutan perannya.
 */
export function uraiPihakGugatan(teksMentah: string): PihakGugatan[] {
  const teks = String(teksMentah || "").replace(/\r/g, "");
  // Hanya kepala gugatan: identitas selalu sebelum posita/duduk perkara.
  const batasPosita = teks.search(/\b(?:adapun\s+(?:alasan|dalil)|duduk\s+perkara|posita|dengan\s+alasan|alasan-alasan\s+sebagai\s+berikut)\b/i);
  const kepala = batasPosita > 0 ? teks.slice(0, batasPosita + 40) : teks.slice(0, 6000);
  const hasil: PihakGugatan[] = [];
  let dari = 0;
  // Bagian identitas mulai sesudah "Yang bertanda tangan di bawah ini" bila ada.
  const pembuka = /yang\s+bertanda\s+tangan\s+di\s+bawah\s+ini\s*[,:;]?/i.exec(kepala);
  if (pembuka) dari = pembuka.index + pembuka[0].length;
  POLA_PERAN.lastIndex = 0;
  let m: RegExpExecArray | null;
  const dilihat = new Set<string>();
  while ((m = POLA_PERAN.exec(kepala))) {
    if (m.index < dari) continue;
    const peran = (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) as PeranPihak;
    const sebutan = m[2] ? `${peran} ${m[2]}` : peran;
    let kalimat = kepala.slice(dari, m.index);
    // Paragraf terakhir sebelum sebutan peran (judul/kop surat di atasnya bukan identitas).
    const potong = kalimat.lastIndexOf("\n\n");
    if (potong > 0 && kalimat.slice(potong).trim().length > 20) kalimat = kalimat.slice(potong);
    const lawan = /\b(?:melawan|lawan)\s*[:;,]?\s*/i.exec(kalimat);
    if (lawan) kalimat = kalimat.slice(lawan.index + lawan[0].length);
    dari = m.index + m[0].length;
    if (dilihat.has(sebutan) || bersih(kalimat).length < 5) continue;
    // Kalimat tanpa satu pun ruas identitas bukan identitas ("... disebut sebagai Penggugat" dalam posita).
    if (!/\b(?:umur|usia|agama|pekerjaan|tempat\s+(?:tinggal|kediaman)|bertempat|alamat|lahir|NIK)\b/i.test(kalimat)) continue;
    dilihat.add(sebutan);
    hasil.push(uraiSatu(kalimat, peran, sebutan));
    if (hasil.length >= 8) break;
  }
  return hasil;
}
