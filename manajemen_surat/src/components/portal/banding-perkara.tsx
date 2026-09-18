"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeftRight, Info, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

/**
 * ============================================================================
 * MEMBANDINGKAN PERKARA DENGAN PERKARA LAIN
 * ============================================================================
 *
 * Pertanyaan yang tiap hari muncul di kepaniteraan dan tidak dapat dijawab
 * satu layar: "perkara ini kok lebih lama dari yang itu?", "majelisnya sama
 * tidak?", "yang itu berapa kali sidang?". Selama ini jawabannya menuntut dua
 * jendela SIPP dibuka berdampingan, lalu mata yang membandingkannya sendiri -
 * dan mata yang membandingkan dua layar berbeda kerap membandingkan baris yang
 * berbeda pula.
 *
 * ============================================================================
 * SUMBERNYA ALAMAT YANG SAMA, BUKAN ALAMAT BARU
 * ============================================================================
 *
 * Perkara pembanding dibaca lewat alamat status perkara yang SAMA dengan yang
 * sedang dibuka. Tidak ada kueri baru, tidak ada bentuk data kedua yang harus
 * dijaga tetap sejalan - dan itu penting: dua bentuk data yang menggambarkan
 * hal yang sama akan menyimpang diam-diam, dan yang menyimpang justru
 * perbandingannya.
 *
 * ============================================================================
 * SELISIHNYA DIHITUNG, BUKAN DIBIARKAN DIHITUNG MATA
 * ============================================================================
 *
 * Kolom ketiga memuat SELISIHNYA. Dua angka berdampingan masih menuntut
 * pembacanya mengurangi sendiri - dan itulah pekerjaan yang sedang ia hindari
 * dengan membuka layar ini. Yang tidak berupa angka dibandingkan sebagai sama
 * atau berbeda, sebab "Majelis A" lawan "Majelis C1" tidak punya selisih.
 */

type Ringkas = {
  nomorPerkara: string;
  jenisPerkara: string;
  tanggalDaftar: string;
  tanggalPutusan: string;
  statusPutusan: string;
  sudahPutus: boolean;
  hariBerjalan: number | null;
  hariMinutasi: number | null;
  jumlahSidang: number;
  jumlahPenundaan: number;
  majelis: string;
  panitera: string;
  jumlahPihak: number;
  adaMediasi: boolean;
};

type StatusMentah = {
  identitas?: { nomorPerkara?: string; jenisPerkara?: string; tanggalDaftar?: string } | null;
  umur?: { hariBerjalan?: number | null; hariMinutasi?: number | null; sudahPutus?: boolean } | null;
  // Boleh null - perkara yang belum putus memulangkan putusan: null, bukan
  // obyek kosong. Tipe yang tidak mengakuinya menolak SELURUH muatan status.
  putusan?: { tanggalPutusan?: string; statusPutusan?: string; sudahPutus?: boolean } | null;
  majelis?: Array<{ kode?: string; nama?: string; jabatan?: string }> | null;
  panitera?: Array<{ nama?: string }> | null;
  jadwal?: Array<{ ditunda?: boolean }> | null;
  penundaan?: Array<unknown> | null;
  pihak?: Array<{ jenis?: string }> | null;
  mediasi?: {
    terbaca?: boolean;
    jadwal?: Array<unknown>;
    mediator?: Array<unknown>;
  } | null;
};

