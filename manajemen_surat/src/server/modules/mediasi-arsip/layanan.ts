import { getEffectiveRoleId, isPrivilegedAdmin } from "@/lib/permissions";
import { bolehAksi } from "@/lib/matriks-peran";
import type { UserPersona } from "@/lib/types";
import { type AletaDatabase } from "@/server/db/client";
import { BATAS_KONVERSI, kenaliBentukNaskah, konversiNaskah } from "@/server/modules/aleta-ecourt/konversi-naskah";
import { pastikanAksiAktor } from "@/server/modules/akses/hak-peran";
import { ApiError } from "@/server/shared/errors";
import { nextPrefixedId } from "@/server/shared/ids";

import { akarPenyimpanan, bacaBerkas, bakukanNomor, hapusBerkas, kunciPerkara, sha256, simpanBerkas } from "./berkas";

/**
 * ============================================================================
 * ARSIP HASIL MEDIASI PER PERKARA - LAYANAN (21 Okt 2026)
 * ============================================================================
 *
 * Dokumen hasil mediasi (laporan mediator, kesepakatan, pernyataan para pihak,
 * dan sejenisnya) yang diunggah petugas dari tab Mediasi SIPP. SIPP tidak punya
 * tempat untuk dokumen ini, jadi disimpan di arsip ALETA: PDF/RTF/DOC/DOCX
 * diterima, yang bukan PDF diubah ke PDF (rute konversi yang sama dengan Putusan
 * Otomatis) dan KEDUANYA disimpan - berkas asli dan PDF-nya.
 *
 * ATURAN
 *   - bentuk dikenali dari KEPALA berkas, bukan dari nama; maksimum 20 MB;
 *   - berkas yang sama (sidik isi) pada perkara yang sama tidak diunggah dua kali;
 *   - mengganti butuh konfirmasi tegas dan membuat versi baru; versi lama berstatus
 *     "diganti" dan berkasnya dibuang dari cakram (jejak tetap);
 *   - menghapus butuh konfirmasi, hanya PENGUNGGAH atau Admin/Super Admin; baris dan
 *     jejaknya tetap (status "dihapus"), berkasnya dibuang;
 *   - setiap unggah, ganti, hapus, lihat, unduh, dan kiriman ke e-Doc Akta Perdamaian
 *     SIPP dicatat di aleta_mediasi_berkas_jejak;
 *   - hak menurut matriks peran (mediasi.arsip-*): mediator, hakim, pimpinan,
 *     panitera, panmud, PP; Admin/Super Admin selalu.
 *
 * Tidak ada yang ditulis ke SIPP dari sini (kiriman Akta Perdamaian dikerjakan
 * peramban atas akun SIPP yang masuk, lalu hanya DICATAT di sini).
 */

export const BATAS = { ukuranBerkas: BATAS_KONVERSI, nomorMin: 6, nomorMaks: 60, berkasPerPerkara: 200 } as const;
/** Nomor perkara SIPP, mis. 684/Pdt.G/2026/PA.Dgl - bentuk ketat: tidak ada jalan menyelipkan jalur atau karakter lain. */
const POLA_NOMOR = /^\d{1,6}\/[A-Za-z]{1,10}(?:\.[A-Za-z]{1,4}){0,2}\/\d{4}\/[A-Za-z]{2,4}\.[A-Za-z]{2,8}$/;

export type BarisBerkas = {
  id: string;
  nomor_perkara: string;
  perkara_kunci: string;
  urutan_mediasi: number | string;
  nama_asli: string;
  bentuk_asal: string;
  jalur_asal: string;
  jalur_pdf: string;
  ukuran_asal: number | string;
  ukuran_pdf: number | string;
  sha256: string;
  versi: number | string;
  menggantikan_id: string;
  status: string;
  peringatan: string;
  diunggah_oleh: string;
  diunggah_nama: string;
  peran: string;
  akun_sipp: string;
  ip: string;
  ke_sipp_pada: string;
  ke_sipp_oleh: string;
  dibuat_pada: string;
  diubah_pada: string;
  dihapus_oleh: string;
  dihapus_pada: string;
  alasan_hapus: string;
};

export type BerkasTampil = {
  id: string;
  nama: string;
  bentukAsal: string;
  adaPdf: boolean;
  ukuranAsal: number;
  ukuranPdf: number;
  versi: number;
  urutanMediasi: number;
  diunggahNama: string;
  peran: string;
  dibuatPada: string;
  peringatan: string;
  bolehHapus: boolean;
  keSipp: { pada: string; oleh: string } | null;
};

