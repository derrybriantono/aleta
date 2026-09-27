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

type Orang = { id?: number | null; kode?: string; nama: string };

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
        </Fragment>
      ))}
    </>
  );
}

/**
 * Isi bagian "Majelis dan petugas" pada Status Perkara.
 *
 * Bentuk dan kalimatnya SAMA dengan yang digambar sebelumnya di layar itu -
 * kode hakim, nama, jabatan; "Panitera:" dan "Jurusita:" dengan tanda "—"
 * bila kosong. Yang berubah hanya: tiap nama kini tautan ke rekapnya.
 */
export function DaftarMajelisPetugas({
  majelis,
  panitera,
  jurusita,
}: {
  majelis: Array<Orang & { kode: string; jabatan: string }>;
  panitera: Orang[];
  jurusita: Orang[];
}) {
  return (
    <>
      {majelis.length > 0 ? (
        <ul className="space-y-0.5 text-sm">
          {majelis.map((orang, urutan) => (
            <li key={`${orang.kode}${orang.nama}-${urutan}`}>
              <span className="font-mono text-sm">{orang.kode || "—"}</span>{" "}
              <TautanPetugas peran="hakim" id={orang.id} nama={orang.nama} className="font-medium" />
              {orang.jabatan ? <span className="text-xs text-muted-foreground"> · {orang.jabatan}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Majelis belum ditetapkan.</p>
      )}
      <p className="mt-2 text-sm">
        <span className="text-xs text-muted-foreground">Panitera: </span>
        <NamaTertaut peran="panitera" orang={panitera} />
      </p>
      <p className="text-sm">
        <span className="text-xs text-muted-foreground">Jurusita: </span>
        <NamaTertaut peran="jurusita" orang={jurusita} />
      </p>
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
