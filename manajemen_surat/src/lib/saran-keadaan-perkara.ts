/**
 * ============================================================================
 * SARAN BLANGKO MENURUT KEADAAN PERKARA (G2B 2.2, 30 Okt 2026)
 * ============================================================================
 *
 * rekomendasiBlangko (rekomendasi-blangko.ts) memilih blangko terutama menurut jenis perkara, status, dan agenda/keterangan sidang. Berkas
 * ini menambahkan KEADAAN PERKARA yang sudah ada di baris jadwal bot, supaya saran PERTAMA sudah benar tanpa klik tambahan, dan tiap saran
 * membawa alasan singkat ("karena Tergugat tidak pernah hadir"):
 *
 *   verstek          (a) amar SIPP memuat "verstek" walau kolom putusan_verstek bukan 'Y' (aturan LOCATE paket relaas-penetapan-30okt);
 *                    (b) sidang yang akan memutus gugatan, Tergugat TIDAK PERNAH hadir (sandi 1, 3, 8, 9, 11, 15 - lib/sandi-kehadiran.ts,
 *                        identik paket relaas-penetapan-30okt), kehadiran SEMUA sidang sebelumnya tercatat, tanpa mediasi, dan kehadiran
 *                        sidang ini belum tercatat (draf H-7 / disusun sebelum sidang) atau tercatat Penggugat saja.
 *   satu Pemohon     itsbat nikah voluntair (alur 16) yang Pemohonnya satu orang dan dikabulkan -> [01e] "Satu Pemohon (Pasangan Meninggal)".
 *   kuasa insidentil keterangan sidang menyebut kuasa insidentil tidak sah -> BAS KUASA INSIDENTIL (cerai) dan putusan NO [98] 4b / gugur 3b.
 *   prodeo           blangko memuat sendiri bunyi DIPA (paket prodeo-panggilan-29okt); saran hanya menyebutnya di alasan.
 *   kuasa            relaas dikirim kepada kuasa (paket relaas-penetapan-30okt K2/11209); disebut di alasan relaas.
 *   e-Court          set relaas e-Court sudah dipilih pohon-blangko; disebut di alasan.
 *   jumlah saksi     saksi Penggugat/Tergugat terpisah (saksiP/saksiT) supaya ekstensi memilih varian "(N Saksi)" BAS yang benar
 *                    (pembuktian Tergugat memakai saksi Tergugat).
 *
 * Yang SENGAJA tidak ditebak: varian "pihak banyak" putusan (tidak ada berkas tersendiri - nama pihak berurut dibuat variabel paket
 * pihak-urut), varian kuasa putusan (bunyi kuasa dibuat variabel), e-Court putusan selain HB (tidak ada berkas tersendiri).
 *
 * Murni: tanpa jaringan, tanpa basis data.
 */
import { kunciJenisPerkara, kunciStatusPutusan } from "@/lib/pemetaan-blangko";
import { penggugatHadirSandi, tergugatHadirSandi } from "@/lib/sandi-kehadiran";

/** Bentuk saran yang dibaca berkas ini (sama dengan Rekomendasi di rekomendasi-blangko.ts; ditulis ulang di sini agar tidak melingkar). */
type SaranSatu = {
  jenis: "bas" | "putusan" | "relaas" | "ptsp";
  folder: string;
  berkas: string;
  menu: string;
  alias: string[];
  label: string;
  alasan: string;
  utama: boolean;
  perkiraan: boolean;
  keyakinan?: "pasti" | "cukup" | "perkiraan";
};
type HasilSaran = { bas: SaranSatu[]; putusan: SaranSatu[]; relaas: SaranSatu[]; saksiP?: number; saksiT?: number };

