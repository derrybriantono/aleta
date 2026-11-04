"use client";

/**
 * ============================================================================
 * KASIR ALETA - TAMPILAN BARU (4 Nov 2026, rancangan Kasir ALETA)
 * ============================================================================
 *
 * Bagian tampilan yang dipakai jendela Kasir harian (kasir-otomatis.tsx): bilah tab, kartu angka penyaring,
 * lencana akun kasir, baris pembayar e-Court + Cetak SKUM, serta tab Sisa panjar dan Instrumen jurusita.
 *
 * Hanya MEMBACA dan MENCETAK lewat rute yang sudah ada (kasir/psp, kasir/instrumen, pembayaran-ecourt). Tidak
 * ada tulisan ke SIPP, tidak ada hitungan biaya, tidak ada izin baru: hak lihat rekening tetap milik rute dan
 * lib/pembayaran-ecourt (Super Admin, Admin, Ketua/Wakil, hakim, panitera, kasir, PTSP).
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { namaBerkasAman, penerimaPsp, teksRekeningPsp, type DaftarPsp, type KelompokInstrumen } from "@/lib/kasir-cetak";
import { rupiah } from "@/lib/kasir-jurnal";
import { bolehLihatRekening, keteranganRekeningBelumAda, tanggalIndonesia, type PembayaranTampil } from "@/lib/pembayaran-ecourt";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";
import { waktuPengadilan } from "@/lib/waktu-pengadilan";

export const ALAMAT_KASIR = "/api/aleta-ecourt/sidang/kasir";

export async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

export const kelasMedan =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** "2026-11-03" dikurangi n hari. */
export function mundurHari(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Unduh PDF dari rute Kasir/e-Court. Pulang "" bila terunduh, selain itu kalimat untuk petugas. */
export async function unduhPdf(alamat: string, nama: string): Promise<string> {
  try {
    const jawaban = await fetch(apiPath(alamat), { cache: "no-store" });
    if (!String(jawaban.headers.get("content-type") || "").includes("application/pdf")) {
      const luar = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
      const isi = ((luar && luar.data) as Record<string, unknown> | undefined) ?? luar;
      return String(isi.alasan || isi.pesan || pesanGalatPortal(luar, "") || "Berkas belum dapat disiapkan saat ini.");
    }
    const berkas = await jawaban.blob();
    const tautan = document.createElement("a");
    tautan.href = URL.createObjectURL(berkas);
    tautan.download = namaBerkasAman(nama);
    tautan.click();
    setTimeout(() => URL.revokeObjectURL(tautan.href), 5000);
    return "";
  } catch (e) {
    return e instanceof Error ? e.message : "Berkas belum dapat disiapkan saat ini.";
  }
}

// ─── Kepala dan tab ──────────────────────────────────────────────────────────

export function KepalaKasir({ children, onTutup, aksi }: { children?: ReactNode; onTutup: () => void; aksi?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-t-lg bg-primary px-4 py-3 text-primary-foreground">
      <div className="min-w-[10rem] flex-1">
        <div className="text-[0.7rem] font-semibold tracking-[0.08em] opacity-85">KASIR ALETA</div>
        <h3 className="text-lg font-extrabold leading-tight">Jurnal Keuangan Perkara</h3>
      </div>
      {children}
      {aksi}
      <button
        type="button"
        aria-label="Tutup"
        onClick={onTutup}
        className="grid h-9 w-9 place-items-center rounded-lg bg-primary-foreground/15 text-xl leading-none hover:bg-primary-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
      >
        ×
      </button>
    </div>
  );
}

export type ButirTab<T extends string> = { kunci: T; judul: string; lencana?: number };

export function BilahTab<T extends string>({ tab, daftar, onPilih }: { tab: T; daftar: Array<ButirTab<T>>; onPilih: (k: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-primary-foreground/15 p-1" role="tablist" aria-label="Bagian Kasir">
      {daftar.map((b) => (
        <button
          key={b.kunci}
          type="button"
          role="tab"
          aria-selected={tab === b.kunci}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground",
            tab === b.kunci ? "bg-primary-foreground font-bold text-primary" : "font-semibold text-primary-foreground hover:bg-primary-foreground/20"
          )}
          onClick={() => onPilih(b.kunci)}
        >
          {b.judul}
          {b.lencana ? <span className={cn("rounded-full px-1.5 text-xs font-bold", tab === b.kunci ? "bg-primary/15" : "bg-primary-foreground/25")}>{b.lencana}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ─── Kartu angka penyaring dan lencana akun ──────────────────────────────────

export function KartuRingkas({
  angka,
  judul,
  ket,
  aktif,
  warna,
  onPilih,
  nama,
}: {
  angka: number;
  judul: string;
  ket: string;
  aktif: boolean;
  warna: "biasa" | "awas" | "baik";
  onPilih: () => void;
  nama: string;
}) {
  return (
    <button
      type="button"
      data-saring={nama}
      aria-pressed={aktif}
      onClick={onPilih}
      className={cn(
        "flex flex-col items-start gap-0.5 rounded-xl border-2 bg-card px-3.5 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        aktif ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      )}
    >
      <span
        className={cn(
          "text-2xl font-extrabold leading-none tabular-nums",
          warna === "awas" && "text-amber-700 dark:text-amber-300",
          warna === "baik" && "text-emerald-700 dark:text-emerald-300"
        )}
      >
        {angka}
      </span>
      <span className="text-sm font-bold">{judul}</span>
      <span className="text-xs text-muted-foreground">{ket}</span>
    </button>
  );
}

/** Inisial dua huruf dari nama ("Tiara Rekaan, A.Md." -> "TR"). */
export function inisialNama(nama: string): string {
  const kata = String(nama || "")
    .replace(/,.*$/, "")
    .split(/\s+/)
    .filter((k) => /^\p{L}/u.test(k));
  return (kata.slice(0, 2).map((k) => k.charAt(0)).join("") || "?").toUpperCase();
}

export function LencanaAkun({ nama }: { nama: string }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs font-semibold text-muted-foreground">Dicatat atas akun kasir</span>
      <span className="inline-flex h-8 items-center gap-2 rounded-lg bg-muted px-2.5 text-sm font-bold" data-akun-kasir-nama={nama}>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[0.65rem] font-extrabold text-primary-foreground" aria-hidden="true">
          {inisialNama(nama)}
        </span>
        {nama}
      </span>
    </div>
  );
}

// ─── Pembayar e-Court dan Cetak SKUM ─────────────────────────────────────────

/**
 * Pembayaran e-Court banyak perkara SEKALI baca (rute pembayaran-ecourt, paling banyak 80 nomor). Peran tanpa
 * hak rekening tidak memanggil apa pun; 403 atau galat = tidak ada baris pembayar (Kasir tetap jalan).
 */
export function usePembayarMassal(nomor: string[]): Record<string, PembayaranTampil> {
  const { currentUser } = usePortal();
  const boleh = bolehLihatRekening(currentUser);
  const kunci = nomor.join("|");
  const [peta, setPeta] = useState<{ kunci: string; isi: Record<string, PembayaranTampil> }>({ kunci: "", isi: {} });
  useEffect(() => {
    if (!boleh || !kunci) return;
    let hidup = true;
    const daftar = kunci.split("|").slice(0, 80);
    void (async () => {
      try {
        const j = await fetch(apiPath(`/api/aleta-ecourt/pembayaran-ecourt?${daftar.map((n) => `nomor=${encodeURIComponent(n)}`).join("&")}`), { cache: "no-store" });
        if (!j.ok) return;
        const isi = ((await j.json().catch(() => ({}))) as { data?: { perkara?: unknown } })?.data?.perkara;
        if (hidup && isi && typeof isi === "object" && !Array.isArray(isi)) setPeta({ kunci, isi: isi as Record<string, PembayaranTampil> });
      } catch {
        /* tanpa baris pembayar */
      }
    })();
    return () => {
      hidup = false;
    };
  }, [kunci, boleh]);
  return peta.kunci === kunci ? peta.isi : {};
}

export function BarisPembayar({ data }: { data: PembayaranTampil }) {
  const rek = [data.bank, data.nomorRekening].filter(Boolean).join(" ");
  const rincian = [
    data.panjar !== null && data.panjar !== undefined ? `Panjar ${rupiah(data.panjar)}` : "",
    data.tanggal ? `dibayar ${tanggalIndonesia(data.tanggal)}${data.jam ? ` ${data.jam.slice(0, 5)}` : ""}` : "",
  ].filter(Boolean);
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-t border-dashed px-3.5 py-2 text-sm" data-kasir-pembayar>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pembayar e-Court</span>
      <b>{data.diterimaDari || "-"}</b>
      {rek ? (
        <span className="font-semibold tabular-nums" data-rekening>
          {rek}
        </span>
      ) : (
        <span className="text-muted-foreground">{keteranganRekeningBelumAda(data.cek)}</span>
      )}
      {data.atasNama ? <span className="break-all text-muted-foreground">a.n. {data.atasNama}</span> : null}
      {rincian.length ? <span className="text-muted-foreground">{rincian.join(" · ")}</span> : null}
    </div>
  );
}

export function TombolSkum({ nomor, adaSkum }: { nomor: string; adaSkum: boolean }) {
  const [kertas, setKertas] = useState<"A4" | "F4">("A4");
  const [sibuk, setSibuk] = useState(false);
  const [kabar, setKabar] = useState("");
  async function cetak() {
    setSibuk(true);
    setKabar("");
    const pesan = await unduhPdf(`/api/aleta-ecourt/pembayaran-ecourt/skum?nomor=${encodeURIComponent(nomor)}&kertas=${kertas}`, `e-SKUM ${nomor}.pdf`);
    setKabar(pesan);
    setSibuk(false);
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select aria-label="Ukuran kertas e-SKUM" className={kelasMedan} value={kertas} onChange={(e) => setKertas(e.target.value === "F4" ? "F4" : "A4")}>
        <option value="A4">A4</option>
        <option value="F4">F4</option>
      </select>
      <Button
        size="sm"
        disabled={sibuk}
        onClick={() => void cetak()}
        title={adaSkum ? "Unduh e-SKUM e-Court perkara ini sebagai PDF (kolom jumlah utuh)" : "e-SKUM belum terbaca dari e-Court - tombol akan menjelaskan langkahnya"}
      >
        Cetak SKUM e-Court
      </Button>
      {kabar ? <span className="basis-full text-xs text-amber-700 dark:text-amber-300">{kabar}</span> : null}
    </span>
  );
}

// ─── Rentang tanggal (Sisa panjar dan Instrumen jurusita) ────────────────────

export type RentangCetak = { dari: string; sampai: string };

export function rentangHariIni(): RentangCetak {
  const h = waktuPengadilan().tanggal;
  return { dari: h, sampai: h };
}

export function AlatRentang({ rentang, onUbah, onBaca, sibuk, children }: { rentang: RentangCetak; onUbah: (r: RentangCetak) => void; onBaca: (r: RentangCetak) => void; sibuk: boolean; children?: ReactNode }) {
  const pintas = (judul: string, r: RentangCetak) => (
    <Button
      key={judul}
      size="sm"
      variant="outline"
      className="h-8 rounded-full px-3 text-xs"
      disabled={sibuk}
      onClick={() => {
        onUbah(r);
        onBaca(r);
      }}
    >
      {judul}
    </Button>
  );
  const hari = waktuPengadilan().tanggal;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 p-3">
      <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
        Dari tanggal
        <input
          type="date"
          className={kelasMedan}
          value={rentang.dari}
          onChange={(e) => {
            const dari = e.target.value;
            onUbah({ dari, sampai: rentang.sampai && rentang.sampai >= dari ? rentang.sampai : dari });
          }}
        />
      </label>
      <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
        Sampai tanggal
        <input type="date" className={kelasMedan} value={rentang.sampai} min={rentang.dari} onChange={(e) => onUbah({ dari: rentang.dari, sampai: e.target.value || rentang.dari })} />
      </label>
      <Button size="sm" variant="outline" disabled={sibuk} onClick={() => onBaca(rentang)}>
        Baca
      </Button>
      <span className="flex flex-wrap items-center gap-1.5">
        {pintas("Hari ini", { dari: hari, sampai: hari })}
        {pintas("Kemarin", { dari: mundurHari(hari, 1), sampai: mundurHari(hari, 1) })}
        {pintas("7 hari", { dari: mundurHari(hari, 6), sampai: hari })}
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-2">{children}</span>
    </div>
  );
}

function teksPeriode(dari: string, sampai: string): string {
  return dari === sampai ? tanggalIndonesia(dari) : `${tanggalIndonesia(dari)} s.d. ${tanggalIndonesia(sampai)}`;
}

const PilihKertas = ({ nilai, onUbah, label }: { nilai: "A4" | "F4"; onUbah: (k: "A4" | "F4") => void; label: string }) => (
  <select aria-label={label} className={kelasMedan} value={nilai} onChange={(e) => onUbah(e.target.value === "F4" ? "F4" : "A4")}>
    <option value="A4">A4</option>
    <option value="F4">F4</option>
  </select>
);

// ─── Tab Sisa panjar ─────────────────────────────────────────────────────────

export function BagianSisaPanjar({ rentang, onUbah }: { rentang: RentangCetak; onUbah: (r: RentangCetak) => void }) {
  const [data, setData] = useState<(DaftarPsp & { available?: boolean }) | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [kertas, setKertas] = useState<"A4" | "F4">("A4");
  const [kabar, setKabar] = useState("");
  const [mencetak, setMencetak] = useState(false);

  const muat = useCallback(async (r: RentangCetak) => {
    setMemuat(true);
    setGalat("");
    setKabar("");
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT_KASIR}/psp?dari=${encodeURIComponent(r.dari)}&sampai=${encodeURIComponent(r.sampai)}`), { cache: "no-store" }));
      if (isi.ok === false || isi.available === false) {
        setGalat(String(isi.alasan || "Daftar pengembalian sisa panjar tidak terbaca."));
        setData(null);
      } else setData(isi as unknown as DaftarPsp);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Daftar pengembalian sisa panjar tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const awal = useRef({ muat, rentang });
  useEffect(() => {
    const jam = setTimeout(() => void awal.current.muat(awal.current.rentang), 0);
    return () => clearTimeout(jam);
  }, []);

  async function cetak() {
    if (!data) return;
    setMencetak(true);
    setKabar("");
    const nama = `Pengembalian sisa panjar ${data.dari}${data.dari !== data.sampai ? ` sd ${data.sampai}` : ""}.pdf`;
    setKabar(await unduhPdf(`${ALAMAT_KASIR}/psp?dari=${encodeURIComponent(data.dari)}&sampai=${encodeURIComponent(data.sampai)}&bentuk=pdf&kertas=${kertas}`, nama));
    setMencetak(false);
  }

  const sembunyi = Boolean(data?.rekeningDisembunyikan);
  return (
    <div className="grid gap-3" data-kasir-cetak="psp">
      <AlatRentang rentang={rentang} onUbah={onUbah} onBaca={(r) => void muat(r)} sibuk={memuat}>
        <PilihKertas nilai={kertas} onUbah={setKertas} label="Ukuran kertas daftar PSP" />
        <Button size="sm" variant="outline" className="border-primary font-bold text-primary" disabled={!data || !data.jumlah || mencetak} onClick={() => void cetak()}>
          Cetak daftar PSP
        </Button>
      </AlatRentang>
      {memuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
      {galat ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}
      {kabar ? <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{kabar}</p> : null}
      {data && !memuat ? (
        data.jumlah === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada pengembalian sisa panjar di jurnal SIPP pada {teksPeriode(data.dari, data.sampai)}.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {data.jumlah} perkara mengembalikan sisa panjar pada {teksPeriode(data.dari, data.sampai)} · sumber: jurnal keuangan SIPP
            </p>
            <div className="aleta-tabel-gulir rounded-lg border">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Perkara</th>
                    <th className="px-3 py-2">Tanggal</th>
                    <th className="px-3 py-2">Penerima</th>
                    {sembunyi ? null : <th className="px-3 py-2">Bank dan rekening</th>}
                    <th className="px-3 py-2 text-right">Sisa panjar</th>
                  </tr>
                </thead>
                <tbody>
                  {data.daftar.map((b) => (
                    <tr key={b.jurnalId} className="border-t" data-psp={b.nomorPerkara}>
                      <td className="whitespace-nowrap px-3 py-2 font-semibold tabular-nums">{b.nomorPerkara}</td>
                      <td className="whitespace-nowrap px-3 py-2">{tanggalIndonesia(b.tanggal)}</td>
                      <td className="px-3 py-2">
                        <b className="block">{penerimaPsp(b) || "-"}</b>
                        <span className="text-xs text-muted-foreground">{b.ecourt ? "pembayar e-Court" : "pendaftaran langsung (bukan e-Court)"}</span>
                      </td>
                      {sembunyi ? null : (
                        <td className="whitespace-nowrap px-3 py-2">
                          {b.rekening && b.rekening.nomorRekening ? (
                            <span className="font-semibold tabular-nums" data-rekening>
                              {teksRekeningPsp(b)}
                            </span>
                          ) : (
                            <span
                              className="italic text-amber-700 dark:text-amber-300"
                              title={
                                b.ecourt
                                  ? "Perkara e-Court: rekening pembayar dibaca otomatis dari e-Court. Bila belum muncul, tekan Tarik data di halaman perkara SIPP."
                                  : "Perkara bukan e-Court: minta nomor rekening penerima kepada pihak atau kuasa (atau serahkan tunai), lalu catat di daftar cetak."
                              }
                            >
                              {teksRekeningPsp(b)}
                            </span>
                          )}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-3 py-2 text-right font-bold tabular-nums">{rupiah(b.jumlah)}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-muted/40 font-extrabold">
                    <td className="px-3 py-2" colSpan={sembunyi ? 3 : 4}>
                      Total
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{rupiah(data.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              {sembunyi
                ? "Nomor rekening tidak ditampilkan untuk peran Anda."
                : "Nomor rekening tampil hanya untuk Super Admin, Admin, Ketua/Wakil, Hakim, Panitera, Kasir, dan PTSP. Daftar cetak memuat kolom paraf penerima atau bukti transfer."}
            </p>
          </>
        )
      ) : null}
    </div>
  );
}

// ─── Tab Instrumen jurusita ──────────────────────────────────────────────────

export function BagianInstrumen({ rentang, onUbah }: { rentang: RentangCetak; onUbah: (r: RentangCetak) => void }) {
  const [data, setData] = useState<{ dari: string; sampai: string; kelompok: KelompokInstrumen[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [kertas, setKertas] = useState<"A4" | "F4">("A4");
  const [kabar, setKabar] = useState("");
  const [mencetak, setMencetak] = useState(false);

  const muat = useCallback(async (r: RentangCetak) => {
    setMemuat(true);
    setGalat("");
    setKabar("");
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT_KASIR}/instrumen?dari=${encodeURIComponent(r.dari)}&sampai=${encodeURIComponent(r.sampai)}`), { cache: "no-store" }));
      if (isi.ok === false || isi.available === false) {
        setGalat(String(isi.alasan || "Instrumen jurusita tidak terbaca."));
        setData(null);
      } else setData({ dari: String(isi.dari || r.dari), sampai: String(isi.sampai || r.sampai), kelompok: Array.isArray(isi.kelompok) ? (isi.kelompok as KelompokInstrumen[]) : [] });
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Instrumen jurusita tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const awal = useRef({ muat, rentang });
  useEffect(() => {
    const jam = setTimeout(() => void awal.current.muat(awal.current.rentang), 0);
    return () => clearTimeout(jam);
  }, []);

  /** Satu PDF per jurusita (dicetak terpisah). */
  async function cetakSatu(k: KelompokInstrumen): Promise<string> {
    if (!data) return "";
    const nama = `Instrumen ${k.jurusita} ${data.dari}${data.dari !== data.sampai ? ` sd ${data.sampai}` : ""}.pdf`;
    return unduhPdf(`${ALAMAT_KASIR}/instrumen?dari=${encodeURIComponent(data.dari)}&sampai=${encodeURIComponent(data.sampai)}&kunci=${encodeURIComponent(k.kunci)}&bentuk=pdf&kertas=${kertas}`, nama);
  }
  async function cetak(daftar: KelompokInstrumen[]) {
    setMencetak(true);
    setKabar("");
    for (const k of daftar) {
      const pesan = await cetakSatu(k);
      if (pesan) {
        setKabar(`${k.jurusita}: ${pesan}`);
        break;
      }
    }
    setMencetak(false);
  }

  const kel = data?.kelompok ?? [];
  return (
    <div className="grid gap-3" data-kasir-cetak="instrumen">
      <AlatRentang rentang={rentang} onUbah={onUbah} onBaca={(r) => void muat(r)} sibuk={memuat}>
        <PilihKertas nilai={kertas} onUbah={setKertas} label="Ukuran kertas instrumen" />
        {kel.length > 1 ? (
          <Button size="sm" variant="outline" className="border-primary font-bold text-primary" disabled={mencetak} onClick={() => void cetak(kel)} title="Satu PDF untuk tiap jurusita">
            Cetak semua (terpisah)
          </Button>
        ) : null}
      </AlatRentang>
      {memuat ? <div className="min-h-[1.25rem]" aria-busy="true" /> : null}
      {galat ? <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}
      {kabar ? <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">{kabar}</p> : null}
      {data && !memuat ? (
        kel.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tidak ada biaya panggilan atau PBT di jurnal SIPP pada {teksPeriode(data.dari, data.sampai)}.</p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Instrumen panggilan dan PBT per jurusita ({kel.length}) · {teksPeriode(data.dari, data.sampai)} · satu berkas per jurusita, dicetak terpisah
            </p>
            <ul className="grid gap-2">
              {kel.map((k) => (
                <li key={k.kunci} className="rounded-xl border bg-card" data-jurusita={k.kunci}>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3.5 py-2.5">
                    <b className="text-base">{k.jurusita}</b>
                    <span className="text-sm text-muted-foreground">{[k.jumlahPanggilan ? `${k.jumlahPanggilan} panggilan` : "", k.jumlahPbt ? `${k.jumlahPbt} PBT` : ""].filter(Boolean).join(" · ")}</span>
                    <b className="tabular-nums">{rupiah(k.total)}</b>
                    <Button size="sm" variant="outline" className="ml-auto font-bold" disabled={mencetak} onClick={() => void cetak([k])} title={`Instrumen ${k.jurusita} (PDF tersendiri)`}>
                      Cetak
                    </Button>
                  </div>
                  <details className="border-t px-3.5 py-1.5">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">Lihat {k.baris.length} relaas</summary>
                    <div className="aleta-tabel-gulir">
                      <table className="mt-1 w-full text-xs">
                        <tbody>
                          {k.baris.map((b) => (
                            <tr key={b.jurnalId} className="border-t">
                              <td className="whitespace-nowrap py-1 pr-2 font-semibold tabular-nums">{b.nomorPerkara}</td>
                              <td className="py-1 pr-2">
                                <b>{b.pihak || "-"}</b>
                                {b.alamat ? <span className="block text-muted-foreground">{b.alamat}</span> : null}
                              </td>
                              <td className="py-1 pr-2">{b.jenis}</td>
                              <td className="whitespace-nowrap py-1 text-right tabular-nums">{rupiah(b.jumlah)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}
    </div>
  );
}
