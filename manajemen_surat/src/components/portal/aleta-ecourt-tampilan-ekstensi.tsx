"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Tampilan ekstensi - menerapkan Lama / Baru / UI Baru dan saklar fitur yang
 * dicoba Super Admin kepada pegawai lain.
 *
 * ============================================================================
 * DAFTAR FITUR, PERAN, DAN MODE DIBACA DARI SERVER
 * ============================================================================
 *
 * Pelajaran dari layar Akses ekstensi: daftar yang diketik di komponen
 * tertinggal diam-diam ketika server bertambah. Seratus dua puluh saklar,
 * bagiannya, peran, dan pilihan mode semuanya datang dari jawaban GET -
 * berkas ini tidak memuat satu pun kode fitur.
 *
 * ============================================================================
 * RINGKASAN DIHITUNG SERVER DENGAN ATURAN YANG SAMA DENGAN EKSTENSI
 * ============================================================================
 *
 * "Siapa mendapat apa" tidak ditebak di layar dari daftar penerapan. Server
 * menghitungnya per pegawai dengan pecahkanTampilan - fungsi yang sama yang
 * menjawab ekstensi - sehingga yang tertulis di sini adalah yang sungguh
 * diterima ekstensi orang itu.
 */

type Mode = "lama" | "baru" | "ui";
type Lingkup = "semua" | "peran" | "pengguna";

type Fitur = { kode: string; bagian: string; nomor: number; jenis: string; judul: string; perluKeputusan: boolean };

type Penerapan = {
  lingkup: Lingkup;
  sasaran: string;
  mode: Mode;
  fitur: Record<string, true>;
  catatan: string;
  diubahOleh: string;
  diubahPada: string;
  labelSasaran: string;
  labelMode: string;
  jumlahFitur: number;
  sasaranAda: boolean;
};

type Pegawai = {
  userId: string;
  nama: string;
  username: string;
  labelPeran: string;
  mode: Mode;
  labelMode: string;
  sumber: string;
  labelSumber: string;
  jumlahFitur: number;
};

type HasilCari = { userId: string; nama: string; username: string; labelPeran: string; labelMode: string; labelSumber: string };

type Jawaban = {
  bolehMenyunting: boolean;
  penerapan: Penerapan[];
  peran: { roleId: string; label: string }[];
  bagian: Record<string, string>;
  daftarFitur: Fitur[];
  mode: { mode: Mode; label: string }[];
  ringkasan: { jumlah: Record<Mode, number>; pegawai: Pegawai[] };
  fiturDibuang?: string[];
};

const ALAMAT = "/api/aleta-ecourt/tampilan-ekstensi";