/** Menyusut muatan status yang besar menjadi yang sungguh dibandingkan. */
export function ringkasDariStatus(status: StatusMentah): Ringkas {
  const majelis = (status.majelis ?? [])
    .map((x) => String(x.kode || x.nama || "").trim())
    .filter(Boolean);
  return {
    nomorPerkara: String(status.identitas?.nomorPerkara || ""),
    jenisPerkara: String(status.identitas?.jenisPerkara || ""),
    tanggalDaftar: String(status.identitas?.tanggalDaftar || ""),
    tanggalPutusan: String(status.putusan?.tanggalPutusan || ""),
    statusPutusan: String(status.putusan?.statusPutusan || ""),
    sudahPutus: Boolean(status.putusan?.sudahPutus ?? status.umur?.sudahPutus),
    hariBerjalan:
      typeof status.umur?.hariBerjalan === "number" ? status.umur.hariBerjalan : null,
    hariMinutasi:
      typeof status.umur?.hariMinutasi === "number" ? status.umur.hariMinutasi : null,
    jumlahSidang: (status.jadwal ?? []).length,
    jumlahPenundaan: (status.penundaan ?? []).length,
    majelis: majelis.join(", "),
    panitera: (status.panitera ?? [])
      .map((x) => String(x.nama || "").trim())
      .filter(Boolean)
      .join(", "),
    // Saksi dan kuasa tidak dihitung sebagai pihak - yang dibandingkan
    // BANYAKNYA ORANG BERPERKARA, bukan banyaknya nama yang tercatat.
    jumlahPihak: (status.pihak ?? []).filter((x) => String(x.jenis || "") !== "kuasa").length,
    // Tidak ada kolom "ada mediasi" - yang ada jadwal dan mediatornya.
    // Salah satunya berisi sudah cukup menyatakan mediasinya berjalan.
    adaMediasi:
      (status.mediasi?.jadwal ?? []).length > 0 || (status.mediasi?.mediator ?? []).length > 0,
  };
}

const angka = (n: number) => n.toLocaleString("id-ID");

/** Satu baris perbandingan - label, dua nilai, dan selisihnya. */
type Baris = {
  label: string;
  kiri: string;
  kanan: string;
  /** Selisih yang sudah berbentuk kalimat, atau kosong bila tidak sebanding. */
  selisih: string;
  /** Benar bila keduanya sama - dipakai meredupkan baris yang tidak menarik. */
  sama: boolean;
};

function bandingAngka(label: string, a: number | null, b: number | null, satuan: string): Baris {
  const kiri = a === null ? "—" : `${angka(a)} ${satuan}`;
  const kanan = b === null ? "—" : `${angka(b)} ${satuan}`;
  if (a === null || b === null) {
    return { label, kiri, kanan, selisih: "", sama: false };
  }
  const beda = b - a;
  return {
    label,
    kiri,
    kanan,
    selisih:
      beda === 0
        ? "sama"
        : `${beda > 0 ? "+" : "−"}${angka(Math.abs(beda))} ${satuan}`,
    sama: beda === 0,
  };
}

function bandingTeks(label: string, a: string, b: string): Baris {
  const kiri = a || "—";
  const kanan = b || "—";
  const sama = Boolean(a) && a === b;
  return {
    label,
    kiri,
    kanan,
    selisih: !a || !b ? "" : sama ? "sama" : "berbeda",
    sama,
  };
}