export type Deps = {
  sekarang?: () => Date;
  akar?: string;
  konversi?: (masukan: { bita: Uint8Array; namaBerkas: string; ke: string }) => Promise<{ berkasBase64: string }>;
};

const SEKARANG = () => new Date();
const sebaris = (t: unknown, maks = 200) => String(t ?? "").replace(/\s+/g, " ").trim().slice(0, maks);

function bersihkanNama(nama: unknown): string {
  // Nama dari petugas hanya disimpan di basis data; jalur dan karakter berbahaya dibuang.
  const n = sebaris(String(nama ?? "").replace(/[\\/]/g, "_").replace(/[\u0000-\u001f]/g, ""), 200);
  return n || "hasil-mediasi";
}

function pastikanNomor(nomor: unknown): string {
  const n = sebaris(nomor, 80);
  if (!POLA_NOMOR.test(n)) {
    throw new ApiError(400, "Nomor perkara tidak terbaca dari halaman SIPP. Muat ulang halaman perkara lalu coba lagi.");
  }
  return n;
}

export function pastikanBolehLihat(aktor: UserPersona) {
  pastikanAksiAktor(aktor, "mediasi.arsip-lihat");
}
export function pastikanBolehUnggah(aktor: UserPersona) {
  pastikanAksiAktor(aktor, "mediasi.arsip-unggah");
}

export function bolehHapusBerkas(aktor: UserPersona, baris: Pick<BarisBerkas, "diunggah_oleh">): boolean {
  if (!bolehAksi(aktor, "mediasi.arsip-hapus")) return false;
  return baris.diunggah_oleh === aktor.id || isPrivilegedAdmin(aktor);
}

function tampil(aktor: UserPersona, b: BarisBerkas): BerkasTampil {
  return {
    id: b.id,
    nama: b.nama_asli,
    bentukAsal: b.bentuk_asal,
    adaPdf: Boolean(b.jalur_pdf),
    ukuranAsal: Number(b.ukuran_asal) || 0,
    ukuranPdf: Number(b.ukuran_pdf) || 0,
    versi: Number(b.versi) || 1,
    urutanMediasi: Number(b.urutan_mediasi) || 0,
    diunggahNama: b.diunggah_nama,
    peran: b.peran,
    dibuatPada: b.dibuat_pada,
    peringatan: b.peringatan,
    bolehHapus: bolehHapusBerkas(aktor, b),
    keSipp: b.ke_sipp_pada ? { pada: b.ke_sipp_pada, oleh: b.ke_sipp_oleh } : null,
  };
}

