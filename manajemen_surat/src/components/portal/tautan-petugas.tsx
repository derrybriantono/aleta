"use client";

import { Fragment } from "react";

import { withBasePath } from "@/lib/base-path";
import { SEBUTAN_PERAN, alamatRekapPetugas, type PeranRekap } from "@/lib/rekap-petugas";
import { daftarMediator } from "@/lib/sebutan-mediator";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * NAMA PETUGAS YANG MEMBUKA REKAPNYA
 * ============================================================================
 *
 * Diminta pengguna 27 September 2026 (butir 6 dan 9): nama hakim, panitera
 * pengganti, juru sita, dan mediator pada layar Status Perkara dapat diklik
 * dan membuka rekap orang itu di HALAMAN BARU.
 *
 * Tiga hal dijaga di sini:
 *
 *   1. ALAMATNYA MEMBAWA ID SIPP, bukan nama. Ejaan nama berbeda antar
 *      penunjukan untuk orang yang sama, dan dua orang dapat bernama sama.
 *      Nama yang datang tanpa id (bot versi lama, atau SIPP yang mencatat
 *      id 0) tetap tampil sebagai teks biasa - tidak ditebakkan ke siapa pun.
 *
 *   2. TAB BARU, target=_blank rel=noopener. Yang membuka rekap sedang
 *      memeriksa satu perkara; menggantinya di tab yang sama membuang tempat
 *      bacanya. noopener memutus window.opener, sehingga halaman rekap tidak
 *      dapat menyetir tab Status Perkara.
 *
 *   3. TAMPAK DAPAT DIKLIK, TIDAK MERUSAK CETAKAN. Garis bawah bertitik yang
 *      menjadi utuh saat disorot, cincin fokus bagi papan ketik, dan kalimat
 *      pembaca layar yang menyebut tab barunya. Saat dicetak garis bawahnya
 *      dibuang dan warnanya kembali ke warna tulisan - di kertas tidak ada
 *      yang dapat diklik, dan garis bawah hanya menambah coretan.
 */
export function TautanPetugas({
  peran,
  id,
  nama,
  className,
}: {
  peran: PeranRekap;
  id: number | null | undefined;
  nama: string;
  className?: string;
}) {
  const alamat = alamatRekapPetugas(peran, id);
  if (!alamat) return <span className={className}>{nama}</span>;
  return (
    <a
      href={withBasePath(alamat)}
      target="_blank"
      rel="noopener"
      title={`Buka rekap ${SEBUTAN_PERAN[peran].toLowerCase()} ini di tab baru`}
      className={cn(
        "rounded-sm underline decoration-dotted decoration-1 underline-offset-[3px] transition-colors",
        "hover:text-primary hover:decoration-solid",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "print:text-inherit print:no-underline",
        className
      )}
    >
      {nama}
      <span className="sr-only"> (rekap dibuka di tab baru)</span>
    </a>
  );
}

/**
 * Satu orang pada muatan bot. keteranganTahapan ("verzet", "banding", ...)
 * hanya terisi untuk penunjukan di luar pemeriksaan dan ikrar; sumber hanya
 * pada majelis ikrar - "penetapanIkrar" bila catatannya dari borang penetapan
 * ikrar talak SIPP, bukan dari tabel penunjukan.
 */
type Orang = {
  id?: number | null;
  kode?: string;
  nama: string;
  keteranganTahapan?: string;
  sumber?: string;
};

type Hakim = Orang & { kode?: string; jabatan?: string };

/** Majelis ikrar talak sebagaimana dikirim bot (sippStatusPerkaraService). */
export type MajelisIkrar = {
  majelis: Hakim[];
  panitera: Orang[];
  jurusita: Orang[];
};

/** " (banding)" untuk penunjukan di luar pemeriksaan; kosong selainnya. */
function akhiranTahapan(orang: Orang): string {
  const ket = String(orang.keteranganTahapan || "").trim();
  return ket ? ` (${ket})` : "";
}