export type MasukanKeadaanSaran = {
  jenisPerkara: string;
  nomorPerkara?: string;
  urutanSidang?: number;
  dihadiriOleh?: number | null;
  tergugatPernahHadir?: boolean;
  penggugatPernahHadir?: boolean | null;
  sudahPutus?: boolean;
  statusPutusan?: string;
  verstekPutusan?: boolean;
  amarVerstek?: boolean;
  mediasi?: unknown;
  mediasiTerbaca?: boolean;
  alurPerkaraId?: number | null;
  jenisPerkaraId?: number | null;
  jumlahPemohon?: number | null;
  prodeo?: boolean;
  kuasaPihak1?: boolean;
  kuasaPihak2?: boolean;
  lewatEcourt?: boolean | null;
  saksiP?: number | null;
  saksiT?: number | null;
  sidangIkrarTalak?: boolean;
};

const AKAR = "derry_briantono";
const RX_MEMUTUS = /putus|musyawarah|pembacaan\s+(?:putusan|penetapan)/i;

/** Gugatan (punya Tergugat yang dapat diputus verstek): alur 15, cerai talak/izin poligami (Pdt.G walau "Pemohon"), atau nomor Pdt.G. */
export function perkaraGugatan(m: Pick<MasukanKeadaanSaran, "alurPerkaraId" | "jenisPerkaraId" | "nomorPerkara" | "jenisPerkara">): boolean {
  if (Number(m.alurPerkaraId) === 16) return false;
  if (Number(m.alurPerkaraId) === 15) return true;
  if ([346, 341].includes(Number(m.jenisPerkaraId))) return true;
  return /\/pdt\.g\//i.test(String(m.nomorPerkara ?? ""));
}

export type SebabVerstek = "amar" | "tidak-pernah-hadir" | null;

/**
 * Putusan diperlakukan verstek karena keadaan perkara (selain bendera putusan_verstek). null = tidak (atau tidak dapat dipastikan).
 * "tidak-pernah-hadir" hanya bila seluruh kehadiran sebelumnya tercatat (penggugatPernahHadir bukan null) dan ada sidang sebelumnya.
 */
export function sebabVerstek(m: MasukanKeadaanSaran, teks: string): SebabVerstek {
  if (m.verstekPutusan === true) return null; // bendera SIPP sudah verstek - jalur lama
  const status = kunciStatusPutusan(m.statusPutusan);
  if (status && /cabut|tidak dapat diterima|coret|gugur|perdamaian|damai/.test(status)) return null;
  if (m.sudahPutus === true && m.amarVerstek === true) return "amar";
  if (m.sudahPutus === true) return null;
  if (m.sidangIkrarTalak === true || !perkaraGugatan(m)) return null;
  if (!RX_MEMUTUS.test(teks)) return null;
  const n = Number(m.urutanSidang) || 0;
  if (n < 2) return null; // sidang pertama: verstek di sidang pertama ditebak alur BAS, bukan di sini
  if (m.tergugatPernahHadir !== false || m.penggugatPernahHadir === null || m.penggugatPernahHadir === undefined) return null;
  if (m.mediasiTerbaca === false || m.mediasi) return null;
  const h = m.dihadiriOleh;
  if (h === null || h === undefined) return "tidak-pernah-hadir";
  if (tergugatHadirSandi(h)) return null;
  return penggugatHadirSandi(h) ? "tidak-pernah-hadir" : null;
}

const ALASAN_VERSTEK: Record<Exclude<SebabVerstek, null>, string> = {
  amar: "karena amar putusan di SIPP menyebut verstek",
  "tidak-pernah-hadir": "karena Tergugat tidak pernah hadir",
};

/** Itsbat nikah voluntair dengan satu Pemohon (pasangan telah meninggal). */
function satuPemohonItsbat(m: MasukanKeadaanSaran): boolean {
  return kunciJenisPerkara(m.jenisPerkara) === "itsbat nikah" && Number(m.alurPerkaraId) === 16 && Number(m.jumlahPemohon) === 1;
}

export const ITSBAT_SATU_PEMOHON = "[01e] [Kabul] IN - Satu Pemohon (Pasangan Meninggal, Voluntair).rtf";

