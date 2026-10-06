"use client";

/**
 * ============================================================================
 * COURT CALENDAR DI KOLOM AGENDA JADWAL SIDANG (6 Okt 2026, butir 3)
 * ============================================================================
 *
 * Permintaan pengguna: "tambahkan di perkara yang bisa buat court calender
 * disini dan terinput di sipp, untuk agenda dan tanggal itu berdasarkan
 * rekomendasi aleta yang sudah dibuat, tapi bisa manual juga buatnya agenda
 * dan tanggalnya, terus bisa edit court calender yang lama, taruh dibawah
 * agenda (paling bawah)".
 *
 *   tautan kecil   "Court Calendar (n)" di dasar sel Agenda - n dibaca SEKALI
 *                  untuk seluruh baris yang tampil (useJumlahCourtCalendar),
 *                  tidak melebarkan kolom.
 *   dialog         1. Court Calendar SIPP yang sudah ada, tiap baris dapat
 *                     DISUNTING (validateEdit SIPP).
 *                  2. Rekomendasi ALETA - ccSusun, aturan butir 29 yang SAMA
 *                     dengan panel SIPP (@/lib/court-calendar-susun); agenda,
 *                     tanggal, jam, keterangan dapat diubah; baris manual dapat
 *                     ditambah (validateInput SIPP).
 *                  3. Pratinjau (kering, bawaan) lalu "Simpan ke SIPP" dengan
 *                     dua tekanan. Tulisannya lewat bot atas akun SIPP milik
 *                     pengguna yang login; hasil per baris hanya "tersimpan"
 *                     bila terbaca ulang dari SIPP.
 *
 * Tampil hanya bagi golongan panitera/admin (bolehIsiCourtCalendar); rute
 * memeriksa ulang kemampuan "data-umum".
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarClock, Pencil, Plus, RotateCcw, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/app-state";
import { apiPath } from "@/lib/base-path";
import { bolehIsiCourtCalendar } from "@/lib/court-calendar-hak";
import {
  ccBarisTambahan,
  ccBukanHariKerja,
  ccIsoSah,
  ccMasukan,
  ccPeriksaBaris,
  ccSusun,
  ccTeksTanggal,
  type BarisKalenderAda,
  type BarisSusunanCc,
  type StatusPerkaraCc,
} from "@/lib/court-calendar-susun";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { cn } from "@/lib/utils";

const ALAMAT = "/api/aleta-ecourt/sidang/court-calendar";

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

function hariIniLokal() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

// ─── Jumlah baris: satu panggilan untuk seluruh baris yang tampil ────────────

const simpananJumlah = new Map<string, number | null>();
const antreJumlah = new Set<string>();
const pendengarJumlah = new Set<() => void>();
let penundaJumlah: ReturnType<typeof setTimeout> | null = null;

function kabariJumlah() {
  for (const f of pendengarJumlah) f();
}

async function muatJumlah() {
  penundaJumlah = null;
  const id = [...antreJumlah].slice(0, 500);
  for (const x of id) antreJumlah.delete(x);
  if (!id.length) return;
  try {
    const isi = await bacaJson(await fetch(apiPath(`${ALAMAT}?jumlah=${id.join(",")}`), { cache: "no-store" }));
    const jumlah = (isi.jumlah && typeof isi.jumlah === "object" ? isi.jumlah : {}) as Record<string, number>;
    for (const x of id) simpananJumlah.set(x, typeof jumlah[x] === "number" ? jumlah[x] : null);
  } catch {
    for (const x of id) simpananJumlah.set(x, null);
  }
  if (antreJumlah.size && !penundaJumlah) penundaJumlah = setTimeout(muatJumlah, 0);
  kabariJumlah();
}

function setelJumlah(perkaraId: string, n: number) {
  simpananJumlah.set(perkaraId, n);
  kabariJumlah();
}

/** Jumlah baris Court Calendar SIPP perkara ini; undefined = sedang dibaca, null = tidak terbaca. */
export function useJumlahCourtCalendar(perkaraId: string, aktif: boolean): number | null | undefined {
  const [, setDetak] = useState(0);
  useEffect(() => {
    if (!aktif || !/^\d+$/.test(perkaraId)) return undefined;
    const dengar = () => setDetak((x) => x + 1);
    pendengarJumlah.add(dengar);
    if (!simpananJumlah.has(perkaraId)) {
      antreJumlah.add(perkaraId);
      if (!penundaJumlah) penundaJumlah = setTimeout(muatJumlah, 60);
    }
    return () => {
      pendengarJumlah.delete(dengar);
    };
  }, [perkaraId, aktif]);
  return simpananJumlah.get(perkaraId);
}

