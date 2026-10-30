"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HukumAcaraSatker, type KeadaanHukumAcara } from "@/components/portal/hukum-acara-satker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { KOLOM_IDENTITAS, ZONA_WAKTU, gantiKodeSurat, type IdentitasSatker } from "@/lib/identitas-satker";
import type { HakPengaturanAbt } from "@/lib/pengaturan-abt";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import { isianMemuatAleta, peringatanTandaAleta } from "@/lib/tanda-aleta";

/**
 * Pengaturan SIPP & ABT > Identitas satker (17 Okt 2026, keputusan butir 3/4/7).
 *
 * 1. Identitas satker disimpan di ALETA (tidak menyentuh ABT/SIPP).
 * 2. "Terapkan ke ABT" - isian yang dicentang saja; tiap isian dicatat dan
 *    dapat dikembalikan dari riwayat di bawahnya.
 * 3. Logo kop - pindai gambar di blangko Derry, pilih yang diganti, bangun
 *    paket; paket dipasang petugas server (folder blangko hanya-baca bagi ALETA).
 */

type LogoSatker = { ada: boolean; jenis: string; md5: string; lebar: number; tinggi: number };
type ButirRencana = { kunci: string; noVar: string; nilaiAbt: string; nilaiAleta: string; perlu: boolean; bisa: boolean; sebab: string };
type DataSatker = {
  identitas: IdentitasSatker;
  logo: LogoSatker;
  tersimpan: boolean;
  diubahOleh: string;
  diubahPada: string;
  saran: IdentitasSatker | null;
  sipp: { kodePN: string; namaPN: string; namaPT: string; alamatPN: string; zonaWaktu: string } | null;
  abt: Array<{ noVar: string; ada: boolean; nama: string; nilai: string; bentukSatker: boolean }>;
  rencana: ButirRencana[];
  hukumAcara?: KeadaanHukumAcara | null;
  galatAbt: string;
};
type GambarBlangko = {
  md5: string;
  blip: string;
  jenis: string;
  ukuranByte: number;
  lebar: number;
  tinggi: number;
  jumlah: number;
  jumlahBerkas: number;
  berkas: string[];
  nama: string[];
  peran: string[];
  kotakElektronik: boolean;
  logo: boolean;
  alasanLogo: string;
};
type HasilPaket = { paket: { nama: string; folderServer: string; jumlahBerkas: number; jumlahGambar: number; berkas: Array<{ rel: string; gambar: number }> } };

const ALAMAT = "/api/pengaturan-sipp-abt";

async function panggil<T>(alamat: string, init?: RequestInit): Promise<T> {
  const r = await fetch(apiPath(alamat), { cache: "no-store", ...init });
  const isi = (await r.json().catch(() => null)) as { ok?: boolean; data?: T } | null;
  if (!r.ok || !isi || isi.ok === false) throw new Error(pesanGalatPortal(isi, `Permintaan gagal (HTTP ${r.status}).`));
  return isi.data as T;
}
const kirim = <T,>(badan: Record<string, unknown>) =>
  panggil<T>(ALAMAT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });

function Pesan({ jenis, children }: { jenis: "galat" | "berhasil" | "info" | "peringatan"; children: React.ReactNode }) {
  const warna =
    jenis === "galat"
      ? "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
      : jenis === "peringatan"
        ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
        : jenis === "berhasil"
        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
        : "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200";
  return <div className={`rounded-xl border px-3 py-2 text-sm ${warna}`}>{children}</div>;
}

const LABEL_RENCANA: Record<string, string> = {
  alamat: "Alamat kantor",
  telepon: "Telepon/WA",
  laman: "Laman",
  surel: "Surel",
  kodeSurat: "Kode surat di nomor surat bawaan",
};

/** Sebutan isian identitas untuk peringatan kata ALETA (17 Okt 2026). */
function peringatanAletaIdentitas(isian: IdentitasSatker): string {
  const label = (k: string) => (k === "kodeSatker" ? "Kode satker SIPP" : (KOLOM_IDENTITAS.find((x) => x.kunci === k)?.label ?? k));
  return peringatanTandaAleta(isianMemuatAleta(isian as unknown as Record<string, unknown>, label));
}

