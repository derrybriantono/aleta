"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  Boxes,
  Eraser,
  CircleAlert,
  CircleCheck,
  Library,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";

/**
 * Kemandirian blangko - layar admin (Tahap 0-7).
 *
 * ============================================================================
 * YANG DITAMPILKAN ADALAH KEADAAN, BUKAN TOMBOL
 * ============================================================================
 *
 * Empat tahap panjang ini punya satu kesamaan: masing-masing dapat berada
 * dalam keadaan "belum pernah dijalankan", dan dalam keadaan itu ALETA memang
 * belum berguna. Layar yang hanya menampilkan tombol membuat admin menekan
 * lalu menunggu tanpa tahu apa yang berubah.
 *
 * Karena itu tiap tab membuka dengan ANGKA keadaannya - berapa definisi yang
 * tersalin, berapa blangko yang dipelajari, berapa pergeseran yang menunggu
 * diputus - dan tombolnya menyusul di bawah.
 *
 * ============================================================================
 * YANG MENUNGGU MANUSIA DITAMPILKAN SEBAGAI PEKERJAAN, BUKAN PERINGATAN
 * ============================================================================
 *
 * 747 kelompok pergeseran bukan galat. Ia daftar pekerjaan: kalimat yang sama
 * yang terlanjur menyimpang selama bertahun-tahun, dan memilih mana yang
 * berlaku adalah pekerjaan hakim. Menampilkannya sebagai peringatan merah akan
 * membuatnya diabaikan; menampilkannya sebagai antrean membuatnya dikerjakan.
 */

type StatistikKamus = {
  jumlah: number;
  perKelas: { A: number; B: number; C: number };
  perJenis: Array<{ jenis: string; jumlah: number }>;
  penyalinanTerakhir: { keadaan: string; sebab: string; oleh: string; dijalankanAt: string; asalSkema: string } | null;
};

type StatistikKorpus = {
  jumlahBerkas: number;
  jumlahBlok: number;
  jumlahGeser: number;
  geserBelumDiputus: number;
  perJenis: Array<{ jenis: string; jumlah: number }>;
  selMatriks: number;
  pembelajaranTerakhir: { keadaan: string; sebab: string; oleh: string; dijalankanAt: string } | null;
};

type Pergeseran = {
  id: string;
  bentuk: string;
  jumlahVarian: number;
  varian: Array<{ sidik: string; teks: string; jumlahPakai: number }>;
};

type BlangkoAleta = {
  kode: string;
  nama: string;
  jenis: string;
  asal_abt: string;
  keadaan: string;
  versi: number;
};

/** Golongan dokumen yang punya saklar periksa sendiri. */
const GOLONGAN = ["relaas", "bas", "putusan", "kepaniteraan", "jinayat"];

type TemuanKelasC = {
  noVar: string;
  nama: string;
  sebab: string;
  jumlahPakai: number;
  blangko: string[];
};

async function ambil<T>(alamat: string): Promise<T | null> {
  try {
    const jawaban = await fetch(apiPath(alamat), { cache: "no-store" });
    if (!jawaban.ok) return null;
    return (await jawaban.json()) as T;
  } catch {
    return null;
  }
}

async function kirim<T>(alamat: string, badan: unknown): Promise<T | null> {
  try {
    const jawaban = await fetch(apiPath(alamat), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badan),
    });
    return (await jawaban.json()) as T;
  } catch {
    return null;
  }
}

