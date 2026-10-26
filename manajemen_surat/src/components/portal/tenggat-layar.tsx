"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { PETA_SEMUA_ATURAN, sebutPeristiwa, tanggalPanjang, tanggalPendek, type Butir } from "@/lib/penjaga-tenggat";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { usePortal } from "@/lib/app-state";
import { daftarPetugasTenggat, kalimatSisa, saringButirTenggat, type SetelanTenggat } from "@/lib/tenggat-terjadwal";

/**
 * ============================================================================
 * LAYAR TENGGAT (G1, 25 Okt 2026)
 * ============================================================================
 *
 * Satu daftar tenggat perkara - akta cerai, ikrar, relaas, mediasi, masa banding dan kasasi - dengan hitung
 * mundur dan saringan per majelis / panitera pengganti. Hakim dan panitera pengganti hanya melihat perkara
 * yang namanya tercantum (disaring server); pimpinan, panitera, dan admin melihat seluruh satker.
 *
 * Sumbernya hasil pagi hari kerja (bila jadwal menyala) atau pemeriksaan langsung dari SIPP (hanya membaca).
 * Yang menyala-matikan jadwal dan pengingat WhatsApp hanya Super Admin; keduanya mati bawaan.
 */

type JalanRingkas = { pada: string; pemicu: string; oleh: string; jam: string; galat: string; gagal: Record<string, string> };
type KirimRingkas = { pada: string; dicoba: number; terkirim: number; gagal: number; dilewati: number; tanpaPerkara: number };
type AturanInfo = { kode: string; judul: string; dasar: string; perluVerifikasi: boolean };

type Data = {
  tersedia: boolean;
  alasan?: string;
  sumber?: "harian" | "langsung";
  tanggal: string;
  dibuatPada?: string;
  lihatSemua: boolean;
  bolehKelola: boolean;
  hitung?: { lewat: number; menjelang: number; catatan: number };
  berjalan?: number;
  butir?: Butir[];
  tumpukanLama?: Record<string, number>;
  gagal?: Record<string, string>;
  aturan?: AturanInfo[];
  setelan: SetelanTenggat | null;
  jalan?: JalanRingkas | null;
  wa?: KirimRingkas | null;
};

const LABEL_TINGKAT: Record<string, string> = {
  lewat: "Lewat tenggat",
  menjelang: "Menjelang",
  berjalan: "Berjalan",
  catatan: "Catatan",
};

function warnaTingkat(t: string) {
  if (t === "lewat") return "danger" as const;
  if (t === "menjelang") return "warning" as const;
  if (t === "berjalan") return "info" as const;
  return "muted" as const;
}

function jamWita(iso?: string) {
  if (!iso) return "";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return "";
  return t.toLocaleTimeString("id-ID", { timeZone: "Asia/Makassar", hour: "2-digit", minute: "2-digit" }).replace(":", ".");
}

function kalimatBatas(b: Butir): string {
  const aturan = PETA_SEMUA_ATURAN.get(b.aturan);
  if (aturan?.acuanDiDepan) return `sidang ${sebutPeristiwa(b.hariKePeristiwa)}`;
  const sisa = kalimatSisa(b);
  return b.tanggalBatas && !b.menunggu ? `${sisa} (batas ${tanggalPendek(b.tanggalBatas)})` : sisa;
}

