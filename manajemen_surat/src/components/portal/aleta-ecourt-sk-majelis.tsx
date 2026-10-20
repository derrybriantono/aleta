"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  badanSimpan,
  bandingkan,
  barisPanitera,
  drafDari,
  KODE_SAH,
  majelisBaru,
  periksaDraf,
  susunPratinjau,
  terapkanBarisPanitera,
  terapkanHakim,
  type DrafMajelis,
  type MajelisSk,
  type PegawaiRingkas,
} from "@/lib/sk-majelis-draf";
import { tanggalPanjang } from "@/lib/tanggal-indonesia";

/**
 * SK Ketua: susunan majelis hakim dan panitera pendamping (halaman admin).
 *
 * ============================================================================
 * DISUNTING SEBAGAI DRAF, DISIMPAN SEKALI DENGAN KONFIRMASI (20 Okt 2026)
 * ============================================================================
 *
 * Super Admin/Admin menyunting nomor, tanggal, dan "berlaku mulai" SK; menambah,
 * mengubah, dan menghapus majelis (ketua dan anggota BERURUTAN dipilih dari
 * hakim aktif; panitera pendamping dengan kode D, D1, ... diikat ke orangnya,
 * dipilih dari panitera aktif). Tidak ada yang tersimpan sebelum tombol Simpan
 * dan konfirmasi di halaman; konfirmasi menyebut apa yang berubah. Jejak siapa
 * mengubah apa dan kapan ada di bagian bawah (audit_logs).
 *
 * BENTUK DATA TIDAK BERUBAH: majelis tetap disimpan dengan rute dan kolom yang
 * sama sejak 0044/0045 (hakimKode berurutan, paniteraId berpasangan kode=id,
 * akun portal berpasangan kode=akun). Data lama tetap terbaca. Logika murninya
 * di lib/sk-majelis-draf.ts (diuji).
 *
 * Kode panitera pada SIPP tabrakan (empat orang berbagi "D"), karena itu tiap
 * kode SK diikat ke ORANG sekali di sini; kodenya tetap tampil di sebelah namanya
 * pada panel penetapan sebagai label.
 */

type SkTetap = { nomor: string; tanggal: string };

type AkunPortal = {
  id: string;
  nama: string;
  peran: string;
  peranLabel: string;
  jabatan: string;
  subPeran: string;
};

type PeringatanServer = { majelisKode: string; kode: string; nama: string; alasan: string };

type Jejak = { id: string; aksi: string; majelisKode: string; oleh: string; pada: string; sebelum: unknown; sesudah: unknown };

const NAMA_AKSI: Record<string, string> = {
  SIMPAN_SK_MAJELIS: "mengubah",
  TAMBAH_SK_MAJELIS: "menambah",
  HAPUS_SK_MAJELIS: "menghapus",
  UBAH_SK_BERLAKU_MULAI: "mengubah tanggal berlaku",
};

const jam = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
};

async function kirimJson(alamat: string, badan: Record<string, unknown>) {
  const r = await fetch(apiPath(alamat), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) });
  const isi = await r.json().catch(() => null);
  if (!r.ok || (isi && isi.ok === false)) throw new Error(pesanGalatPortal(isi, "Gagal menyimpan."));
  return isi?.data ?? isi;
}

const kelasSelect = "h-9 min-w-56 rounded-md border border-input bg-background px-2 text-sm";

