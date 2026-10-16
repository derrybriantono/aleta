"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { SetSaksiAleta } from "@/components/portal/set-saksi-aleta";
import { PageIntro } from "@/components/portal/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import {
  ARTI_CEK,
  artiJenisVariabel,
  bedaFolder,
  folderBas,
  gabungPeran,
  hakPengaturanAbt,
  hurufDiluarLatin1,
  namaPeran,
  pecahPeran,
  periksaKueriVariabel,
  periksaTemplat,
  rancanganSaklar,
  ringkasBedaTemplat,
  susunSaklar,
  susunUbahMenu,
  uraiJenis,
  uraiPeran,
  uraiTahapan,
  type BarisTemplat,
  type DataMenuAbt,
  type FolderMenuAbt,
  type HakPengaturanAbt,
  type KunciSaklar,
} from "@/lib/pengaturan-abt";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Pengaturan SIPP & ABT (16 Okt 2026, Tahap H) - halaman admin.
 *
 * Empat bagian: (1) Hak menu ABT folder Blangko Derry + saklar kebijakan,
 * (2) Isian blangko (variabel ABT yang dipakai blangko Derry), (3) Template
 * tanya jawab, (4) Riwayat. Setiap ubahan: rancangan di layar -> pratinjau
 * beda -> Simpan; nilai lama tercatat dan bisa dikembalikan. Rute
 * /api/pengaturan-sipp-abt yang menjaga peran.
 */

type Bagian = "menu" | "variabel" | "templat" | "riwayat";

async function panggil<T>(alamat: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(alamat), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}