async function catatJejak(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: { berkasId: string; nomor: string; peristiwa: string; hasil: string; ringkas: string; rinci?: Record<string, unknown>; akunSipp?: string; ip?: string },
  kini: Date
) {
  const id = await nextPrefixedId(db, "aleta_mediasi_berkas_jejak", "mbj");
  await db.run(
    `INSERT INTO aleta_mediasi_berkas_jejak
       (id, berkas_id, nomor_perkara, waktu, peristiwa, pelaku, pelaku_id, peran, akun_sipp, ip, hasil, ringkas, rinci_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      masukan.berkasId,
      masukan.nomor,
      kini.toISOString(),
      masukan.peristiwa,
      sebaris(aktor.name, 120),
      aktor.id,
      String(getEffectiveRoleId(aktor) ?? ""),
      sebaris(masukan.akunSipp, 80),
      sebaris(masukan.ip, 60),
      masukan.hasil,
      sebaris(masukan.ringkas, 300),
      JSON.stringify(masukan.rinci ?? {}).slice(0, 4000),
    ]
  );
}

/** Daftar berkas aktif satu perkara (terbaru dulu) beserta hak pemanggil. */
export async function daftarBerkas(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: { nomorPerkara: unknown }
): Promise<{ berkas: BerkasTampil[]; hak: { lihat: true; unggah: boolean } }> {
  pastikanBolehLihat(aktor);
  const nomor = pastikanNomor(masukan.nomorPerkara);
  const baris = await db.queryAll<BarisBerkas>(
    "SELECT * FROM aleta_mediasi_berkas WHERE perkara_kunci = ? AND status = 'aktif' ORDER BY dibuat_pada DESC",
    [kunciPerkara(nomor)]
  );
  return { berkas: baris.map((b) => tampil(aktor, b)), hak: { lihat: true, unggah: bolehAksi(aktor, "mediasi.arsip-unggah") } };
}

export type MasukanUnggah = {
  nomorPerkara: unknown;
  urutanMediasi?: unknown;
  nama: string;
  bita: Uint8Array;
  /** Mengganti berkas ini (versi baru). Wajib bersama konfirmasiGanti = true. */
  gantiId?: unknown;
  konfirmasiGanti?: unknown;
  akunSipp?: unknown;
  ip?: string;
};

/** Mengunggah (atau mengganti) satu berkas hasil mediasi. */
export async function unggahBerkas(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: MasukanUnggah,
  deps: Deps = {}
): Promise<{ ok: true; berkas: BerkasTampil; peringatan: string[] }> {
  pastikanBolehUnggah(aktor);
  const kini = (deps.sekarang ?? SEKARANG)();
  const akar = deps.akar ?? akarPenyimpanan();
  const nomor = pastikanNomor(masukan.nomorPerkara);
  const kunci = kunciPerkara(nomor);
  const bita = masukan.bita;
  if (!bita || bita.length === 0) throw new ApiError(400, "Berkasnya kosong.");
  if (bita.length > BATAS.ukuranBerkas) throw new ApiError(413, `Ukuran berkas melampaui ${Math.round(BATAS.ukuranBerkas / 1024 / 1024)} MB.`);
  const bentuk = kenaliBentukNaskah(bita);
  if (!bentuk) {
    throw new ApiError(400, "Isinya bukan PDF, RTF, DOC, maupun DOCX - dikenali dari kepala berkas, bukan dari namanya.");
  }
  const urutan = Math.max(0, Math.min(99, Math.trunc(Number(masukan.urutanMediasi) || 0)));
  const nama = bersihkanNama(masukan.nama);
  const sidik = sha256(bita);

  const gantiId = sebaris(masukan.gantiId, 100);
  let lama: BarisBerkas | undefined;
  if (gantiId) {
    if (masukan.konfirmasiGanti !== true) {
      throw new ApiError(409, "Mengganti berkas butuh konfirmasi tegas.", { kode: "perlu_konfirmasi" });
    }
    lama = await db.queryOne<BarisBerkas>("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [gantiId]);
    if (!lama || lama.status !== "aktif" || lama.perkara_kunci !== kunci) {
      throw new ApiError(404, "Berkas yang akan diganti tidak ditemukan pada perkara ini.");
    }
  }

  // Cegah unggah ganda: isi yang sama persis pada perkara yang sama (selain yang sedang diganti).
  const kembar = await db.queryOne<BarisBerkas>(
    "SELECT * FROM aleta_mediasi_berkas WHERE perkara_kunci = ? AND sha256 = ? AND status = 'aktif'",
    [kunci, sidik]
  );
  if (kembar && kembar.id !== gantiId) {
    throw new ApiError(409, `Berkas yang sama persis sudah ada di arsip perkara ini (${kembar.nama_asli}).`, { kode: "ganda", berkasId: kembar.id });
  }
  const jumlah = await db.queryOne<{ n: number | string }>(
    "SELECT COUNT(*) AS n FROM aleta_mediasi_berkas WHERE perkara_kunci = ? AND status = 'aktif'",
    [kunci]
  );
  if (!gantiId && Number(jumlah?.n ?? 0) >= BATAS.berkasPerPerkara) {
    throw new ApiError(409, `Arsip perkara ini sudah memuat ${BATAS.berkasPerPerkara} berkas.`);
  }

  // PDF: yang bukan PDF diubah (soffice di bot); gagal tidak menggagalkan unggah - berkas asli tetap disimpan.
  const peringatan: string[] = [];
  let pdf: Uint8Array | null = null;
  if (bentuk === "pdf") {
    pdf = bita;
  } else {
    try {
      const konversi = deps.konversi ?? ((m) => konversiNaskah(m));
      const hasil = await konversi({ bita, namaBerkas: nama, ke: "pdf" });
      pdf = new Uint8Array(Buffer.from(hasil.berkasBase64, "base64"));
      if (pdf.length === 0 || Buffer.from(pdf.subarray(0, 5)).toString("latin1") !== "%PDF-") {
        pdf = null;
        peringatan.push("Hasil konversi ke PDF tidak sah; hanya berkas asli yang disimpan.");
      }
    } catch (galat) {
      pdf = null;
      peringatan.push(`PDF belum dapat dibuat (${sebaris((galat as Error)?.message || galat, 140)}); hanya berkas asli yang disimpan.`);
    }
  }

  const id = await nextPrefixedId(db, "aleta_mediasi_berkas", "mbk");
  const jalurAsal = await simpanBerkas(kunci, id, bentuk, bita, akar);
  let jalurPdf = "";
  if (bentuk === "pdf") {
    jalurPdf = jalurAsal;
  } else if (pdf) {
    jalurPdf = await simpanBerkas(kunci, `${id}-pdf`, "pdf", pdf, akar);
  }
  const versi = lama ? Number(lama.versi) + 1 : 1;
  const waktu = kini.toISOString();
  await db.run(
    `INSERT INTO aleta_mediasi_berkas
       (id, nomor_perkara, perkara_kunci, urutan_mediasi, nama_asli, bentuk_asal, jalur_asal, jalur_pdf, ukuran_asal, ukuran_pdf, sha256,
        versi, menggantikan_id, status, peringatan, diunggah_oleh, diunggah_nama, peran, akun_sipp, ip,
        ke_sipp_pada, ke_sipp_oleh, dibuat_pada, diubah_pada, dihapus_oleh, dihapus_pada, alasan_hapus)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, ?, ?, ?, ?, '', '', ?, ?, '', '', '')`,
    [
      id,
      nomor,
      kunci,
      urutan,
      nama,
      bentuk,
      jalurAsal,
      jalurPdf,
      bita.length,
      pdf ? pdf.length : 0,
      sidik,
      versi,
      lama ? lama.id : "",
      peringatan.join(" ").slice(0, 400),
      aktor.id,
      sebaris(aktor.name, 120),
      String(getEffectiveRoleId(aktor) ?? ""),
      sebaris(masukan.akunSipp, 80),
      sebaris(masukan.ip, 60),
      waktu,
      waktu,
    ]
  );

  if (lama) {
    // Versi lama: berkasnya dibuang dari cakram; baris dan jejak tetap.
    await hapusBerkas(lama.jalur_asal, akar);
    if (lama.jalur_pdf && lama.jalur_pdf !== lama.jalur_asal) await hapusBerkas(lama.jalur_pdf, akar);
    await db.run("UPDATE aleta_mediasi_berkas SET status = 'diganti', diubah_pada = ?, jalur_asal = '', jalur_pdf = '' WHERE id = ?", [waktu, lama.id]);
  }

  await catatJejak(
    db,
    aktor,
    {
      berkasId: id,
      nomor,
      peristiwa: lama ? "ganti" : "unggah",
      hasil: "berhasil",
      ringkas: `${lama ? `Mengganti ${lama.nama_asli} dengan` : "Mengunggah"} ${nama} (${bentuk.toUpperCase()}, ${bita.length} bait).`,
      rinci: { sha256: sidik, versi, menggantikan: lama?.id ?? "", pdf: Boolean(jalurPdf), urutanMediasi: urutan },
      akunSipp: String(masukan.akunSipp ?? ""),
      ip: masukan.ip,
    },
    kini
  );

  const baru = await db.queryOne<BarisBerkas>("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [id]);
  return { ok: true, berkas: tampil(aktor, baru as BarisBerkas), peringatan };
}

/** Isi satu berkas (asli atau PDF) untuk lihat/unduh; dicatat di jejak. */
export async function ambilIsiBerkas(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: { id: unknown; bentuk?: unknown; aksi?: unknown; ip?: string },
  deps: Deps = {}
): Promise<{ bita: Uint8Array; nama: string; mime: string; bentuk: string }> {
  pastikanBolehLihat(aktor);
  const id = sebaris(masukan.id, 100);
  const b = id ? await db.queryOne<BarisBerkas>("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [id]) : undefined;
  if (!b || b.status !== "aktif") throw new ApiError(404, "Berkas tidak ditemukan.");
  const minta = String(masukan.bentuk ?? "pdf") === "asli" ? "asli" : "pdf";
  const jalur = minta === "pdf" && b.jalur_pdf ? b.jalur_pdf : b.jalur_asal;
  const bita = jalur ? await bacaBerkas(jalur, deps.akar ?? akarPenyimpanan()) : null;
  if (!bita) throw new ApiError(404, "Berkas tidak ada lagi di penyimpanan.");
  const bentuk = jalur === b.jalur_pdf && b.jalur_pdf ? "pdf" : b.bentuk_asal;
  const aksi = String(masukan.aksi ?? "") === "lihat" ? "lihat" : "unduh";
  await catatJejak(
    db,
    aktor,
    { berkasId: b.id, nomor: b.nomor_perkara, peristiwa: aksi, hasil: "berhasil", ringkas: `${aksi === "lihat" ? "Melihat" : "Mengunduh"} ${b.nama_asli} (${bentuk}).`, ip: masukan.ip },
    (deps.sekarang ?? SEKARANG)()
  );
  const MIME: Record<string, string> = {
    pdf: "application/pdf",
    rtf: "application/rtf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const dasar = b.nama_asli.replace(/\.[A-Za-z0-9]{2,5}$/, "") || "hasil-mediasi";
  return { bita, nama: `${dasar}.${bentuk}`, mime: MIME[bentuk] ?? "application/octet-stream", bentuk };
}

/** Menghapus (konfirmasi tegas; pengunggah atau Admin). Baris dan jejak tetap. */
export async function hapusBerkasArsip(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: { id: unknown; konfirmasi: unknown; alasan?: unknown; ip?: string },
  deps: Deps = {}
): Promise<{ ok: true }> {
  pastikanAksiAktor(aktor, "mediasi.arsip-hapus");
  const id = sebaris(masukan.id, 100);
  const b = id ? await db.queryOne<BarisBerkas>("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [id]) : undefined;
  if (!b || b.status !== "aktif") throw new ApiError(404, "Berkas tidak ditemukan.");
  if (!bolehHapusBerkas(aktor, b)) {
    throw new ApiError(403, `Berkas ini hanya dapat dihapus oleh pengunggahnya (${b.diunggah_nama}) atau Admin.`);
  }
  if (masukan.konfirmasi !== true) throw new ApiError(409, "Menghapus berkas butuh konfirmasi tegas.", { kode: "perlu_konfirmasi" });
  const kini = (deps.sekarang ?? SEKARANG)();
  const akar = deps.akar ?? akarPenyimpanan();
  await hapusBerkas(b.jalur_asal, akar);
  if (b.jalur_pdf && b.jalur_pdf !== b.jalur_asal) await hapusBerkas(b.jalur_pdf, akar);
  const alasan = sebaris(masukan.alasan, 200);
  await db.run(
    "UPDATE aleta_mediasi_berkas SET status = 'dihapus', jalur_asal = '', jalur_pdf = '', dihapus_oleh = ?, dihapus_pada = ?, alasan_hapus = ?, diubah_pada = ? WHERE id = ?",
    [aktor.id, kini.toISOString(), alasan, kini.toISOString(), b.id]
  );
  await catatJejak(
    db,
    aktor,
    { berkasId: b.id, nomor: b.nomor_perkara, peristiwa: "hapus", hasil: "berhasil", ringkas: `Menghapus ${b.nama_asli}${alasan ? ` - ${alasan}` : ""}.`, rinci: { sha256: b.sha256 }, ip: masukan.ip },
    kini
  );
  return { ok: true };
}

/**
 * Mencatat hasil kiriman e-Doc Akta Perdamaian ke SIPP. Kirimannya sendiri dikerjakan peramban
 * atas akun SIPP yang masuk (jalur unggah SIPP); di sini hanya jejaknya.
 */
export async function catatKirimanSipp(
  db: AletaDatabase,
  aktor: UserPersona,
  masukan: { id?: unknown; hasil?: unknown; ringkas?: unknown; akunSipp?: unknown; menimpa?: unknown; ip?: string },
  deps: Deps = {}
): Promise<{ ok: true }> {
  pastikanBolehUnggah(aktor);
  const id = sebaris(masukan.id, 100);
  const b = id ? await db.queryOne<BarisBerkas>("SELECT * FROM aleta_mediasi_berkas WHERE id = ?", [id]) : undefined;
  if (!b || b.status !== "aktif") throw new ApiError(404, "Berkas tidak ditemukan.");
  const hasil = String(masukan.hasil ?? "") === "berhasil" ? "berhasil" : "gagal";
  const kini = (deps.sekarang ?? SEKARANG)();
  if (hasil === "berhasil") {
    await db.run("UPDATE aleta_mediasi_berkas SET ke_sipp_pada = ?, ke_sipp_oleh = ?, diubah_pada = ? WHERE id = ?", [
      kini.toISOString(),
      sebaris(aktor.name, 120),
      kini.toISOString(),
      b.id,
    ]);
  }
  await catatJejak(
    db,
    aktor,
    {
      berkasId: b.id,
      nomor: b.nomor_perkara,
      peristiwa: "ke-sipp",
      hasil,
      ringkas: sebaris(masukan.ringkas, 280) || `Mengirim ${b.nama_asli} ke e-Doc Akta Perdamaian SIPP: ${hasil}.`,
      rinci: { menimpa: masukan.menimpa === true },
      akunSipp: String(masukan.akunSipp ?? ""),
      ip: masukan.ip,
    },
    kini
  );
  return { ok: true };
}

export { bakukanNomor };