const RX_KUASA_INSIDENTIL_TIDAK_SAH = /kuasa\s+insidentil[^.;]{0,80}(?:tidak\s+sah|ditolak|tidak\s+memenuhi|tidak\s+diterima)|(?:tidak\s+sah|ditolak)[^.;]{0,40}kuasa\s+insidentil/i;

/** Nama BAS / putusan kuasa insidentil tidak sah blangko Derry (folder cerai saja). */
const KUASA_INSIDENTIL = {
  "cerai gugat": { folderBas: `${AKAR}/1 Perceraian CG - BAS`, folderPut: `${AKAR}/1 Perceraian CG`, naskah: "Gugatan" },
  "cerai talak": { folderBas: `${AKAR}/1a Perceraian CT - BAS`, folderPut: `${AKAR}/1a Perceraian CT`, naskah: "Permohonan" },
} as const;

/** Sisi pihak relaas dari nama berkasnya: "... T.rtf", "... P (e-Court).rtf", "... P dan T.rtf" (keduanya); "" = tidak tersebut. */
export function sisiRelaas(berkas: string): "P" | "T" | "PT" | "" {
  const b = String(berkas || "").replace(/\.rtf$/i, "").trim();
  if (/\bP dan T$/.test(b)) return "PT";
  const m = /\b([PT])(?:\s*\([^)]*\))?$/.exec(b);
  return m ? (m[1] as "P" | "T") : "";
}

function sisipDepan(daftar: SaranSatu[], baru: SaranSatu): SaranSatu[] {
  return [baru, ...daftar.filter((x) => !(x.folder === baru.folder && x.berkas === baru.berkas)).map((x) => ({ ...x, utama: false }))];
}

function tambahAlasan(r: SaranSatu, frasa: string): SaranSatu {
  if (!frasa || r.alasan.includes(frasa)) return r;
  const dasar = r.alasan.replace(/\.\s*$/, "");
  // "karena ..." menyambung kalimat; frasa berhuruf besar menjadi kalimat sendiri.
  const sambung = /^[a-z]/.test(frasa) ? " " : ". ";
  return { ...r, alasan: `${dasar}${sambung}${frasa}.`.replace(/\s+/g, " ") };
}

/**
 * Menerapkan keadaan perkara pada hasil saran (tidak mengubah saran yang tidak bersangkutan). `menuDari(folder)` mencari nama menu & alias
 * yang sudah dipakai saran lain di folder yang sama (BAS/putusan baru hanya ditambahkan bila menunya diketahui).
 */
