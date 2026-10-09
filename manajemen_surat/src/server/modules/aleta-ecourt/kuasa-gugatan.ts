import {
  gabungNama,
  isianAmanAbt,
  namaKantor,
  rapatkan,
  uraiKuasaGugatan,
  type KuasaGugatan,
} from "@/lib/kuasa-gugatan";

/**
 * ============================================================================
 * USULAN KUASA HUKUM UNTUK PANEL ABT (9 Okt 2026, butir 1-4 KUASA)
 * ============================================================================
 *
 *   GET /aleta-ecourt/kuasa-gugatan?nomor=...  ->  { ada, usulan[], gugatan, sumber, catatan[] }
 *
 * Variabel yang diusulkan (semuanya ISIAN - data_teks/data_tanggal - yang
 * ditulis panel lewat abt/edit_data sesudah petugas mencentang):
 *
 *   #0156#   Kantor Kuasa Penggugat        nama kantor di gugatan; cadangan SIPP
 *   #0184#   Tgl. Surat Kuasa Penggugat    "Surat Kuasa Khusus tanggal ..." di gugatan
 *   #8538#  Alamat Kantor Kuasa Penggugat sesudah nama kantor di gugatan; cadangan SIPP
 *   #8537#  Nama Advokat Kuasa Penggugat  daftar kuasa aktif SIPP; cadangan gugatan
 *
 * #0132# (tanggal REGISTER kuasa khusus) dan #8539# (nomor register) bukan
 * isi gugatan - keduanya dicatat kepaniteraan di SIPP dan diusulkan bot
 * (abtUsulanService.usulanKuasaSipp).
 *
 * Keyakinan: lapisan teks Word/PDF "cukup" (dicentang sendiri, sama dengan
 * usulan lain yang berdasar satu sumber tertulis); hasil OCR pindaian dan
 * cadangan dari SIPP "ragu" (tidak dicentang sendiri). Tiap usulan membawa
 * kalimat asalnya dengan tanda sumber "gugatan-ecourt" atau "sipp".
 */

export type BarisKuasaSipp = {
  pihakKe: number;
  urutan: number;
  nama: string;
  alamat: string;
  alamatKantor: string;
  nomorKuasa: string;
  tanggalKuasa: string;
};

export type SumberUsulan = { asal: "gugatan-ecourt" | "sipp"; kalimat: string };

export type UsulanKuasa = {
  kode: string;
  nama: string;
  nilai: string;
  keyakinan: "pasti" | "cukup" | "ragu" | "kosong";
  bentrok: "";
  sumber: SumberUsulan[];
  catatan: string;
};

export type SumberGugatan = { judul: string; documentKey: string; baca: "teks" | "ocr" };

export const KODE_KUASA = Object.freeze({
  kantor: "0156",
  tanggalSuratKuasa: "0184",
  alamatKantor: "8538",
  advokat: "8537",
});

function kunciNama(n: string) {
  return n.toLowerCase().replace(/\b(?:adv|hj|h|dr|drs)\.?\s+/g, "").replace(/[^a-z]/g, "");
}

/** Nama advokat kuasa pihak 1 dari SIPP, tanpa kembar (SIPP kadang mencatat orang yang sama belasan kali). */
export function advokatSipp(baris: BarisKuasaSipp[]): string[] {
  const urut = [...baris].filter((b) => b.pihakKe === 1 && rapatkan(b.nama)).sort((a, b) => a.urutan - b.urutan);
  const kunci = new Set<string>();
  const hasil: string[] = [];
  for (const b of urut) {
    const k = kunciNama(b.nama);
    if (!k || kunci.has(k)) continue;
    kunci.add(k);
    hasil.push(isianAmanAbt(b.nama));
  }
  return hasil;
}