const kirim = <T,>(badan: Record<string, unknown>) =>
  panggil<T>("/api/pengaturan-sipp-abt", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

const jam = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

/** Peran yang paling sering dipakai blangko - tampil di depan. */
const PERAN_UTAMA = ["1", "10", "20", "30", "500", "600", "650", "430", "1000", "1010", "1020"];

function Pesan({ jenis, children }: { jenis: "galat" | "berhasil" | "info"; children: React.ReactNode }) {
  const warna =
    jenis === "galat"
      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
      : jenis === "berhasil"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
  return <div className={`rounded-xl border px-3 py-2 text-sm ${warna}`}>{children}</div>;
}

// ===========================================================================
// Riwayat (dipakai semua bagian)
// ===========================================================================

type Suntingan = {
  id: string;
  jenis: string;
  kunci: string;
  ringkas: string;
  status: string;
  galat: string;
  pulihDari: string;
  olehNama: string;
  pada: string;
};

function DaftarRiwayat({ jenis, kunci, bolehKembalikan, segarkan, sesudahKembalikan }: { jenis?: string; kunci?: string; bolehKembalikan: (s: Suntingan) => boolean; segarkan: number; sesudahKembalikan: () => void }) {
  const [riwayat, setRiwayat] = useState<Suntingan[] | null>(null);
  const [galat, setGalat] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [yakin, setYakin] = useState("");

  const muat = useCallback(async () => {
    try {
      const q = new URLSearchParams({ bagian: "riwayat", batas: "30" });
      if (jenis) q.set("jenis", jenis);
      if (kunci) q.set("kunci", kunci);
      const d = await panggil<{ riwayat: Suntingan[] }>(`/api/pengaturan-sipp-abt?${q.toString()}`);
      setRiwayat(d.riwayat);
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, [jenis, kunci]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat, segarkan]);

  async function kembalikan(id: string) {
    setSibuk(id);
    setGalat("");
    try {
      await kirim({ tindakan: "kembalikan", id });
      setYakin("");
      await muat();
      sesudahKembalikan();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  if (galat) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!riwayat) return <p className="text-sm text-muted-foreground">Memuat riwayat...</p>;
  if (!riwayat.length) return <p className="text-sm text-muted-foreground">Belum ada perubahan yang dicatat.</p>;
  return (
    <ul className="space-y-2">
      {riwayat.map((s) => (
        <li key={s.id} className="flex flex-col gap-2 rounded-xl border border-border/70 p-3 text-sm sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{jam(s.pada)}</span>
              <span className="text-muted-foreground">oleh {s.olehNama || "-"}</span>
              <Badge variant={s.status === "tersimpan" ? "success" : s.status === "gagal" ? "danger" : "warning"}>
                {s.status === "tersimpan" ? "tersimpan" : s.status === "gagal" ? "gagal" : "menunggu"}
              </Badge>
              {s.pulihDari ? <Badge variant="info">pengembalian</Badge> : null}
            </div>
            <p className="break-words">{s.ringkas}</p>
            {s.galat ? <p className="break-words text-rose-700 dark:text-rose-300">{s.galat}</p> : null}
          </div>
          {s.status === "tersimpan" && bolehKembalikan(s) ? (
            yakin === s.id ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="destructive" disabled={sibuk === s.id} onClick={() => void kembalikan(s.id)}>
                  {sibuk === s.id ? "Mengembalikan..." : "Ya, kembalikan"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setYakin("")}>
                  Batal
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="shrink-0" onClick={() => setYakin(s.id)}>
                Kembalikan ke sebelum ini
              </Button>
            )
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ===========================================================================
// Hak menu & saklar
// ===========================================================================

type DataMenu = DataMenuAbt & { saklar: ReturnType<typeof susunSaklar>; hak: HakPengaturanAbt };

function PilihPeran({ nilai, peran, ubah, nonaktif }: { nilai: string | null; peran: DataMenuAbt["peran"]; ubah: (v: string | null) => void; nonaktif: boolean }) {
  const [semua, setSemua] = useState(false);
  const terpilih = pecahPeran(nilai);
  const daftar = (semua ? peran.map((p) => String(p.id)) : PERAN_UTAMA).filter((id, i, a) => a.indexOf(id) === i);
  for (const id of terpilih) if (!daftar.includes(id)) daftar.push(id);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {daftar.map((id) => (
          <label key={id} className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              disabled={nonaktif}
              checked={terpilih.includes(id)}
              onChange={(e) => ubah(gabungPeran(e.target.checked ? [...terpilih, id] : terpilih.filter((x) => x !== id)))}
            />
            {namaPeran(id, peran)}
          </label>
        ))}
      </div>
      <button type="button" className="text-xs text-primary underline" onClick={() => setSemua(!semua)}>
        {semua ? "Tampilkan peran utama saja" : "Tampilkan semua peran SIPP"}
      </button>
    </div>
  );
}

function BagianMenu({ hakAwal }: { hakAwal: HakPengaturanAbt | null }) {
  const [data, setData] = useState<DataMenu | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [rancangan, setRancangan] = useState<Record<number, Partial<FolderMenuAbt>>>({});
  const [rancanganConfig, setRancanganConfig] = useState<Record<string, string>>({});
  const [buka, setBuka] = useState<number | null>(null);
  const [pratinjau, setPratinjau] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [segarkan, setSegarkan] = useState(0);

  const muat = useCallback(async () => {
    try {
      setData(await panggil<DataMenu>("/api/pengaturan-sipp-abt?bagian=menu"));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const hak = data?.hak ?? hakAwal;
  const boleh = Boolean(hak?.ubahMenu);

  const folderRancangan = useMemo(
    () => (data ? data.folder.map((f) => ({ ...f, ...(rancangan[f.id] ?? {}) }) as FolderMenuAbt) : []),
    [data, rancangan]
  );
  const ubah = useMemo(() => (data ? susunUbahMenu(data.folder, rancangan, data) : []), [data, rancangan]);
  const ubahConfig = useMemo(
    () =>
      data
        ? Object.entries(rancanganConfig)
            .filter(([name, v]) => (data.config[name] ?? "") !== v)
            .map(([name, baru]) => ({ name, lama: data.config[name] ?? "", baru }))
        : [],
    [data, rancanganConfig]
  );
  const saklar = useMemo(
    () => (data ? susunSaklar({ folder: folderRancangan, config: { ...data.config, ...rancanganConfig } }) : []),
    [data, folderRancangan, rancanganConfig]
  );

  function ubahFolder(id: number, isi: Partial<FolderMenuAbt>) {
    setRancangan((r) => ({ ...r, [id]: { ...(r[id] ?? {}), ...isi } }));
    setPesan("");
  }

  function geserSaklar(kunci: KunciSaklar, nyala: boolean) {
    if (!data) return;
    setPesan("");
    if (kunci === "validasi-bas") {
      setRancanganConfig((c) => ({ ...c, validasi_data_bas: nyala ? "1" : "0" }));
      return;
    }
    setRancangan((r) => rancanganSaklar(kunci, nyala, data.folder, r));
  }

  async function simpan() {
    setSibuk(true);
    setGalat("");
    try {
      await kirim({ tindakan: "simpan-menu", ubah, config: ubahConfig });
      setRancangan({});
      setRancanganConfig({});
      setPratinjau(false);
      setPesan("Tersimpan di ABT. Nilai lama dicatat di riwayat dan dapat dikembalikan.");
      setSegarkan((x) => x + 1);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  }

  if (galat && !data) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!data) return <p className="text-sm text-muted-foreground">Memuat hak menu ABT...</p>;
  const jumlahUbah = ubah.length + ubahConfig.length;

  return (
    <div className="space-y-4">
      {!boleh ? <Pesan jenis="info">Anda dapat melihat pengaturan ini. Yang dapat mengubah hak menu dan saklar hanya Super Admin.</Pesan> : null}
      {pesan ? <Pesan jenis="berhasil">{pesan}</Pesan> : null}
      {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}

      <Card>
        <CardHeader>
          <CardTitle>Saklar kebijakan</CardTitle>
          <CardDescription>
            Keadaan saklar dibaca dari hak menu ABT saat ini. Menggeser saklar baru membuat rancangan; ABT berubah setelah Anda menekan Simpan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {saklar.map((s) => (
            <div key={s.kunci} className="flex items-start justify-between gap-4 rounded-xl border border-border/70 p-3">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{s.judul}</span>
                  {s.keadaan === "sebagian" ? <Badge variant="warning">sebagian folder</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{s.arti}</p>
                {s.folder.length ? <p className="text-xs text-muted-foreground">Menyentuh {s.folder.length} folder.</p> : null}
              </div>
              <Switch
                aria-label={s.judul}
                checked={s.keadaan === "nyala"}
                disabled={!boleh}
                onCheckedChange={(v) => geserSaklar(s.kunci, Boolean(v))}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hak menu per folder - {data.grup?.nama ?? "Blangko Derry"}</CardTitle>
          <CardDescription>Siapa yang melihat folder blangko di ABT, untuk tahapan dan jenis perkara apa. Membuka satu folder berarti membuka seluruh isinya.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {folderRancangan.map((f) => {
            const asal = data.folder.find((x) => x.id === f.id)!;
            const beda = bedaFolder(asal, rancangan[f.id] ?? {}, data);
            return (
              <div key={f.id} className={`rounded-xl border p-3 ${beda.length ? "border-amber-400" : "border-border/70"}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{f.namaAlias || f.nama}</span>
                      {folderBas(f) ? <Badge variant="info">BAS</Badge> : null}
                      {beda.length ? <Badge variant="warning">{beda.length} ubahan belum disimpan</Badge> : null}
                    </div>
                    <p>
                      <span className="text-muted-foreground">Dilihat: </span>
                      {uraiPeran(f.user_grup_id, data.peran)}
                    </p>
                    <p className="text-muted-foreground">
                      {ARTI_CEK[f.user_cek] ?? ""} · {uraiTahapan(f.proses_id_min, f.proses_id_max, data.proses)} · {uraiJenis(f, data.jenis, data.alur)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="shrink-0" onClick={() => setBuka(buka === f.id ? null : f.id)}>
                    {buka === f.id ? "Tutup" : boleh ? "Ubah" : "Rinci"}
                  </Button>
                </div>
                {buka === f.id ? (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    <div>
                      <p className="mb-1 text-sm font-medium">Peran yang melihat folder ini</p>
                      <PilihPeran nilai={f.user_grup_id} peran={data.peran} nonaktif={!boleh} ubah={(v) => ubahFolder(f.id, { user_grup_id: v })} />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">Peran yang selalu boleh (tanpa melihat tahapan perkara)</p>
                      <PilihPeran nilai={f.user_top_id} peran={data.peran} nonaktif={!boleh} ubah={(v) => ubahFolder(f.id, { user_top_id: v })} />
                    </div>
                    {folderBas(f) || f.user_validator ? (
                      <div>
                        <p className="mb-1 text-sm font-medium">Peran pemeriksa BAS</p>
                        <PilihPeran nilai={f.user_validator} peran={data.peran} nonaktif={!boleh} ubah={(v) => ubahFolder(f.id, { user_validator: v })} />
                      </div>
                    ) : null}
                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Perkara yang tampil</span>
                        <NativeSelect value={String(f.user_cek)} disabled={!boleh} onChange={(e) => ubahFolder(f.id, { user_cek: Number(e.target.value) })}>
                          {[0, 1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {ARTI_CEK[n]}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Mulai tahapan</span>
                        <NativeSelect value={String(f.proses_id_min)} disabled={!boleh} onChange={(e) => ubahFolder(f.id, { proses_id_min: Number(e.target.value) })}>
                          {[...new Set([f.proses_id_min, ...data.proses.map((p) => p.id)])].map((id) => (
                            <option key={id} value={id}>
                              {uraiTahapan(id, id, data.proses)}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium">Sampai tahapan</span>
                        <NativeSelect value={String(f.proses_id_max)} disabled={!boleh} onChange={(e) => ubahFolder(f.id, { proses_id_max: Number(e.target.value) })}>
                          {[...new Set([f.proses_id_max, ...data.proses.map((p) => p.id)])].map((id) => (
                            <option key={id} value={id}>
                              {uraiTahapan(id, id, data.proses)}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>
                    </div>
                    {f.proses_id_min > f.proses_id_max ? <Pesan jenis="galat">Tahapan awal lebih akhir daripada tahapan akhir - folder tidak akan tampil.</Pesan> : null}
                    {beda.length ? (
                      <Button size="sm" variant="ghost" onClick={() => setRancangan((r) => Object.fromEntries(Object.entries(r).filter(([k]) => Number(k) !== f.id)))}>
                        Batalkan ubahan folder ini
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {jumlahUbah ? (
        <div className="sticky bottom-3 z-10 space-y-3 rounded-2xl border border-amber-400 bg-card p-4 shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium">{jumlahUbah} ubahan belum disimpan</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRancangan({});
                  setRancanganConfig({});
                  setPratinjau(false);
                }}
              >
                Buang rancangan
              </Button>
              <Button size="sm" onClick={() => setPratinjau(!pratinjau)} disabled={!boleh}>
                {pratinjau ? "Sembunyikan pratinjau" : "Lihat beda lalu simpan"}
              </Button>
            </div>
          </div>
          {pratinjau ? (
            <div className="space-y-3">
              <ul className="max-h-80 space-y-2 overflow-auto text-sm">
                {ubah.map((u) => {
                  const f = data.folder.find((x) => x.id === u.id)!;
                  return (
                    <li key={u.id} className="rounded-lg border border-border/60 p-2">
                      <p className="font-medium">{f.namaAlias || f.nama}</p>
                      {bedaFolder(f, rancangan[u.id] ?? {}, data).map((b) => (
                        <p key={b.kolom} className="break-words">
                          {b.label}: <span className="text-rose-700 line-through dark:text-rose-300">{b.lamaTeks}</span> → <span className="text-emerald-700 dark:text-emerald-300">{b.baruTeks}</span>
                        </p>
                      ))}
                    </li>
                  );
                })}
                {ubahConfig.map((c) => (
                  <li key={c.name} className="rounded-lg border border-border/60 p-2">
                    BAS harus diperiksa hakim: <span className="line-through">{c.lama === "1" ? "ya" : "tidak"}</span> → {c.baru === "1" ? "ya" : "tidak"}
                  </li>
                ))}
              </ul>
              <Button onClick={() => void simpan()} disabled={sibuk || !boleh}>
                {sibuk ? "Menyimpan ke ABT..." : "Simpan ke ABT"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Riwayat hak menu</CardTitle>
        </CardHeader>
        <CardContent>
          <DaftarRiwayat jenis="menu" bolehKembalikan={() => boleh} segarkan={segarkan} sesudahKembalikan={() => void muat()} />
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Isian blangko (variabel)
// ===========================================================================

type ButirVariabel = {
  noVar: string;
  judul: string;
  nama: string;
  jenis: string;
  dikunci: boolean;
  jumlahBlangko: number;
  contohBlangko: string[];
};

type RinciVariabel = {
  noVar: string;
  judul: string;
  nama: string;
  jenis: string;
  sql_query?: string;
  adaKueri?: boolean;
  default_data: string;
  dikunci: boolean;
  blangko: string[];
};

type HasilUji = { ok: boolean; status: string; sebab: string; nilai: string; ms: number };

function RinciVar({ noVar, hak, tutup }: { noVar: string; hak: HakPengaturanAbt; tutup: () => void }) {
  const [v, setV] = useState<RinciVariabel | null>(null);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [kueri, setKueri] = useState("");
  const [bawaan, setBawaan] = useState("");
  const [lanjutan, setLanjutan] = useState(false);
  const [nomor, setNomor] = useState("");
  const [perkara, setPerkara] = useState<{ perkaraId: number; nomor: string; jenis: string } | null>(null);
  const [sidangKe, setSidangKe] = useState("1");
  const [uji, setUji] = useState<HasilUji | null>(null);
  const [ujiUntuk, setUjiUntuk] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [pratinjau, setPratinjau] = useState(false);
  const [segarkan, setSegarkan] = useState(0);

  const muat = useCallback(async () => {
    try {
      const d = await panggil<{ variabel: RinciVariabel }>(`/api/pengaturan-sipp-abt?bagian=variabel&noVar=${encodeURIComponent(noVar)}`);
      setV(d.variabel);
      setKueri(d.variabel.sql_query ?? "");
      setBawaan(d.variabel.default_data ?? "");
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, [noVar]);
  // Ganti isian = komponen baru (key={noVar} di induk), jadi tidak perlu disetel ulang di sini.
  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);
  useEffect(() => {
    if (perkara) return;
    void panggil<{ perkara: { perkaraId: number; nomor: string; jenis: string } | null }>("/api/pengaturan-sipp-abt?bagian=perkara")
      .then((d) => {
        if (d.perkara) {
          setPerkara(d.perkara);
          setNomor(d.perkara.nomor);
        }
      })
      .catch(() => undefined);
  }, [perkara]);

  if (galat && !v) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!v) return <p className="text-sm text-muted-foreground">Memuat isian...</p>;

  const bolehKueri = hak.ubahKueri && v.jenis === "data_sql" && !v.dikunci;
  const bolehBawaan = hak.ubahBawaan && !v.dikunci;
  const kueriBerubah = bolehKueri && kueri.trim() !== (v.sql_query ?? "").trim();
  const bawaanBerubah = bolehBawaan && bawaan !== (v.default_data ?? "");
  const sebabKueri = kueriBerubah ? periksaKueriVariabel(kueri) : "";
  const luarBawaan = bawaanBerubah ? hurufDiluarLatin1(bawaan) : [];
  const kunciUji = `${kueri.trim()}|${perkara?.perkaraId ?? ""}|${sidangKe}`;
  const ujiLolos = !kueriBerubah || (uji?.ok === true && ujiUntuk === kunciUji);
  const bisaSimpan = (kueriBerubah || bawaanBerubah) && !sebabKueri && !luarBawaan.length && ujiLolos;

  async function cariPerkara() {
    setSibuk("perkara");
    try {
      const d = await panggil<{ perkara: { perkaraId: number; nomor: string; jenis: string } | null }>(
        `/api/pengaturan-sipp-abt?bagian=perkara&nomor=${encodeURIComponent(nomor.trim())}`
      );
      setPerkara(d.perkara);
      if (!d.perkara) setGalat("Nomor perkara tidak ditemukan di SIPP.");
      else setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  async function jalankanUji() {
    if (!perkara) return;
    setSibuk("uji");
    setUji(null);
    try {
      const d = await kirim<{ uji: HasilUji }>({
        tindakan: "uji-variabel",
        noVar,
        perkaraId: perkara.perkaraId,
        sidangKe: Number(sidangKe) || 0,
        ...(kueriBerubah ? { sql_query: kueri } : {}),
      });
      setUji(d.uji);
      setUjiUntuk(kunciUji);
    } catch (e) {
      setUji({ ok: false, status: "galat", sebab: e instanceof Error ? e.message : String(e), nilai: "", ms: 0 });
    } finally {
      setSibuk("");
    }
  }

  async function simpan() {
    if (!v) return;
    setSibuk("simpan");
    setGalat("");
    try {
      const lama: Record<string, string> = {};
      const baru: Record<string, string> = {};
      if (kueriBerubah) {
        lama.sql_query = v.sql_query ?? "";
        baru.sql_query = kueri;
      }
      if (bawaanBerubah) {
        lama.default_data = v.default_data ?? "";
        baru.default_data = bawaan;
      }
      await kirim({ tindakan: "simpan-variabel", noVar, lama, baru, perkaraId: perkara?.perkaraId, sidangKe: Number(sidangKe) || 0 });
      setPesan("Tersimpan di ABT. Nilai lama dicatat di riwayat dan dapat dikembalikan.");
      setPratinjau(false);
      setSegarkan((x) => x + 1);
      await muat();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="break-words">{v.judul}</CardTitle>
            <CardDescription>
              Nama di ABT (tidak berubah): {v.nama || "-"} · #{v.noVar}# · {artiJenisVariabel(v.jenis)}
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" onClick={tutup}>
            Tutup
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {v.dikunci ? <Pesan jenis="info">Isian ini dikunci ABT (bawaan Badilag) sehingga tidak dapat diubah.</Pesan> : null}
        {pesan ? <Pesan jenis="berhasil">{pesan}</Pesan> : null}
        {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}

        <div className="text-sm">
          <p className="font-medium">Dipakai di {v.blangko.length} blangko Derry</p>
          <ul className="mt-1 max-h-28 list-inside list-disc overflow-auto text-muted-foreground">
            {v.blangko.slice(0, 30).map((b) => (
              <li key={b} className="break-words">
                {b.replace(/\.rtf$/i, "")}
              </li>
            ))}
            {v.blangko.length > 30 ? <li>dan {v.blangko.length - 30} lainnya</li> : null}
          </ul>
        </div>

        <label className="block space-y-1 text-sm">
          <span className="font-medium">Isian bawaan (muncul lebih dulu saat petugas mengisi di ABT)</span>
          <Textarea rows={3} value={bawaan} disabled={!bolehBawaan} onChange={(e) => setBawaan(e.target.value)} />
          {luarBawaan.length ? <span className="text-rose-700">Huruf ini tidak dapat disimpan ABT: {luarBawaan.join(" ")}</span> : null}
        </label>

        {hak.ubahKueri ? (
          <div className="rounded-xl border border-dashed border-border p-3">
            <button type="button" className="text-sm font-medium text-primary underline" onClick={() => setLanjutan(!lanjutan)}>
              {lanjutan ? "Sembunyikan bagian lanjutan" : "Bagian lanjutan (khusus Super Admin): cara isian ini diambil"}
            </button>
            {lanjutan ? (
              <div className="mt-2 space-y-2">
                {v.jenis === "data_sql" ? (
                  <>
                    <Textarea rows={8} className="font-mono text-xs" value={kueri} disabled={!bolehKueri} onChange={(e) => setKueri(e.target.value)} />
                    <p className="text-xs text-muted-foreground">
                      Hanya satu perintah SELECT. Tanda #perkara_id# dan #NNNN# diganti ABT saat dicetak. Kueri yang diubah wajib lolos uji di bawah sebelum dapat disimpan.
                    </p>
                    {sebabKueri ? <Pesan jenis="galat">{sebabKueri}</Pesan> : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Isian jenis ini tidak memakai kueri.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : v.adaKueri ? (
          <p className="text-xs text-muted-foreground">Cara isian ini diambil hanya dapat dilihat dan diubah Super Admin.</p>
        ) : null}

        <div className="space-y-2 rounded-xl border border-border/70 p-3">
          <p className="text-sm font-medium">Contoh hasil atas satu perkara (hanya membaca)</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span>Nomor perkara</span>
              <Input value={nomor} onChange={(e) => setNomor(e.target.value)} className="w-64" />
            </label>
            <Button size="sm" variant="outline" onClick={() => void cariPerkara()} disabled={sibuk === "perkara" || !nomor.trim()}>
              Pakai perkara ini
            </Button>
            <label className="space-y-1 text-sm">
              <span>Sidang ke</span>
              <Input value={sidangKe} onChange={(e) => setSidangKe(e.target.value.replace(/\D/g, "").slice(0, 2))} className="w-20" />
            </label>
            <Button size="sm" onClick={() => void jalankanUji()} disabled={!perkara || sibuk === "uji" || Boolean(sebabKueri)}>
              {sibuk === "uji" ? "Menghitung..." : kueriBerubah ? "Uji rancangan" : "Lihat hasil"}
            </Button>
          </div>
          {perkara ? (
            <p className="text-xs text-muted-foreground">
              Perkara contoh: {perkara.nomor} ({perkara.jenis})
            </p>
          ) : null}
          {uji ? (
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant={uji.ok ? (uji.status === "kosong" ? "warning" : "success") : "danger"}>
                  {uji.ok ? (uji.status === "kosong" ? "berjalan, hasil kosong" : "berjalan") : "gagal"}
                </Badge>
                <span className="text-muted-foreground">{(uji.ms / 1000).toFixed(1)} detik</span>
              </div>
              {uji.sebab ? <p className="text-sm text-muted-foreground">{uji.sebab}</p> : null}
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-muted/60 p-2 text-sm">{uji.nilai || "(kosong)"}</pre>
            </div>
          ) : null}
        </div>

        {kueriBerubah || bawaanBerubah ? (
          <div className="space-y-2 rounded-xl border border-amber-400 p-3">
            {!ujiLolos ? <Pesan jenis="info">Kueri berubah - jalankan &quot;Uji rancangan&quot; sampai berhasil sebelum menyimpan.</Pesan> : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setPratinjau(!pratinjau)}>
                {pratinjau ? "Sembunyikan beda" : "Lihat beda"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setKueri(v.sql_query ?? "");
                  setBawaan(v.default_data ?? "");
                }}
              >
                Buang rancangan
              </Button>
              <Button size="sm" disabled={!bisaSimpan || sibuk === "simpan"} onClick={() => void simpan()}>
                {sibuk === "simpan" ? "Menyimpan ke ABT..." : "Simpan ke ABT"}
              </Button>
            </div>
            {pratinjau ? (
              <div className="grid gap-2 md:grid-cols-2">
                {kueriBerubah ? (
                  <>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-2 text-xs dark:bg-rose-950/40">{v.sql_query || "(kosong)"}</pre>
                    <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-2 text-xs dark:bg-emerald-950/40">{kueri || "(kosong)"}</pre>
                  </>
                ) : null}
                {bawaanBerubah ? (
                  <>
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-rose-50 p-2 text-sm dark:bg-rose-950/40">{v.default_data || "(kosong)"}</pre>
                    <pre className="whitespace-pre-wrap break-words rounded-lg bg-emerald-50 p-2 text-sm dark:bg-emerald-950/40">{bawaan || "(kosong)"}</pre>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-sm font-medium">Riwayat isian ini</p>
          <DaftarRiwayat jenis="variabel" kunci={v.noVar} bolehKembalikan={() => hak.ubahBawaan} segarkan={segarkan} sesudahKembalikan={() => void muat()} />
        </div>
      </CardContent>
    </Card>
  );
}

function BagianVariabel({ hakAwal, noVarAwal }: { hakAwal: HakPengaturanAbt | null; noVarAwal: string }) {
  const [daftar, setDaftar] = useState<ButirVariabel[] | null>(null);
  const [hak, setHak] = useState<HakPengaturanAbt | null>(hakAwal);
  const [jumlahBerkas, setJumlahBerkas] = useState(0);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [jenis, setJenis] = useState("");
  const [buka, setBuka] = useState(noVarAwal);

  useEffect(() => {
    void panggil<{ daftar: ButirVariabel[]; jumlahBerkas: number; hak: HakPengaturanAbt }>("/api/pengaturan-sipp-abt?bagian=variabel")
      .then((d) => {
        setDaftar(d.daftar);
        setJumlahBerkas(d.jumlahBerkas);
        setHak(d.hak);
      })
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)));
  }, []);

  const jenisAda = useMemo(() => [...new Set((daftar ?? []).map((v) => v.jenis))].sort(), [daftar]);
  const tampil = useMemo(() => {
    const c = cari.trim().toLowerCase();
    return (daftar ?? []).filter((v) => (!jenis || v.jenis === jenis) && (!c || `${v.judul} ${v.nama} ${v.noVar}`.toLowerCase().includes(c)));
  }, [daftar, cari, jenis]);

  return (
    <div className="space-y-4">
      {buka && hak ? <RinciVar key={buka} noVar={buka} hak={hak} tutup={() => setBuka("")} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Isian blangko Derry</CardTitle>
          <CardDescription>
            Hanya isian yang dipakai berkas Blangko Derry{jumlahBerkas ? ` (${jumlahBerkas} berkas)` : ""}. Isian yang dipakai blangko lain juga ikut berubah bila diubah di sini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input placeholder="Cari nama isian atau nomornya" value={cari} onChange={(e) => setCari(e.target.value)} />
            <NativeSelect value={jenis} onChange={(e) => setJenis(e.target.value)} className="sm:w-72">
              <option value="">Semua jenis</option>
              {jenisAda.map((j) => (
                <option key={j} value={j}>
                  {artiJenisVariabel(j)}
                </option>
              ))}
            </NativeSelect>
          </div>
          {!daftar && !galat ? <p className="text-sm text-muted-foreground">Membaca berkas Blangko Derry di server...</p> : null}
          <ul className="divide-y divide-border/60">
            {tampil.slice(0, 300).map((v) => (
              <li key={v.noVar} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="break-words font-medium">{v.judul}</p>
                  <p className="text-xs text-muted-foreground">
                    #{v.noVar}# · {artiJenisVariabel(v.jenis)} · {v.jumlahBlangko} blangko {v.dikunci ? "· dikunci ABT" : ""}
                  </p>
                </div>
                <Button size="sm" variant={buka === v.noVar ? "default" : "outline"} onClick={() => setBuka(v.noVar)}>
                  {buka === v.noVar ? "Sedang dibuka" : "Buka"}
                </Button>
              </li>
            ))}
          </ul>
          {tampil.length > 300 ? <p className="text-xs text-muted-foreground">Menampilkan 300 dari {tampil.length}; persempit pencarian.</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ===========================================================================
// Template tanya jawab
// ===========================================================================

type Kumpulan = { kode: string; nama: string; jenisPerkaraId: number[]; jumlah: number };

function BagianTemplat({ hakAwal }: { hakAwal: HakPengaturanAbt | null }) {
  const boleh = Boolean(hakAwal?.ubahTemplat);
  const [kumpulan, setKumpulan] = useState<Kumpulan[] | null>(null);
  const [kode, setKode] = useState("");
  const [asal, setAsal] = useState<BarisTemplat[] | null>(null);
  const [baris, setBaris] = useState<BarisTemplat[]>([]);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pratinjau, setPratinjau] = useState(false);
  const [segarkan, setSegarkan] = useState(0);

  useEffect(() => {
    void panggil<{ kumpulan: Kumpulan[] }>("/api/pengaturan-sipp-abt?bagian=templat")
      .then((d) => setKumpulan(d.kumpulan))
      .catch((e) => setGalat(e instanceof Error ? e.message : String(e)));
  }, [segarkan]);

  const muatIsi = useCallback(async (k: string) => {
    if (!k) return;
    try {
      const d = await panggil<{ templat: { baris: BarisTemplat[] } }>(`/api/pengaturan-sipp-abt?bagian=templat&kode=${encodeURIComponent(k)}`);
      setAsal(d.templat.baris);
      setBaris(d.templat.baris.map((b) => ({ tanya: b.tanya, jawab: b.jawab })));
      setGalat("");
      setPratinjau(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void muatIsi(kode), 0);
    return () => window.clearTimeout(t);
  }, [kode, muatIsi]);

  const berubah = asal !== null && (asal.length !== baris.length || asal.some((a, i) => a.tanya !== baris[i]?.tanya || a.jawab !== baris[i]?.jawab));
  const masalah = berubah ? periksaTemplat(baris) : [];

  function ubahBaris(i: number, isi: Partial<BarisTemplat>) {
    setBaris((b) => b.map((x, j) => (j === i ? { ...x, ...isi } : x)));
  }
  function geser(i: number, arah: -1 | 1) {
    setBaris((b) => {
      const j = i + arah;
      if (j < 0 || j >= b.length) return b;
      const salin = [...b];
      [salin[i], salin[j]] = [salin[j], salin[i]];
      return salin;
    });
  }

  async function simpan() {
    if (!asal) return;
    setSibuk(true);
    setGalat("");
    try {
      await kirim({ tindakan: "simpan-templat", kode, lama: asal.map((a) => ({ tanya: a.tanya, jawab: a.jawab })), baru: baris });
      setPesan("Tersimpan di ABT. Isi lama dicatat di riwayat dan dapat dikembalikan.");
      setSegarkan((x) => x + 1);
      await muatIsi(kode);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Template tanya jawab ABT</CardTitle>
          <CardDescription>
            Daftar pertanyaan yang dimuat petugas di ABT (mis. pertanyaan saksi). Tanda seperti #0046# di jawaban diganti nama pihak saat dimuat. Template
            tidak dapat dihapus dari sini.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!boleh ? <Pesan jenis="info">Hanya Super Admin dan Admin yang dapat mengubah template.</Pesan> : null}
          {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
          {pesan ? <Pesan jenis="berhasil">{pesan}</Pesan> : null}
          <NativeSelect
            value={kode}
            onChange={(e) => {
              setKode(e.target.value);
              setAsal(null);
              setPesan("");
            }}
          >
            <option value="">Pilih template...</option>
            {(kumpulan ?? []).map((k) => (
              <option key={k.kode} value={k.kode}>
                {k.nama} ({k.jumlah} pertanyaan)
              </option>
            ))}
          </NativeSelect>
          {kode && asal ? (
            <div className="space-y-2">
              {baris.map((b, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-border/70 p-2 md:grid-cols-[2.5rem_1fr_1fr_auto]">
                  <span className="pt-2 text-sm text-muted-foreground">{i + 1}.</span>
                  <Textarea rows={2} aria-label={`Pertanyaan ${i + 1}`} value={b.tanya} disabled={!boleh} onChange={(e) => ubahBaris(i, { tanya: e.target.value })} />
                  <Textarea rows={2} aria-label={`Jawaban awal ${i + 1}`} value={b.jawab} disabled={!boleh} onChange={(e) => ubahBaris(i, { jawab: e.target.value })} />
                  {boleh ? (
                    <div className="flex gap-1 md:flex-col">
                      <Button size="sm" variant="ghost" aria-label="Naikkan" onClick={() => geser(i, -1)}>
                        ▲
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Turunkan" onClick={() => geser(i, 1)}>
                        ▼
                      </Button>
                      <Button size="sm" variant="ghost" aria-label="Buang pertanyaan" onClick={() => setBaris((x) => x.filter((_, j) => j !== i))}>
                        ✕
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
              {boleh ? (
                <Button size="sm" variant="outline" onClick={() => setBaris((x) => [...x, { tanya: "", jawab: "" }])}>
                  Tambah pertanyaan
                </Button>
              ) : null}
            </div>
          ) : null}
          {berubah ? (
            <div className="sticky bottom-3 z-10 space-y-2 rounded-2xl border border-amber-400 bg-card p-3 shadow-lg">
              <p className="text-sm font-medium">Belum disimpan: {ringkasBedaTemplat(asal ?? [], baris)}</p>
              {masalah.map((m) => (
                <p key={m} className="text-sm text-rose-700">
                  {m}
                </p>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setPratinjau(!pratinjau)}>
                  {pratinjau ? "Sembunyikan beda" : "Lihat beda"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setBaris((asal ?? []).map((a) => ({ tanya: a.tanya, jawab: a.jawab })))}>
                  Buang rancangan
                </Button>
                <Button size="sm" disabled={sibuk || masalah.length > 0 || !boleh} onClick={() => void simpan()}>
                  {sibuk ? "Menyimpan ke ABT..." : "Simpan ke ABT"}
                </Button>
              </div>
              {pratinjau ? (
                <ul className="max-h-72 space-y-1 overflow-auto text-sm">
                  {Array.from({ length: Math.max(asal?.length ?? 0, baris.length) }).map((_, i) => {
                    const a = asal?.[i];
                    const b = baris[i];
                    if (a && b && a.tanya === b.tanya && a.jawab === b.jawab) return null;
                    return (
                      <li key={i} className="rounded-lg border border-border/60 p-2">
                        <p className="font-medium">Nomor {i + 1}</p>
                        {a ? <p className="break-words text-rose-700 line-through dark:text-rose-300">{a.tanya} — {a.jawab}</p> : null}
                        {b ? <p className="break-words text-emerald-700 dark:text-emerald-300">{b.tanya} — {b.jawab}</p> : <p className="text-muted-foreground">(dibuang)</p>}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
      {kode ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat template ini</CardTitle>
          </CardHeader>
          <CardContent>
            <DaftarRiwayat jenis="templat" kunci={kode} bolehKembalikan={() => boleh} segarkan={segarkan} sesudahKembalikan={() => void muatIsi(kode)} />
          </CardContent>
        </Card>
      ) : null}
      <SetSaksiAleta />
    </div>
  );
}

// ===========================================================================
// Halaman
// ===========================================================================

const BAGIAN: Array<[Bagian, string]> = [
  ["menu", "Hak menu & saklar"],
  ["variabel", "Isian blangko"],
  ["templat", "Template tanya jawab"],
  ["riwayat", "Riwayat semua"],
];

export function PengaturanSippAbt({ roleId }: { roleId: string }) {
  const [bagian, setBagian] = useState<Bagian>("menu");
  const [noVarAwal, setNoVarAwal] = useState("");
  const [segarkan, setSegarkan] = useState(0);
  // Hanya untuk tampilan; rute memeriksa ulang dari akun yang masuk.
  const hak = useMemo(() => hakPengaturanAbt(roleId), [roleId]);

  // Tautan "Edit variabel ini" dari Blangko ABT by Derry Briantono:
  // /admin/pengaturan-sipp-abt?bagian=variabel&noVar=NNNN
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        const q = new URLSearchParams(window.location.search);
        const b = q.get("bagian");
        if (b === "menu" || b === "variabel" || b === "templat" || b === "riwayat") setBagian(b);
        const n = (q.get("noVar") ?? "").replace(/\D/g, "").slice(0, 5);
        if (n) {
          setNoVarAwal(n.padStart(4, "0"));
          setBagian("variabel");
        }
      } catch {
        // Tanpa alamat - bagian bawaan.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <PageIntro
        eyebrow="Pengaturan"
        title="Pengaturan SIPP & ABT"
        description="Hak menu ABT untuk Blangko Derry, saklar kebijakan, isian blangko, dan template tanya jawab. Setiap simpan langsung berlaku di ABT, dicatat, dan dapat dikembalikan."
      />
      <div role="tablist" aria-label="Bagian pengaturan" className="flex flex-wrap gap-2">
        {BAGIAN.map(([k, t]) => (
          <Button key={k} role="tab" aria-selected={bagian === k} variant={bagian === k ? "default" : "outline"} size="sm" onClick={() => setBagian(k)}>
            {t}
          </Button>
        ))}
      </div>
      {bagian === "menu" ? <BagianMenu hakAwal={hak} /> : null}
      {bagian === "variabel" ? <BagianVariabel hakAwal={hak} noVarAwal={noVarAwal} /> : null}
      {bagian === "templat" ? <BagianTemplat hakAwal={hak} /> : null}
      {bagian === "riwayat" ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat semua perubahan</CardTitle>
            <CardDescription>Siapa mengubah apa dan kapan. Kembalikan hanya berhasil bila isi ABT belum diubah lagi sesudahnya.</CardDescription>
          </CardHeader>
          <CardContent>
            <DaftarRiwayat
              bolehKembalikan={(s) => (s.jenis === "menu" ? hak.ubahMenu : s.jenis === "variabel" ? hak.ubahBawaan : hak.ubahTemplat)}
              segarkan={segarkan}
              sesudahKembalikan={() => setSegarkan((x) => x + 1)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