export function TenggatLayar() {
  const { currentUser } = usePortal();
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [saring, setSaring] = useState({ tingkat: "", aturan: "", majelis: "", panitera: "", cari: "", milikSaya: false });

  const muat = useCallback(async (langsung: boolean) => {
    setMemuat(true);
    setGalat("");
    try {
      const r = await fetch(apiPath(`/api/aleta-ecourt/tenggat${langsung ? "?langsung=1" : ""}`), { cache: "no-store" });
      const mentah: unknown = await r.json().catch(() => null);
      if (!r.ok) {
        setGalat(pesanGalatPortal(mentah, "Tenggat belum dapat dimuat."));
        return;
      }
      setData(((mentah as { data?: unknown } | null)?.data ?? null) as Data | null);
    } catch {
      setGalat("Tenggat belum dapat dimuat. Periksa sambungan ke server.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    // Ditunda satu putaran: pemuatan mengubah state, dan efek tidak boleh mengubahnya secara serempak.
    const t = window.setTimeout(() => void muat(false), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const kirim = async (badan: Record<string, unknown>, kunci: string) => {
    setSibuk(kunci);
    setPesan("");
    try {
      const r = await fetch(apiPath("/api/aleta-ecourt/tenggat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(badan),
      });
      const mentah: unknown = await r.json().catch(() => null);
      setPesan(r.ok ? "Tersimpan." : pesanGalatPortal(mentah, "Gagal disimpan."));
      await muat(false);
    } finally {
      setSibuk("");
    }
  };

  const butir = useMemo(() => data?.butir ?? [], [data]);
  const tampil = useMemo(
    () =>
      saringButirTenggat(butir, {
        tingkat: saring.tingkat,
        aturan: saring.aturan,
        majelis: saring.majelis,
        panitera: saring.panitera,
        cari: saring.cari,
        milikSaya: saring.milikSaya ? String(currentUser?.name || "") : "",
      }),
    [butir, saring, currentUser?.name]
  );
  const namaMajelis = useMemo(() => daftarPetugasTenggat(butir, "majelis"), [butir]);
  const namaPanitera = useMemo(() => daftarPetugasTenggat(butir, "panitera"), [butir]);
  const aturanBelumDiperiksa = (data?.aturan ?? []).filter((a) => a.perluVerifikasi);
  const setelan = data?.setelan ?? null;

  if (memuat && !data) return <div className="min-h-[16rem] animate-pulse rounded-2xl border border-border bg-muted/30" />;
  if (galat && !data) return <p className="rounded-xl border border-border bg-card p-4 text-sm">{galat}</p>;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-4" data-tenggat-layar="">
      {data.tersedia ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{tanggalPanjang(data.tanggal)}</span>
          <Badge variant="muted">{data.sumber === "harian" ? `Hasil pagi ${jamWita(data.dibuatPada)} WITA` : "Diperiksa sekarang dari SIPP"}</Badge>
          <Badge variant="danger">{data.hitung?.lewat ?? 0} lewat tenggat</Badge>
          <Badge variant="warning">{data.hitung?.menjelang ?? 0} menjelang</Badge>
          <Badge variant="info">{data.berjalan ?? 0} berjalan</Badge>
          <Badge variant="muted">{data.hitung?.catatan ?? 0} catatan</Badge>
          <Button type="button" size="sm" variant="outline" disabled={memuat} onClick={() => void muat(true)}>
            Periksa langsung sekarang
          </Button>
          {!data.lihatSemua ? <span className="text-xs text-muted-foreground">Hanya perkara yang namanya tercantum.</span> : null}
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card p-4 text-sm">
          Tenggat belum dapat dibaca dari SIPP ({data.alasan || "server bot tidak menjawab"}). Ini BUKAN berarti tidak ada tenggat.
          <Button type="button" size="sm" variant="outline" className="ml-3" disabled={memuat} onClick={() => void muat(true)}>
            Coba lagi
          </Button>
        </p>
      )}

      {data.bolehKelola && setelan ? (
        <section className="rounded-2xl border border-border bg-card p-4 text-sm" aria-label="Pengaturan penjaga tenggat">
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2">
              <Switch checked={setelan.jadwal} disabled={Boolean(sibuk)} onCheckedChange={(v) => void kirim({ aksi: "setelan", jadwal: v }, "setelan")} />
              Jadwal harian {setelan.jadwal ? "menyala" : "mati"} ({setelan.jam.replace(":", ".")} WITA, hari kerja)
            </label>
            <label className="flex items-center gap-2">
              <Switch
                checked={setelan.pengingatWa}
                disabled={Boolean(sibuk) || !setelan.jadwal}
                onCheckedChange={(v) => void kirim({ aksi: "setelan", pengingatWa: v }, "setelan")}
              />
              Pengingat WhatsApp pribadi {setelan.pengingatWa ? "menyala" : "mati"}
            </label>
            <Button type="button" size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void kirim({ aksi: "jalankan" }, "jalankan")}>
              Jalankan sekarang
            </Button>
            {data.wa && data.wa.gagal > 0 ? (
              <Button type="button" size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void kirim({ aksi: "jalankan", ulangiGagal: true }, "ulang")}>
                Kirim ulang yang gagal ({data.wa.gagal})
              </Button>
            ) : null}
            {setelan.diubahOleh ? <span className="text-xs text-muted-foreground">Terakhir diubah {setelan.diubahOleh}.</span> : null}
          </div>
          {!setelan.jadwal ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Jadwal mati: tidak ada pembacaan otomatis, tidak ada lonceng, tidak ada pesan. Layar ini tetap dapat memeriksa langsung dari SIPP.
            </p>
          ) : null}
          <div className="mt-3">
            <p className="text-xs font-medium text-muted-foreground">Aturan yang boleh masuk pengingat WhatsApp</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {(data.aturan ?? []).map((a) => {
                const dipilih = setelan.aturanPengingat.includes(a.kode);
                return (
                  <label key={a.kode} className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={dipilih}
                      disabled={Boolean(sibuk)}
                      onChange={() =>
                        void kirim(
                          {
                            aksi: "setelan",
                            aturanPengingat: dipilih ? setelan.aturanPengingat.filter((k) => k !== a.kode) : [...setelan.aturanPengingat, a.kode],
                          },
                          "setelan"
                        )
                      }
                    />
                    {a.judul}
                    {a.perluVerifikasi ? <Badge variant="warning">dasar belum diperiksa</Badge> : null}
                  </label>
                );
              })}
            </div>
          </div>
          {data.wa ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Pengingat terakhir {jamWita(data.wa.pada)} WITA: {data.wa.terkirim} terkirim, {data.wa.gagal} gagal, {data.wa.dilewati} dilewati,{" "}
              {data.wa.tanpaPerkara} orang tanpa perkara bertenggat.
            </p>
          ) : null}
          {data.jalan?.galat ? <p className="mt-2 text-xs">Jalan terakhir tidak lengkap: {data.jalan.galat}</p> : null}
          {pesan ? <p className="mt-2 text-xs">{pesan}</p> : null}
        </section>
      ) : null}

      {data.gagal && Object.keys(data.gagal).length > 0 ? (
        <p className="rounded-xl border border-amber-300/70 bg-amber-100 p-3 text-xs text-amber-900 dark:border-amber-700/50 dark:bg-amber-950/70 dark:text-amber-200">
          Sebagian aturan tidak terbaca dari SIPP sehingga tidak diperiksa:{" "}
          {Object.entries(data.gagal)
            .map(([k, v]) => `${PETA_SEMUA_ATURAN.get(k)?.judul || k} (${v})`)
            .join("; ")}
          .
        </p>
      ) : null}

      {data.tersedia ? (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[9rem] flex-col gap-1 text-xs text-muted-foreground">
              Tingkat
              <NativeSelect aria-label="Saring tingkat" value={saring.tingkat} onChange={(e) => setSaring((x) => ({ ...x, tingkat: e.target.value }))}>
                <option value="">Semua</option>
                {Object.entries(LABEL_TINGKAT).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="flex min-w-[12rem] flex-col gap-1 text-xs text-muted-foreground">
              Aturan
              <NativeSelect aria-label="Saring aturan" value={saring.aturan} onChange={(e) => setSaring((x) => ({ ...x, aturan: e.target.value }))}>
                <option value="">Semua aturan</option>
                {(data.aturan ?? []).map((a) => (
                  <option key={a.kode} value={a.kode}>
                    {a.judul}
                  </option>
                ))}
              </NativeSelect>
            </label>
            {data.lihatSemua ? (
              <>
                <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
                  Majelis
                  <NativeSelect aria-label="Saring majelis" value={saring.majelis} onChange={(e) => setSaring((x) => ({ ...x, majelis: e.target.value }))}>
                    <option value="">Semua majelis</option>
                    {namaMajelis.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
                  Panitera pengganti
                  <NativeSelect aria-label="Saring panitera pengganti" value={saring.panitera} onChange={(e) => setSaring((x) => ({ ...x, panitera: e.target.value }))}>
                    <option value="">Semua panitera pengganti</option>
                    {namaPanitera.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <label className="flex items-center gap-2 pb-2 text-xs">
                  <Switch checked={saring.milikSaya} onCheckedChange={(v) => setSaring((x) => ({ ...x, milikSaya: v }))} />
                  Perkara saya saja
                </label>
              </>
            ) : null}
            <label className="flex min-w-[11rem] flex-col gap-1 text-xs text-muted-foreground">
              Cari nomor perkara
              <Input aria-label="Cari nomor perkara" className="h-10" value={saring.cari} onChange={(e) => setSaring((x) => ({ ...x, cari: e.target.value }))} />
            </label>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="p-2">Perkara</th>
                  <th className="p-2">Tenggat</th>
                  <th className="p-2">Sisa waktu</th>
                  <th className="p-2">Petugas</th>
                  <th className="p-2">Yang perlu dikerjakan</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((b, i) => (
                  <tr key={`${b.aturan}-${b.perkaraId}-${b.pihak}-${i}`} className="border-b align-top" data-baris-tenggat={b.aturan}>
                    <td className="p-2">
                      <div className="font-medium">{b.nomorPerkara}</div>
                      <div className="text-muted-foreground">{b.jenisPerkara}</div>
                    </td>
                    <td className="p-2">
                      <Badge variant={warnaTingkat(b.tingkat)}>{LABEL_TINGKAT[b.tingkat] || b.tingkat}</Badge>
                      <div className="mt-1">{b.judul}</div>
                      {b.perluVerifikasi ? <Badge variant="warning">dasar belum diperiksa</Badge> : null}
                      {b.keterangan ? <div className="text-muted-foreground">{b.keterangan}</div> : null}
                    </td>
                    <td className="p-2 font-medium">{kalimatBatas(b)}</td>
                    <td className="p-2">
                      {b.majelis ? <div>Majelis: {b.majelis}</div> : null}
                      {b.panitera ? <div>PP: {b.panitera}</div> : null}
                      {b.jurusita ? <div>JS: {b.jurusita}</div> : null}
                      {b.mediator ? <div>Mediator: {b.mediator}</div> : null}
                    </td>
                    <td className="p-2">{b.tingkat === "berjalan" ? "-" : b.tindakan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {tampil.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {butir.length === 0 ? "Tidak ada tenggat yang terlampaui, menjelang, atau berjalan hari ini." : "Tidak ada yang cocok dengan saringan."}
              </p>
            ) : null}
          </div>

          {data.tumpukanLama && Object.keys(data.tumpukanLama).length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Tumpukan lama (lebih dari 24 bulan) dihitung tetapi tidak dirinci:{" "}
              {Object.entries(data.tumpukanLama)
                .map(([k, v]) => `${PETA_SEMUA_ATURAN.get(k)?.judul || k} ${v}`)
                .join("; ")}
              .
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="rounded-2xl border border-border bg-card p-4 text-xs" aria-label="Dasar aturan">
        <p className="font-medium">Dasar tiap aturan</p>
        {aturanBelumDiperiksa.length > 0 ? (
          <p className="mt-1 text-muted-foreground">
            Aturan bertanda &quot;dasar belum diperiksa&quot; ditulis dari ingatan pengembang dan menunggu pemeriksaan Derry; belum ikut pengingat WhatsApp sampai Super Admin memilihnya.
          </p>
        ) : null}
        <ul className="mt-2 flex flex-col gap-1">
          {(data.aturan ?? []).map((a) => (
            <Fragment key={a.kode}>
              <li>
                <span className="font-medium">{a.judul}.</span> <span className="text-muted-foreground">{a.dasar}</span>
              </li>
            </Fragment>
          ))}
        </ul>
        <p className="mt-2 text-muted-foreground">Ini usulan dari data SIPP. Yang memutus tetap pejabat yang berwenang; periksa catatan pengadilan untuk angka resmi.</p>
      </section>
    </div>
  );
}