export function BandingPerkara({ sekarang }: { sekarang: Ringkas }) {
  const [nomor, setNomor] = useState("");
  const [lawan, setLawan] = useState<Ringkas | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);

  const ambil = useCallback(async () => {
    const dicari = nomor.trim();
    if (!dicari) return;
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(
        apiPath(`/api/aleta-ecourt/status-perkara?nomor=${encodeURIComponent(dicari)}`),
        { cache: "no-store" }
      );
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca perkara pembanding."));
      const data = isi?.data ?? isi;
      if (!data?.available) {
        setGalat(String(data?.message || "ALETA Bot belum dapat dihubungi."));
        return;
      }
      if (!data.status) {
        setGalat(
          String(data.alasan) === "perkara_tidak_ditemukan"
            ? "Perkara pembanding tidak ditemukan di SIPP."
            : String(data.alasan || "Perkara pembanding tidak dapat dibaca.")
        );
        return;
      }
      const ringkas = ringkasDariStatus(data.status as StatusMentah);
      if (ringkas.nomorPerkara === sekarang.nomorPerkara) {
        setGalat("Itu perkara yang sedang dibuka — pilih perkara yang lain.");
        return;
      }
      setLawan(ringkas);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Perkara pembanding tidak dapat dibaca.");
    } finally {
      setMemuat(false);
    }
  }, [nomor, sekarang.nomorPerkara]);

  const baris = useMemo<Baris[]>(() => {
    if (!lawan) return [];
    return [
      bandingTeks("Jenis perkara", sekarang.jenisPerkara, lawan.jenisPerkara),
      bandingTeks("Tanggal daftar", sekarang.tanggalDaftar, lawan.tanggalDaftar),
      bandingTeks("Tanggal putusan", sekarang.tanggalPutusan, lawan.tanggalPutusan),
      bandingTeks("Status putusan", sekarang.statusPutusan, lawan.statusPutusan),
      bandingAngka("Lama proses", sekarang.hariBerjalan, lawan.hariBerjalan, "hari"),
      bandingAngka("Jeda minutasi", sekarang.hariMinutasi, lawan.hariMinutasi, "hari"),
      bandingAngka("Jumlah sidang", sekarang.jumlahSidang, lawan.jumlahSidang, "kali"),
      bandingAngka("Penundaan", sekarang.jumlahPenundaan, lawan.jumlahPenundaan, "kali"),
      bandingAngka("Pihak berperkara", sekarang.jumlahPihak, lawan.jumlahPihak, "orang"),
      bandingTeks("Majelis", sekarang.majelis, lawan.majelis),
      bandingTeks("Panitera sidang", sekarang.panitera, lawan.panitera),
      bandingTeks(
        "Mediasi",
        sekarang.adaMediasi ? "ada" : "tidak ada",
        lawan.adaMediasi ? "ada" : "tidak ada"
      ),
    ];
  }, [sekarang, lawan]);

  const berbeda = baris.filter((b) => !b.sama && b.selisih).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs text-muted-foreground">
          Nomor perkara pembanding
          <Input
            value={nomor}
            onChange={(e) => setNomor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void ambil();
              }
            }}
            placeholder="mis. 473/Pdt.G/2026/PA.Dgl"
          />
        </label>
        <Button type="button" onClick={() => void ambil()} disabled={memuat || !nomor.trim()}>
          <Plus className="mr-1.5 h-4 w-4" aria-hidden />
          {memuat ? "Membaca…" : "Bandingkan"}
        </Button>
        {lawan ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLawan(null);
              setNomor("");
              setGalat("");
            }}
          >
            <X className="mr-1.5 h-4 w-4" aria-hidden />
            Bersihkan
          </Button>
        ) : null}
      </div>

      {galat ? (
        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{galat}</span>
        </p>
      ) : null}

      {!lawan ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Isi nomor perkara lain untuk menjajarkannya dengan perkara ini. Yang dibandingkan
            jenisnya, tanggalnya, lama prosesnya, banyaknya sidang dan penundaan, majelis, panitera
            sidang, dan mediasinya — beserta selisihnya, supaya tidak perlu dikurangi sendiri.
          </span>
        </p>
      ) : (
        <>
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ArrowLeftRight className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {berbeda === 0
                ? "Kedua perkara sama pada seluruh butir yang dibandingkan."
                : `${berbeda} butir berbeda dari ${baris.length} yang dibandingkan.`}
            </span>
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Butir</th>
                  <th className="px-3 py-2 font-medium">{sekarang.nomorPerkara}</th>
                  <th className="px-3 py-2 font-medium">{lawan.nomorPerkara}</th>
                  <th className="px-3 py-2 text-right font-medium">Selisih</th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b) => (
                  <tr
                    key={b.label}
                    className={cn(
                      "border-b border-border/60 last:border-0",
                      // Yang SAMA diredupkan, bukan disembunyikan: menghilangkannya
                      // membuat pembaca menyangka butirnya tidak diperiksa.
                      b.sama && "text-muted-foreground"
                    )}
                  >
                    <td className="px-3 py-1.5">{b.label}</td>
                    <td className="px-3 py-1.5">{b.kiri}</td>
                    <td className="px-3 py-1.5">{b.kanan}</td>
                    <td
                      className={cn(
                        "px-3 py-1.5 text-right tabular-nums",
                        !b.sama && b.selisih && "font-medium text-foreground"
                      )}
                    >
                      {b.selisih || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Selisih dihitung dari perkara ini ke perkara pembanding: tanda tambah berarti
            pembandingnya lebih besar.
          </p>
        </>
      )}
    </div>
  );
}
