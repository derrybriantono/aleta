import { createHash } from "node:crypto";
import path from "node:path";

import { cariGatewayPerkara } from "@/server/modules/aleta-bot/whatsapp-gateway-client";
import {
  namaBerkasArsipPerkara,
  susunArsipPerkara,
  BATAS_TOTAL_BYTE,
  type HasilArsipPerkara,
  type OpsiArsipPerkara,
} from "@/server/modules/aleta-ecourt/susun-arsip-perkara";
import { GalatDrive, type KlienDrive } from "@/server/modules/sinkron/drive";
import { NAMA_FOLDER_BERKAS, folderInduk } from "@/server/modules/sinkron/drive-cadangan";
import type { PengaturanSinkron } from "@/server/modules/sinkron/pengaturan";
import { bacaJson, jalurSinkron, tulisJson } from "@/server/modules/sinkron/penyimpanan";

/**
 * Berkas SELURUH perkara ke Google Drive sebagai POHON FOLDER (butir 30).
 *
 * ============================================================================
 * STRUKTURNYA TIDAK DISUSUN DI SINI
 * ============================================================================
 *
 * Isi tiap folder perkara datang dari susunArsipPerkara() - fungsi yang SAMA
 * yang mengisi ZIP tombol "Unduh seluruh perkara" di Status Perkara (isi
 * lengkap, sumber semua). Nama tiap berkas di ZIP adalah jalurnya di Drive:
 *
 *   ALETA Sinkron/Berkas perkara/2026/perkara-273-Pdt.G-2026-PA.Dgl/
 *     00 Data SIPP/perkara.json, 01 identitas.csv, ...
 *     01 Gugatan/01 - Surat Gugatan atau Permohonan.docx
 *     02 Relaas/..., 02 Relaas/Resi pos/..., 03 BAS/..., 04 Putusan/...
 *     05 Lampiran/, 06 e-Court/, 07 Penetapan/, 08 Arsip fisik/ (bila dipilih)
 *     RINGKASAN.txt, DAFTAR ISI.txt, KETERANGAN.txt
 *
 * Nama folder perkara = nama ZIP-nya tanpa ".zip" (namaBerkasArsipPerkara).
 * Satu-satunya lapisan tambahan: folder TAHUN, supaya satu folder Drive tidak
 * berisi sepuluh ribu folder perkara.
 *
 * ============================================================================
 * BERTAMBAH, TAHAN GANGGUAN, DAN TIDAK MEMBEBANI SERVER
 * ============================================================================
 *
 * - Tiap berkas dicatat SHA-256-nya setelah terunggah (catatan per perkara di
 *   reports/sinkron/drive-berkas/perkara/). Isi yang sama tidak diunggah dua
 *   kali; isi yang berubah memperbarui BERKAS YANG SAMA di Drive (versinya
 *   disimpan Drive), bukan membuat duplikat.
 * - Catatan ditulis sesudah TIAP berkas: server yang mati di tengah jalan
 *   melanjutkan dari berkas berikutnya, bukan dari awal.
 * - Tiap jalan dibatasi jumlah perkara dan megabyte, diberi jeda antarberkas,
 *   dan perkara yang baru diperiksa dilewati sampai `ulangiSetelahHari`.
 * - Berkas yang HILANG dari susunan (bot sedang tidak dapat membacanya) TIDAK
 *   dibuang dari Drive. Yang dipindah ke Sampah hanya berkas yang isinya kini
 *   berdiri dengan NAMA LAIN (nomor urut relaas bergeser) - isinya terbukti
 *   masih ada, jadi tidak ada yang hilang.
 */

export type CatatanPerkara = {
  nomor: string;
  folderId: string;
  folder: Record<string, string>;
  berkas: Record<string, { sha256: string; byte: number; id: string; diunggah: string }>;
};

