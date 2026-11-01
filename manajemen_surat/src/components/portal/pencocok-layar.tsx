"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { tanggalPendek, type RingkasanPencocok, type SisiTemuan, type Tingkat } from "@/lib/pencocok-data";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * ============================================================================
 * PENCOCOK DATA (N3, 1 Nov 2026)
 * ============================================================================
 *
 * Satu tempat untuk perkara yang datanya BERBEDA antara SIPP, ABT, dan e-Court. Layar ini hanya menandai: tidak ada
 * tombol yang menulis ke SIPP/ABT/e-Court - perbaikan lewat tombol yang sudah ada (mis. Betulkan kehadiran di panel
 * cetak Blangko Derry). Hasil pemeriksaan malam; hakim dan panitera pengganti hanya melihat perkara yang namanya tercantum.
 *
 * Kinerja: data kecil dimuat sekali, disaring di peramban (tanpa permintaan ulang saat mengetik), daftar dipotong 80
 * baris per tampilan, rincian dibuka malas (elemen details).
 */

type Baris = {
  perkaraId: string;
  nomorPerkara: string;
  jenis: string;
  tingkat: Tingkat;
  ringkas: string;
  sisi: SisiTemuan[];
  judul: string;
  saran: string;
  sumber: string;
  diperiksaPada: string;
  pertamaTerlihat: string;
};

type Data = {
  tersedia: boolean;
  lihatSemua: boolean;
  bolehKelola: boolean;
  sedangBerjalan: boolean;
  ringkasan: RingkasanPencocok;
  baris: Baris[];
  jenis: Array<{ kode: string; kelompok: string; judul: string; tingkat: Tingkat; sumber: string }>;
  kelompok: Record<string, string>;
  catatan: {
    tanggal: string;
    pada: string;
    selesaiPada: string;
    pemicu: string;
    oleh: string;
    durasiMs: number;
    diperiksa: number;
    gagal: Record<string, number>;
    galat: string;
    lengkap: boolean;
  } | null;
  setelan: { jadwal: boolean; jam: string; hariPutus: number; diubahOleh: string } | null;
};

const LABEL_TINGKAT: Record<Tingkat, string> = { tinggi: "Penting", sedang: "Perlu dicek", rendah: "Ringan" };
const WARNA_TINGKAT: Record<Tingkat, "danger" | "warning" | "muted"> = { tinggi: "danger", sedang: "warning", rendah: "muted" };
const NAMA_SUMBER_GAGAL: Record<string, string> = {
  putusan: "putusan SIPP",
  "akta-cerai": "akta cerai SIPP",
  sidang: "jadwal sidang SIPP",
  pihak: "pihak SIPP",
  biaya: "biaya SIPP",
  majelis: "majelis SIPP",
  panitera: "panitera pengganti SIPP",
  penetapan: "penetapan SIPP",
  "court-calendar": "Court Calendar",
  "hadir-lengkap": "kehadiran sidang",
  mediasi: "mediasi",
  "laporan-mediasi": "sidang laporan mediasi",
  ecourt: "pendaftaran e-Court",
  "abt-masuk": "register pendaftaran ABT",
  "abt-putus": "register putusan ABT",
  "abt-minutasi": "register minutasi ABT",
  "abt-akta": "register akta cerai ABT",
  "abt-biaya": "biaya ABT",
  "ecourt-putusan": "tab putusan e-Court",
  ktp: "NIK dari KTP",
  "nik-sipp": "NIK pihak SIPP",
  "kuasa-sipp": "kuasa hukum SIPP",
  "kuasa-ecourt": "kuasa hukum e-Court",
  "kuasa-nama": "nama kuasa hukum",
};
const HALAMAN = 80;

function waktuWita(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  const tanggal = t.toLocaleDateString("id-ID", { timeZone: "Asia/Makassar", day: "numeric", month: "short" });
  const jam = t.toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
  return `${tanggal} ${jam} WITA`;
}