function waktuSingkat(iso: string) {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function AletaEcourtTampilanEkstensi() {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [tersembunyi, setTersembunyi] = useState(false);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);

  // Isian "Terapkan ke".
  const [lingkup, setLingkup] = useState<Lingkup>("semua");
  const [peranDipilih, setPeranDipilih] = useState("");
  const [orangDipilih, setOrangDipilih] = useState<{ userId: string; nama: string } | null>(null);
  const [mode, setMode] = useState<Mode>("baru");
  const [fitur, setFitur] = useState<Record<string, true>>({});
  const [catatan, setCatatan] = useState("");

  const [kataCari, setKataCari] = useState("");
  const [hasilCari, setHasilCari] = useState<HasilCari[]>([]);
  const [mencari, setMencari] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      // Bukan Super Admin atau Admin: kartu ini tidak digambar sama sekali,
      // sama seperti kartu Akses ekstensi bagi pegawai biasa.
      if (jawaban.status === 403) {
        setTersembunyi(true);
        return;
      }
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca tampilan ekstensi."));
      setData(isi?.data ?? isi);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca tampilan ekstensi.");
    } finally {
      setMemuat(false);
    }
  }, []);

  // Ditunda satu putaran, mengikuti pola kartu e-Court lain.
  useEffect(() => {
    const timer = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(timer);
  }, [muat]);

  const cari = useCallback(async () => {
    const bersih = kataCari.trim();
    if (bersih.length < 2) {
      setHasilCari([]);
      return;
    }
    setMencari(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath(ALAMAT + "?cari=" + encodeURIComponent(bersih)), { cache: "no-store" });
      const isi = await jawaban.json().catch(() => null);
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal mencari pegawai."));
      setHasilCari((isi?.data ?? isi)?.hasil ?? []);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal mencari pegawai.");
    } finally {
      setMencari(false);
    }
  }, [kataCari]);

  const kirim = useCallback(
    async (cara: "PUT" | "DELETE", badan: Record<string, unknown>, pesanBerhasil: string) => {
      setMenyimpan(true);
      setGalat("");
      setKabar("");
      try {
        const alamat =
          cara === "DELETE"
            ? ALAMAT +
              "?lingkup=" +
              encodeURIComponent(String(badan.lingkup)) +
              "&sasaran=" +
              encodeURIComponent(String(badan.sasaran ?? ""))
            : ALAMAT;
        const jawaban = await fetch(apiPath(alamat), {
          method: cara,
          headers: { "content-type": "application/json" },
          body: cara === "PUT" ? JSON.stringify(badan) : undefined,
        });
        const isi = await jawaban.json().catch(() => null);
        if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
        const baru = (isi?.data ?? isi) as Jawaban;
        // Memakai keadaan yang dikirim balik server, bukan menebak.
        setData(baru);
        const dibuang = baru.fiturDibuang ?? [];
        setKabar(dibuang.length ? pesanBerhasil + " Kode tidak dikenal dibuang: " + dibuang.join(", ") + "." : pesanBerhasil);
      } catch (kesalahan) {
        setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
      } finally {
        setMenyimpan(false);
      }
    },
    []
  );

  const sasaranSekarang = lingkup === "semua" ? "" : lingkup === "peran" ? peranDipilih : orangDipilih?.userId ?? "";
  const siapTerapkan = lingkup === "semua" || Boolean(sasaranSekarang);

  const penerapanSama = useMemo(
    () => data?.penerapan.find((p) => p.lingkup === lingkup && p.sasaran === sasaranSekarang) ?? null,
    [data, lingkup, sasaranSekarang]
  );

  const fiturPerBagian = useMemo(() => {
    const kelompok = new Map<string, Fitur[]>();
    for (const f of data?.daftarFitur ?? []) {
      const daftar = kelompok.get(f.bagian) ?? [];
      daftar.push(f);
      kelompok.set(f.bagian, daftar);
    }
    return [...kelompok.entries()];
  }, [data]);

  const jumlahMenyala = Object.keys(fitur).length;

  function aturFitur(kode: string, nyala: boolean) {
    setFitur((lama) => {
      const baru = { ...lama };
      if (nyala) baru[kode] = true;
      else delete baru[kode];
      return baru;
    });
  }

  function aturBagian(daftar: Fitur[], nyala: boolean) {
    setFitur((lama) => {
      const baru = { ...lama };
      for (const f of daftar) {
        if (nyala) baru[f.kode] = true;
        else delete baru[f.kode];
      }
      return baru;
    });
  }

  function sunting(p: Penerapan) {
    setLingkup(p.lingkup);
    if (p.lingkup === "peran") setPeranDipilih(p.sasaran);
    if (p.lingkup === "pengguna") setOrangDipilih({ userId: p.sasaran, nama: p.labelSasaran });
    setMode(p.mode);
    setFitur({ ...p.fitur });
    setCatatan(p.catatan);
    setKabar("Penerapan untuk " + p.labelSasaran + " dimuat ke isian di bawah. Ubah lalu tekan Terapkan.");
    document.getElementById("terapkan-tampilan-ekstensi")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (tersembunyi) return null;

  return (
    <Card id="tampilan-ekstensi" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Tampilan ekstensi</CardTitle>
        <CardDescription>
          Menerapkan tampilan ekstensi (Lama, Baru, atau UI Baru) beserta saklar fiturnya kepada semua pegawai, satu
          peran, atau satu orang. Tampilan yang diterapkan di sini BUKAN mode coba: pegawai yang menerimanya bekerja
          seperti biasa dan tulisannya tidak ditahan. Hanya Super Admin yang dapat menerapkan; Admin dapat membaca.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {galat ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            {galat}
          </p>
        ) : null}
        {kabar ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            {kabar}
          </p>
        ) : null}

        {memuat && !data ? (
          <p className="text-sm text-muted-foreground">Memuat tampilan ekstensi...</p>
        ) : !data ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Tampilan ekstensi belum dapat dibaca dari server.</p>
            <Button size="sm" variant="outline" onClick={() => void muat()}>
              Coba lagi
            </Button>
          </div>
        ) : (
          <>
            {!data.bolehMenyunting ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Anda dapat membaca pengaturan ini, tetapi hanya Super Admin yang dapat menerapkan atau menghapus
                tampilan.
              </p>
            ) : null}

            {/* ---------------------------------------------------------- */}
            {/* Siapa mendapat apa                                          */}
            {/* ---------------------------------------------------------- */}
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Siapa mendapat apa</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {data.mode.map((m) => (
                  <div key={m.mode} className="rounded-lg border bg-card p-3">
                    <p className="text-2xl font-semibold tabular-nums">{data.ringkasan.jumlah[m.mode] ?? 0}</p>
                    <p className="text-sm font-medium">pegawai memakai tampilan {m.label}</p>
                  </div>
                ))}
              </div>
              {data.mode.map((m) => {
                const orang = data.ringkasan.pegawai.filter((p) => p.mode === m.mode);
                if (orang.length === 0) return null;
                return (
                  <details key={m.mode} className="rounded-md border px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">
                      {m.label} - {orang.length} pegawai
                    </summary>
                    <ul className="mt-2 divide-y text-sm">
                      {orang.map((p) => (
                        <li key={p.userId} className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
                          <span>
                            <span className="font-medium">{p.nama}</span>{" "}
                            <span className="text-xs text-muted-foreground">({p.labelPeran})</span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {p.labelSumber}
                            {p.jumlahFitur ? " - " + p.jumlahFitur + " fitur menyala" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
              <p className="text-xs text-muted-foreground">
                Urutan yang berlaku: penerapan untuk orang itu sendiri, lalu untuk perannya (peran utama lebih dulu,
                lalu peran tambahan menurut urutan pada akunnya), lalu untuk semua pegawai. Tanpa penerapan apa pun,
                ekstensi memakai tampilan Lama.
              </p>
            </section>

            {/* ---------------------------------------------------------- */}
            {/* Daftar penerapan                                            */}
            {/* ---------------------------------------------------------- */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Penerapan yang tersimpan ({data.penerapan.length})</h3>
              {data.penerapan.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Belum ada tampilan yang diterapkan. Semua pegawai memakai tampilan Lama.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-3 font-medium">Diterapkan ke</th>
                        <th className="px-3 py-2 font-medium">Tampilan</th>
                        <th className="px-3 py-2 font-medium">Fitur menyala</th>
                        <th className="px-3 py-2 font-medium">Diubah</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {data.penerapan.map((p) => (
                        <tr key={p.lingkup + ":" + p.sasaran} className="border-b align-top last:border-0">
                          <td className="py-2 pr-3">
                            <span className="font-medium">{p.labelSasaran}</span>
                            {!p.sasaranAda ? (
                              <Badge variant="muted" className="ml-2 align-middle">
                                sasaran sudah tidak ada
                              </Badge>
                            ) : null}
                            {p.catatan ? <p className="mt-0.5 text-xs text-muted-foreground">{p.catatan}</p> : null}
                          </td>
                          <td className="px-3 py-2">{p.labelMode}</td>
                          <td className="px-3 py-2 tabular-nums">{p.mode === "lama" ? "-" : p.jumlahFitur}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{waktuSingkat(p.diubahPada)}</td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" disabled={!data.bolehMenyunting} onClick={() => sunting(p)}>
                                Ubah
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={!data.bolehMenyunting || menyimpan}
                                onClick={() => {
                                  if (!window.confirm("Hapus penerapan untuk " + p.labelSasaran + "? Mereka kembali mengikuti penerapan yang lebih luas.")) return;
                                  void kirim("DELETE", { lingkup: p.lingkup, sasaran: p.sasaran }, "Penerapan untuk " + p.labelSasaran + " dihapus.");
                                }}
                              >
                                Hapus
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ---------------------------------------------------------- */}
            {/* Terapkan ke                                                 */}
            {/* ---------------------------------------------------------- */}
            <section id="terapkan-tampilan-ekstensi" className="scroll-mt-24 space-y-4 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Terapkan ke</h3>

              <fieldset className="flex flex-wrap gap-4 text-sm" disabled={!data.bolehMenyunting}>
                {(
                  [
                    ["semua", "Semua pegawai"],
                    ["peran", "Satu peran"],
                    ["pengguna", "Satu orang"],
                  ] as const
                ).map(([nilai, label]) => (
                  <label key={nilai} className="flex items-center gap-2">
                    <input type="radio" name="lingkup-tampilan" checked={lingkup === nilai} onChange={() => setLingkup(nilai)} />
                    {label}
                  </label>
                ))}
              </fieldset>

              {lingkup === "peran" ? (
                <div className="max-w-sm space-y-1">
                  <label htmlFor="peran-tampilan" className="block text-xs font-medium text-muted-foreground">
                    Peran
                  </label>
                  <NativeSelect
                    id="peran-tampilan"
                    value={peranDipilih}
                    disabled={!data.bolehMenyunting}
                    onChange={(e) => setPeranDipilih(e.target.value)}
                  >
                    <option value="">- pilih peran -</option>
                    {data.peran.map((p) => (
                      <option key={p.roleId} value={p.roleId}>
                        {p.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              ) : null}

              {lingkup === "pengguna" ? (
                <div className="space-y-2">
                  {orangDipilih ? (
                    <p className="text-sm">
                      Dipilih: <span className="font-medium">{orangDipilih.nama}</span>{" "}
                      <Button size="sm" variant="ghost" onClick={() => setOrangDipilih(null)}>
                        Ganti
                      </Button>
                    </p>
                  ) : null}
                  <div className="flex max-w-md items-end gap-2">
                    <div className="flex-1 space-y-1">
                      <label htmlFor="cari-pegawai-tampilan" className="block text-xs font-medium text-muted-foreground">
                        Cari pegawai (nama atau nama pengguna)
                      </label>
                      <Input
                        id="cari-pegawai-tampilan"
                        value={kataCari}
                        disabled={!data.bolehMenyunting}
                        onChange={(e) => setKataCari(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void cari();
                        }}
                      />
                    </div>
                    <Button size="sm" onClick={() => void cari()} disabled={mencari || !data.bolehMenyunting}>
                      {mencari ? "Mencari..." : "Cari"}
                    </Button>
                  </div>
                  {hasilCari.length ? (
                    <ul className="max-w-xl divide-y rounded-md border text-sm">
                      {hasilCari.map((h) => (
                        <li key={h.userId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5">
                          <span>
                            <span className="font-medium">{h.nama}</span>{" "}
                            <span className="text-xs text-muted-foreground">
                              ({h.labelPeran}) - kini {h.labelMode}, {h.labelSumber.toLowerCase()}
                            </span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setOrangDipilih({ userId: h.userId, nama: h.nama + " (" + h.labelPeran + ")" });
                              setHasilCari([]);
                            }}
                          >
                            Pilih
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Tampilan</p>
                <div className="flex flex-wrap gap-2">
                  {data.mode.map((m) => (
                    <Button
                      key={m.mode}
                      size="sm"
                      variant={mode === m.mode ? "default" : "outline"}
                      disabled={!data.bolehMenyunting}
                      aria-pressed={mode === m.mode}
                      onClick={() => setMode(m.mode)}
                    >
                      {m.label}
                    </Button>
                  ))}
                </div>
                {mode === "lama" ? (
                  <p className="text-xs text-muted-foreground">
                    Tampilan Lama mematikan semua fitur baru, apa pun isi saklarnya.
                  </p>
                ) : null}
              </div>

              <details className="rounded-md border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">
                  Saklar fitur ({jumlahMenyala} dari {data.daftarFitur.length} menyala)
                </summary>
                <div className="mt-3 space-y-4">
                  {fiturPerBagian.map(([bagian, daftar]) => (
                    <div key={bagian} className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">
                          {data.bagian[bagian] ?? bagian}{" "}
                          <span className="text-xs font-normal text-muted-foreground">
                            ({daftar.filter((f) => fitur[f.kode]).length}/{daftar.length})
                          </span>
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="ghost" disabled={!data.bolehMenyunting} onClick={() => aturBagian(daftar, true)}>
                            Nyalakan semua
                          </Button>
                          <Button size="sm" variant="ghost" disabled={!data.bolehMenyunting} onClick={() => aturBagian(daftar, false)}>
                            Matikan semua
                          </Button>
                        </div>
                      </div>
                      <ul className="grid gap-1 sm:grid-cols-2">
                        {daftar.map((f) => (
                          <li key={f.kode} className="flex items-center justify-between gap-3 rounded border px-2 py-1 text-sm">
                            <span>
                              <span className="text-xs text-muted-foreground tabular-nums">{f.kode}</span> {f.judul}
                              {f.perluKeputusan ? (
                                <Badge variant="muted" className="ml-1 align-middle">
                                  perlu keputusan
                                </Badge>
                              ) : null}
                            </span>
                            <Switch
                              checked={Boolean(fitur[f.kode])}
                              disabled={!data.bolehMenyunting}
                              aria-label={f.kode + " - " + f.judul}
                              onCheckedChange={(nilai) => aturFitur(f.kode, nilai)}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </details>

              <div className="max-w-xl space-y-1">
                <label htmlFor="catatan-tampilan" className="block text-xs font-medium text-muted-foreground">
                  Catatan (tidak wajib) - mis. alasan atau tanggal uji
                </label>
                <Input
                  id="catatan-tampilan"
                  value={catatan}
                  maxLength={400}
                  disabled={!data.bolehMenyunting}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  disabled={!data.bolehMenyunting || !siapTerapkan || menyimpan}
                  onClick={() =>
                    void kirim(
                      "PUT",
                      { lingkup, sasaran: sasaranSekarang, mode, fitur: mode === "lama" ? {} : fitur, catatan },
                      "Tampilan diterapkan."
                    )
                  }
                >
                  {menyimpan ? "Menyimpan..." : penerapanSama ? "Terapkan (menimpa yang lama)" : "Terapkan"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Ekstensi pegawai mengikuti perubahan ini saat memuat ulang halaman SIPP, ABT, atau portal.
                </p>
              </div>
            </section>
          </>
        )}
      </CardContent>
    </Card>
  );
}
