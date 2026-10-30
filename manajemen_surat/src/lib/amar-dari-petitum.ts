/**
 * ============================================================================
 * USULAN AMAR BERBUTIR DARI PETITUM MENURUT STATUS PUTUSAN (G2B 2.5, 30 Okt 2026)
 * ============================================================================
 *
 * Untuk borang Putusan Akhir SIPP (kolom Amar, CKEditor) yang masih KOSONG: bila status putusan sudah diketahui (pilihan status di
 * borang / status SIPP), amar disusun dari petitum perkara itu dan diisikan; petugas membaca lalu menekan Simpan sendiri. Amar yang
 * sudah diketik manusia tidak pernah ditimpa (penjaganya di ekstensi amar-petitum-sipp.js).
 *
 * Bentuk butir meniru amar SIPP PA Donggala yang sudah diputus (diukur atas sipp_2810, lihat uji amar-dari-petitum-g2b-30okt):
 *   - verstek  "Menyatakan Tergugat yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir;"
 *              lalu "Mengabulkan gugatan Penggugat secara verstek;"
 *   - CG       "Menjatuhkan talak satu ba'in shughra Tergugat (<nama>) terhadap Penggugat (<nama>);"
 *   - CT       "Memberi izin kepada Pemohon (<nama>) untuk menjatuhkan talak satu raj'i terhadap Termohon (<nama>) di depan sidang
 *              Pengadilan Agama <satker>;"
 *   - cabut    "Mengabulkan permohonan pencabutan perkara Nomor <nomor> dari Penggugat;" + "Memerintahkan Panitera untuk mencatat
 *              pencabutan perkara tersebut dalam register perkara;"
 *   - gugur    "Menyatakan gugatan Penggugat gugur;"   NO "Menyatakan gugatan Penggugat tidak dapat diterima (niet ontvankelijke verklaard);"
 *   - tolak    "Menolak gugatan Penggugat;"
 *   - biaya    "Membebankan kepada <pihak> untuk membayar biaya perkara ini sejumlah Rp<angka>,00 (<terbilang> rupiah)."
 *              PRODEO (keputusan pengguna 30 Okt): "Membebankan biaya perkara kepada DIPA Pengadilan Agama <satker> Tahun <tahun daftar>."
 *   - dikabulkan: butir petitum PRIMER selain "mengabulkan", "biaya", "verstek", "talak" (disusun baku di atas) dan subsider dipakai
 *     apa adanya (petitum memang ditulis dalam bentuk amar); "Mohon"/"agar" di depannya dibuang.
 *
 * Yang TIDAK pernah dikarang: besaran yang tidak tertulis (biaya belum diketahui -> titik-titik), butir yang dikabulkan pada "kabul
 * sebagian", pihak yang dibebani biaya pada gugatan non-perkawinan - semuanya menjadi PERTANYAAN bernomor dan titik-titik di amar.
 * Murni: tanpa jaringan dan basis data.
 */