export function PencocokLayar() {
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [saring, setSaring] = useState({ tingkat: "", kelompok: "", jenis: "", cari: "" });
  const [batas, setBatas] = useState(HALAMAN);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/pencocok"), { cache: "no-store" });
      const mentah: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setGalat(pesanGalatPortal(mentah, "Pencocok data belum dapat dimuat."));
        return;
      }
      setData(((mentah as { data?: unknown } | null)?.data ?? null) as Data | null);
    } catch {
      setGalat("Pencocok data belum dapat dimuat. Periksa sambungan ke server.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu putaran: pemuatan mengubah state, dan efek tidak boleh mengubahnya secara serempak.
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirim = async (badan: Record<string, unknown>) => {
    setSibuk(true);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/pencocok"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const mentah: unknown = await r.json().catch(() => null);
      if (!r.ok) setPesan(pesanGalatPortal(mentah, "Gagal disimpan."));
      else setPesan(badan.aksi === "jalankan" ? "Pemeriksaan dimulai di latar. Muat ulang beberapa saat lagi." : "Tersimpan.");
      await muat();
    } finally {
      setSibuk(false);
    }
  };

  const baris = useMemo(() => data?.baris ?? [], [data]);
  const jenisPilihan = useMemo(() => (data?.jenis ?? []).filter((j) => !saring.kelompok || j.kelompok === saring.kelompok), [data, saring.kelompok]);
  const tampil = useMemo(() => {
    const kata = saring.cari.trim().toLowerCase();
    const kelompokDariJenis = new Map((data?.jenis ?? []).map((j) => [j.kode, j.kelompok]));
    return baris.filter(
      (b) =>
        (!saring.tingkat || b.tingkat === saring.tingkat) &&
        (!saring.jenis || b.jenis === saring.jenis) &&
        (!saring.kelompok || kelompokDariJenis.get(b.jenis) === saring.kelompok) &&
        (!kata || b.nomorPerkara.toLowerCase().includes(kata))
    );
  }, [baris, data, saring]);

  if (memuat && !data) return <div className="min-h-[16rem] animate-pulse rounded-2xl border border-border bg-muted/30" />;
  if (galat && !data) return <p className="rounded-xl border border-border bg-card p-4 text-sm">{galat}</p>;
  if (!data) return null;

  const c = data.catatan;
  const gagal = c ? Object.entries(c.gagal) : [];
  const ubahSaring = (bagian: Partial<typeof saring>) => {
    setBatas(HALAMAN);
    setSaring((x) => ({ ...x, ...bagian }));
  };

  return (
    <div className="flex flex-col gap-4" data-pencocok-layar="">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {c ? (
          <>
            <span className="font-medium">Pemeriksaan terakhir {waktuWita(c.selesaiPada || c.pada)}</span>
            <Badge variant="muted">{c.diperiksa} perkara diperiksa</Badge>
            <Badge variant="muted">{(c.durasiMs / 1000).toFixed(1)} detik</Badge>
          </>
        ) : (
          <span className="text-muted-foreground">Belum pernah diperiksa. Pemeriksaan berjalan sendiri tiap malam.</span>
        )}
        <Badge variant="danger">{data.ringkasan.perTingkat.tinggi} penting</Badge>
        <Badge variant="warning">{data.ringkasan.perTingkat.sedang} perlu dicek</Badge>
        <Badge variant="muted">{data.ringkasan.perTingkat.rendah} ringan</Badge>
        {data.sedangBerjalan ? <Badge variant="info">sedang diperiksa</Badge> : null}
        <Button type="button" size="sm" variant="outline" disabled={memuat} onClick={() => void muat()}>
          Muat ulang
        </Button>
        {!data.lihatSemua ? <span className="text-xs text-muted-foreground">Hanya perkara yang namanya tercantum.</span> : null}
      </div>

      <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
        Layar ini hanya menandai perbedaan data antara SIPP, ABT, dan e-Court; tidak mengubah apa pun. Perbaikan dilakukan di sistem yang keliru, atau lewat tombol yang sudah
        ada (misalnya Betulkan kehadiran di panel cetak Blangko Derry).
      </p>

      {c?.galat ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-100 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-200">
          Pemeriksaan terakhir terhenti: {c.galat}
        </p>
      ) : null}
      {gagal.length > 0 ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-100 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-200">
          Sebagian data tidak terbaca pada pemeriksaan terakhir sehingga tidak dibandingkan:{" "}
          {gagal.map(([k, n]) => `${NAMA_SUMBER_GAGAL[k] ?? k} (${n} kelompok)`).join("; ")}. Ini bukan berarti datanya cocok.
        </p>
      ) : null}

      {data.bolehKelola && data.setelan ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm" aria-label="Pengaturan Pencocok data">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2">
              <Switch checked={data.setelan.jadwal} disabled={sibuk} onCheckedChange={(v) => void kirim({ aksi: "setelan", jadwal: v })} />
              Pemeriksaan tiap malam {data.setelan.jadwal ? "menyala" : "mati"} ({data.setelan.jam.replace(":", ".")} WITA)
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Jam
              <Input
                aria-label="Jam pemeriksaan malam"
                className="h-9 w-24"
                defaultValue={data.setelan.jam}
                onBlur={(e) => {
                  const nilai = e.target.value.trim();
                  if (nilai && nilai !== data.setelan?.jam) void kirim({ aksi: "setelan", jam: nilai });
                }}
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Perkara putus dalam (hari)
              <Input
                aria-label="Hari putus yang ikut diperiksa"
                className="h-9 w-24"
                type="number"
                min={30}
                max={1500}
                defaultValue={data.setelan.hariPutus}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n && n !== data.setelan?.hariPutus) void kirim({ aksi: "setelan", hariPutus: n });
                }}
              />
            </label>
            <Button type="button" size="sm" variant="outline" disabled={sibuk || data.sedangBerjalan} onClick={() => void kirim({ aksi: "jalankan" })}>
              Periksa sekarang
            </Button>
          </div>
          {pesan ? <p className="mt-2 text-xs">{pesan}</p> : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
            Tingkat
            <NativeSelect aria-label="Saring tingkat" value={saring.tingkat} onChange={(e) => ubahSaring({ tingkat: e.target.value })}>
              <option value="">Semua</option>
              {(Object.keys(LABEL_TINGKAT) as Tingkat[]).map((k) => (
                <option key={k} value={k}>
                  {LABEL_TINGKAT[k]}
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
            Bagian
            <NativeSelect aria-label="Saring bagian" value={saring.kelompok} onChange={(e) => ubahSaring({ kelompok: e.target.value, jenis: "" })}>
              <option value="">Semua bagian</option>
              {Object.entries(data.kelompok).map(([k, v]) => (
                <option key={k} value={k}>
                  {v} ({data.ringkasan.perKelompok[k] ?? 0})
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex min-w-[14rem] flex-col gap-1 text-xs text-muted-foreground">
            Jenis perbedaan
            <NativeSelect aria-label="Saring jenis perbedaan" value={saring.jenis} onChange={(e) => ubahSaring({ jenis: e.target.value })}>
              <option value="">Semua jenis</option>
              {jenisPilihan.map((j) => (
                <option key={j.kode} value={j.kode}>
                  {j.judul} ({data.ringkasan.perJenis[j.kode] ?? 0})
                </option>
              ))}
            </NativeSelect>
          </label>
          <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
            Cari nomor perkara
            <Input aria-label="Cari nomor perkara" className="h-10" value={saring.cari} onChange={(e) => ubahSaring({ cari: e.target.value })} />
          </label>
        </div>

        {tampil.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {baris.length === 0
              ? c
                ? "Tidak ada perbedaan data yang ditemukan pada pemeriksaan terakhir."
                : "Belum ada hasil pemeriksaan."
              : "Tidak ada yang cocok dengan saringan."}
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Perkara</th>
                  <th className="p-2">Tingkat</th>
                  <th className="p-2">Perbedaan</th>
                  <th className="p-2">Yang perlu dikerjakan</th>
                </tr>
              </thead>
              <tbody>
                {tampil.slice(0, batas).map((b) => (
                  <tr key={`${b.perkaraId}-${b.jenis}`} className="border-b align-top" data-baris-pencocok={b.jenis}>
                    <td className="p-2 font-medium whitespace-nowrap">{b.nomorPerkara || b.perkaraId}</td>
                    <td className="p-2">
                      <Badge variant={WARNA_TINGKAT[b.tingkat]}>{LABEL_TINGKAT[b.tingkat]}</Badge>
                    </td>
                    <td className="p-2">
                      <p className="font-medium">{b.judul}</p>
                      <p className="text-muted-foreground">{b.ringkas}</p>
                      {b.sisi.length > 0 ? (
                        <details className="mt-1">
                          <summary className="cursor-pointer text-muted-foreground">Rincian</summary>
                          <ul className="mt-1 space-y-0.5">
                            {b.sisi.map((s, i) => (
                              <li key={i}>
                                <span className="font-medium">{s.sumber}:</span> {s.nilai}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-1 text-muted-foreground">
                            Pertama terlihat {tanggalPendek(b.pertamaTerlihat.slice(0, 10))}; diperiksa {waktuWita(b.diperiksaPada)}.
                          </p>
                        </details>
                      ) : null}
                    </td>
                    <td className="p-2 text-muted-foreground">{b.saran}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tampil.length > batas ? (
              <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                Menampilkan {batas} dari {tampil.length}.
                <Button type="button" size="sm" variant="outline" onClick={() => setBatas((n) => n + HALAMAN)}>
                  Tampilkan lebih banyak
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