export function AletaEcourtSkMajelis() {
  const [asli, setAsli] = useState<MajelisSk[]>([]);
  const [draf, setDraf] = useState<DrafMajelis[]>([]);
  const [hakim, setHakim] = useState<PegawaiRingkas[]>([]);
  const [panitera, setPanitera] = useState<PegawaiRingkas[]>([]);
  const [akun, setAkun] = useState<AkunPortal[]>([]);
  const [akunAlasan, setAkunAlasan] = useState("");
  const [namaHari, setNamaHari] = useState<string[]>([]);
  const [skTetap, setSkTetap] = useState<SkTetap[]>([]);
  const [pegawaiAlasan, setPegawaiAlasan] = useState("");
  const [peringatanServer, setPeringatanServer] = useState<PeringatanServer[]>([]);
  const [jejak, setJejak] = useState<Jejak[]>([]);
  // SK atas: yang tersimpan dan yang sedang disunting.
  const [skAsli, setSkAsli] = useState({ nomor: "", tanggal: "", berlaku: "" });
  const [sk, setSk] = useState({ nomor: "", tanggal: "", berlaku: "" });
  const [kodeBaru, setKodeBaru] = useState("");
  const [memuat, setMemuat] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const jawaban = await fetch(apiPath("/api/aleta-ecourt/sk-majelis"), { cache: "no-store" });
      const isi = await jawaban.json();
      if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Gagal membaca SK susunan majelis."));
      const data = isi?.data ?? isi;
      const daftar = (data.majelis ?? []) as MajelisSk[];
      setAsli(daftar);
      setDraf(drafDari(daftar));
      setHakim((data.hakim ?? []) as PegawaiRingkas[]);
      setPanitera((data.panitera ?? []) as PegawaiRingkas[]);
      setAkun((data.akun ?? []) as AkunPortal[]);
      setAkunAlasan(String(data.akunAlasan ?? ""));
      setNamaHari((data.namaHari ?? []) as string[]);
      setSkTetap((data.skTetap ?? []) as SkTetap[]);
      setPegawaiAlasan(String(data.pegawaiAlasan ?? ""));
      setPeringatanServer((data.peringatan ?? []) as PeringatanServer[]);
      setJejak((data.jejak ?? []) as Jejak[]);
      const bawaan = (data.skBerlaku ?? { nomor: "", tanggal: "" }) as { nomor: string; tanggal: string };
      const berlaku = data.berlakuMulai?.tanggal ? String(data.berlakuMulai.tanggal) : bawaan.tanggal;
      const nilai = { nomor: bawaan.nomor ?? "", tanggal: bawaan.tanggal ?? "", berlaku: data.berlakuMulai?.diisi ? berlaku : "" };
      setSkAsli(nilai);
      setSk(nilai);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal membaca SK.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  const ubahMajelis = useCallback((kode: string, fn: (m: DrafMajelis) => DrafMajelis) => {
    setKonfirmasi(false);
    setPesan("");
    setDraf((lama) => lama.map((m) => (m.majelisKode === kode ? fn(m) : m)));
  }, []);

  /** Empat panitera berbagi kode "D" - itu yang membuat pengikatan ke orang perlu. */
  const kodeTabrakan = useMemo(() => {
    const hitung = new Map<string, number>();
    for (const p of panitera) {
      if (!p.kode) continue;
      hitung.set(p.kode, (hitung.get(p.kode) ?? 0) + 1);
    }
    return [...hitung.entries()].filter(([, n]) => n > 1);
  }, [panitera]);

  const periksa = useMemo(() => periksaDraf(draf, hakim, panitera), [draf, hakim, panitera]);
  const perubahan = useMemo(() => bandingkan(asli, draf, hakim, panitera), [asli, draf, hakim, panitera]);
  const skBerubah = sk.nomor.trim() !== skAsli.nomor || sk.tanggal !== skAsli.tanggal;
  const berlakuBerubah = sk.berlaku !== skAsli.berlaku;
  const jumlahPerubahan = perubahan.length + (skBerubah ? 1 : 0) + (berlakuBerubah ? 1 : 0);
  const berlakuTampil = sk.berlaku || sk.tanggal;
  const pratinjau = useMemo(
    () =>
      susunPratinjau(draf, hakim, panitera, {
        nomor: sk.nomor,
        tanggal: sk.tanggal ? tanggalPanjang(sk.tanggal, sk.tanggal) : "",
        berlaku: berlakuTampil ? tanggalPanjang(berlakuTampil, berlakuTampil) : "",
      }),
    [draf, hakim, panitera, sk, berlakuTampil]
  );

  // Peringatan langsung dari draf + yang dibawa server (mutasi, jabatan berganti).
  const semuaPeringatan = useMemo(() => {
    const dariServer = peringatanServer.map((p) => `Majelis ${p.majelisKode}: ${p.kode}${p.nama ? ` (${p.nama})` : ""} - ${p.alasan}.`);
    return [...new Set([...dariServer, ...periksa.peringatan])];
  }, [peringatanServer, periksa.peringatan]);

  const tambahMajelis = () => {
    const kode = kodeBaru.trim().toUpperCase();
    if (!KODE_SAH.test(kode)) {
      setGalat("Kode majelis hanya huruf dan angka, paling banyak 8 (mis. A, B, C1).");
      return;
    }
    if (draf.some((m) => m.majelisKode === kode && !m.hapus)) {
      setGalat(`Majelis ${kode} sudah ada.`);
      return;
    }
    setGalat("");
    setKonfirmasi(false);
    setDraf((lama) => [...lama.filter((m) => m.majelisKode !== kode), majelisBaru(kode, 1, namaHari[1] ?? "Senin")]);
    setKodeBaru("");
  };

  const simpanSemua = async () => {
    setSibuk(true);
    setGalat("");
    setPesan("");
    try {
      for (const p of perubahan) {
        const m = draf.find((x) => x.majelisKode === p.kode);
        if (!m) continue;
        if (p.jenis === "hapus") await kirimJson("/api/aleta-ecourt/sk-majelis", { tindakan: "hapus", majelisKode: m.majelisKode });
        else await kirimJson("/api/aleta-ecourt/sk-majelis", badanSimpan(m));
      }
      if (skBerubah) {
        await kirimJson("/api/pengaturan-sipp-abt", {
          tindakan: "simpan-nomor-sk",
          nilai: { majelis: { nomor: sk.nomor.trim(), tanggal: sk.tanggal } },
        });
      }
      if (berlakuBerubah) await kirimJson("/api/aleta-ecourt/sk-majelis", { tindakan: "berlaku-mulai", tanggal: sk.berlaku });
      setPesan("SK tersimpan.");
      setKonfirmasi(false);
    } catch (kesalahan) {
      setGalat(kesalahan instanceof Error ? kesalahan.message : "Gagal menyimpan.");
    } finally {
      setSibuk(false);
      await muat();
    }
  };

  if (memuat && draf.length === 0 && !galat) {
    return <p className="text-sm text-muted-foreground">Membaca SK susunan majelis…</p>;
  }

  const bolehSimpan = jumlahPerubahan > 0 && periksa.galat.length === 0 && !sibuk;

  return (
    <div className="space-y-4" data-sk-majelis>
      <Card>
        <CardHeader>
          <CardTitle>SK susunan majelis hakim dan panitera pendamping</CardTitle>
          <CardDescription>
            Yang tersimpan di sini menang atas susunan yang disimpulkan dari pemakaian di SIPP: majelis yang ada di SK muncul lebih dahulu pada
            papan dan panel penetapan, beserta kodenya. Susunan di luar SK tetap dapat dipilih, bertanda &quot;di luar SK&quot;. Perubahan baru
            tersimpan sesudah Anda menekan Simpan dan membenarkannya.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="space-y-1">
              <span className="text-muted-foreground">Nomor SK</span>
              <Input
                aria-label="Nomor SK"
                value={sk.nomor}
                onChange={(e) => {
                  setKonfirmasi(false);
                  setSk((s) => ({ ...s, nomor: e.target.value }));
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Tanggal SK</span>
              <Input
                aria-label="Tanggal SK"
                type="date"
                value={sk.tanggal}
                onChange={(e) => {
                  setKonfirmasi(false);
                  setSk((s) => ({ ...s, tanggal: e.target.value }));
                }}
              />
            </label>
            <label className="space-y-1">
              <span className="text-muted-foreground">Berlaku mulai</span>
              <Input
                aria-label="Berlaku mulai"
                type="date"
                value={sk.berlaku}
                onChange={(e) => {
                  setKonfirmasi(false);
                  setSk((s) => ({ ...s, berlaku: e.target.value }));
                }}
              />
              <span className="block text-xs text-muted-foreground">Kosong = sama dengan tanggal SK. Beban majelis dinilai sejak tanggal ini.</span>
            </label>
          </div>
          {skTetap.length ? (
            <label className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Isi dari SK yang tercatat di SIPP</span>
              <select
                className={kelasSelect}
                value=""
                aria-label="Pilih dari SK di SIPP"
                onChange={(e) => {
                  const pilih = skTetap[Number(e.target.value)];
                  if (pilih) setSk((s) => ({ ...s, nomor: pilih.nomor, tanggal: pilih.tanggal || s.tanggal }));
                }}
              >
                <option value="">Pilih…</option>
                {skTetap.map((x, i) => (
                  <option key={`${x.nomor}-${i}`} value={i}>
                    {x.nomor}
                    {x.tanggal ? ` (${tanggalPanjang(x.tanggal, x.tanggal)})` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Menyimpan nomor/tanggal di sini tidak mengubah blangko ABT. Untuk memakainya di blangko, tekan &quot;Terapkan ke ABT&quot; di kartu Nomor SK
            penunjukan di bawah.
          </p>
          {pegawaiAlasan ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2">
              Daftar pegawai SIPP tidak terbaca: {pegawaiAlasan}. Hari sidang dan kode masih dapat disunting, tetapi panitera sidang belum dapat diikat ke orangnya.
            </p>
          ) : null}
          {kodeTabrakan.length > 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-muted-foreground">
              Kode panitera di SIPP tidak dapat dipakai menunjuk orang — {kodeTabrakan.map(([kode, n]) => `${n} orang berkode "${kode}"`).join(", ")}.
              Karena itu tiap kode SK diikat ke orangnya di bawah ini; kodenya tetap tampil di sebelah namanya pada panel penetapan.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {semuaPeringatan.length > 0 ? (
        <Card data-sk-peringatan>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">SK perlu diperbarui</CardTitle>
            <CardDescription>Pegawai berikut di SK sudah tidak aktif, bermutasi, atau jabatannya berubah. Ganti di majelisnya di bawah.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700 dark:text-amber-400">
              {semuaPeringatan.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {draf.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Belum ada majelis di SK. Tambahkan di bawah; sampai itu usulan memakai susunan yang terpakai tahun ini dan papan memberi tanda
          &quot;belum memakai SK&quot;.
        </p>
      ) : null}

      {draf.map((m) =>
        m.hapus ? (
          <Card key={m.majelisKode} data-majelis={m.majelisKode} data-hapus>
            <CardContent className="flex flex-wrap items-center gap-3 py-4 text-sm">
              <span>
                Majelis {m.majelisKode} akan dihapus dari SK saat disimpan.
              </span>
              <Button size="sm" variant="outline" onClick={() => ubahMajelis(m.majelisKode, (x) => ({ ...x, hapus: false }))}>
                Batalkan penghapusan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <KartuMajelis
            key={m.majelisKode}
            m={m}
            hakim={hakim}
            panitera={panitera}
            akun={akun}
            akunAlasan={akunAlasan}
            namaHari={namaHari}
            ubah={(fn) => ubahMajelis(m.majelisKode, fn)}
            hapus={() => {
              setKonfirmasi(false);
              if (m.baru) setDraf((lama) => lama.filter((x) => x.majelisKode !== m.majelisKode));
              else ubahMajelis(m.majelisKode, (x) => ({ ...x, hapus: true }));
            }}
          />
        )
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 py-4 text-sm">
          <span className="text-muted-foreground">Tambah majelis</span>
          <Input
            aria-label="Kode majelis baru"
            className="max-w-32"
            value={kodeBaru}
            placeholder="mis. C2"
            onChange={(e) => setKodeBaru(e.target.value.toUpperCase())}
          />
          <Button size="sm" variant="outline" onClick={tambahMajelis}>
            Tambah majelis
          </Button>
        </CardContent>
      </Card>

      <Card data-sk-pratinjau>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pratinjau: begini usulan akan memakai SK ini</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-sm">
            {pratinjau.map((b, i) => (
              <li key={i} className={b.startsWith("  ") ? "pl-5 text-muted-foreground" : ""}>
                {b.trim()}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card data-sk-simpan>
        <CardContent className="space-y-3 py-4 text-sm">
          {periksa.galat.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-destructive" data-sk-galat>
              {periksa.galat.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          ) : null}
          {galat ? <p className="text-destructive">{galat}</p> : null}
          {pesan ? <p className="text-emerald-600">{pesan}</p> : null}

          {konfirmasi ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3" role="group" aria-label="Konfirmasi simpan SK">
              <p className="font-semibold">Simpan {jumlahPerubahan} perubahan SK ini?</p>
              <ul className="list-disc space-y-1 pl-5">
                {skBerubah ? <li>Nomor/tanggal SK: {sk.nomor} ({sk.tanggal ? tanggalPanjang(sk.tanggal, sk.tanggal) : "-"})</li> : null}
                {berlakuBerubah ? <li>Berlaku mulai: {sk.berlaku ? tanggalPanjang(sk.berlaku, sk.berlaku) : "sama dengan tanggal SK"}</li> : null}
                {perubahan.map((p) => (
                  <li key={p.kode}>
                    <strong>Majelis {p.kode}</strong> ({p.jenis}): {p.uraian.join("; ")}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button size="sm" disabled={sibuk} onClick={() => void simpanSemua()}>
                  Ya, simpan
                </Button>
                <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setKonfirmasi(false)}>
                  Batal
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button disabled={!bolehSimpan} onClick={() => setKonfirmasi(true)}>
                Simpan perubahan
              </Button>
              <span className="text-muted-foreground">
                {jumlahPerubahan > 0 ? `${jumlahPerubahan} perubahan belum disimpan.` : "Tidak ada perubahan."}
              </span>
              {jumlahPerubahan > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDraf(drafDari(asli));
                    setSk(skAsli);
                    setGalat("");
                  }}
                >
                  Buang perubahan
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => void muat()} disabled={memuat}>
                Muat ulang
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-sk-jejak>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Jejak perubahan</CardTitle>
        </CardHeader>
        <CardContent>
          {jejak.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada perubahan SK yang tercatat.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {jejak.map((j) => (
                <li key={j.id}>
                  {jam(j.pada)} - {j.oleh} {NAMA_AKSI[j.aksi] ?? j.aksi.toLowerCase()}
                  {j.majelisKode && !j.majelisKode.startsWith("*") ? ` Majelis ${j.majelisKode}` : ""}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KartuMajelis({
  m,
  hakim,
  panitera,
  akun,
  akunAlasan,
  namaHari,
  ubah,
  hapus,
}: {
  m: DrafMajelis;
  hakim: PegawaiRingkas[];
  panitera: PegawaiRingkas[];
  akun: AkunPortal[];
  akunAlasan: string;
  namaHari: string[];
  ubah: (fn: (m: DrafMajelis) => DrafMajelis) => void;
  hapus: () => void;
}) {
  const [yakinHapus, setYakinHapus] = useState(false);
  const barisPp = barisPanitera(m);
  const daftarHakimBisaDipilih = hakim.length > 0;

  const gantiHakim = (indeks: number, kode: string) =>
    ubah((x) => terapkanHakim(x, x.hakimKode.map((k, i) => (i === indeks ? kode : k))));
  const geserHakim = (indeks: number, arah: -1 | 1) =>
    ubah((x) => {
      const tujuan = indeks + arah;
      if (tujuan < 0 || tujuan >= x.hakimKode.length) return x;
      const salin = [...x.hakimKode];
      [salin[indeks], salin[tujuan]] = [salin[tujuan], salin[indeks]];
      return terapkanHakim(x, salin);
    });

  const ubahBarisPp = (indeks: number, bagian: Partial<{ kode: string; id: number }>) =>
    ubah((x) => terapkanBarisPanitera(x, barisPanitera(x).map((b, i) => (i === indeks ? { ...b, ...bagian } : b))));

  return (
    <Card data-majelis={m.majelisKode}>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span>Majelis {m.majelisKode}</span>
          {m.baru ? <Badge variant="info">baru</Badge> : null}
          {!m.baru && m.bawaan ? <Badge variant="outline">belum disunting</Badge> : null}
          <Badge variant="muted">{namaHari[m.hari] ?? m.namaHari}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-36 text-muted-foreground">Hari sidang</span>
          <select
            className={kelasSelect}
            aria-label={`Hari sidang Majelis ${m.majelisKode}`}
            value={m.hari}
            onChange={(e) => ubah((x) => ({ ...x, hari: Number(e.target.value), namaHari: namaHari[Number(e.target.value)] ?? x.namaHari }))}
          >
            {namaHari.map((nama, i) => (
              <option key={nama} value={i}>
                {nama}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <p className="text-muted-foreground">Hakim (ketua di urutan pertama)</p>
          {m.hakimKode.map((kode, i) => {
            const adaDiDaftar = hakim.some((h) => h.kode.toUpperCase() === kode);
            return (
              <div key={`${i}-${kode}`} className="flex flex-wrap items-center gap-2" data-baris-hakim>
                <Badge variant="outline" className="w-20 justify-center">
                  {i === 0 ? "Ketua" : `Anggota ${i}`}
                </Badge>
                {daftarHakimBisaDipilih ? (
                  <select
                    className={kelasSelect}
                    aria-label={`${i === 0 ? "Ketua" : `Anggota ${i}`} Majelis ${m.majelisKode}`}
                    value={kode}
                    onChange={(e) => gantiHakim(i, e.target.value)}
                  >
                    <option value="">— pilih hakim —</option>
                    {kode && !adaDiDaftar ? <option value={kode}>{kode} — tidak aktif di SIPP</option> : null}
                    {hakim
                      .filter((h) => h.kode)
                      .map((h) => (
                        <option key={h.id} value={h.kode.toUpperCase()}>
                          {h.kode} — {h.nama}
                        </option>
                      ))}
                  </select>
                ) : (
                  <Input className="max-w-32" aria-label={`Kode hakim ${i + 1} Majelis ${m.majelisKode}`} value={kode} onChange={(e) => gantiHakim(i, e.target.value.toUpperCase())} />
                )}
                <Button size="sm" variant="outline" disabled={i === 0} onClick={() => geserHakim(i, -1)} aria-label="Naikkan urutan">
                  ↑
                </Button>
                <Button size="sm" variant="outline" disabled={i === m.hakimKode.length - 1} onClick={() => geserHakim(i, 1)} aria-label="Turunkan urutan">
                  ↓
                </Button>
                <Button size="sm" variant="outline" onClick={() => ubah((x) => terapkanHakim(x, x.hakimKode.filter((_, j) => j !== i)))}>
                  Hapus
                </Button>
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => ubah((x) => terapkanHakim(x, [...x.hakimKode, ""]))}>
            Tambah {m.hakimKode.length === 0 ? "ketua" : "anggota"}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground">Panitera sidang menurut SK (pendamping; kode SK diikat ke orangnya)</p>
          {barisPp.map((b, i) => {
            const orang = panitera.find((p) => p.id === b.id);
            return (
              <div key={`${i}`} className="flex flex-wrap items-center gap-2" data-baris-panitera>
                <Input
                  className="w-20"
                  aria-label={`Kode panitera ${i + 1} Majelis ${m.majelisKode}`}
                  value={b.kode}
                  placeholder="D1"
                  onChange={(e) => ubahBarisPp(i, { kode: e.target.value.toUpperCase() })}
                />
                <select
                  className={kelasSelect}
                  aria-label={`Orang untuk kode ${b.kode || i + 1} Majelis ${m.majelisKode}`}
                  value={b.id}
                  disabled={panitera.length === 0}
                  onChange={(e) => ubahBarisPp(i, { id: Number(e.target.value) })}
                >
                  <option value={0}>— belum diikat —</option>
                  {b.id > 0 && !orang ? <option value={b.id}>(tidak aktif di SIPP)</option> : null}
                  {panitera.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nama}
                      {p.kode ? ` (kode SIPP ${p.kode})` : " (tanpa kode SIPP)"}
                    </option>
                  ))}
                </select>
                {b.id === 0 ? <span className="text-xs text-amber-600">belum diikat — panel memakai giliran beban</span> : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => ubah((x) => terapkanBarisPanitera(x, barisPanitera(x).filter((_, j) => j !== i)))}
                >
                  Hapus
                </Button>
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={() => ubah((x) => terapkanBarisPanitera(x, [...barisPanitera(x), { kode: "", id: 0 }]))}>
            Tambah pendamping
          </Button>
        </div>

        <details>
          <summary className="cursor-pointer text-muted-foreground">Akun portal tiap anggota majelis dan SK khusus majelis ini</summary>
          <div className="mt-3 space-y-3">
            {akunAlasan ? (
              <p className="text-xs text-amber-600">Daftar akun tidak terbaca: {akunAlasan}. Susunan majelisnya tetap dapat disunting.</p>
            ) : null}
            {[...m.hakimKode, ...m.paniteraKode].filter(Boolean).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada kode hakim maupun panitera pada majelis ini — isi kodenya lebih dahulu, lalu akunnya dapat ditautkan.
              </p>
            ) : null}
            {[...m.hakimKode, ...m.paniteraKode].filter(Boolean).map((kode) => {
              const tertaut = (m.akun ?? []).find((a) => a.kode === kode);
              const orang = tertaut ? akun.find((u) => u.id === tertaut.akunId) : null;
              return (
                <label key={`akun-${kode}`} className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="w-14 justify-center">
                    {kode}
                  </Badge>
                  <span className="w-20 text-xs text-muted-foreground">
                    {m.hakimKode.includes(kode) ? (m.hakimKode[0] === kode ? "ketua" : "hakim") : "panitera"}
                  </span>
                  <select
                    className={kelasSelect}
                    aria-label={`Akun untuk ${kode} Majelis ${m.majelisKode}`}
                    value={tertaut?.akunId ?? ""}
                    disabled={akun.length === 0}
                    onChange={(e) => {
                      const akunId = e.target.value;
                      ubah((x) => {
                        const lain = (x.akun ?? []).filter((a) => a.kode !== kode);
                        return { ...x, akun: akunId ? [...lain, { kode, akunId }] : lain };
                      });
                    }}
                  >
                    <option value="">— belum ditautkan —</option>
                    {akun.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.nama} — {u.peranLabel}
                        {u.jabatan ? ` · ${u.jabatan}` : ""}
                      </option>
                    ))}
                  </select>
                  {tertaut && !orang ? <span className="text-xs text-amber-600">akunnya sudah tidak aktif atau tidak terlihat</span> : null}
                </label>
              );
            })}
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-36 text-muted-foreground">SK khusus (opsional)</span>
              <Input
                className="max-w-sm"
                aria-label={`Nomor SK khusus Majelis ${m.majelisKode}`}
                value={m.skIkutBawaan ? "" : m.skNomor}
                placeholder="Kosong = ikut SK bawaan di atas"
                onChange={(e) => ubah((x) => ({ ...x, skNomor: e.target.value, skIkutBawaan: !e.target.value && !x.skTanggal }))}
              />
              <Input
                className="max-w-40"
                type="date"
                aria-label={`Tanggal SK khusus Majelis ${m.majelisKode}`}
                value={m.skIkutBawaan ? "" : m.skTanggal}
                onChange={(e) => ubah((x) => ({ ...x, skTanggal: e.target.value, skIkutBawaan: !e.target.value && !x.skNomor }))}
              />
            </div>
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-2">
          {yakinHapus ? (
            <>
              <span>Hapus Majelis {m.majelisKode} dari SK?</span>
              <Button size="sm" variant="destructive" onClick={() => hapus()}>
                Ya, hapus
              </Button>
              <Button size="sm" variant="outline" onClick={() => setYakinHapus(false)}>
                Batal
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setYakinHapus(true)}>
              Hapus majelis
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