import { terbilang } from "@/lib/biaya-perkara";
import { kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";

export type StatusAmar = "dikabulkan" | "dikabulkan-sebagian" | "ditolak" | "tidak-dapat-diterima" | "gugur" | "dicabut" | "perdamaian" | "dicoret";

export type MasukanAmar = {
  jenisPerkara: string;
  nomorPerkara: string;
  /** 15 gugatan, 16 permohonan; kosong = dari nomor (Pdt.G/Pdt.P). */
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  /** Nama status SIPP ("Dikabulkan", "Tidak Dapat Diterima", ...) atau kode StatusAmar. */
  status: string;
  /** Kabul untuk sebagian (status SIPP tetap "Dikabulkan"). */
  sebagian?: boolean;
  verstek?: boolean;
  /** Petitum SIPP (perkara.petitum, HTML CKEditor). */
  petitum: string;
  /** Nama pihak pertama / kedua sesuai SIPP, berurutan. */
  namaPihak1: string[];
  namaPihak2: string[];
  prodeo?: boolean;
  /** Nama satker tanpa "Pengadilan Agama", mis. "Donggala". */
  satker: string;
  /** Tahun pendaftaran perkara (untuk DIPA prodeo); kosong = dari nomor perkara. */
  tahunDaftar?: number | null;
  /** Biaya perkara (rupiah) bila sudah diketahui; kosong = titik-titik + pertanyaan. */
  biaya?: number | null;
};

export type PertanyaanAmar = { no: number; teks: string; usulan: string };
export type HasilAmar = {
  ok: boolean;
  status: StatusAmar | "";
  butir: string[];
  /** HTML <ol><li> seperti amar SIPP (siap diisikan ke CKEditor). */
  html: string;
  pertanyaan: PertanyaanAmar[];
  catatan: string[];
};

// ---------------------------------------------------------------------------
// Petitum -> butir
// ---------------------------------------------------------------------------
const ENTITAS: Record<string, string> = { "&nbsp;": " ", "&amp;": "&", "&#39;": "'", "&quot;": '"', "&lt;": "<", "&gt;": ">", "&rsquo;": "'", "&lsquo;": "'" };
export function polosPetitum(html: string): string {
  return String(html ?? "")
    .replace(/<\s*(?:br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (e) => ENTITAS[e.toLowerCase()] ?? " ")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ");
}

export type ButirPetitum = { teks: string; bagian: "primer" | "subsider" | "provisi" | "rekonvensi"; jenis: string };

const RX_JUDUL = /^(?:dalam\s+)?(primair|primer|subsidair|subsider|subsidiair|provisi|rekonvensi|konvensi|pokok\s+perkara)\s*[:.]?\s*$/i;
const RX_PENGANTAR = /(?:mohon|memohon)[^.]{0,120}(?:memeriksa|mengadili|menjatuhkan\s+putusan|berkenan)|sebagai\s+berikut\s*:?\s*$|^(?:primair|primer)\s*:/i;

function jenisButirPetitum(t: string): string {
  const s = t.toLowerCase();
  if (/ex\s*aequo|seadil[- ]?adilnya|putusan\s+(?:yang\s+)?lain/.test(s)) return "subsider";
  if (/biaya\s+perkara|membebankan\s+biaya/.test(s)) return "biaya";
  if (/^\s*(?:menyatakan\s+)?(?:tergugat|termohon)[^;]{0,80}tidak\s+hadir/.test(s) || /\bverstek\b/.test(s) && /tidak\s+hadir/.test(s)) return "verstek";
  if (/^\s*mengabulkan\s+(?:gugatan|permohonan)/.test(s) && s.length < 120) return "kabul";
  if (/(?:menjatuhkan|jatuh)\s+talak|izin[^;]{0,60}(?:menjatuhkan|mengikrarkan|ikrar)\s+talak|ikrar\s+talak/.test(s)) return "talak";
  return "lain";
}

/** Butir petitum: penomoran (1. / 1) / a. / -) dibuang, baris lanjutan disambung, judul primer/subsider dibaca. */
export function butirPetitum(html: string): ButirPetitum[] {
  const baris = polosPetitum(html).split("\n").map((x) => x.trim()).filter(Boolean);
  const hasil: ButirPetitum[] = [];
  let bagian: ButirPetitum["bagian"] = "primer";
  let akhir: ButirPetitum | null = null;
  for (const b of baris) {
    const j = RX_JUDUL.exec(b);
    if (j) {
      const n = j[1].toLowerCase();
      bagian = /^sub/.test(n) ? "subsider" : n === "provisi" ? "provisi" : n === "rekonvensi" ? "rekonvensi" : "primer";
      akhir = null;
      continue;
    }
    if (RX_PENGANTAR.test(b) && !/^\s*(?:\d+|[a-z])[.)]/i.test(b)) continue;
    const nomor = /^\s*(?:\d{1,2}|[a-z])\s*[.)]\s*|^\s*[-•]\s+/i.exec(b);
    if (nomor || !akhir) {
      const teks = b.slice(nomor ? nomor[0].length : 0).trim();
      if (teks.length < 4 || !/[a-z]{3}/i.test(teks)) continue;
      akhir = { teks, bagian, jenis: "" };
      hasil.push(akhir);
    } else akhir.teks = `${akhir.teks} ${b}`;
  }
  for (const h of hasil) {
    h.teks = h.teks.replace(/\s+/g, " ").trim();
    h.jenis = h.bagian === "subsider" ? "subsider" : jenisButirPetitum(h.teks);
  }
  return hasil;
}

