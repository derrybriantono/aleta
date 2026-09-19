"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Info } from "lucide-react";

import { apiPath } from "@/lib/base-path";
import { siarkanAba } from "@/lib/alat-bagian";
import { Button } from "@/components/ui/button";

/**
 * ============================================================================
 * IDENTITAS SATU PIHAK - DIBUKA DARI NAMANYA
 * ============================================================================
 *
 * Nama para pihak sudah ada di Status Perkara sejak lama; siapa orangnya tidak.
 * Umur, pekerjaan, pendidikan, dan desa asalnya selama ini menuntut petugas
 * membuka SIPP di jendela lain - padahal keempatnya justru yang ditanyakan
 * ketika menyusun penetapan dan memeriksa relaas.
 *
 * ============================================================================
 * DIBACA SEKALI, KETIKA DIMINTA - BUKAN IKUT MUATAN STATUS
 * ============================================================================
 *
 * Ini data pribadi, dan layar Status Perkara dibuka di meja yang kerap
 * terlihat orang lain. Yang tidak diketuk karena itu tidak pernah meninggalkan
 * basis data.
 *
 * Sekali diketuk, SELURUH pihak perkara itu terbaca sekaligus dan disimpan -
 * bukan satu per satu. Satu kueri untuk dua belas nama jauh lebih murah
 * daripada dua belas kueri, dan yang membuka satu nama hampir selalu membuka
 * nama berikutnya.
 *
 * NIK dan telepon datang SUDAH tersamar dari peladen. Menyamarkannya di sini
 * tidak ada gunanya: yang utuh tetap melintasi jaringan dan tetap terbaca oleh
 * siapa pun yang membuka alat pengembang.
 */

export type PihakLengkap = {
  pihakId: number;
  pihakKe: number;
  kedudukan: string;
  nama: string;
  kelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  umur: number | null;
  pekerjaan: string;
  pendidikan: string;
  agama: string;
  statusKawin: string;
  wargaNegara: string;
  alamat: string;
  rtrw: string;
  wilayah: string[];
  nikSamar: string;
  adaNik: boolean;
  teleponSamar: string;
  adaTelepon: boolean;
  difabel: boolean;
};

type Muatan = { ok: boolean; alasan?: string; catatan?: string; pihak?: PihakLengkap[] };

/** Membuka bungkus { ok, data } - membacanya langsung selalu keliru dan tidak berbunyi. */
async function bukaBungkus<T>(balasan: Response): Promise<T> {
  return ((await balasan.json()) as { data?: T })?.data ?? ({} as T);
}

/**
 * Menyimpan hasil per nomor perkara, di luar komponen.
 *
 * Kartu identitas lahir dan mati mengikuti nama yang diketuk. Simpanan yang
 * hidup di dalam komponen ikut mati bersamanya, sehingga menutup lalu membuka
 * nama yang sama membaca SIPP lagi - dan pada perkara berpihak banyak itu
 * berarti belasan pembacaan untuk satu jawaban yang tidak berubah.
 */
const simpanan = new Map<string, PihakLengkap[]>();