function ke_iso(nilai: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(nilai);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/**
 * Susun usulan dari hasil pembacaan gugatan (boleh null: tidak ada berkas /
 * tidak terbaca) dan baris kuasa SIPP.
 */
export function susunUsulanKuasa(masukan: {
  gugatan: KuasaGugatan | null;
  sumberGugatan: SumberGugatan | null;
  kuasaSipp: BarisKuasaSipp[];
  tanggalDaftar?: string;
}): UsulanKuasa[] {
  const { gugatan, sumberGugatan, kuasaSipp } = masukan;
  const p = kuasaSipp.filter((b) => b.pihakKe === 1);
  const dariOcr = sumberGugatan?.baca === "ocr";
  const yakinGugatan: UsulanKuasa["keyakinan"] = dariOcr ? "ragu" : "cukup";
  const label = sumberGugatan ? `"${sumberGugatan.judul}" e-Court${dariOcr ? " (dibaca OCR)" : ""}` : "gugatan e-Court";
  const sg = (kalimat: string): SumberUsulan[] => [{ asal: "gugatan-ecourt", kalimat: `${label}: ${kalimat}` }];
  const adaKuasa = Boolean(gugatan?.ada) || p.length > 0;
  const tanpa = "Gugatan dan SIPP tidak menyebut kuasa hukum Penggugat/Pemohon.";
  const usulan: UsulanKuasa[] = [];
  const buat = (kode: string, nama: string, nilai: string, keyakinan: UsulanKuasa["keyakinan"], sumber: SumberUsulan[], catatan: string): UsulanKuasa => ({
    kode,
    nama,
    nilai: nilai ? isianAmanAbt(nilai) : "",
    keyakinan: nilai ? keyakinan : "kosong",
    bentrok: "",
    sumber,
    catatan,
  });

  // ── #0156# nama kantor ──
  if (gugatan?.kantor) {
    usulan.push(buat(KODE_KUASA.kantor, "Kantor Kuasa Penggugat", gugatan.kantor.nilai, yakinGugatan, sg(gugatan.kantor.kalimat), ""));
  } else {
    const dariSipp = p.map((b) => namaKantor(b.alamatKantor)).find(Boolean) || null;
    usulan.push(
      dariSipp
        ? buat(KODE_KUASA.kantor, "Kantor Kuasa Penggugat", dariSipp.nama, "ragu", [{ asal: "sipp", kalimat: `Alamat kantor advokat di SIPP: ${p.find((b) => namaKantor(b.alamatKantor))?.alamatKantor || ""}` }], "Nama kantor tidak terbaca dari gugatan - diambil dari alamat kantor advokat di SIPP.")
        : buat(
            KODE_KUASA.kantor,
            "Kantor Kuasa Penggugat",
            "",
            "kosong",
            [],
            !adaKuasa ? tanpa : gugatan ? "Gugatan tidak menyebut nama kantor (kuasa perorangan) - isi bila surat kuasanya menyebut kantor." : "Gugatan e-Court tidak terbaca - isi dari surat kuasa."
          )
    );
  }

  // ── #0184# tanggal surat kuasa ──
  if (gugatan?.tanggalSuratKuasa) {
    const iso = gugatan.tanggalSuratKuasa.iso || ke_iso(gugatan.tanggalSuratKuasa.nilai);
    const sesudahDaftar = masukan.tanggalDaftar && iso > masukan.tanggalDaftar;
    usulan.push(
      buat(
        KODE_KUASA.tanggalSuratKuasa,
        "Tgl. Surat Kuasa Penggugat",
        gugatan.tanggalSuratKuasa.nilai,
        sesudahDaftar ? "ragu" : yakinGugatan,
        sg(gugatan.tanggalSuratKuasa.kalimat),
        sesudahDaftar ? "Tanggal surat kuasa di gugatan SESUDAH tanggal pendaftaran perkara - periksa surat kuasanya." : ""
      )
    );
  } else {
    usulan.push(
      buat(
        KODE_KUASA.tanggalSuratKuasa,
        "Tgl. Surat Kuasa Penggugat",
        "",
        "kosong",
        [],
        !adaKuasa ? tanpa : gugatan ? "Gugatan tidak menyebut tanggal surat kuasa - isi dari surat kuasanya." : "Gugatan e-Court tidak terbaca - isi dari surat kuasa."
      )
    );
  }

  // ── #8538# alamat kantor ──
  if (gugatan?.alamatKantor) {
    usulan.push(buat(KODE_KUASA.alamatKantor, "Alamat Kantor Kuasa Penggugat", gugatan.alamatKantor.nilai, yakinGugatan, sg(gugatan.alamatKantor.kalimat), ""));
  } else {
    const b = p.find((x) => x.alamatKantor || x.alamat) || null;
    // alamat_kantor SIPP kadang berisi nama kantor + alamat ("Kantor Hukum X, Alamat: ..."):
    // bagian sesudah "Alamat:" yang diambil bila ada.
    const mentah = b ? b.alamatKantor || b.alamat : "";
    const potong = /alamat\s*:\s*(.+)$/i.exec(rapatkan(mentah));
    const nilai = potong ? potong[1] : mentah;
    usulan.push(
      nilai
        ? buat(KODE_KUASA.alamatKantor, "Alamat Kantor Kuasa Penggugat", nilai, "ragu", [{ asal: "sipp", kalimat: `Alamat advokat di SIPP: ${mentah}` }], "Alamat kantor tidak terbaca dari gugatan - diambil dari SIPP, periksa.")
        : buat(KODE_KUASA.alamatKantor, "Alamat Kantor Kuasa Penggugat", "", "kosong", [], adaKuasa ? "Alamat kantor kuasa tidak ditemukan." : tanpa)
    );
  }

  // ── #8537# nama advokat ──
  const sipp = advokatSipp(kuasaSipp);
  if (sipp.length) {
    const dariGugatan = gugatan?.advokat?.nilai || [];
    usulan.push(
      buat(
        KODE_KUASA.advokat,
        "Nama Advokat Kuasa Penggugat",
        gabungNama(sipp),
        "pasti",
        [
          { asal: "sipp", kalimat: `Kuasa aktif Penggugat di SIPP: ${sipp.join("; ")}` },
          ...(dariGugatan.length ? sg(`advokat yang menandatangani: ${dariGugatan.join("; ")}`) : []),
        ],
        dariGugatan.length && dariGugatan.length !== sipp.length
          ? `Gugatan menyebut ${dariGugatan.length} advokat, SIPP mencatat ${sipp.length} kuasa aktif - pakai yang menerima kuasa.`
          : ""
      )
    );
  } else if (gugatan?.advokat?.nilai.length) {
    usulan.push(
      buat(KODE_KUASA.advokat, "Nama Advokat Kuasa Penggugat", gabungNama(gugatan.advokat.nilai), "ragu", sg(gugatan.advokat.nilai.join("; ")), "Kuasa hukum belum dicatat di SIPP - nama diambil dari gugatan.")
    );
  } else {
    usulan.push(buat(KODE_KUASA.advokat, "Nama Advokat Kuasa Penggugat", "", "kosong", [], adaKuasa ? "Nama advokat tidak ditemukan." : tanpa));
  }
  return usulan;
}

// ─── Pembacaan berkas ────────────────────────────────────────────────────────

export type DokumenArsip = {
  documentKey: string;
  judulDokumen: string;
  jenisDokumen?: string;
  peranPengunggah?: string;
  diunggahPada?: string | null;
  adaPdf: boolean;
  adaWord: boolean;
};

const POLA_GUGATAN = /gugat|permohonan/i;
const POLA_BUKAN_GUGATAN = /kuasa|bukti|jawab|replik|duplik|kesimpulan|pencabutan|perbaikan|pernyataan|persetujuan|ktp|kk\b|akta|buku\s+nikah|surat\s+keterangan/i;

/** Dokumen surat gugatan/permohonan pendaftaran, Word lebih dulu (lapisan teksnya pasti ada). */
export function pilihDokumenGugatan(dokumen: DokumenArsip[]): DokumenArsip[] {
  return dokumen
    .filter((d) => POLA_GUGATAN.test(d.judulDokumen || "") && !POLA_BUKAN_GUGATAN.test(d.judulDokumen || ""))
    .filter((d) => !/tergugat|termohon/i.test(d.peranPengunggah || ""))
    .filter((d) => d.adaPdf || d.adaWord)
    .sort((a, b) => Number(b.adaWord) - Number(a.adaWord) || String(a.diunggahPada || "").localeCompare(String(b.diunggahPada || "")));
}

export type DepsKuasaGugatan = {
  rincian: (nomor: string) => Promise<{ ok: boolean; dokumen: DokumenArsip[] }>;
  ambilBerkas: (documentKey: string, format: "pdf" | "word") => Promise<Buffer | null>;
  bacaTeks: (data: Buffer, bolehOcr: boolean) => Promise<{ teks: string; sumber: "teks" | "ocr" | ""; sebab: string }>;
  sipp: (nomor: string) => Promise<{ kuasaSipp: BarisKuasaSipp[]; tanggalDaftar: string } | null>;
};

export type HasilKuasaGugatan = {
  ada: boolean;
  usulan: UsulanKuasa[];
  gugatan: KuasaGugatan | null;
  sumber: SumberGugatan | null;
  catatan: string[];
};

const BATAS_DOKUMEN = 3;

/** Baca gugatan perkara + kuasa SIPP -> usulan. OCR paling banyak sekali per permintaan. */
export async function bacaKuasaGugatan(nomor: string, deps: DepsKuasaGugatan): Promise<HasilKuasaGugatan> {
  const catatan: string[] = [];
  const [rincian, sipp] = await Promise.all([
    deps.rincian(nomor).catch(() => ({ ok: false, dokumen: [] as DokumenArsip[] })),
    deps.sipp(nomor).catch(() => null),
  ]);
  if (!sipp) catatan.push("Data kuasa SIPP tidak terbaca dari ALETA Bot.");
  if (!rincian.ok) catatan.push("Arsip e-Court perkara ini tidak terbaca dari ALETA Bot.");
  const calon = pilihDokumenGugatan(rincian.dokumen || []);
  if (rincian.ok && !calon.length) catatan.push("Surat gugatan/permohonan belum ada di arsip e-Court ALETA.");

  let gugatan: KuasaGugatan | null = null;
  let sumber: SumberGugatan | null = null;
  let ocrDipakai = false;
  for (const d of calon.slice(0, BATAS_DOKUMEN)) {
    const format: "pdf" | "word" = d.adaWord ? "word" : "pdf";
    const data = await deps.ambilBerkas(d.documentKey, format).catch(() => null);
    if (!data) {
      catatan.push(`${d.judulDokumen}: berkas tidak terambil dari arsip.`);
      continue;
    }
    const teks = await deps.bacaTeks(data, !ocrDipakai);
    if (teks.sumber === "ocr") ocrDipakai = true;
    if (!teks.teks) {
      catatan.push(`${d.judulDokumen}: teks tidak terbaca (${teks.sebab || "kosong"}).`);
      continue;
    }
    const h = uraiKuasaGugatan(teks.teks);
    if (!gugatan || (h.ada && !gugatan.ada)) {
      gugatan = h;
      sumber = { judul: d.judulDokumen, documentKey: d.documentKey, baca: teks.sumber === "ocr" ? "ocr" : "teks" };
    }
    if (h.ada && (h.tanggalSuratKuasa || h.kantor)) {
      gugatan = h;
      sumber = { judul: d.judulDokumen, documentKey: d.documentKey, baca: teks.sumber === "ocr" ? "ocr" : "teks" };
      break;
    }
  }
  const usulan = susunUsulanKuasa({
    gugatan,
    sumberGugatan: sumber,
    kuasaSipp: sipp?.kuasaSipp || [],
    tanggalDaftar: sipp?.tanggalDaftar || "",
  });
  return { ada: Boolean(gugatan?.ada) || (sipp?.kuasaSipp || []).some((b) => b.pihakKe === 1), usulan, gugatan, sumber, catatan };
}