export type IndeksPerkara = {
  daftarDiperbarui: string;
  perkara: Record<string, { diperiksa: string; berkas: number; byte: number; galat: string }>;
};

/** Pilihan susunan: sama dengan tombol Status Perkara (isi lengkap, sumber semua). */
export function opsiSusunan(p: PengaturanSinkron, nomor: string): OpsiArsipPerkara {
  return {
    nomor,
    sumber: "semua",
    lengkap: true,
    sertakanArsip: p.drive.berkasPerkara.sertakanArsipFisik,
    // Sinkron tidak melewati nginx 120 detik, jadi batas WAKTU dilonggarkan
    // dan batas JUMLAH berkas dinaikkan. Batas UKURAN (penjaga memori portal)
    // tetap sama dengan ZIP.
    batasBerkas: 1000,
    batasTotalByte: BATAS_TOTAL_BYTE,
    batasSatuBerkasMs: 60_000,
    batasSeluruhMs: 15 * 60_000,
  };
}

/** Tahun dari nomor perkara ("273/Pdt.G/2026/PA.Dgl" -> "2026"). */
export function tahunPerkara(nomor: string) {
  return /\/((?:19|20)\d{2})\//.exec(nomor)?.[1] ?? "Tanpa tahun";
}

/** Nama folder perkara di Drive = nama ZIP tombol Status Perkara tanpa ".zip". */
export function namaFolderPerkara(nomor: string) {
  return namaBerkasArsipPerkara(nomor, { lengkap: true, sumber: "semua" }).replace(/\.zip$/, "");
}

export function jalurCatatanPerkara(nomor: string) {
  const sidik = createHash("sha1").update(nomor).digest("hex");
  return path.join(jalurSinkron.driveBerkas(), "perkara", `${sidik}.json`);
}

const jalurIndeks = () => path.join(jalurSinkron.driveBerkas(), "indeks.json");

export async function bacaIndeks(): Promise<IndeksPerkara> {
  const i = await bacaJson<IndeksPerkara>(jalurIndeks(), { daftarDiperbarui: "", perkara: {} });
  return { daftarDiperbarui: i?.daftarDiperbarui ?? "", perkara: i?.perkara ?? {} };
}

/** Seluruh nomor perkara sejak `tahunMulai`, dari pencarian Status Perkara. */
export async function daftarNomorPerkara(tahunMulai: number, cari = cariGatewayPerkara) {
  const nomor = new Set<string>();
  const tahunIni = new Date().getFullYear();
  for (let tahun = tahunMulai; tahun <= tahunIni; tahun += 1) {
    let lewati = 0;
    for (let halaman = 0; halaman < 200; halaman += 1) {
      const jawab = await cari({ tahun: String(tahun), batas: 500, lewati });
      if (!jawab.ok) throw new Error(`Daftar perkara ${tahun} tidak terbaca: ${jawab.error}`);
      for (const b of jawab.data.perkara ?? []) if (b.nomorPerkara) nomor.add(String(b.nomorPerkara).trim());
      if (!jawab.data.adaLagi || (jawab.data.perkara ?? []).length === 0) break;
      lewati += Number(jawab.data.batas || 500);
    }
  }
  return [...nomor];
}

/**
 * Urutan kerja: yang belum pernah diperiksa lebih dulu, lalu yang paling
 * lama tidak diperiksa. Yang diperiksa kurang dari `ulangiSetelahHari` hari
 * lalu dilewati. Fungsi murni - diuji.
 */
export function pilihPerkara(
  nomor: string[],
  indeks: IndeksPerkara,
  ulangiSetelahHari: number,
  batas: number,
  kini = Date.now()
) {
  const ambang = kini - ulangiSetelahHari * 86_400_000;
  return nomor
    .map((n) => ({ n, t: indeks.perkara[n]?.diperiksa ? Date.parse(indeks.perkara[n].diperiksa) : 0 }))
    .filter((x) => x.t === 0 || x.t <= ambang)
    .sort((a, b) => a.t - b.t || a.n.localeCompare(b.n))
    .slice(0, batas)
    .map((x) => x.n);
}