function Angka({ nilai, label, warna }: { nilai: number | string; label: string; warna?: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className={`text-xl font-semibold tabular-nums ${warna ?? ""}`}>{nilai}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Pesan({ teks, baik }: { teks: string; baik?: boolean }) {
  if (!teks) return null;
  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
        baik
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
          : "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
      }`}
    >
      {baik ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <span>{teks}</span>
    </div>
  );
}

// ============================================================================
// Tahap 0 - Kamus variabel
// ============================================================================

function TabKamus() {
  const [statistik, setStatistik] = useState<StatistikKamus | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [cari, setCari] = useState("");
  const [temuan, setTemuan] = useState<Record<string, unknown> | null>(null);
  const [putaran, setPutaran] = useState(0);

  // Pemuatan ditaruh DI DALAM efek, bukan lewat useCallback, dan hasilnya
  // dibuang bila komponen sudah ditutup: jawaban yang datang terlambat ke
  // komponen yang sudah tidak ada akan menyetel keadaan yang tidak dilihat
  // siapa pun, dan pada tab yang berpindah cepat itu terjadi tiap kali.
  useEffect(() => {
    let batal = false;
    void (async () => {
      const jawaban = await ambil<{ statistik: StatistikKamus }>("/api/aleta-ecourt/kamus");
      if (!batal) setStatistik(jawaban?.statistik ?? null);
    })();
    return () => {
      batal = true;
    };
  }, [putaran]);

  const muat = () => setPutaran((n) => n + 1);

  const salin = async () => {
    setSibuk(true);
    setPesan("");
    const hasil = await kirim<{ ok: boolean; jumlahBaris: number; rekap: Record<string, number>; sebab: string }>(
      "/api/aleta-ecourt/kamus",
      { tindakan: "salin" }
    );
    setSibuk(false);
    if (!hasil) return setPesan("Penyalinan tidak terjawab.");
    setBaik(Boolean(hasil.ok));
    setPesan(
      hasil.ok
        ? `${hasil.jumlahBaris} definisi tersalin. Kelas A ${hasil.rekap?.A ?? 0}, B ${hasil.rekap?.B ?? 0}, C ${hasil.rekap?.C ?? 0}.`
        : hasil.sebab || "Penyalinan gagal."
    );
    muat();
  };

  const belumPernah = (statistik?.jumlah ?? 0) === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" /> Kamus variabel
          </CardTitle>
          <CardDescription>
            Salinan definisi variabel dari APS Badilag ke dalam ALETA. Salinan, bukan sambungan &mdash; sesudah
            tersalin, membaca definisi tidak menyentuh ABT sama sekali.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {belumPernah ? (
            <Pesan teks="Kamus belum pernah disalin. Sebelum disalin, ALETA tidak dapat mengartikan satu penanda pun." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Angka nilai={statistik?.jumlah ?? 0} label="definisi" />
              <Angka nilai={statistik?.perKelas.A ?? 0} label="Kelas A - mekanis" warna="text-emerald-600" />
              <Angka nilai={statistik?.perKelas.B ?? 0} label="Kelas B - butuh manusia" warna="text-amber-600" />
              <Angka nilai={statistik?.perKelas.C ?? 0} label="Kelas C - mati" warna="text-rose-600" />
            </div>
          )}

          {statistik?.penyalinanTerakhir ? (
            <p className="text-xs text-muted-foreground">
              Penyalinan terakhir {statistik.penyalinanTerakhir.keadaan} oleh {statistik.penyalinanTerakhir.oleh || "-"}
              {statistik.penyalinanTerakhir.asalSkema ? ` dari ${statistik.penyalinanTerakhir.asalSkema}` : ""}
              {statistik.penyalinanTerakhir.sebab ? ` - ${statistik.penyalinanTerakhir.sebab}` : ""}
            </p>
          ) : null}

          <Pesan teks={pesan} baik={baik} />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={salin} disabled={sibuk} size="sm">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {belumPernah ? "Salin kamus dari ABT" : "Salin ulang"}
            </Button>
            <span className="text-xs text-muted-foreground">Hanya membaca APS Badilag. Tidak pernah menulis ke sana.</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arti sebuah penanda</CardTitle>
          <CardDescription>
            Panitera yang melihat <code>#6034#</code> tertinggal di naskahnya berhak tahu bahwa yang diminta adalah
            jabatan panitera, bukan namanya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={cari}
              onChange={(e) => setCari(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))}
              placeholder="Nomor penanda, misalnya 6034"
              className="max-w-56"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const jawaban = await ambil<{ ada: boolean; variabel?: Record<string, unknown>; sebab?: string }>(
                  `/api/aleta-ecourt/kamus?noVar=${encodeURIComponent(cari)}`
                );
                setTemuan(jawaban?.ada ? (jawaban.variabel ?? null) : { sebab: jawaban?.sebab ?? "Tidak ditemukan." });
              }}
              disabled={!cari}
            >
              Cari
            </Button>
          </div>

          {temuan ? (
            <div className="space-y-1 rounded-md border border-border/60 bg-muted/20 p-3 text-sm">
              {temuan.sebab ? (
                <p className="text-muted-foreground">{String(temuan.sebab)}</p>
              ) : (
                <>
                  <p className="font-medium">
                    #{String(temuan.noVar)}# &mdash; {String(temuan.nama)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Kelas {String(temuan.kelas)} &middot; jenis {String(temuan.jenis) || "(kosong)"} &middot; muncul{" "}
                    {String(temuan.jumlahPakai)} kali di pustaka blangko
                  </p>
                  <p className="text-xs text-muted-foreground">{String(temuan.sebabKelas)}</p>
                  {String(temuan.sqlQuery) ? (
                    <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-[11px]">
                      {String(temuan.sqlQuery)}
                    </pre>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tahap 1 - Korpus blangko
// ============================================================================

function TabKorpus() {
  const [statistik, setStatistik] = useState<StatistikKorpus | null>(null);
  const [geser, setGeser] = useState<Pergeseran[]>([]);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [alasan, setAlasan] = useState<Record<string, string>>({});
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const [a, b] = await Promise.all([
        ambil<{ statistik: StatistikKorpus }>("/api/aleta-ecourt/korpus"),
        ambil<{ pergeseran: Pergeseran[] }>("/api/aleta-ecourt/korpus?pergeseran=1"),
      ]);
      if (batal) return;
      setStatistik(a?.statistik ?? null);
      setGeser(b?.pergeseran ?? []);
    })();
    return () => {
      batal = true;
    };
  }, [putaran]);

  const muat = () => setPutaran((n) => n + 1);

  const pelajari = async () => {
    setSibuk(true);
    setPesan("");
    const hasil = await kirim<{ ok: boolean; jumlahBerkas: number; jumlahBlok: number; jumlahGeser: number; jumlahGagalSusun: number; sebab: string }>(
      "/api/aleta-ecourt/korpus",
      { tindakan: "pelajari" }
    );
    setSibuk(false);
    if (!hasil) return setPesan("Pembelajaran tidak terjawab.");
    setBaik(Boolean(hasil.ok));
    setPesan(
      hasil.ok
        ? `${hasil.jumlahBerkas} blangko dipelajari menjadi ${hasil.jumlahBlok} blok kalimat; ${hasil.jumlahGeser} kelompok pergeseran menunggu diputus.`
        : `${hasil.sebab}${hasil.jumlahGagalSusun ? ` (${hasil.jumlahGagalSusun} blangko gagal disusun ulang)` : ""}`
    );
    muat();
  };

  const putuskan = async (id: string, sidik: string) => {
    const hasil = await kirim<{ ok: boolean; sebab: string }>("/api/aleta-ecourt/korpus", {
      tindakan: "putuskan",
      id,
      blokTerpilih: sidik,
      alasan: alasan[id] ?? "",
    });
    setBaik(Boolean(hasil?.ok));
    setPesan(hasil?.ok ? "Keputusan tercatat." : hasil?.sebab ?? "Keputusan gagal.");
    muat();
  };

  const belumPernah = (statistik?.jumlahBerkas ?? 0) === 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Boxes className="size-4" /> Korpus blangko
          </CardTitle>
          <CardDescription>
            Seluruh pustaka ABT dipelajari sekali lalu ditinggalkan. Yang disimpan blok kalimatnya, susunannya, dan
            dimensi keadaannya &mdash; bukan salinan berkasnya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {belumPernah ? (
            <Pesan teks="Korpus belum pernah dipelajari. Pustaka blangko ALETA belum dapat disusun sebelum ini dijalankan." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Angka nilai={statistik?.jumlahBerkas ?? 0} label="blangko dipelajari" />
              <Angka nilai={statistik?.jumlahBlok ?? 0} label="blok kalimat unik" />
              <Angka nilai={statistik?.selMatriks ?? 0} label="sel matriks terisi" />
              <Angka
                nilai={statistik?.geserBelumDiputus ?? 0}
                label="pergeseran menunggu"
                warna="text-amber-600"
              />
            </div>
          )}

          {statistik?.pembelajaranTerakhir ? (
            <p className="text-xs text-muted-foreground">
              Pembelajaran terakhir {statistik.pembelajaranTerakhir.keadaan} oleh{" "}
              {statistik.pembelajaranTerakhir.oleh || "-"}
              {statistik.pembelajaranTerakhir.sebab ? ` - ${statistik.pembelajaranTerakhir.sebab}` : ""}
            </p>
          ) : null}

          <Pesan teks={pesan} baik={baik} />

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={pelajari} disabled={sibuk} size="sm">
              {sibuk ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {belumPernah ? "Pelajari seluruh blangko ABT" : "Pelajari ulang"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Berjalan beberapa menit. Korpus yang tidak dapat menyusun ulang sumbernya tidak akan disimpan.
            </span>
          </div>
        </CardContent>
      </Card>

      {geser.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pergeseran yang menunggu diputus</CardTitle>
            <CardDescription>
              Kalimat yang seharusnya sama tetapi terlanjur menyimpang antar berkas. Mesin tidak pernah memilih
              sendiri &mdash; memilih bunyi kalimat hukum adalah pekerjaan hakim.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {geser.slice(0, 10).map((g) => (
              <div key={g.id} className="space-y-2 rounded-md border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{g.jumlahVarian} varian</Badge>
                </div>
                {g.varian.map((v) => (
                  <div key={v.sidik} className="flex items-start gap-2 border-t border-border/40 pt-2 first:border-0">
                    <Button size="sm" variant="outline" onClick={() => void putuskan(g.id, v.sidik)}>
                      Pilih
                    </Button>
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm">{v.teks}</p>
                      <p className="text-xs text-muted-foreground">dipakai {v.jumlahPakai} kali</p>
                    </div>
                  </div>
                ))}
                <Textarea
                  value={alasan[g.id] ?? ""}
                  onChange={(e) => setAlasan((s) => ({ ...s, [g.id]: e.target.value }))}
                  placeholder="Alasan memilih - tercatat bersama keputusannya"
                  rows={2}
                  className="text-sm"
                />
              </div>
            ))}
            {geser.length > 10 ? (
              <p className="text-xs text-muted-foreground">
                Menampilkan 10 dari {geser.length}. Sisanya muncul setelah yang ini diputus.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ============================================================================
// Tahap 5, 6 - Pustaka blangko ALETA
// ============================================================================

function TabPustaka() {
  const [daftar, setDaftar] = useState<BlangkoAleta[]>([]);
  const [jalur, setJalur] = useState("");
  const [kode, setKode] = useState("");
  const [nama, setNama] = useState("");
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [saklar, setSaklar] = useState<Record<string, boolean>>({});
  const [perkaraUji, setPerkaraUji] = useState("");
  const [putaran, setPutaran] = useState(0);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const jawaban = await ambil<{ blangko: BlangkoAleta[] }>("/api/aleta-ecourt/blangko-aleta");
      if (batal) return;
      setDaftar(jawaban?.blangko ?? []);
      const keadaan: Record<string, boolean> = {};
      for (const g of GOLONGAN) {
        const s = await ambil<{ menyala: boolean }>(`/api/aleta-ecourt/blangko-aleta?saklar=${g}`);
        keadaan[g] = Boolean(s?.menyala);
      }
      if (!batal) setSaklar(keadaan);
    })();
    return () => {
      batal = true;
    };
  }, [putaran]);

  const muat = () => setPutaran((n) => n + 1);

  const turunkan = async () => {
    setSibuk(true);
    const hasil = await kirim<{ ok: boolean; jumlahBagian: number; sebab: string }>(
      "/api/aleta-ecourt/blangko-aleta",
      { tindakan: "turunkan", jalur, kode, nama }
    );
    setSibuk(false);
    setBaik(Boolean(hasil?.ok));
    setPesan(hasil?.ok ? `Blangko "${kode}" tersusun dari ${hasil.jumlahBagian} bagian.` : hasil?.sebab ?? "Gagal.");
    if (hasil?.ok) {
      setJalur("");
      setKode("");
      setNama("");
    }
    muat();
  };

  const geserSaklar = async (golongan: string, menyala: boolean) => {
    const hasil = await kirim<{ ok: boolean; sebab: string }>("/api/aleta-ecourt/blangko-aleta", {
      tindakan: "saklar",
      golongan,
      menyala,
      alasan: menyala ? "dinyalakan dari layar admin" : "dimatikan dari layar admin",
    });
    setBaik(Boolean(hasil?.ok));
    setPesan(hasil?.ok ? `Saklar ${golongan} ${menyala ? "menyala" : "mati"}.` : hasil?.sebab ?? "Gagal.");
    muat();
  };

  const uji = async () => {
    setSibuk(true);
    const hasil = await kirim<{ mandiri: boolean; jumlahDiperiksa: number; temuan: Array<{ kode: string; sebab: string }> }>(
      "/api/aleta-ecourt/blangko-aleta",
      { tindakan: "ujiMandiri", perkaraId: perkaraUji }
    );
    setSibuk(false);
    if (!hasil) return setPesan("Uji tidak terjawab.");
    setBaik(hasil.mandiri);
    setPesan(
      hasil.mandiri
        ? `Mandiri: ${hasil.jumlahDiperiksa} blangko terbit tanpa menyentuh ABT.`
        : hasil.jumlahDiperiksa === 0
          ? "Belum ada satu blangko pun di pustaka ALETA - tidak ada yang dapat diuji."
          : `Belum mandiri: ${hasil.temuan.length} blangko gagal terbit. ${hasil.temuan
              .slice(0, 3)
              .map((t) => `${t.kode} (${t.sebab})`)
              .join("; ")}`
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Library className="size-4" /> Pustaka blangko ALETA
          </CardTitle>
          <CardDescription>
            Blangko ALETA bukan berkas melainkan kerangka, bagian, dan syarat &mdash; sehingga kombinasi keadaan yang
            ABT tidak punya berkasnya pun terbit dengan benar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Pesan teks={pesan} baik={baik} />

          {daftar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Belum ada blangko ALETA. Turunkan satu dari korpus di bawah &mdash; mulailah dari relaas, hanya tujuh
              berkas dan cukup kecil untuk salah dengan murah.
            </p>
          ) : (
            <div className="space-y-1">
              {daftar.map((b) => (
                <div
                  key={b.kode}
                  className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/50 py-2 last:border-0"
                >
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{b.kode}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{b.nama}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{b.jenis || "tanpa golongan"}</Badge>
                    <Badge variant={b.keadaan === "disahkan" ? "default" : "outline"}>{b.keadaan}</Badge>
                    {b.asal_abt ? (
                      <span className="text-xs text-muted-foreground">diturunkan dari ABT</span>
                    ) : (
                      <span className="text-xs text-emerald-600">blangko baru</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-md border border-border/60 p-3">
            <p className="text-sm font-medium">Turunkan dari korpus</p>
            <Input value={jalur} onChange={(e) => setJalur(e.target.value)} placeholder="Jalur blangko sumber, misalnya RELAAS PA DONGGALA/RELASS ECOURT PENGGUGAT - PEMOHON.rtf" />
            <div className="flex flex-wrap gap-2">
              <Input value={kode} onChange={(e) => setKode(e.target.value)} placeholder="Kode, misalnya RELAAS-P-01" className="max-w-56" />
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama blangko" className="max-w-72" />
              <Button size="sm" onClick={turunkan} disabled={sibuk || !jalur || !kode}>
                {sibuk ? <Loader2 className="size-4 animate-spin" /> : null} Turunkan
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saklar periksa hasil</CardTitle>
          <CardDescription>
            Bawaannya mati &mdash; blangko langsung dipakai. Satu saklar per golongan dokumen: relaas dan putusan
            risikonya tidak sama. Tiap pergeseran tercatat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {GOLONGAN.map((g) => (
            <div key={g} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
              <span className="text-sm capitalize">{g}</span>
              <Button
                size="sm"
                variant={saklar[g] ? "default" : "outline"}
                onClick={() => void geserSaklar(g, !saklar[g])}
              >
                {saklar[g] ? <ShieldCheck className="size-4" /> : <ShieldOff className="size-4" />}
                {saklar[g] ? "Diperiksa" : "Langsung pakai"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Uji kemandirian dari ABT</CardTitle>
          <CardDescription>
            Bukan diumumkan, melainkan dibuktikan: tiap blangko diterbitkan tanpa menyentuh folder ABT. Uji ini juga
            berjalan sendiri pada tiap pemeriksaan keajekan berkala.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            value={perkaraUji}
            onChange={(e) => setPerkaraUji(e.target.value)}
            placeholder="perkara_id untuk uji"
            className="max-w-56"
          />
          <Button size="sm" variant="outline" onClick={uji} disabled={sibuk}>
            {sibuk ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Jalankan uji
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Tahap 7 - Membereskan Kelas C
// ============================================================================

function TabPembersihan() {
  const [ringkas, setRingkas] = useState<{ jumlahMati: number; matiDanTerpakai: number } | null>(null);
  const [temuan, setTemuan] = useState<TemuanKelasC[]>([]);

  useEffect(() => {
    let batal = false;
    void (async () => {
      const jawaban = await ambil<{ ringkas: { jumlahMati: number; matiDanTerpakai: number }; temuan: TemuanKelasC[] }>(
        "/api/aleta-ecourt/blangko-aleta?kelasC=1"
      );
      if (batal) return;
      setRingkas(jawaban?.ringkas ?? null);
      setTemuan(jawaban?.temuan ?? []);
    })();
    return () => {
      batal = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eraser className="size-4" /> Variabel mati yang masih terpakai
        </CardTitle>
        <CardDescription>
          Variabel yang tidak dapat diisi siapa pun, termasuk ABT sendiri. Ini pekerjaan hukum, bukan teknik &mdash;
          yang memutuskan sebuah alinea masih perlu atau tidak haruslah hakim atau panitera. Yang dapat dikerjakan
          mesin hanyalah menunjukkan di mana ia tersembunyi.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Angka nilai={ringkas?.jumlahMati ?? 0} label="Kelas C seluruhnya" />
          <Angka nilai={ringkas?.matiDanTerpakai ?? 0} label="mati TETAPI dipakai blangko" warna="text-rose-600" />
        </div>

        {temuan.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada variabel mati yang dipakai blangko mana pun. Yang mati tetapi tidak terpakai tidak perlu
            dibereskan &mdash; ia hanya baris kamus yang tidak menyentuh naskah siapa pun.
          </p>
        ) : (
          <div className="space-y-2">
            {temuan.slice(0, 25).map((t) => (
              <div key={t.noVar} className="rounded-md border border-border/60 p-3">
                <p className="text-sm font-medium">
                  #{t.noVar}# &mdash; {t.nama || "(tanpa nama)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  muncul {t.jumlahPakai} kali &middot; {t.sebab}
                </p>
                {t.blangko.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {t.blangko.map((b) => (
                      <li key={b} className="break-all text-xs text-muted-foreground">
                        {b}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BlangkoMandiri() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Kemandirian blangko</h1>
        <p className="text-sm text-muted-foreground">
          Seluruh blangko APS Badilag dipelajari saat membangun, lalu ALETA berdiri sendiri. Empat tahap di bawah
          berurutan: kamus dahulu, korpus sesudahnya, baru pustaka blangko dapat disusun.
        </p>
      </div>

      <Tabs defaultValue="kamus">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="kamus">Kamus</TabsTrigger>
          <TabsTrigger value="korpus">Korpus</TabsTrigger>
          <TabsTrigger value="pustaka">Pustaka</TabsTrigger>
          <TabsTrigger value="bersih">Pembersihan</TabsTrigger>
        </TabsList>
        <TabsContent value="kamus" className="mt-4">
          <TabKamus />
        </TabsContent>
        <TabsContent value="korpus" className="mt-4">
          <TabKorpus />
        </TabsContent>
        <TabsContent value="pustaka" className="mt-4">
          <TabPustaka />
        </TabsContent>
        <TabsContent value="bersih" className="mt-4">
          <TabPembersihan />
        </TabsContent>
      </Tabs>
    </div>
  );
}