export function useIdentitasPihak(nomorPerkara: string, aktif: boolean) {
  const [pihak, setPihak] = useState<PihakLengkap[] | null>(
    () => simpanan.get(nomorPerkara) ?? null
  );
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);

  useEffect(() => {
    if (!aktif || !nomorPerkara) return;
    const tersimpan = simpanan.get(nomorPerkara);
    if (tersimpan) {
      setPihak(tersimpan);
      return;
    }
    let hidup = true;
    setMemuat(true);
    void (async () => {
      try {
        const balasan = await fetch(
          apiPath(`/api/aleta-ecourt/identitas-pihak?nomorPerkara=${encodeURIComponent(nomorPerkara)}`),
          { cache: "no-store" }
        );
        const isi = await bukaBungkus<Muatan>(balasan);
        if (!hidup) return;
        if (!isi.ok) {
          setGalat(isi.alasan || "Identitas pihak tidak dapat dibaca.");
          return;
        }
        const daftar = Array.isArray(isi.pihak) ? isi.pihak : [];
        simpanan.set(nomorPerkara, daftar);
        setPihak(daftar);
      } catch (e) {
        if (hidup) setGalat(e instanceof Error ? e.message : "Identitas pihak tidak dapat dibaca.");
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => {
      hidup = false;
    };
  }, [nomorPerkara, aktif]);

  const cari = useCallback(
    (nama: string) => {
      if (!pihak) return null;
      const baku = nama.trim().toLowerCase();
      return pihak.find((x) => x.nama.trim().toLowerCase() === baku) ?? null;
    },
    [pihak]
  );

  return { pihak, cari, galat, memuat };
}

function Baris({ label, nilai }: { label: string; nilai: string }) {
  if (!nilai) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-[6.5rem] shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 text-sm">{nilai}</dd>
    </div>
  );
}

export function KartuIdentitasPihak({
  orang,
  memuat,
  galat,
}: {
  orang: PihakLengkap | null;
  memuat: boolean;
  galat: string;
}) {
  const lahir = useMemo(() => {
    if (!orang) return "";
    const bagian = [orang.tempatLahir, orang.tanggalLahir].filter(Boolean).join(", ");
    if (!bagian) return orang.umur !== null ? `${orang.umur} tahun` : "";
    return orang.umur !== null ? `${bagian} · ${orang.umur} tahun` : bagian;
  }, [orang]);

  if (galat) {
    return (
      <p className="mt-1 flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{galat}</span>
      </p>
    );
  }
  if (memuat && !orang) {
    return <p className="mt-1 text-xs text-muted-foreground">Membaca identitas…</p>;
  }
  if (!orang) {
    // Nama ada di daftar pihak tetapi tidak ketemu di tabel identitas. Disebut
    // apa adanya: "tidak ketemu" berbeda dari "belum diisi", dan menyamakan
    // keduanya membuat orang menelusuri hal yang salah.
    return (
      <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Identitas orang ini tidak tercatat pada tabel pihak SIPP.</span>
      </p>
    );
  }

  return (
    <dl className="mt-1.5 space-y-0.5 rounded-lg border border-border bg-muted/30 px-3 py-2">
      <Baris label="Kedudukan" nilai={orang.kedudukan} />
      <Baris label="Jenis kelamin" nilai={orang.kelamin} />
      <Baris label="Lahir" nilai={lahir} />
      <Baris label="Pekerjaan" nilai={orang.pekerjaan} />
      <Baris label="Pendidikan" nilai={orang.pendidikan} />
      <Baris label="Agama" nilai={orang.agama} />
      <Baris label="Status kawin" nilai={orang.statusKawin} />
      <Baris label="Warga negara" nilai={orang.wargaNegara} />
      <Baris label="Wilayah" nilai={orang.wilayah.join(" · ")} />
      <Baris label="Alamat" nilai={orang.alamat} />
      <Baris label="RT/RW" nilai={orang.rtrw} />
      <Baris label="NIK" nilai={orang.adaNik ? orang.nikSamar : ""} />
      <Baris label="Telepon" nilai={orang.adaTelepon ? orang.teleponSamar : ""} />
      {orang.difabel ? <Baris label="Difabel" nilai="Ya - perlu penyesuaian layanan" /> : null}

      {/* ==============================================================
          JALAN KE PERKARA LAIN ORANG INI
          ==============================================================

          Analisis "Riwayat pihak" sudah menghitungnya sejak lama - lewat NIK,
          nama, dan tanggal lahir. Yang tidak ada JALANNYA: yang sedang menatap
          nama seseorang harus menutup kartu ini, menggulung ke Analisis
          lanjutan, membukanya, lalu mencari satu tombol di antara empat puluh
          satu. */}
      <div className="pt-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            siarkanAba({ jenis: "buka", kunci: "analisa-lanjut" });
            siarkanAba({ jenis: "analisa", kunci: "pihak" });
            window.setTimeout(() => {
              document
                .getElementById("bagian-analisa-lanjut")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 80);
          }}
        >
          Perkara lain orang ini
        </Button>
      </div>

      {/* Yang disamarkan disebutkan SEBAB penyamarannya, bukan dibiarkan
          terlihat seperti data rusak. */}
      {orang.adaNik || orang.adaTelepon ? (
        <p className="pt-1 text-[0.68rem] leading-snug text-muted-foreground">
          NIK dan nomor telepon sengaja disamarkan — cukup untuk mencocokkan dengan berkas di
          tangan, tidak cukup untuk disalin. Yang utuh ada di SIPP.
        </p>
      ) : null}
    </dl>
  );
}