export type RencanaUnggah = {
  unggah: Array<{ nama: string; isi: Buffer; sha256: string; idLama: string }>;
  sama: number;
  /** Berkas lama di Drive yang isinya kini berdiri dengan nama lain. */
  buang: Array<{ nama: string; id: string }>;
};

/**
 * Membandingkan susunan sekarang dengan catatan unggahan. Fungsi murni.
 * Hanya berkas yang isinya berubah atau baru yang diunggah.
 */
export function rencanakanUnggah(isiZip: HasilArsipPerkara["isiZip"], catatan: CatatanPerkara): RencanaUnggah {
  const rencana: RencanaUnggah = { unggah: [], sama: 0, buang: [] };
  const sidikBaru = new Set<string>();
  const namaBaru = new Set<string>();
  for (const b of isiZip) {
    const sha256 = createHash("sha256").update(b.isi).digest("hex");
    sidikBaru.add(sha256);
    namaBaru.add(b.nama);
    const lama = catatan.berkas[b.nama];
    if (lama && lama.sha256 === sha256) {
      rencana.sama += 1;
      continue;
    }
    rencana.unggah.push({ nama: b.nama, isi: b.isi, sha256, idLama: lama?.id ?? "" });
  }
  for (const [nama, lama] of Object.entries(catatan.berkas)) {
    if (!namaBaru.has(nama) && sidikBaru.has(lama.sha256)) rencana.buang.push({ nama, id: lama.id });
  }
  return rencana;
}

async function pastikanJalurFolder(klien: KlienDrive, catatan: CatatanPerkara, jalurRelatif: string) {
  const bagian = jalurRelatif.split("/").slice(0, -1);
  let induk = catatan.folderId;
  let kunci = "";
  for (const nama of bagian) {
    kunci = kunci ? `${kunci}/${nama}` : nama;
    if (!catatan.folder[kunci]) catatan.folder[kunci] = await klien.pastikanFolder(nama, induk);
    induk = catatan.folder[kunci];
  }
  return induk;
}

export type HasilSinkronBerkas = {
  diperiksa: number;
  berkasDiunggah: number;
  berkasSama: number;
  berkasDibuang: number;
  byte: number;
  galat: string[];
  sisa: number;
  terhenti: string;
};