/** Beberapa nama dipisah koma, tiap nama tautannya sendiri. */
function NamaTertaut({ peran, orang }: { peran: PeranRekap; orang: Orang[] }) {
  const ada = orang.filter((x) => String(x.nama || "").trim());
  if (ada.length === 0) return <>—</>;
  return (
    <>
      {ada.map((x, urutan) => (
        <Fragment key={`${x.id ?? "tanpa-id"}-${x.nama}-${urutan}`}>
          {urutan > 0 ? ", " : null}
          <TautanPetugas peran={peran} id={x.id} nama={x.nama} />
          {akhiranTahapan(x) ? <span className="text-xs text-muted-foreground">{akhiranTahapan(x)}</span> : null}
        </Fragment>
      ))}
    </>
  );
}

/** Daftar hakim: kode, nama tertaut, kedudukan - bentuk yang sama sejak dulu. */
function DaftarHakim({ majelis, kosong }: { majelis: Hakim[]; kosong: string }) {
  if (majelis.length === 0) return <p className="text-sm text-muted-foreground">{kosong}</p>;
  return (
    <ul className="space-y-0.5 text-sm">
      {majelis.map((orang, urutan) => (
        <li key={`${orang.kode ?? ""}${orang.nama}-${urutan}`}>
          <span className="font-mono text-sm">{orang.kode || "—"}</span>{" "}
          <TautanPetugas peran="hakim" id={orang.id} nama={orang.nama} className="font-medium" />
          {orang.jabatan || akhiranTahapan(orang) ? (
            <span className="text-xs text-muted-foreground">
              {orang.jabatan ? ` · ${orang.jabatan}` : ""}
              {akhiranTahapan(orang)}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function JudulKecil({ children }: { children: string }) {
  return <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

/**
 * ============================================================================
 * ISI BAGIAN "MAJELIS DAN PETUGAS" PADA STATUS PERKARA
 * ============================================================================
 *
 * Tiap nama tautan ke rekapnya (lewat ID, tab baru). Bentuk tiap baris sama
 * dengan sebelumnya - kode hakim, nama, kedudukan; tanda "—" bila kosong.
 *
 * MAJELIS PEMERIKSA, BUKAN MAJELIS YANG AKTIF SEKARANG. SIPP menonaktifkan
 * majelis pemeriksaan begitu majelis ikrar talak ditetapkan, dan dulu layar
 * ini - membaca penunjukan aktif - menulis majelis IKRAR sebagai majelis
 * perkara (perkara_id 385: ketua pemeriksa Muh. Arasy Latif, tertulis Ulfah,
 * ketua ikrarnya). Bot sejak perbaikan itu mengirim majelis pemeriksa beserta
 * `sumberMajelis: "pemeriksa"`, dan majelis ikrar talak tersendiri di `ikrar`,
 * yang digambar sebagai blok kedua.
 *
 * Judul "Majelis pemeriksa" hanya ditulis bila bot MENYATAKANNYA. Muatan bot
 * versi lama (tanpa sumberMajelis) berisi penunjukan aktif - yang pada perkara
 * yang sudah ikrar justru majelis ikrar - jadi digambar tanpa judul, seperti
 * dulu. "aktif" (modul pemeriksa gagal dibaca di bot) disebut terang-terangan,
 * dan "tidakTerbaca" (penunjukan tidak terbaca sama sekali) tidak ditulis
 * "Majelis belum ditetapkan" - yang itu pernyataan tentang perkaranya.
 */
export function DaftarMajelisPetugas({
  majelis,
  panitera,
  jurusita,
  ikrar,
  sumberMajelis,
}: {
  majelis: Hakim[];
  panitera: Orang[];
  jurusita: Orang[];
  /** Majelis ikrar talak; null/tidak ada = tidak ada ikrar (atau bot lama). */
  ikrar?: MajelisIkrar | null;
  /**
   * "pemeriksa" menurut aturan bersama; "aktif" bila bot jatuh ke penunjukan
   * aktif; "tidakTerbaca" bila penunjukan tidak terbaca sama sekali.
   */
  sumberMajelis?: string;
}) {
  const pemeriksa = sumberMajelis === "pemeriksa";
  const kosongMajelis =
    sumberMajelis === "tidakTerbaca" ? "Majelis tidak terbaca dari SIPP." : "Majelis belum ditetapkan.";
  const dariBorang = Boolean(
    ikrar && [...ikrar.majelis, ...ikrar.panitera, ...ikrar.jurusita].some((x) => x.sumber === "penetapanIkrar")
  );
  return (
    <>
      {pemeriksa ? <JudulKecil>Majelis pemeriksa</JudulKecil> : null}
      {sumberMajelis === "aktif" ? (
        <p className="mb-1 text-xs text-amber-700 dark:text-amber-300">
          Majelis pemeriksa tidak terbaca — yang tampil penunjukan yang aktif sekarang, yang pada perkara cerai talak
          sesudah ikrar dapat berupa majelis ikrar.
        </p>
      ) : null}
      <DaftarHakim majelis={majelis} kosong={kosongMajelis} />
      <p className="mt-2 text-sm">
        <span className="text-xs text-muted-foreground">{pemeriksa ? "Panitera pengganti: " : "Panitera: "}</span>
        <NamaTertaut peran="panitera" orang={panitera} />
      </p>
      <p className="text-sm">
        <span className="text-xs text-muted-foreground">{pemeriksa ? "Juru sita: " : "Jurusita: "}</span>
        <NamaTertaut peran="jurusita" orang={jurusita} />
      </p>

      {ikrar ? (
        <div className="mt-3 border-t border-border pt-2" data-blok="majelis-ikrar">
          <JudulKecil>Majelis ikrar talak</JudulKecil>
          <DaftarHakim majelis={ikrar.majelis} kosong="Majelis ikrar tidak tercatat." />
          <p className="mt-2 text-sm">
            <span className="text-xs text-muted-foreground">Panitera sidang: </span>
            <NamaTertaut peran="panitera" orang={ikrar.panitera} />
          </p>
          <p className="text-sm">
            <span className="text-xs text-muted-foreground">Juru sita: </span>
            <NamaTertaut peran="jurusita" orang={ikrar.jurusita} />
          </p>
          {dariBorang ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Sebagian dari blangko penetapan ikrar talak SIPP — tabel penunjukan tidak mencatatnya tersendiri.
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/**
 * Nama mediator satu catatan mediasi, masing-masing tertaut ke rekapnya.
 *
 * mediator_text SIPP merangkai beberapa mediator dengan <br/>, dan dulu
 * tanda itu tertulis mentah di layar. Nama ke-n berpasangan dengan id ke-n
 * (perkara_mediasi.mediator_id "15,17") dan sandi ke-n (status_mediator
 * "H,H") - urutan yang sama yang dipakai SIPP merangkainya. Sebutan Mediator
 * Hakim / Mediator Non Hakim diambil dari lib/sebutan-mediator, satu aturan
 * untuk seluruh layar.
 */
export function NamaMediatorTertaut({
  mediator,
  statusMediator,
  mediatorIds,
}: {
  mediator: string;
  statusMediator: string;
  mediatorIds?: Array<number | null>;
}) {
  // Id dipasangkan menurut posisi ASLINYA, baru sesudah itu yang tanpa nama
  // dibuang - membuang lebih dulu menggeser id ke nama orang lain.
  const bernama = daftarMediator(mediator, statusMediator)
    .map((m, urutan) => ({ ...m, id: mediatorIds?.[urutan] ?? null }))
    .filter((m) => m.nama);
  if (bernama.length === 0) {
    return <span className="text-sm font-medium">Mediator belum tercatat</span>;
  }
  return (
    <span className="text-sm font-medium">
      {bernama.map((m, urutan) => (
        <Fragment key={`${m.nama}-${urutan}`}>
          {urutan > 0 ? ", " : null}
          <TautanPetugas peran="mediator" id={m.id} nama={m.nama} />
          <span className="text-xs font-normal text-muted-foreground"> ({m.sebutan})</span>
        </Fragment>
      ))}
    </span>
  );
}