/** Butir petitum -> kalimat amar: "Mohon ..."/"agar" dibuang, huruf pertama besar, tanpa tanda akhir (diberi ';' oleh penyusun). */
function amarDariPetitum(t: string): string {
  let s = t.replace(/^\s*(?:mohon|memohon)\s+(?:agar\s+)?(?:kiranya\s+)?/i, "").replace(/^\s*agar\s+/i, "");
  s = s.replace(/[;,.\s]+$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---------------------------------------------------------------------------
// Penyusun
// ---------------------------------------------------------------------------
export function kodeStatusAmar(status: string, sebagian = false): StatusAmar | "" {
  const s = kunciStatusPutusan(status) || String(status ?? "").trim().toLowerCase();
  if (/^dikabulkan[- ]sebagian$/.test(s)) return "dikabulkan-sebagian";
  if (s === "dikabulkan") return sebagian ? "dikabulkan-sebagian" : "dikabulkan";
  if (s === "ditolak") return "ditolak";
  if (s === "tidak dapat diterima" || s === "tidak-dapat-diterima") return "tidak-dapat-diterima";
  if (s === "gugur" || s === "digugurkan") return "gugur";
  if (s === "dicabut") return "dicabut";
  if (s === "perdamaian") return "perdamaian";
  if (/^dicoret/.test(s)) return "dicoret";
  return "";
}

const rupiahAmar = (n: number) => `Rp${Math.round(n).toLocaleString("id-ID")},00`;

function gabungNama(daftar: string[]): string {
  const d = daftar.map((x) => String(x || "").trim()).filter(Boolean);
  return d.length <= 1 ? d[0] ?? "" : `${d.slice(0, -1).join(", ")} dan ${d[d.length - 1]}`;
}

export function susunAmar(m: MasukanAmar): HasilAmar {
  const status = kodeStatusAmar(m.status, m.sebagian === true);
  const pertanyaan: PertanyaanAmar[] = [];
  const catatan: string[] = [];
  const tanya = (teks: string, usulan: string) => pertanyaan.push({ no: pertanyaan.length + 1, teks, usulan });
  const kosong: HasilAmar = { ok: false, status, butir: [], html: "", pertanyaan, catatan };
  if (!status) {
    catatan.push("Status putusan belum dipilih: amar belum dapat disusun.");
    return kosong;
  }
  const j = kunciJenisPerkara(m.jenisPerkara);
  const permohonan = Number(m.alurPerkaraId) === 16 || (!m.alurPerkaraId && /\/pdt\.p\//i.test(m.nomorPerkara));
  const ct = j === "cerai talak" || Number(m.jenisPerkaraId) === 346;
  const cg = j === "cerai gugat" || Number(m.jenisPerkaraId) === 347;
  const banyak1 = m.namaPihak1.filter(Boolean).length > 1;
  const banyak2 = m.namaPihak2.filter(Boolean).length > 1;
  // Sebutan: alur/jenis (sebutan-pihak-satu-sumber): permohonan & cerai talak/izin poligami = Pemohon/Termohon.
  const pemohon = permohonan || ct || Number(m.jenisPerkaraId) === 341;
  const P1 = pemohon ? "Pemohon" : "Penggugat";
  const P2 = pemohon ? "Termohon" : "Tergugat";
  const sebut1 = banyak1 ? (permohonan ? "para Pemohon" : `para ${P1}`) : P1;
  // Dua Pemohon (itsbat, dispensasi): "Pemohon I dan Pemohon II" seperti amar SIPP; lebih dari dua = "para Pemohon".
  const jumlah1 = m.namaPihak1.filter(Boolean).length;
  const sebutP1Kabul = permohonan && jumlah1 === 2 ? `${P1} I dan ${P1} II` : sebut1;
  const naskah = pemohon ? "permohonan" : "gugatan";
  const sebut2 = banyak2 ? `para ${P2}` : P2;

  const butir: string[] = [];
  // Ketidakhadiran pihak kedua (verstek) - hanya gugatan / cerai talak yang punya lawan.
  const verstek = m.verstek === true && !permohonan;
  const pernyataanVerstek = `Menyatakan ${sebut2} yang telah dipanggil secara resmi dan patut untuk menghadap ke persidangan, tidak hadir`;

  if (status === "dikabulkan" || status === "dikabulkan-sebagian") {
    if (verstek) butir.push(pernyataanVerstek);
    butir.push(`Mengabulkan ${naskah} ${sebutP1Kabul}${status === "dikabulkan-sebagian" ? " untuk sebagian" : ""}${verstek ? " secara verstek" : ""}`);
    const n1 = gabungNama(m.namaPihak1);
    const n2 = gabungNama(m.namaPihak2);
    if (cg) butir.push(`Menjatuhkan talak satu ba'in shughra ${P2} (${n2 || "..."}) terhadap ${P1} (${n1 || "..."})`);
    if (ct) butir.push(`Memberi izin kepada ${P1} (${n1 || "..."}) untuk menjatuhkan talak satu raj'i terhadap ${P2} (${n2 || "..."}) di depan sidang Pengadilan Agama ${m.satker}`);
    const lain = butirPetitum(m.petitum).filter((b) => b.bagian === "primer" && b.jenis === "lain");
    for (const b of lain) butir.push(amarDariPetitum(b.teks));
    // Itsbat nikah yang petitumnya tidak memuat butir pengesahan (petitum SIPP sering kosong): butir baku amar SIPP PA Donggala, tanggal
    // dan tempat akad dari isian hakim (titik-titik).
    const itsbat = /itsbat|istbat|pengesahan perkawinan/.test(j) || Number(m.jenisPerkaraId) === 360;
    if (itsbat && !lain.some((b) => /sah|itsbat|istbat|isbat|pengesahan/i.test(b.teks))) {
      const pasangan = jumlah1 >= 2 ? `${P1} I (${m.namaPihak1[0]}) dengan ${P1} II (${m.namaPihak1[1]})` : `${P1} (${n1 || "..."}) dengan ...`;
      butir.push(`Menyatakan sah perkawinan antara ${pasangan} yang dilaksanakan pada tanggal ... di ...`);
      butir.push(`Memerintahkan kepada ${jumlah1 >= 2 ? "para Pemohon" : P1} untuk mencatatkan perkawinan tersebut pada Kantor Urusan Agama Kecamatan ...`);
      catatan.push("Petitum tidak memuat butir pengesahan: tanggal dan tempat akad nikah serta KUA tempat mencatatkan diisi sesuai fakta persidangan.");
    } else if (!lain.length && !cg && !ct) {
      catatan.push("Petitum tidak memuat butir pokok yang dapat dijadikan amar - lengkapi amar pokoknya.");
      butir.push("...");
    }
    if (status === "dikabulkan-sebagian") {
      tanya("Kabul sebagian: butir tuntutan mana yang dikabulkan dan mana yang ditolak? Semua butir petitum tercantum - hapus yang ditolak.", "Hapus butir yang tidak dikabulkan; butir 'Menolak ... untuk selain dan selebihnya' sudah ditambahkan.");
      butir.push(`Menolak ${naskah} ${sebut1} untuk selain dan selebihnya`);
    }
    if (lain.some((b) => /rp\.?\s*[\d.]+/i.test(b.teks))) catatan.push("Besaran uang diambil dari petitum (yang DITUNTUT) - sesuaikan dengan yang dikabulkan majelis.");
  } else if (status === "ditolak") {
    if (verstek) {
      butir.push(pernyataanVerstek);
      tanya("Putusan ditolak secara verstek: perlu butir 'Menyatakan Tergugat ... tidak hadir' di depan 'Menolak gugatan'?", "Ya, seperti blangko [01ab] Tolak Verstek; hapus butir pertama bila majelis tidak memakainya.");
    }
    butir.push(`Menolak ${naskah} ${sebut1}`);
  } else if (status === "tidak-dapat-diterima") {
    butir.push(`Menyatakan ${naskah} ${sebut1} tidak dapat diterima (niet ontvankelijke verklaard)`);
  } else if (status === "gugur") {
    butir.push(`Menyatakan ${naskah} ${sebut1} gugur`);
  } else if (status === "dicabut") {
    butir.push(`Mengabulkan permohonan pencabutan perkara Nomor ${m.nomorPerkara} dari ${sebut1}`);
    butir.push("Memerintahkan Panitera untuk mencatat pencabutan perkara tersebut dalam register perkara");
  } else if (status === "perdamaian") {
    butir.push(`Menghukum ${sebut1} dan ${sebut2} untuk menaati isi kesepakatan perdamaian yang telah disepakati`);
    tanya("Perdamaian: amar memuat isi akta perdamaian (butir kesepakatan) atau cukup menghukum para pihak menaatinya?", "Salin butir kesepakatan dari akta perdamaian (blangko [97] Akta Perdamaian) sebelum butir ini.");
  } else if (status === "dicoret") {
    butir.push(`Memerintahkan Panitera untuk mencoret perkara Nomor ${m.nomorPerkara} dari register perkara`);
    tanya("Dicoret (panjar habis): bentuknya penetapan; perlu butir biaya?", "Ikuti blangko [98] Coret 6 di folder jenis perkara ini.");
  }

  // Biaya perkara.
  const tahun = Number(m.tahunDaftar) || Number((/\/(\d{4})\//.exec(m.nomorPerkara) ?? [])[1]) || 0;
  if (m.prodeo === true) {
    butir.push(`Membebankan biaya perkara kepada DIPA Pengadilan Agama ${m.satker} Tahun ${tahun || "...."}`);
  } else {
    const perkawinan = cg || ct || /itsbat|istbat|dispensasi|poligami|asal usul|perwalian|wali adhal|pembatalan perkawinan|hak asuh|nafkah anak/.test(j);
    let dibebani = sebut1;
    if (!perkawinan && !permohonan && (status === "dikabulkan" || status === "dikabulkan-sebagian")) {
      dibebani = sebut2;
      tanya(`Gugatan ${m.jenisPerkara} dikabulkan: biaya dibebankan kepada pihak yang kalah (${sebut2}, Pasal 192 ayat (1) RBg)?`, `Ya - ${sebut2}; ubah bila majelis membebankan lain (mis. ditanggung bersama).`);
    }
    const biaya = Number(m.biaya);
    const angka = Number.isFinite(biaya) && biaya > 0 ? `${rupiahAmar(biaya)} (${terbilang(biaya)} rupiah)` : "Rp............,00 (............ rupiah)";
    if (!(Number.isFinite(biaya) && biaya > 0)) catatan.push("Jumlah biaya perkara belum diketahui - isi titik-titik sebelum Simpan.");
    butir.push(`Membebankan kepada ${dibebani} untuk membayar biaya perkara ini sejumlah ${angka}`);
  }

  // Tanda akhir: ';' antarbutir, '.' butir terakhir; titik-titik isian ("...") dipertahankan.
  const rapi = butir.map((b, i) => `${/\.\.\.\s*$/.test(b) ? b.replace(/\s+$/, "") : b.replace(/[;.\s]+$/, "")}${i === butir.length - 1 ? "." : ";"}`);
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return { ok: true, status, butir: rapi, html: `<ol>${rapi.map((b) => `<li>${esc(b)}</li>`).join("")}</ol>`, pertanyaan, catatan };
}