export async function sinkronBerkasPerkara(
  klien: KlienDrive,
  p: PengaturanSinkron,
  pilihan: {
    sinyal?: AbortSignal;
    lapor?: (t: string) => void;
    /** Uji: pengganti daftar nomor dan penyusun. */
    daftarNomor?: string[];
    susun?: (opsi: OpsiArsipPerkara) => Promise<HasilArsipPerkara>;
    tidur?: (ms: number) => Promise<void>;
  } = {}
): Promise<HasilSinkronBerkas> {
  const cfg = p.drive.berkasPerkara;
  const susun = pilihan.susun ?? susunArsipPerkara;
  const tidur = pilihan.tidur ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const indeks = await bacaIndeks();
  const nomor = pilihan.daftarNomor ?? (await daftarNomorPerkara(cfg.tahunMulai));
  indeks.daftarDiperbarui = new Date().toISOString();
  const antre = pilihPerkara(nomor, indeks, cfg.ulangiSetelahHari, cfg.perkaraPerJalan);
  const hasil: HasilSinkronBerkas = {
    diperiksa: 0,
    berkasDiunggah: 0,
    berkasSama: 0,
    berkasDibuang: 0,
    byte: 0,
    galat: [],
    sisa: 0,
    terhenti: "",
  };
  const batasByte = cfg.batasMbPerJalan * 1024 * 1024;

  const induk = await folderInduk(klien, p);
  const akarBerkas = await klien.pastikanFolder(NAMA_FOLDER_BERKAS, induk);
  const folderTahun: Record<string, string> = {};

  for (const n of antre) {
    if (pilihan.sinyal?.aborted) {
      hasil.terhenti = "dihentikan admin";
      break;
    }
    if (hasil.byte >= batasByte) {
      hasil.terhenti = `batas ${cfg.batasMbPerJalan} MB per jalan tercapai`;
      break;
    }
    pilihan.lapor?.(`${hasil.diperiksa + 1}/${antre.length}: ${n}`);
    const jalurCatatan = jalurCatatanPerkara(n);
    const catatan = await bacaJson<CatatanPerkara>(jalurCatatan, { nomor: n, folderId: "", folder: {}, berkas: {} });
    try {
      const susunan = await susun(opsiSusunan(p, n));
      const rencana = rencanakanUnggah(susunan.isiZip, catatan);
      hasil.berkasSama += rencana.sama;
      if (rencana.unggah.length > 0 && !catatan.folderId) {
        const tahun = tahunPerkara(n);
        folderTahun[tahun] ??= await klien.pastikanFolder(tahun, akarBerkas);
        catatan.folderId = await klien.pastikanFolder(namaFolderPerkara(n), folderTahun[tahun]);
        await tulisJson(jalurCatatan, catatan);
      }
      for (const u of rencana.unggah) {
        if (pilihan.sinyal?.aborted) throw new Error("dihentikan admin");
        const indukBerkas = await pastikanJalurFolder(klien, catatan, u.nama);
        const id = await klien.unggah(path.posix.basename(u.nama), indukBerkas, u.isi, u.idLama);
        catatan.berkas[u.nama] = { sha256: u.sha256, byte: u.isi.length, id, diunggah: new Date().toISOString() };
        await tulisJson(jalurCatatan, catatan);
        hasil.berkasDiunggah += 1;
        hasil.byte += u.isi.length;
        if (cfg.jedaMs > 0) await tidur(cfg.jedaMs);
      }
      for (const b of rencana.buang) {
        await klien.buang(b.id).catch(() => undefined);
        delete catatan.berkas[b.nama];
        hasil.berkasDibuang += 1;
      }
      await tulisJson(jalurCatatan, catatan);
      indeks.perkara[n] = {
        diperiksa: new Date().toISOString(),
        berkas: susunan.isiZip.length,
        byte: susunan.totalByte,
        galat: "",
      };
    } catch (galat) {
      const pesan = String((galat as Error)?.message || galat).slice(0, 200);
      hasil.galat.push(`${n}: ${pesan}`);
      // Folder perkara dihapus orang di Drive: catatannya dikosongkan supaya
      // jalan berikutnya membuat ulang folder dan mengunggah ulang isinya.
      if (galat instanceof GalatDrive && galat.status === 404) {
        await tulisJson(jalurCatatan, { nomor: n, folderId: "", folder: {}, berkas: {} });
      }
      // Diperiksa tetap dicatat, supaya satu perkara yang selalu gagal tidak
      // memonopoli awal antrean setiap malam.
      indeks.perkara[n] = { diperiksa: new Date().toISOString(), berkas: 0, byte: 0, galat: pesan };
      // Sambungan Drive yang putus total menghentikan jalan ini - melanjutkan
      // hanya menumpuk error yang sama untuk ratusan perkara.
      if (/tidak berlaku|tidak terjangkau|Kuota penyimpanan/i.test(pesan)) {
        hasil.terhenti = pesan;
        await tulisJson(jalurIndeks(), indeks);
        break;
      }
    }
    hasil.diperiksa += 1;
    await tulisJson(jalurIndeks(), indeks);
  }
  hasil.sisa = pilihPerkara(nomor, indeks, cfg.ulangiSetelahHari, Number.MAX_SAFE_INTEGER).length;
  await tulisJson(jalurIndeks(), indeks);
  return hasil;
}