// ─── Bentuk data ─────────────────────────────────────────────────────────────

type BarisSipp = BarisKalenderAda & {
  id: number;
  diinputOleh: string;
  diinputTanggal: string;
  diperbaharuiOleh: string;
  diperbaharuiTanggal: string;
};

type IsianBaris = { tanggal: string; jam: string; agenda: string; keterangan: string };

type Keadaan = "" | "tersimpan" | "belum-terbaca" | "sudah-ada" | "ditolak" | "gagal" | "tidak-berubah" | "akan-dikirim";

type BarisRencana = BarisSusunanCc & { kunci: string; keadaan: Keadaan; pesan: string };

type DataDialog = {
  perkara: { perkaraId: number; nomorPerkara: string; tanggalDaftar: string; jenisPerkara: string };
  baris: BarisSipp[];
  status: StatusPerkaraCc | null;
  statusAlasan: string;
  akun: { ok: boolean; username?: string; milik: string[]; pesan?: string; alasan?: string };
};

type HasilBaris = { jenis: "tambah" | "ubah"; ke: number; id?: number; keadaan: string; pesan: string };

const SEBUT_KEADAAN: Record<string, string> = {
  tersimpan: "tersimpan di SIPP",
  "belum-terbaca": "belum terbaca ulang",
  "sudah-ada": "sudah ada",
  ditolak: "ditolak",
  gagal: "gagal",
  "tidak-berubah": "tidak berubah",
  "akan-dikirim": "akan dikirim",
};