const bacaBerkas = (f: File) =>
  new Promise<string>((ok, gagal) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result || ""));
    r.onerror = () => gagal(new Error("Berkas tidak terbaca."));
    r.readAsDataURL(f);
  });

export function BagianIdentitasSatker({ hak, riwayat }: { hak: HakPengaturanAbt; riwayat: (segarkan: number, sesudah: () => void) => React.ReactNode }) {
  const [data, setData] = useState<DataSatker | null>(null);
  const [isian, setIsian] = useState<IdentitasSatker | null>(null);
  const [logoBaru, setLogoBaru] = useState<string>("");
  const [galat, setGalat] = useState("");
  const [berhasil, setBerhasil] = useState("");
  const [sibuk, setSibuk] = useState("");
  const [pilihTerapkan, setPilihTerapkan] = useState<Record<string, boolean>>({});
  const [hasilTerapkan, setHasilTerapkan] = useState<Array<{ kunci: string; noVar: string; ok: boolean; dilewati?: boolean; pesan: string }> | null>(null);
  const [segarkan, setSegarkan] = useState(0);
  const boleh = hak.ubahBawaan;

  const muat = useCallback(async () => {
    try {
      const d = await panggil<DataSatker>(`${ALAMAT}?bagian=satker`);
      setData(d);
      setIsian(d.identitas);
      // Bawaan centang: isian yang berbeda - kecuali kode surat (disetujui tegas di layar).
      setPilihTerapkan(Object.fromEntries(d.rencana.map((r) => [r.kunci, r.perlu && r.bisa && r.kunci !== "kodeSurat"])));
      setGalat("");
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const berubah = useMemo(() => Boolean(data && isian && (JSON.stringify(isian) !== JSON.stringify(data.identitas) || !data.tersimpan || logoBaru)), [data, isian, logoBaru]);

  async function simpan(tambahan: Record<string, unknown> = {}) {
    if (!isian) return;
    setSibuk("simpan");
    setGalat("");
    setBerhasil("");
    try {
      await kirim({ tindakan: "simpan-satker", identitas: isian, ...(logoBaru ? { logoBase64: logoBaru } : {}), ...tambahan });
      setLogoBaru("");
      await muat();
      const catatanAleta = peringatanAletaIdentitas(isian);
      setBerhasil(
        `Identitas satker tersimpan di ALETA. ABT belum diubah - gunakan Terapkan ke ABT di bawah.${catatanAleta ? ` ${catatanAleta}` : ""}`
      );
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  async function terapkan() {
    const kunci = Object.entries(pilihTerapkan)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!kunci.length) return;
    setSibuk("terapkan");
    setGalat("");
    setBerhasil("");
    try {
      const h = await kirim<{ hasil: NonNullable<typeof hasilTerapkan> }>({ tindakan: "terapkan-satker", kunci });
      setHasilTerapkan(h.hasil);
      await muat();
      setSegarkan((x) => x + 1);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  async function pilihLogo(f: File | undefined) {
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      setGalat("Logo lebih dari 4 MB - pilih berkas yang lebih kecil.");
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) {
      setGalat("Logo harus PNG, JPG, atau WebP.");
      return;
    }
    setGalat("");
    setLogoBaru(await bacaBerkas(f));
  }

  if (galat && !data) return <Pesan jenis="galat">{galat}</Pesan>;
  if (!data || !isian) return <p className="text-sm text-muted-foreground">Memuat identitas satker...</p>;

  const sipp = data.sipp;
  const beda = (a: string, b: string) => Boolean(a && b && a.trim().toLowerCase() !== b.trim().toLowerCase());
  const keteranganSipp: Partial<Record<keyof IdentitasSatker, string>> = sipp
    ? { namaPengadilan: sipp.namaPN, pengadilanTinggi: sipp.namaPT, zonaWaktu: sipp.zonaWaktu }
    : {};
  const peringatanAleta = peringatanAletaIdentitas(isian);
  const srcLogo = logoBaru || (data.logo.ada ? apiPath(`${ALAMAT}?bagian=satker-logo&v=${data.logo.md5}`) : "");

  return (
    <div className="space-y-4">
      {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
      {berhasil ? <Pesan jenis="berhasil">{berhasil}</Pesan> : null}
      {data.galatAbt ? <Pesan jenis="info">Keadaan ABT/SIPP belum terbaca: {data.galatAbt}</Pesan> : null}

      <Card>
        <CardHeader>
          <CardTitle>Identitas satker</CardTitle>
          <CardDescription>
            Dipakai kop dan isi blangko Derry. SIPP tidak menyimpan telepon, laman, surel, dan logo - isinya diatur di sini.
            {data.tersimpan ? ` Terakhir diubah ${data.diubahOleh || "-"}.` : " Belum pernah disimpan - isian di bawah diambil dari SIPP dan ABT sekarang."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Kode satker SIPP</span>
              <Input value={isian.kodeSatker} disabled={!boleh} onChange={(e) => setIsian({ ...isian, kodeSatker: e.target.value })} placeholder="PA.Dgl" />
              {sipp && beda(isian.kodeSatker, sipp.kodePN) ? <span className="text-xs text-rose-700 dark:text-rose-300">Berbeda dengan SIPP ({sipp.kodePN}).</span> : null}
            </label>
            {KOLOM_IDENTITAS.map((k) => (
              <label key={k.kunci} className={`space-y-1 text-sm ${k.kunci === "alamat" ? "md:col-span-2" : ""}`}>
                <span className="font-medium">{k.label}</span>
                {k.kunci === "zonaWaktu" ? (
                  <NativeSelect value={isian.zonaWaktu} disabled={!boleh} onChange={(e) => setIsian({ ...isian, zonaWaktu: e.target.value })}>
                    <option value="">-</option>
                    {ZONA_WAKTU.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </NativeSelect>
                ) : k.kunci === "alamat" ? (
                  <Textarea rows={2} value={isian.alamat} disabled={!boleh} maxLength={k.batas} onChange={(e) => setIsian({ ...isian, alamat: e.target.value })} placeholder={k.contoh} />
                ) : (
                  <Input value={isian[k.kunci]} disabled={!boleh} maxLength={k.batas} onChange={(e) => setIsian({ ...isian, [k.kunci]: e.target.value })} placeholder={k.contoh} />
                )}
                {keteranganSipp[k.kunci] !== undefined ? (
                  <span className={`block text-xs ${beda(isian[k.kunci], keteranganSipp[k.kunci] ?? "") ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>
                    Kop blangko mengambil ini dari SIPP: {keteranganSipp[k.kunci] || "(kosong)"}
                    {beda(isian[k.kunci], keteranganSipp[k.kunci] ?? "") ? " - berbeda; ubah di SIPP bila perlu." : ""}
                  </span>
                ) : null}
              </label>
            ))}
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-border/70 p-3 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/60 bg-white">
              {srcLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={srcLogo} alt="Logo satker" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">Belum ada logo</span>
              )}
            </div>
            <div className="min-w-0 space-y-2 text-sm">
              <p className="font-medium">Logo kop</p>
              <p className="text-muted-foreground">
                {logoBaru
                  ? "Logo baru belum disimpan."
                  : data.logo.ada
                    ? `PNG ${data.logo.lebar}x${data.logo.tinggi} piksel.`
                    : "Unggah logo satker, atau pakai logo yang sudah ada di blangko (bagian Logo kop blangko di bawah)."}
              </p>
              {boleh ? (
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    Pilih gambar...
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => void pilihLogo(e.target.files?.[0])} />
                  </label>
                  {logoBaru ? (
                    <Button size="sm" variant="outline" onClick={() => setLogoBaru("")}>
                      Batal
                    </Button>
                  ) : data.logo.ada ? (
                    <Button size="sm" variant="outline" disabled={Boolean(sibuk)} onClick={() => void simpan({ hapusLogo: true })}>
                      Hapus logo
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {peringatanAleta ? <Pesan jenis="peringatan">{peringatanAleta}</Pesan> : null}

          {boleh ? (
            <div className="flex flex-wrap gap-2">
              <Button disabled={!berubah || Boolean(sibuk)} onClick={() => void simpan()}>
                {sibuk === "simpan" ? "Menyimpan..." : "Simpan di ALETA"}
              </Button>
              {data.saran ? (
                <Button variant="outline" disabled={Boolean(sibuk)} onClick={() => setIsian({ ...data.saran!, kodeSatker: data.saran!.kodeSatker })}>
                  Isi dari SIPP & ABT sekarang
                </Button>
              ) : null}
              {data.tersimpan ? (
                <Button variant="ghost" disabled={Boolean(sibuk)} onClick={() => setIsian(data.identitas)}>
                  Batalkan perubahan
                </Button>
              ) : null}
            </div>
          ) : (
            <Pesan jenis="info">Hanya Super Admin dan Admin yang dapat mengubah identitas satker.</Pesan>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Terapkan ke ABT</CardTitle>
          <CardDescription>
            Mengisi isian satker {isian.kodeSatker || sipp?.kodePN || ""} di variabel blangko (#9271# alamat, #9272# telepon/WA, #9273# laman, #9274# surel; baris kontak kop #9275# ikut otomatis). Hanya yang dicentang; tiap isian dicatat dan dapat dikembalikan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data.tersimpan ? <Pesan jenis="info">Simpan identitas satker di ALETA dulu.</Pesan> : null}
          {data.rencana.length ? (
            <ul className="space-y-2">
              {data.rencana.map((r) => {
                const kodeSuratBaru = (() => {
                  if (r.kunci !== "kodeSurat" || !r.bisa) return "";
                  try {
                    return gantiKodeSurat(r.nilaiAbt, r.nilaiAleta);
                  } catch {
                    return "";
                  }
                })();
                return (
                  <li key={r.kunci} className="flex items-start gap-3 rounded-xl border border-border/70 p-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1"
                      aria-label={`Terapkan ${LABEL_RENCANA[r.kunci]}`}
                      checked={Boolean(pilihTerapkan[r.kunci])}
                      disabled={!boleh || !r.bisa || !r.perlu || Boolean(sibuk)}
                      onChange={(e) => setPilihTerapkan((x) => ({ ...x, [r.kunci]: e.target.checked }))}
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{LABEL_RENCANA[r.kunci]}</span>
                        <Badge variant="muted">#{r.noVar}#</Badge>
                        {!r.bisa ? <Badge variant="warning">tidak dapat diterapkan</Badge> : r.perlu ? <Badge variant="info">berbeda</Badge> : <Badge variant="success">sudah sama</Badge>}
                      </div>
                      {r.kunci === "kodeSurat" ? (
                        <p className="break-words text-muted-foreground">
                          ABT sekarang: <code>{r.nilaiAbt || "(kosong)"}</code>
                          {kodeSuratBaru && r.perlu ? (
                            <>
                              {" "}
                              menjadi <code>{kodeSuratBaru}</code>
                            </>
                          ) : null}
                        </p>
                      ) : (
                        <p className="break-words text-muted-foreground">
                          ABT sekarang: {r.nilaiAbt || "(kosong)"}
                          {r.perlu ? ` - menjadi: ${r.nilaiAleta || "(kosong, kembali ke data SIPP)"}` : ""}
                        </p>
                      )}
                      {r.sebab ? <p className="text-amber-700 dark:text-amber-300">{r.sebab}</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
          {boleh && data.rencana.length ? (
            <Button disabled={Boolean(sibuk) || !Object.values(pilihTerapkan).some(Boolean)} onClick={() => void terapkan()}>
              {sibuk === "terapkan" ? "Menerapkan..." : "Terapkan yang dicentang ke ABT"}
            </Button>
          ) : null}
          {hasilTerapkan ? (
            <ul className="space-y-1 text-sm">
              {hasilTerapkan.map((h) => (
                <li key={h.kunci} className={h.ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                  {LABEL_RENCANA[h.kunci]} (#{h.noVar}#): {h.pesan}
                </li>
              ))}
            </ul>
          ) : null}
          <details className="rounded-xl border border-border/70 p-3">
            <summary className="cursor-pointer text-sm font-medium">Riwayat identitas satker di ABT</summary>
            <div className="mt-3">{riwayat(segarkan, () => void muat())}</div>
          </details>
        </CardContent>
      </Card>

      <HukumAcaraSatker
        keadaan={data.hukumAcara ?? null}
        bolehUbah={hak.ubahKueri}
        sesudah={() => {
          void muat();
          setSegarkan((x) => x + 1);
        }}
      />

      <LogoKopBlangko boleh={boleh} adaLogo={data.logo.ada} sesudahPakai={() => void muat()} />

      <Card>
        <CardHeader>
          <CardTitle>Mode tanda tangan elektronik</CardTitle>
          <CardDescription>Berlaku untuk penetapan PMH/PPP/PJS/PHS yang dicetak atau diunggah lewat ALETA.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Blangko PTSP (@ 0, @ 1, @ 2) tetap memuat gambar cap dan tanda tangan untuk cetak biasa dari ABT. Bila dicetak/diunggah lewat ALETA, gambar
            cap/tanda tangan itu <strong>selalu dibuang</strong> dari blok tanda tangan, lalu diganti tanda tangan pejabat yang sudah disahkan di ALETA
            (dan cap di atasnya bila diatur). Bagian yang memakai kotak &quot;Ditandatangani secara elektronik oleh: ...&quot; (PPP dan PJS di @ 0) dipakai
            apa adanya beserta logonya - tidak ditempeli gambar tanda tangan.
          </p>
          <p className="text-muted-foreground">
            Sertifikat TTE (passphrase) hanya dikerjakan bila penyedia TTE disetel di server. Pengaturan per jenis ada di ALETA e-Court &gt; Peta penetapan.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LogoKopBlangko({ boleh, adaLogo, sesudahPakai }: { boleh: boolean; adaLogo: boolean; sesudahPakai: () => void }) {
  const [pindai, setPindai] = useState<{ jumlahBerkas: number; gambar: GambarBlangko[] } | null>(null);
  const [pilih, setPilih] = useState<Record<string, boolean>>({});
  const [sibuk, setSibuk] = useState("");
  const [galat, setGalat] = useState("");
  const [paket, setPaket] = useState<HasilPaket["paket"] | null>(null);
  const [yakin, setYakin] = useState(false);

  async function mulaiPindai() {
    setSibuk("pindai");
    setGalat("");
    try {
      const h = await panggil<{ jumlahBerkas: number; gambar: GambarBlangko[] }>(`${ALAMAT}?bagian=logo-pindai`);
      setPindai(h);
      setPilih(Object.fromEntries(h.gambar.map((g) => [g.md5, g.logo])));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  async function pakai(md5: string) {
    setSibuk(`pakai-${md5}`);
    setGalat("");
    try {
      await kirim({ tindakan: "logo-dari-blangko", md5 });
      sesudahPakai();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  async function bangun() {
    const md5 = Object.entries(pilih)
      .filter(([, v]) => v)
      .map(([k]) => k);
    setSibuk("paket");
    setGalat("");
    try {
      const h = await kirim<HasilPaket>({ tindakan: "paket-logo-kop", md5 });
      setPaket(h.paket);
      setYakin(false);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally {
      setSibuk("");
    }
  }

  const terpilih = Object.values(pilih).filter(Boolean).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logo kop blangko</CardTitle>
        <CardDescription>
          Logo ada di dalam berkas RTF blangko Derry (amplop relaas, permohonan delegasi, surat tercatat, kotak tanda tangan elektronik PTSP). Folder
          blangko di server hanya dapat DIBACA ALETA, jadi penggantian dibuat sebagai paket - dengan cadangan dan pemulihan - lalu dipasang petugas server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {galat ? <Pesan jenis="galat">{galat}</Pesan> : null}
        <Button variant="outline" disabled={Boolean(sibuk)} onClick={() => void mulaiPindai()}>
          {sibuk === "pindai" ? "Memindai blangko..." : pindai ? "Pindai ulang" : "Pindai gambar di blangko Derry"}
        </Button>
        {pindai ? (
          <>
            <p className="text-sm text-muted-foreground">
              {pindai.jumlahBerkas} blangko, {pindai.gambar.length} gambar berbeda. Yang ditandai logo sudah dicentang; periksa sebelum membangun paket.
            </p>
            <ul className="grid gap-2 md:grid-cols-2">
              {pindai.gambar.map((g) => (
                <li key={g.md5} className={`flex gap-3 rounded-xl border p-3 text-sm ${pilih[g.md5] ? "border-primary/50 bg-primary/5" : "border-border/70"}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    aria-label={`Ganti gambar ${g.md5.slice(0, 8)}`}
                    checked={Boolean(pilih[g.md5])}
                    disabled={!boleh || Boolean(sibuk)}
                    onChange={(e) => setPilih((x) => ({ ...x, [g.md5]: e.target.checked }))}
                  />
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-white">
                    {g.jenis ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={apiPath(`${ALAMAT}?bagian=logo-blangko&md5=${g.md5}`)} alt="" loading="lazy" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="px-1 text-center text-[10px] text-muted-foreground">{g.blip.toUpperCase() || "?"} (cadangan Word lama)</span>
                    )}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-1">
                      {g.logo ? <Badge variant="info">logo</Badge> : null}
                      {g.kotakElektronik ? <Badge variant="netral">kotak TTD elektronik</Badge> : null}
                      <span className="text-muted-foreground">
                        {g.lebar}x{g.tinggi}, {g.jumlahBerkas} blangko
                      </span>
                    </div>
                    {g.alasanLogo ? <p className="text-xs text-muted-foreground">{g.alasanLogo}</p> : null}
                    <p className="truncate text-xs text-muted-foreground" title={g.berkas.join("\n")}>
                      {g.berkas.slice(0, 2).join("; ")}
                      {g.jumlahBerkas > 2 ? ` dan ${g.jumlahBerkas - 2} lagi` : ""}
                    </p>
                    {boleh && g.jenis ? (
                      <Button size="sm" variant="ghost" className="h-7 px-2" disabled={Boolean(sibuk)} onClick={() => void pakai(g.md5)}>
                        {sibuk === `pakai-${g.md5}` ? "Memakai..." : "Jadikan logo satker"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
            {boleh ? (
              yakin ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">Bangun paket untuk {terpilih} gambar terpilih? Blangko belum berubah sampai paket dipasang.</span>
                  <Button disabled={Boolean(sibuk)} onClick={() => void bangun()}>
                    {sibuk === "paket" ? "Membangun..." : "Ya, bangun paket"}
                  </Button>
                  <Button variant="outline" onClick={() => setYakin(false)}>
                    Batal
                  </Button>
                </div>
              ) : (
                <Button disabled={!terpilih || !adaLogo || Boolean(sibuk)} onClick={() => setYakin(true)}>
                  Bangun paket ganti logo kop
                </Button>
              )
            ) : null}
            {!adaLogo ? <p className="text-sm text-amber-700 dark:text-amber-300">Simpan logo satker dulu (unggah atau &quot;Jadikan logo satker&quot;).</p> : null}
          </>
        ) : null}
        {paket ? (
          <Pesan jenis="berhasil">
            <p>
              Paket <strong>{paket.nama}</strong> siap: {paket.jumlahBerkas} blangko, {paket.jumlahGambar} gambar. Pasang di server (root):
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-background/70 p-2 text-xs">{`bash ${paket.folderServer}/pasang.sh\n# kembalikan: bash ${paket.folderServer}/pulih.sh`}</pre>
          </Pesan>
        ) : null}
      </CardContent>
    </Card>
  );
}