export function terapkanKeadaanPerkara<H extends HasilSaran>(hasil: H, m: MasukanKeadaanSaran, teks: string, verstekSebab: SebabVerstek): H {
  const out = { ...hasil, bas: [...hasil.bas], putusan: [...hasil.putusan], relaas: [...hasil.relaas] };
  const j = kunciJenisPerkara(m.jenisPerkara);
  const menuDari = (folder: string, daftar: SaranSatu[]) => daftar.find((x) => x.folder === folder) || null;

  // 1. Verstek: alasan pada saran putusan utama (blangkonya sudah verstek karena masukan verstek dinyalakan sebelum peta dibaca).
  if (verstekSebab && out.putusan.length) {
    const frasa = ALASAN_VERSTEK[verstekSebab];
    out.putusan = out.putusan.map((x) => {
      if (!x.utama || !/verstek/i.test(`${x.berkas} ${x.label}`)) return x;
      // "(verstek)" di alasan peta -> "(verstek, karena ...)"; selain itu disambung di ujung kalimat.
      return x.alasan.includes("(verstek)") ? { ...x, alasan: x.alasan.replace("(verstek)", `(verstek, ${frasa})`) } : tambahAlasan(x, frasa);
    });
  }

  // 2. Itsbat nikah satu Pemohon (pasangan meninggal) yang dikabulkan.
  const utamaPut = out.putusan.find((x) => x.utama);
  if (utamaPut && satuPemohonItsbat(m) && /^\[01\] \[Kabul\] IN\.rtf$/i.test(utamaPut.berkas)) {
    out.putusan = sisipDepan(out.putusan, {
      ...utamaPut,
      berkas: ITSBAT_SATU_PEMOHON,
      label: ITSBAT_SATU_PEMOHON.replace(/\.rtf$/i, ""),
      alasan: `${utamaPut.alasan.replace(/\.\s*$/, "")} karena Pemohonnya satu orang (pasangan telah meninggal).`,
      utama: true,
    });
  }

  // 3. Kuasa insidentil tidak sah (keterangan sidang) - perkara cerai.
  const ki = KUASA_INSIDENTIL[j as keyof typeof KUASA_INSIDENTIL];
  if (ki && RX_KUASA_INSIDENTIL_TIDAK_SAH.test(teks)) {
    const status = kunciStatusPutusan(m.statusPutusan);
    const contohPut = menuDari(ki.folderPut, out.putusan);
    if (contohPut && (status === "tidak dapat diterima" || status === "digugurkan" || status === "gugur")) {
      const berkas = status === "tidak dapat diterima" ? "[98] [NO] 4b. Cerai P Diwakili Kuasa Insidentil Tidak Sah.rtf" : "[98] [Gugur] 3b. Cerai P Diwakili Kuasa Insidentil Tidak Sah (P Tidak Pernah Hadir).rtf";
      out.putusan = sisipDepan(out.putusan, { ...contohPut, berkas, label: berkas.replace(/\.rtf$/i, ""), alasan: "Putusan karena kuasa insidentil Penggugat tidak sah, menurut keterangan sidang.", utama: true, perkiraan: false });
    }
    const contohBas = menuDari(ki.folderBas, out.bas);
    if (contohBas && !m.sudahPutus) {
      const tHadir = tergugatHadirSandi(m.dihadiriOleh);
      const berkas = `BAS KUASA INSIDENTIL - Sidang 1 P Hadir Sendiri Menandatangani ${ki.naskah} dari Kuasa Tidak Sah & T ${tHadir ? "Hadir - Mediasi" : "Tidak Hadir - Tunda Panggil T"}.rtf`;
      out.bas = sisipDepan(out.bas, {
        ...contohBas,
        berkas,
        label: berkas.replace(/\.rtf$/i, ""),
        alasan: `Kuasa insidentil tidak sah: Penggugat hadir sendiri menandatangani ${ki.naskah.toLowerCase()}nya${tHadir ? "; Tergugat hadir, dilanjutkan mediasi" : "; Tergugat tidak hadir, tunda panggil Tergugat"}.`,
        utama: true,
        perkiraan: m.dihadiriOleh === null || m.dihadiriOleh === undefined,
      });
    }
  }

  // 4. Prodeo: bunyi amar biaya dibuat blangko (DIPA) - alasan putusan utama menyebutnya.
  if (m.prodeo === true) {
    out.putusan = out.putusan.map((x) => (x.utama ? tambahAlasan(x, "Perkara prodeo: biaya perkara dibebankan kepada DIPA (bunyinya disusun blangko)") : x));
  }

  // 5. Relaas: e-Court dan kuasa.
  out.relaas = out.relaas.map((x) => {
    let r = x;
    if (/e-court/i.test(x.berkas)) r = tambahAlasan(r, "Perkara e-Court: relaas elektronik");
    const sisi = sisiRelaas(x.berkas);
    const sisiP = sisi === "P" || sisi === "PT";
    const sisiT = sisi === "T" || sisi === "PT";
    if ((sisiP && m.kuasaPihak1 === true) || (sisiT && m.kuasaPihak2 === true)) r = tambahAlasan(r, "Pihak berkuasa: relaas ditujukan kepada kuasanya");
    return r;
  });

  // 6. Saksi tiap sisi untuk varian "(N Saksi)" BAS di ekstensi.
  if (typeof m.saksiP === "number" && m.saksiP > 0) out.saksiP = m.saksiP;
  if (typeof m.saksiT === "number" && m.saksiT > 0) out.saksiT = m.saksiT;
  return out as H;
}