const WARNA_KEADAAN: Record<string, string> = {
  tersimpan: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "akan-dikirim": "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  "sudah-ada": "border-border bg-muted text-muted-foreground",
  "tidak-berubah": "border-border bg-muted text-muted-foreground",
  "belum-terbaca": "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  ditolak: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  gagal: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

function LencanaKeadaan({ keadaan }: { keadaan: string }) {
  if (!keadaan) return null;
  return (
    <span className={cn("rounded border px-1 py-0.5 text-[11px] leading-none", WARNA_KEADAAN[keadaan] ?? "border-border")}>
      {SEBUT_KEADAAN[keadaan] ?? keadaan}
    </span>
  );
}

const kelasMedan =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

/** Isian satu baris: tanggal, jam, agenda, keterangan - medan blangko Tambah Court Calender SIPP. */
function IsianCourtCalendar({
  nilai,
  ubah,
  kunci,
}: {
  nilai: IsianBaris;
  ubah: (n: Partial<IsianBaris>) => void;
  kunci?: boolean;
}) {
  const sebab = ccIsoSah(nilai.tanggal) ? ccBukanHariKerja(nilai.tanggal) : "";
  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          type="date"
          aria-label="Tanggal rencana sidang"
          className={cn(kelasMedan, sebab && "border-amber-500")}
          value={nilai.tanggal}
          disabled={kunci}
          onChange={(e) => ubah({ tanggal: e.target.value })}
        />
        <input
          type="time"
          aria-label="Jam"
          className={kelasMedan}
          value={nilai.jam}
          disabled={kunci}
          onChange={(e) => ubah({ jam: e.target.value })}
        />
        {ccIsoSah(nilai.tanggal) ? (
          <span className={cn("text-xs", sebab ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
            {ccTeksTanggal(nilai.tanggal)}
            {sebab ? ` - ${sebab}` : ""}
          </span>
        ) : null}
      </div>
      <textarea
        aria-label="Jadwal/Agenda Sidang"
        rows={2}
        className="min-h-[2.5rem] rounded-md border border-input bg-background px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
        placeholder="Jadwal/Agenda Sidang"
        value={nilai.agenda}
        disabled={kunci}
        onChange={(e) => ubah({ agenda: e.target.value })}
      />
      <input
        type="text"
        aria-label="Keterangan"
        className={kelasMedan}
        placeholder="Keterangan (boleh kosong)"
        value={nilai.keterangan}
        disabled={kunci}
        onChange={(e) => ubah({ keterangan: e.target.value })}
      />
    </div>
  );
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

function DialogCourtCalendar({
  perkaraId,
  nomorPerkara,
  jenisPerkara,
  onTutup,
}: {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara: string;
  onTutup: () => void;
}) {
  const [data, setData] = useState<DataDialog | null>(null);
  const [galat, setGalat] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [rencana, setRencana] = useState<BarisRencana[]>([]);
  const [penjelasan, setPenjelasan] = useState("");
  const [catatan, setCatatan] = useState<string[]>([]);
  const [suntingan, setSuntingan] = useState<Record<number, IsianBaris>>({});
  const [hasilSunting, setHasilSunting] = useState<Record<number, { keadaan: Keadaan; pesan: string }>>({});
  const [akunPilihan, setAkunPilihan] = useState("");
  const [sedang, setSedang] = useState(false);
  const [kabar, setKabar] = useState<{ teks: string; gagal: boolean } | null>(null);
  const [pratinjau, setPratinjau] = useState<Array<{ keterangan: string; sql: string; nilai: unknown[] }> | null>(null);
  const [yakin, setYakin] = useState(false);
  const penundaYakin = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hariIni = useMemo(hariIniLokal, []);
  const kunciUrut = useRef(0);

  useEffect(() => {
    const tekan = (e: KeyboardEvent) => {
      if (e.key === "Escape") onTutup();
    };
    window.addEventListener("keydown", tekan);
    return () => window.removeEventListener("keydown", tekan);
  }, [onTutup]);

  useEffect(
    () => () => {
      if (penundaYakin.current) clearTimeout(penundaYakin.current);
    },
    []
  );

  const susun = useCallback(
    (d: DataDialog) => {
      const kalender = d.baris.map((b) => ({ tanggal: b.tanggal, jam: b.jam, agenda: b.agenda, keterangan: b.keterangan }));
      const masukan = ccMasukan(
        d.status,
        { nomorPerkara: d.perkara.nomorPerkara || nomorPerkara, identitas: d.status?.identitasPihak ? null : { jenisPerkara: d.perkara.jenisPerkara || jenisPerkara } },
        kalender,
        hariIni
      );
      if (!masukan.tanggalDaftar && d.perkara.tanggalDaftar) masukan.tanggalDaftar = d.perkara.tanggalDaftar;
      const hasil = ccSusun(masukan);
      setRencana(
        hasil.baris.map((b) => {
          kunciUrut.current += 1;
          return { ...b, kunci: `r${kunciUrut.current}`, keadaan: "", pesan: "" };
        })
      );
      setPenjelasan(hasil.penjelasan);
      setCatatan(d.statusAlasan ? [d.statusAlasan, ...hasil.catatan] : hasil.catatan);
    },
    [hariIni, jenisPerkara, nomorPerkara]
  );

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const isi = await bacaJson(await fetch(apiPath(`${ALAMAT}?perkaraId=${encodeURIComponent(perkaraId)}`), { cache: "no-store" }));
      if (isi.available === false || isi.ok === false) {
        setGalat(String(isi.alasan || "Court Calendar SIPP tidak terbaca."));
        setData(null);
        return;
      }
      const d = isi as unknown as DataDialog;
      setData(d);
      setSuntingan({});
      setHasilSunting({});
      setPratinjau(null);
      if (d.akun?.ok && d.akun.username) setAkunPilihan(d.akun.username);
      else if (d.akun?.milik?.length) setAkunPilihan((x) => x || d.akun.milik[0]);
      setelJumlah(perkaraId, d.baris.length);
      susun(d);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Court Calendar SIPP tidak terbaca.");
    } finally {
      setMemuat(false);
    }
  }, [perkaraId, susun]);

  useEffect(() => {
    void muat();
  }, [muat]);

  const lepasYakin = () => {
    if (penundaYakin.current) clearTimeout(penundaYakin.current);
    penundaYakin.current = null;
    setYakin(false);
  };

  const ubahRencana = (kunci: string, n: Partial<BarisRencana>) => {
    lepasYakin();
    setPratinjau(null);
    setRencana((daftar) => daftar.map((b) => (b.kunci === kunci ? { ...b, ...n, keadaan: n.keadaan ?? (b.keadaan === "tersimpan" ? b.keadaan : ""), pesan: n.pesan ?? "" } : b)));
  };

  const tambahManual = () => {
    lepasYakin();
    setPratinjau(null);
    setRencana((daftar) => {
      const terakhir = daftar.length ? daftar[daftar.length - 1].tanggal : data?.baris.length ? data.baris[data.baris.length - 1].tanggal : "";
      kunciUrut.current += 1;
      return [...daftar, { ...ccBarisTambahan(terakhir, hariIni), kunci: `r${kunciUrut.current}`, keadaan: "", pesan: "" }];
    });
  };

  const terpilih = rencana.filter((b) => b.pilih && b.keadaan !== "tersimpan");
  const daftarUbah = Object.entries(suntingan).map(([id, s]) => ({ id: Number(id), ...s }));
  const jumlahKirim = terpilih.length + daftarUbah.length;
  const tanggalDaftar = data?.perkara.tanggalDaftar || "";
  const salahIsian = [
    ...terpilih.map((b) => ccPeriksaBaris(b, tanggalDaftar)),
    ...daftarUbah.map((b) => ccPeriksaBaris(b, tanggalDaftar)),
  ].filter(Boolean).length;
  const akunSiap = Boolean(data?.akun && (data.akun.ok || (data.akun.alasan === "akun_sipp_ganda" && akunPilihan)));

  async function kirim(kering: boolean) {
    if (!data || sedang || !jumlahKirim) return;
    setSedang(true);
    setKabar({ teks: kering ? "Menyusun pratinjau…" : `Menyimpan ${jumlahKirim} baris ke SIPP…`, gagal: false });
    const tambahKunci = terpilih.map((b) => b.kunci);
    const ubahId = daftarUbah.map((b) => b.id);
    try {
      const isi = await bacaJson(
        await fetch(apiPath(ALAMAT), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            perkaraId,
            akunSipp: data.akun.ok ? data.akun.username : akunPilihan,
            tambah: terpilih.map((b) => ({ tanggal: b.tanggal, jam: b.jam, agenda: b.agenda, keterangan: b.keterangan })),
            ubah: daftarUbah,
            kering,
          }),
        })
      );
      if (isi.available === false || (isi.ok === false && !Array.isArray(isi.hasil) && !Array.isArray(isi.rencana))) {
        setKabar({ teks: String(isi.pesan || isi.alasan || "Tidak ada yang dikirim ke SIPP."), gagal: true });
        return;
      }
      const ditolak = (Array.isArray(isi.ditolak) ? isi.ditolak : []) as HasilBaris[];
      const dilewati = (Array.isArray(isi.dilewati) ? isi.dilewati : []) as HasilBaris[];
      const hasil = (Array.isArray(isi.hasil) ? isi.hasil : []) as HasilBaris[];
      const tandai = (h: HasilBaris, keadaan: Keadaan) => {
        if (h.jenis === "tambah") {
          const kunci = tambahKunci[h.ke];
          setRencana((daftar) =>
            daftar.map((b) =>
              b.kunci === kunci ? { ...b, keadaan, pesan: h.pesan, pilih: keadaan === "tersimpan" || keadaan === "sudah-ada" ? false : b.pilih } : b
            )
          );
        } else {
          const id = ubahId[h.ke] ?? h.id ?? 0;
          setHasilSunting((x) => ({ ...x, [id]: { keadaan, pesan: h.pesan } }));
        }
      };
      for (const h of ditolak) tandai(h, "ditolak");
      for (const h of dilewati) tandai(h, h.jenis === "ubah" ? "tidak-berubah" : "sudah-ada");

      if (kering) {
        const rincian = (Array.isArray(isi.rencana) ? isi.rencana : []) as Array<{ keterangan: string; sql: string; nilai: unknown[]; jenis: "tambah" | "ubah"; ke: number }>;
        for (const r of rincian) tandai({ jenis: r.jenis, ke: r.ke, keadaan: "akan-dikirim", pesan: "" }, "akan-dikirim");
        setPratinjau(rincian);
        setKabar({
          teks: rincian.length
            ? `Pratinjau: ${rincian.length} pernyataan akan ditulis ke perkara_court_calendar atas akun SIPP ${String((isi.akunSipp as { username?: string })?.username || "")}. Belum ada yang disimpan.`
            : "Pratinjau: tidak ada baris yang perlu ditulis.",
          gagal: false,
        });
        return;
      }

      for (const h of hasil) tandai(h, (h.keadaan as Keadaan) || "gagal");
      const sesudah = Array.isArray(isi.daftarSesudah) ? (isi.daftarSesudah as BarisSipp[]) : null;
      if (sesudah) {
        setData((d) => (d ? { ...d, baris: sesudah } : d));
        setelJumlah(perkaraId, sesudah.length);
        const tersimpanUbah = new Set(hasil.filter((h) => h.jenis === "ubah" && h.keadaan === "tersimpan").map((h) => ubahId[h.ke]));
        setSuntingan((x) => Object.fromEntries(Object.entries(x).filter(([id]) => !tersimpanUbah.has(Number(id)))));
      }
      setPratinjau(null);
      const r = (isi.ringkas ?? {}) as { tersimpan?: number; belumTerbaca?: number; sudahAda?: number; gagal?: number };
      const bagian = [
        r.tersimpan ? `${r.tersimpan} baris tersimpan dan terbaca ulang di SIPP` : "",
        r.belumTerbaca ? `${r.belumTerbaca} belum terbaca ulang` : "",
        r.sudahAda ? `${r.sudahAda} sudah ada` : "",
        ditolak.length ? `${ditolak.length} ditolak` : "",
        r.gagal ? `${r.gagal} gagal` : "",
      ].filter(Boolean);
      setKabar({ teks: `${bagian.join("; ") || String(isi.alasan || "Tidak ada yang tersimpan")}.`, gagal: isi.ok !== true });
    } catch (e) {
      setKabar({ teks: e instanceof Error ? e.message : "Gagal menghubungi ALETA.", gagal: true });
    } finally {
      setSedang(false);
    }
  }

  const tekanSimpan = () => {
    if (!yakin) {
      // Dua tekanan, seperti panel SIPP: yang pertama hanya menyebut akibatnya.
      setYakin(true);
      penundaYakin.current = setTimeout(() => setYakin(false), 8000);
      return;
    }
    lepasYakin();
    void kirim(false);
  };

  // 6 Okt 2026: dirender lewat PORTAL ke document.body. Di dalam tabel Jadwal
  // Sidang ada induk ber-transform/backdrop, sehingga "fixed" ikut induk itu
  // dan dialognya muncul di puncak halaman - harus digulir ke atas dulu.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Court Calendar ${nomorPerkara}`}
      onClick={onTutup}
    >
      <div
        className="my-4 w-full max-w-3xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Court Calendar</h3>
            <p className="text-sm text-muted-foreground">
              {nomorPerkara}
              {data?.perkara.jenisPerkara ? ` · ${data.perkara.jenisPerkara}` : ""}
              {data?.perkara.tanggalDaftar ? ` · didaftar ${ccTeksTanggal(data.perkara.tanggalDaftar)}` : ""}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {memuat ? <p className="text-sm text-muted-foreground">Membaca Court Calendar SIPP perkara ini…</p> : null}
        {galat ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p>
        ) : null}

        {data ? (
          <div className="grid gap-4">
            {/* Akun yang tercatat di SIPP */}
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
              {data.akun.ok ? (
                <span>
                  Tersimpan di SIPP atas akun SIPP Anda: <b>{data.akun.username}</b> (diinput_oleh / diperbaharui_oleh).
                </span>
              ) : data.akun.alasan === "akun_sipp_ganda" ? (
                <label className="flex flex-wrap items-center gap-2">
                  <span>Akun SIPP yang dipakai:</span>
                  <select className={kelasMedan} value={akunPilihan} onChange={(e) => setAkunPilihan(e.target.value)}>
                    {data.akun.milik.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <span className="text-amber-700 dark:text-amber-300">{data.akun.pesan || "Akun SIPP Anda belum tertaut - Court Calendar dapat dilihat, tetapi tidak dapat disimpan."}</span>
              )}
            </div>

            {/* 1. Yang sudah ada di SIPP */}
            <section>
              <h4 className="mb-1.5 text-sm font-semibold">Sudah di Court Calendar SIPP ({data.baris.length})</h4>
              {data.baris.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada rencana sidang di SIPP untuk perkara ini.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {data.baris.map((b) => {
                    const s = suntingan[b.id];
                    const h = hasilSunting[b.id];
                    return (
                      <li key={b.id} className="rounded-md border px-2 py-1.5 text-sm">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="font-medium">
                            {ccTeksTanggal(b.tanggal)}
                            {b.jam ? ` ${b.jam}` : ""}
                          </span>
                          <span className="min-w-0 flex-1 break-words">{b.agenda || "-"}</span>
                          {b.keterangan ? <span className="text-muted-foreground">({b.keterangan})</span> : null}
                          {h ? <LencanaKeadaan keadaan={h.keadaan} /> : null}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs"
                            disabled={sedang}
                            onClick={() => {
                              lepasYakin();
                              setPratinjau(null);
                              setSuntingan((x) => {
                                if (x[b.id]) {
                                  const { [b.id]: _buang, ...sisa } = x;
                                  void _buang;
                                  return sisa;
                                }
                                return { ...x, [b.id]: { tanggal: b.tanggal, jam: b.jam || "09:00", agenda: b.agenda, keterangan: b.keterangan } };
                              });
                            }}
                          >
                            <Pencil className="mr-1 h-3 w-3" />
                            {s ? "Batal sunting" : "Sunting"}
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          diinput {b.diinputOleh || "-"}
                          {b.diperbaharuiOleh ? ` · diperbarui ${b.diperbaharuiOleh}` : ""}
                        </div>
                        {s ? (
                          <div className="mt-1.5">
                            <IsianCourtCalendar
                              nilai={s}
                              kunci={sedang}
                              ubah={(n) => {
                                lepasYakin();
                                setPratinjau(null);
                                setHasilSunting((x) => {
                                  const { [b.id]: _lama, ...sisa } = x;
                                  void _lama;
                                  return sisa;
                                });
                                setSuntingan((x) => ({ ...x, [b.id]: { ...x[b.id], ...n } }));
                              }}
                            />
                            {ccPeriksaBaris(s, tanggalDaftar) ? (
                              <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{ccPeriksaBaris(s, tanggalDaftar)}</p>
                            ) : null}
                          </div>
                        ) : null}
                        {h?.pesan ? <p className="mt-0.5 text-xs text-muted-foreground">{h.pesan}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 2. Rekomendasi ALETA + baris manual */}
            <section>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold">Rekomendasi ALETA</h4>
                <div className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={sedang} onClick={() => data && susun(data)}>
                    <RotateCcw className="mr-1 h-3 w-3" />
                    Susun ulang
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={sedang} onClick={tambahManual}>
                    <Plus className="mr-1 h-3 w-3" />
                    Tambah baris manual
                  </Button>
                </div>
              </div>
              {penjelasan ? <p className="mb-1 text-sm text-muted-foreground">{penjelasan}</p> : null}
              {catatan.map((c) => (
                <p key={c} className="mb-1 text-xs text-amber-700 dark:text-amber-300">
                  {c}
                </p>
              ))}
              {rencana.length === 0 ? (
                <p className="text-sm text-muted-foreground">Tidak ada baris untuk diinput. Tekan Tambah baris manual bila perlu.</p>
              ) : (
                <ul className="grid gap-1.5">
                  {rencana.map((b, i) => {
                    const salah = b.pilih && b.keadaan !== "tersimpan" ? ccPeriksaBaris(b, tanggalDaftar) : "";
                    const kunci = sedang || b.keadaan === "tersimpan";
                    return (
                      <li key={b.kunci} className={cn("rounded-md border px-2 py-1.5", !b.pilih && "opacity-70")}>
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                          <label className="inline-flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={b.pilih}
                              disabled={kunci}
                              onChange={(e) => ubahRencana(b.kunci, { pilih: e.target.checked })}
                            />
                            <span className="font-medium">{i + 1}</span>
                          </label>
                          <span className="rounded border px-1 text-muted-foreground">{b.catatan === "baris tambahan" ? "manual" : b.asal}</span>
                          <LencanaKeadaan keadaan={b.keadaan} />
                          {b.catatan && b.catatan !== "baris tambahan" ? <span className="text-muted-foreground">{b.catatan}</span> : null}
                          <button
                            type="button"
                            className="ml-auto text-muted-foreground hover:text-foreground disabled:opacity-50"
                            disabled={kunci}
                            title="Hapus baris ini dari susunan (tidak menyentuh SIPP)"
                            onClick={() => {
                              lepasYakin();
                              setPratinjau(null);
                              setRencana((daftar) => daftar.filter((x) => x.kunci !== b.kunci));
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <IsianCourtCalendar nilai={b} kunci={kunci} ubah={(n) => ubahRencana(b.kunci, n)} />
                        {salah ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-300">{salah}</p> : null}
                        {b.pesan ? <p className="mt-0.5 text-xs text-muted-foreground">{b.pesan}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* 3. Pratinjau dan simpan */}
            {pratinjau && pratinjau.length ? (
              <details className="rounded-md border bg-muted/40 px-3 py-2 text-xs" open>
                <summary className="cursor-pointer text-sm font-medium">Pratinjau pernyataan ke SIPP ({pratinjau.length})</summary>
                <p className="mt-1 text-muted-foreground">
                  Hanya tabel perkara_court_calendar. Tanpa baris Audit Trail - blangko Court Calendar SIPP sendiri tidak mencatatnya. Jam
                  diinput/diperbarui diambil basis data saat menyimpan, dalam bentuk jam SIPP.
                </p>
                <ol className="mt-1 grid list-decimal gap-1 pl-5">
                  {pratinjau.map((p, i) => (
                    <li key={i}>
                      <div>{p.keterangan}</div>
                      <code className="block whitespace-pre-wrap break-all text-muted-foreground">{p.sql}</code>
                      <code className="block whitespace-pre-wrap break-all">{JSON.stringify(p.nilai)}</code>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            {kabar ? (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  kabar.gagal ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-muted/40"
                )}
              >
                {kabar.teks}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-3">
              <span className="mr-auto text-xs text-muted-foreground">
                {jumlahKirim
                  ? `${terpilih.length} baris baru, ${daftarUbah.length} suntingan`
                  : "Centang rekomendasi, tambah baris manual, atau sunting baris lama."}
              </span>
              <Button size="sm" variant="outline" disabled={sedang || !jumlahKirim || !akunSiap} onClick={() => void kirim(true)}>
                Pratinjau (uji coba)
              </Button>
              <Button
                size="sm"
                variant={yakin ? "destructive" : "default"}
                disabled={sedang || !jumlahKirim || !akunSiap || salahIsian > 0}
                onClick={tekanSimpan}
                title={salahIsian ? "Perbaiki baris yang ditandai merah lebih dulu" : undefined}
              >
                {yakin ? `Tekan sekali lagi: simpan ${jumlahKirim} baris ke SIPP` : `Simpan ke SIPP${jumlahKirim ? ` (${jumlahKirim})` : ""}`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

// ─── Tautan di sel Agenda ────────────────────────────────────────────────────

export function CourtCalendarSidang({
  perkaraId,
  nomorPerkara,
  jenisPerkara = "",
}: {
  perkaraId: string;
  nomorPerkara: string;
  jenisPerkara?: string;
}) {
  const { currentUser } = usePortal();
  const boleh = bolehIsiCourtCalendar(currentUser);
  const jumlah = useJumlahCourtCalendar(String(perkaraId), boleh);
  const [buka, setBuka] = useState(false);
  const tutup = useCallback(() => setBuka(false), []);
  if (!boleh || !/^\d+$/.test(String(perkaraId))) return null;
  return (
    <div className="mt-1">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        title="Lihat, susun dari rekomendasi ALETA, tambah manual, atau sunting Court Calendar SIPP perkara ini"
        onClick={() => setBuka(true)}
      >
        <CalendarClock className="h-3 w-3" />
        Court Calendar
        <span className="text-muted-foreground">{jumlah === undefined ? "" : jumlah === null ? "(?)" : `(${jumlah})`}</span>
      </button>
      {buka ? (
        <DialogCourtCalendar perkaraId={String(perkaraId)} nomorPerkara={nomorPerkara} jenisPerkara={jenisPerkara} onTutup={tutup} />
      ) : null}
    </div>
  );
}
