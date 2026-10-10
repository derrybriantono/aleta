"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";

/**
 * Kamus deteksi & kalimat (P9, 10 Okt 2026) - kartu Admin.
 *
 * Pola deteksi dan templat kalimat per kelompok, dari DUA lapis: benih JSON di
 * citra bot dan baris database yang disunting di sini (menimpa benih menurut
 * kode). Tambah/sunting/nonaktifkan, uji pola atas contoh yang diketik dan
 * atas sampel data nyata (lewat bot, baca-saja), angka ukur, calon dari
 * koreksi petugas (P8), jejak koreksi (D2), dan label pustaka kalimat (D3).
 *
 * Hanya Super Admin dan Admin - rute menolak peran lain, kartu ini lalu
 * menampilkan pesannya saja.
 */

type Status = "aktif" | "draf" | "nonaktif";
type Asal = "benih" | "database" | "database-menimpa";
type Ukur = { n: number; tepat: number; salahTangkap: number; sumber?: string; tanggal?: string };
type Lapangan = { dipakai: number; diterima: number; disunting: number; persenDiterima: number };

type Pola = {
  kode: string;
  kelompok: string;
  label: string;
  kunci: string;
  regex: string;
  flags: string;
  status: Status;
  yakin: "pasti" | "ragu";
  contohBenar: string[];
  contohSalah: string[];
  ukur: Ukur;
  catatan: string;
  asal: Asal;
  adaBenih: boolean;
  ketepatan: number;
  peringatan: string[];
  lapangan: Lapangan | null;
  diubahOleh: string;
  diubahAt: string;
};

type Templat = {
  kode: string;
  kelompok: string;
  label: string;
  gaya: string;
  teks: string;
  status: Status;
  catatan: string;
  asal: Asal;
  adaBenih: boolean;
};

type Kelompok = { kelompok: string; pola: Pola[]; templat: Templat[] };

type JawabanKamus = {
  kelompok: Kelompok[];
  benih: { asal: string; sebab: string; galat: string[]; jumlahKelompok: number };
  lapisBot: { jumlahPola: number; jumlahTemplat: number; sidik: string; diterimaPada: string } | null;
  lapisPortal: { jumlahPola: number; jumlahTemplat: number; sidik: string };
  selaras: boolean | null;
  ringkasKoreksi: { jumlah: number; perHasil: Record<string, number> };
  label: { kelompokBaku: string[]; sumberSampel: Record<string, string> };
};

type Calon = {
  id: string;
  jenis: "pola" | "templat";
  kelompok: string;
  variabel: string;
  kodePolaAsal: string;
  usulKode: string;
  usulLabel: string;
  usulRegex: string;
  usulFlags: string;
  usulTeks: string;
  contohBenar: string[];
  contohSalah: string[];
  jumlahKoreksi: number;
  jumlahPerkara: number;
  jumlahDipakai: number;
  alasan: string;
  keadaan: string;
  alasanTolak: string;
  hasilKode: string;
};

type Koreksi = {
  id: string;
  nomorPerkara: string;
  perkaraId: string;
  variabel: string;
  namaVariabel: string;
  nilaiUsulan: string;
  sumber: string;
  kodePola: string;
  nilaiAkhir: string;
  hasil: string;
  jalur: string;
  petugasNama: string;
  pada: string;
};

type RingkasVariabel = { variabel: string; jumlah: number; diterima: number; disunting: number; diketik: number; dipilih: number };

type ButirPustaka = {
  id: string;
  teks: string;
  jenisPerkara: string;
  keadaan: string;
  jumlahPemakaian: number;
  bagian: string;
  labelAlasan: string[];
  labelKeadaan: string[];
  labelOleh: string;
};

const ALAMAT = "/api/aleta-ecourt/kamus-deteksi";
const ALAMAT_PUSTAKA = "/api/aleta-ecourt/pustaka/pertimbangan";
const BAGIAN = ["pertimbangan", "keterangan-saksi", "tuntutan", "posita", "amar"];

const WARNA_STATUS: Record<Status, "success" | "warning" | "muted"> = { aktif: "success", draf: "warning", nonaktif: "muted" };
const LABEL_ASAL: Record<Asal, string> = { benih: "benih", database: "database", "database-menimpa": "database (menimpa benih)" };
const WARNA_ASAL: Record<Asal, "outline" | "info" | "netral"> = { benih: "outline", database: "info", "database-menimpa": "netral" };

type SuntingPola = {
  baru: boolean;
  kode: string;
  kelompok: string;
  label: string;
  kunci: string;
  regex: string;
  flags: string;
  status: Status;
  yakin: "pasti" | "ragu";
  contohBenar: string;
  contohSalah: string;
  ukurN: string;
  ukurTepat: string;
  ukurSalah: string;
  ukurSumber: string;
  catatan: string;
};

type SuntingTemplat = { baru: boolean; kode: string; kelompok: string; label: string; gaya: string; teks: string; status: Status; catatan: string };

const persen = (x: number) => `${(x * 100).toFixed(1)}%`;
const baris = (x: string) => x.split("\n").map((s) => s.trim()).filter(Boolean);

async function mintaJson(alamat: string, init?: RequestInit) {
  const jawaban = await fetch(apiPath(alamat), { cache: "no-store", ...init });
  const isi = await jawaban.json().catch(() => null);
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, "Permintaan gagal."));
  return isi?.data ?? isi;
}

async function kirimJson(alamat: string, badan: Record<string, unknown>) {
  return mintaJson(alamat, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(badan) });
}

function polaKeSunting(p: Pola | null, kelompok = ""): SuntingPola {
  return {
    baru: !p,
    kode: p?.kode ?? "",
    kelompok: p?.kelompok ?? kelompok,
    label: p?.label ?? "",
    kunci: p?.kunci ?? "",
    regex: p?.regex ?? "",
    flags: p?.flags ?? "i",
    status: p ? p.status : "draf",
    yakin: p?.yakin ?? "ragu",
    contohBenar: (p?.contohBenar ?? []).join("\n"),
    contohSalah: (p?.contohSalah ?? []).join("\n"),
    ukurN: String(p?.ukur.n ?? 0),
    ukurTepat: String(p?.ukur.tepat ?? 0),
    ukurSalah: String(p?.ukur.salahTangkap ?? 0),
    ukurSumber: p?.ukur.sumber ?? "",
    catatan: p?.catatan ?? "",
  };
}

// ─── Penyunting pola beserta UJI POLA ────────────────────────────────────────

function PenyuntingPola(props: {
  awal: SuntingPola;
  kelompokBaku: string[];
  sumberSampel: Record<string, string>;
  sibuk: boolean;
  simpan: (s: SuntingPola) => Promise<boolean>;
  batal: () => void;
}) {
  const [s, setS] = useState(props.awal);
  const [contohUji, setContohUji] = useState("");
  const [hasilUji, setHasilUji] = useState<{ cocok: number; hasil: Array<{ teks: string; cocok: boolean; potongan: string }> } | null>(null);
  const [sampel, setSampel] = useState({ sumber: "saksi", batas: "2000", noVar: "" });
  const [hasilSampel, setHasilSampel] = useState<{
    ok: boolean;
    diperiksa: number;
    cocok: number;
    persen: number;
    contoh: Array<{ rujukan: string; cuplikan: string }>;
    error?: string;
  } | null>(null);
  const [pesan, setPesan] = useState("");
  const [menguji, setMenguji] = useState(false);

  const uji = async () => {
    setPesan("");
    try {
      const daftar = [...baris(contohUji), ...baris(s.contohBenar), ...baris(s.contohSalah)];
      setHasilUji(await kirimJson(ALAMAT, { tindakan: "uji", regex: s.regex, flags: s.flags, contoh: daftar }));
    } catch (e) {
      setHasilUji(null);
      setPesan(e instanceof Error ? e.message : "Uji gagal.");
    }
  };

  const ujiSampel = async () => {
    setPesan("");
    setMenguji(true);
    try {
      setHasilSampel(
        await kirimJson(ALAMAT, {
          tindakan: "uji-sampel",
          regex: s.regex,
          flags: s.flags,
          sumber: sampel.sumber,
          batas: Number(sampel.batas) || 2000,
          noVar: sampel.noVar,
        })
      );
    } catch (e) {
      setHasilSampel(null);
      setPesan(e instanceof Error ? e.message : "Uji sampel gagal.");
    } finally {
      setMenguji(false);
    }
  };

  const ubah = (k: keyof SuntingPola) => (e: { target: { value: string } }) => setS({ ...s, [k]: e.target.value });

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={s.kode} onChange={ubah("kode")} disabled={!s.baru} placeholder="kode, mis. alasan-b-nafkah" aria-label="Kode pola" />
        <Input value={s.kelompok} onChange={ubah("kelompok")} list="kamus-deteksi-kelompok" placeholder="kelompok" aria-label="Kelompok" />
        <Input value={s.kunci} onChange={ubah("kunci")} placeholder="kunci (huruf alasan, jenis tuntutan, ...)" aria-label="Kunci" />
      </div>
      <datalist id="kamus-deteksi-kelompok">
        {props.kelompokBaku.map((k) => (
          <option key={k} value={k} />
        ))}
      </datalist>
      <Input value={s.label} onChange={ubah("label")} placeholder="Label yang dibaca orang" aria-label="Label" />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <Input value={s.regex} onChange={ubah("regex")} className="font-mono text-xs" placeholder="regex JavaScript" aria-label="Regex" />
        <Input value={s.flags} onChange={ubah("flags")} className="font-mono text-xs" placeholder="i" aria-label="Bendera regex" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Contoh yang HARUS cocok (satu per baris)
          <Textarea value={s.contohBenar} onChange={ubah("contohBenar")} rows={3} aria-label="Contoh benar" />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Contoh yang TIDAK boleh cocok
          <Textarea value={s.contohSalah} onChange={ubah("contohSalah")} rows={3} aria-label="Contoh salah" />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-6">
        <NativeSelect value={s.status} onChange={ubah("status")} aria-label="Status">
          <option value="draf">draf</option>
          <option value="aktif">aktif</option>
          <option value="nonaktif">nonaktif</option>
        </NativeSelect>
        <NativeSelect value={s.yakin} onChange={ubah("yakin")} aria-label="Yakin">
          <option value="ragu">ragu</option>
          <option value="pasti">pasti (wajib ukur &gt;= 95%)</option>
        </NativeSelect>
        <Input value={s.ukurN} onChange={ubah("ukurN")} inputMode="numeric" placeholder="ukur n" aria-label="Ukur n" />
        <Input value={s.ukurTepat} onChange={ubah("ukurTepat")} inputMode="numeric" placeholder="tepat" aria-label="Ukur tepat" />
        <Input value={s.ukurSalah} onChange={ubah("ukurSalah")} inputMode="numeric" placeholder="salah tangkap" aria-label="Ukur salah tangkap" />
        <Input value={s.ukurSumber} onChange={ubah("ukurSumber")} placeholder="sumber ukur" aria-label="Sumber ukur" />
      </div>
      <Textarea value={s.catatan} onChange={ubah("catatan")} rows={2} placeholder="Catatan" aria-label="Catatan" />

      <div className="space-y-2 rounded-md border border-dashed border-border/80 p-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Uji pola</div>
        <Textarea
          value={contohUji}
          onChange={(e) => setContohUji(e.target.value)}
          rows={3}
          placeholder="Ketik kalimat untuk diuji, satu per baris (contoh benar/salah di atas ikut diuji)"
          aria-label="Contoh untuk diuji"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => void uji()}>
            Uji atas contoh
          </Button>
          <NativeSelect className="h-9 w-auto" value={sampel.sumber} onChange={(e) => setSampel({ ...sampel, sumber: e.target.value })} aria-label="Sumber sampel">
            {Object.entries(props.sumberSampel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </NativeSelect>
          <Input className="h-9 w-24" value={sampel.batas} onChange={(e) => setSampel({ ...sampel, batas: e.target.value })} aria-label="Batas sampel" />
          {sampel.sumber === "isian" ? (
            <Input className="h-9 w-24" value={sampel.noVar} onChange={(e) => setSampel({ ...sampel, noVar: e.target.value })} placeholder="no var" aria-label="Nomor variabel" />
          ) : null}
          <Button size="sm" variant="outline" disabled={menguji} onClick={() => void ujiSampel()}>
            {menguji ? "Menguji..." : "Uji atas data nyata"}
          </Button>
        </div>
        {hasilUji ? (
          <div className="space-y-1 text-xs">
            <div>
              Cocok {hasilUji.cocok} dari {hasilUji.hasil.length}
            </div>
            {hasilUji.hasil.map((h, i) => (
              <div key={i} className={h.cocok ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground"}>
                {h.cocok ? "cocok: " : "tidak: "}
                {h.cocok ? h.potongan : h.teks}
              </div>
            ))}
          </div>
        ) : null}
        {hasilSampel ? (
          hasilSampel.ok ? (
            <div className="space-y-1 text-xs">
              <div className="font-medium">
                {hasilSampel.cocok} cocok dari {hasilSampel.diperiksa} teks ({hasilSampel.persen}%). Periksa contoh di bawah: yang
                cocok padahal bukan maksud pola adalah salah tangkap.
              </div>
              {hasilSampel.contoh.map((c, i) => (
                <div key={i} className="break-words">
                  <span className="text-muted-foreground">{c.rujukan}: </span>
                  {c.cuplikan}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-rose-600 dark:text-rose-400">{hasilSampel.error}</p>
          )
        ) : null}
      </div>

      {pesan ? <p className="text-sm text-rose-600 dark:text-rose-400">{pesan}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={props.sibuk} onClick={() => void props.simpan(s)}>
          Simpan pola
        </Button>
        <Button size="sm" variant="outline" disabled={props.sibuk} onClick={props.batal}>
          Batal
        </Button>
      </div>
    </div>
  );
}

function PenyuntingTemplat(props: { awal: SuntingTemplat; kelompokBaku: string[]; sibuk: boolean; simpan: (s: SuntingTemplat) => Promise<boolean>; batal: () => void }) {
  const [s, setS] = useState(props.awal);
  const ubah = (k: keyof SuntingTemplat) => (e: { target: { value: string } }) => setS({ ...s, [k]: e.target.value });
  return (
    <div className="space-y-2 rounded-lg border border-border/70 bg-card p-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <Input value={s.kode} onChange={ubah("kode")} disabled={!s.baru} placeholder="kode templat" aria-label="Kode templat" />
        <Input value={s.kelompok} onChange={ubah("kelompok")} list="kamus-deteksi-kelompok" placeholder="kelompok" aria-label="Kelompok templat" />
        <Input value={s.gaya} onChange={ubah("gaya")} placeholder="gaya (lengkap / ringkas)" aria-label="Gaya" />
      </div>
      <Input value={s.label} onChange={ubah("label")} placeholder="Label" aria-label="Label templat" />
      <Textarea value={s.teks} onChange={ubah("teks")} rows={4} placeholder="Teks templat dengan isian {nama}" aria-label="Teks templat" />
      <div className="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <NativeSelect value={s.status} onChange={ubah("status")} aria-label="Status templat">
          <option value="draf">draf</option>
          <option value="aktif">aktif</option>
          <option value="nonaktif">nonaktif</option>
        </NativeSelect>
        <Input value={s.catatan} onChange={ubah("catatan")} placeholder="Catatan" aria-label="Catatan templat" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={props.sibuk} onClick={() => void props.simpan(s)}>
          Simpan templat
        </Button>
        <Button size="sm" variant="outline" disabled={props.sibuk} onClick={props.batal}>
          Batal
        </Button>
      </div>
    </div>
  );
}

// ─── Kartu utama ─────────────────────────────────────────────────────────────

export function AletaEcourtKamusDeteksi() {
  const [data, setData] = useState<JawabanKamus | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [pesanGagal, setPesanGagal] = useState("");
  const [kabar, setKabar] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [saring, setSaring] = useState({ kelompok: "", cari: "" });
  const [suntingPola, setSuntingPola] = useState<SuntingPola | null>(null);
  const [suntingTemplat, setSuntingTemplat] = useState<SuntingTemplat | null>(null);
  const [tab, setTab] = useState("pola");

  const [calon, setCalon] = useState<Calon[] | null>(null);
  const [keadaanCalon, setKeadaanCalon] = useState("menunggu");
  const [tolakAlasan, setTolakAlasan] = useState<Record<string, string>>({});
  const [ubahCalon, setUbahCalon] = useState<Record<string, { kode: string; kelompok: string }>>({});

  const [jejak, setJejak] = useState<{ jejak: Koreksi[]; ringkas: { perVariabel: RingkasVariabel[] } } | null>(null);
  const [hanyaKoreksi, setHanyaKoreksi] = useState(true);

  const [pustaka, setPustaka] = useState<ButirPustaka[] | null>(null);
  const [saringPustaka, setSaringPustaka] = useState({ keadaan: "usulan", bagian: "", labelAlasan: "", labelKeadaan: "", cari: "" });
  const [labelSunting, setLabelSunting] = useState<Record<string, { bagian: string; alasan: string; keadaan: string }>>({});
  const [kalimatBaru, setKalimatBaru] = useState({ teks: "", bagian: "keterangan-saksi", alasan: "", keadaan: "" });

  const muat = useCallback(async () => {
    setMemuat(true);
    setPesanGagal("");
    try {
      setData(await mintaJson(ALAMAT));
    } catch (e) {
      setPesanGagal(e instanceof Error ? e.message : "Gagal membaca kamus deteksi.");
    } finally {
      setMemuat(false);
    }
  }, []);

  const muatCalon = useCallback(async () => {
    try {
      const d = await mintaJson(`${ALAMAT}?bagian=calon&keadaan=${encodeURIComponent(keadaanCalon)}`);
      setCalon(d.calon ?? []);
    } catch (e) {
      setPesanGagal(e instanceof Error ? e.message : "Gagal membaca calon.");
    }
  }, [keadaanCalon]);

  const muatJejak = useCallback(async () => {
    try {
      setJejak(await mintaJson(`${ALAMAT}?bagian=jejak&batas=100${hanyaKoreksi ? "&koreksi=1" : ""}`));
    } catch (e) {
      setPesanGagal(e instanceof Error ? e.message : "Gagal membaca jejak koreksi.");
    }
  }, [hanyaKoreksi]);

  const muatPustaka = useCallback(async () => {
    try {
      const q = new URLSearchParams({ keadaan: saringPustaka.keadaan });
      if (saringPustaka.bagian) q.set("bagian", saringPustaka.bagian);
      if (saringPustaka.labelAlasan) q.set("labelAlasan", saringPustaka.labelAlasan);
      if (saringPustaka.labelKeadaan) q.set("labelKeadaan", saringPustaka.labelKeadaan);
      if (saringPustaka.cari) q.set("cari", saringPustaka.cari);
      const d = await mintaJson(`${ALAMAT_PUSTAKA}?${q.toString()}`);
      setPustaka(d.butir ?? []);
    } catch (e) {
      setPesanGagal(e instanceof Error ? e.message : "Gagal membaca pustaka.");
    }
  }, [saringPustaka]);

  useEffect(() => {
    const t = window.setTimeout(() => void muat(), 0);
    return () => window.clearTimeout(t);
  }, [muat]);

  useEffect(() => {
    if (tab !== "calon") return;
    const t = window.setTimeout(() => void muatCalon(), 0);
    return () => window.clearTimeout(t);
  }, [tab, muatCalon]);

  useEffect(() => {
    if (tab !== "jejak") return;
    const t = window.setTimeout(() => void muatJejak(), 0);
    return () => window.clearTimeout(t);
  }, [tab, muatJejak]);

  useEffect(() => {
    if (tab !== "pustaka") return;
    const t = window.setTimeout(() => void muatPustaka(), 0);
    return () => window.clearTimeout(t);
  }, [tab, muatPustaka]);

  const tindak = useCallback(
    async (badan: Record<string, unknown>, kabarBerhasil: string, alamat = ALAMAT) => {
      setSibuk(true);
      setPesanGagal("");
      setKabar("");
      try {
        const d = await kirimJson(alamat, badan);
        if (d && d.ok === false && d.sebab) throw new Error(String(d.sebab));
        const dorong = d?.dorong as { ok: boolean; error?: string } | undefined;
        setKabar(dorong && !dorong.ok ? `${kabarBerhasil} Belum terkirim ke bot: ${dorong.error ?? "-"} (dicoba lagi otomatis).` : kabarBerhasil);
        await muat();
        return d ?? true;
      } catch (e) {
        setPesanGagal(e instanceof Error ? e.message : "Gagal menyimpan.");
        return null;
      } finally {
        setSibuk(false);
      }
    },
    [muat]
  );

  const tampil = useMemo(() => {
    const cari = saring.cari.trim().toLowerCase();
    return (data?.kelompok ?? [])
      .filter((k) => !saring.kelompok || k.kelompok === saring.kelompok)
      .map((k) => ({
        ...k,
        pola: k.pola.filter((p) => !cari || `${p.kode} ${p.label} ${p.kunci} ${p.regex}`.toLowerCase().includes(cari)),
        templat: k.templat.filter((t) => !cari || `${t.kode} ${t.label} ${t.teks}`.toLowerCase().includes(cari)),
      }));
  }, [data, saring]);

  const kelompokBaku = useMemo(
    () => Array.from(new Set([...(data?.label.kelompokBaku ?? []), ...(data?.kelompok ?? []).map((k) => k.kelompok)])).sort(),
    [data]
  );

  const simpanPola = async (s: SuntingPola) => {
    const d = await tindak(
      {
        tindakan: "simpan-pola",
        kode: s.kode.trim(),
        kelompok: s.kelompok.trim(),
        label: s.label,
        kunci: s.kunci,
        regex: s.regex,
        flags: s.flags,
        status: s.status,
        yakin: s.yakin,
        contohBenar: baris(s.contohBenar),
        contohSalah: baris(s.contohSalah),
        ukur: { n: Number(s.ukurN) || 0, tepat: Number(s.ukurTepat) || 0, salahTangkap: Number(s.ukurSalah) || 0, sumber: s.ukurSumber },
        catatan: s.catatan,
      },
      `Pola ${s.kode} tersimpan.`
    );
    if (d) setSuntingPola(null);
    return Boolean(d);
  };

  const simpanTemplat = async (s: SuntingTemplat) => {
    const d = await tindak({ tindakan: "simpan-templat", ...s, kode: s.kode.trim(), kelompok: s.kelompok.trim() }, `Templat ${s.kode} tersimpan.`);
    if (d) setSuntingTemplat(null);
    return Boolean(d);
  };

  const ringkas = data?.ringkasKoreksi;

  return (
    <Card id="kamus-deteksi">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Kamus deteksi &amp; kalimat
          <Badge variant="muted">pola, templat, koreksi petugas</Badge>
        </CardTitle>
        <CardDescription>
          Pola yang dikenali ALETA dari keterangan saksi, posita, dan gugatan, serta templat rangkaian kata. Benih ikut citra bot;
          baris database di sini menimpa benih dengan kode yang sama. Draf tidak dipakai bot. Hal hukum (huruf alasan, amar)
          tetap usulan yang diperiksa manusia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline">
              benih: {data.benih.asal === "bot" ? "dari bot" : data.benih.asal === "berkas" ? "dari berkas lokal" : "tidak terbaca"} ({data.benih.jumlahKelompok}{" "}
              kelompok)
            </Badge>
            <Badge variant="info">
              database: {data.lapisPortal.jumlahPola} pola, {data.lapisPortal.jumlahTemplat} templat dikirim
            </Badge>
            {data.selaras === null ? (
              <Badge variant="warning">bot belum terbaca</Badge>
            ) : data.selaras ? (
              <Badge variant="success">bot selaras</Badge>
            ) : (
              <Badge variant="warning">bot belum memakai lapis terbaru</Badge>
            )}
            <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "kirim-ke-bot" }, "Lapis dikirim ke bot.")}>
              Kirim ulang ke bot
            </Button>
            {ringkas ? (
              <span className="text-muted-foreground">
                Jejak koreksi: {ringkas.jumlah} (diterima {ringkas.perHasil.diterima ?? 0}, disunting {ringkas.perHasil.disunting ?? 0}, diketik{" "}
                {ringkas.perHasil.diketik ?? 0})
              </span>
            ) : null}
          </div>
        ) : null}
        {data?.benih.sebab ? <p className="text-xs text-muted-foreground">{data.benih.sebab}</p> : null}
        {data?.benih.galat.length ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-300">
            Benih bermasalah: {data.benih.galat.slice(0, 5).join("; ")}
          </div>
        ) : null}

        {memuat ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {pesanGagal ? <p className="text-sm text-rose-600 dark:text-rose-400">{pesanGagal}</p> : null}
        {kabar ? <p className="text-sm text-emerald-700 dark:text-emerald-300">{kabar}</p> : null}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="pola">Pola &amp; templat</TabsTrigger>
            <TabsTrigger value="calon">Calon dari koreksi</TabsTrigger>
            <TabsTrigger value="jejak">Jejak koreksi</TabsTrigger>
            <TabsTrigger value="pustaka">Pustaka kalimat</TabsTrigger>
          </TabsList>

          {/* ── POLA & TEMPLAT ── */}
          <TabsContent value="pola" className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto_auto]">
              <NativeSelect value={saring.kelompok} onChange={(e) => setSaring({ ...saring, kelompok: e.target.value })} aria-label="Saring kelompok">
                <option value="">Semua kelompok</option>
                {kelompokBaku.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </NativeSelect>
              <Input value={saring.cari} onChange={(e) => setSaring({ ...saring, cari: e.target.value })} placeholder="Cari kode, label, regex" aria-label="Cari pola" />
              <Button size="sm" variant="outline" onClick={() => setSuntingPola(polaKeSunting(null, saring.kelompok))}>
                Tambah pola
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSuntingTemplat({ baru: true, kode: "", kelompok: saring.kelompok, label: "", gaya: "", teks: "", status: "draf", catatan: "" })}
              >
                Tambah templat
              </Button>
            </div>

            {suntingPola?.baru ? (
              <PenyuntingPola
                awal={suntingPola}
                kelompokBaku={kelompokBaku}
                sumberSampel={data?.label.sumberSampel ?? {}}
                sibuk={sibuk}
                simpan={simpanPola}
                batal={() => setSuntingPola(null)}
              />
            ) : null}
            {suntingTemplat?.baru ? (
              <PenyuntingTemplat awal={suntingTemplat} kelompokBaku={kelompokBaku} sibuk={sibuk} simpan={simpanTemplat} batal={() => setSuntingTemplat(null)} />
            ) : null}

            {data && !tampil.length ? (
              <p className="text-sm text-muted-foreground">Belum ada pola maupun templat - benih kosong dan database kosong.</p>
            ) : null}

            {tampil.map((k) => (
              <div key={k.kelompok} className="space-y-2 rounded-lg border border-border/70 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{k.kelompok}</span>
                  <Badge variant="muted">
                    {k.pola.length} pola, {k.templat.length} templat
                  </Badge>
                </div>
                {k.pola.map((p) =>
                  suntingPola && !suntingPola.baru && suntingPola.kode === p.kode ? (
                    <PenyuntingPola
                      key={p.kode}
                      awal={suntingPola}
                      kelompokBaku={kelompokBaku}
                      sumberSampel={data?.label.sumberSampel ?? {}}
                      sibuk={sibuk}
                      simpan={simpanPola}
                      batal={() => setSuntingPola(null)}
                    />
                  ) : (
                    <div key={p.kode} className="border-t border-border/60 pt-2 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-xs">{p.kode}</span>
                        <Badge variant={WARNA_STATUS[p.status]}>{p.status}</Badge>
                        <Badge variant={p.yakin === "pasti" ? "success" : "outline"}>{p.yakin}</Badge>
                        <Badge variant={WARNA_ASAL[p.asal]}>{LABEL_ASAL[p.asal]}</Badge>
                        {p.kunci ? <Badge variant="outline">kunci {p.kunci}</Badge> : null}
                        <span className="text-muted-foreground">{p.label}</span>
                      </div>
                      <div className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                        /{p.regex}/{p.flags}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>
                          Ukur: {p.ukur.n ? `n ${p.ukur.n}, tepat ${persen(p.ketepatan)}, salah tangkap ${p.ukur.salahTangkap}` : "belum diukur"}
                          {p.ukur.sumber ? ` (${p.ukur.sumber})` : ""}
                        </span>
                        <span>
                          Lapangan:{" "}
                          {p.lapangan ? `${p.lapangan.dipakai} dipakai, ${p.lapangan.persenDiterima}% diterima utuh, ${p.lapangan.disunting} disunting` : "belum ada"}
                        </span>
                      </div>
                      {p.peringatan.length ? <div className="text-xs text-amber-700 dark:text-amber-300">{p.peringatan.join("; ")}</div> : null}
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={sibuk} onClick={() => setSuntingPola(polaKeSunting(p))}>
                          Sunting
                        </Button>
                        {p.status !== "aktif" ? (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "status", jenis: "pola", kode: p.kode, status: "aktif" }, `${p.kode} diaktifkan.`)}>
                            Aktifkan
                          </Button>
                        ) : null}
                        {p.status !== "nonaktif" ? (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "status", jenis: "pola", kode: p.kode, status: "nonaktif" }, `${p.kode} dinonaktifkan.`)}>
                            Nonaktifkan
                          </Button>
                        ) : null}
                        {p.asal === "database-menimpa" ? (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "kembalikan", jenis: "pola", kode: p.kode }, `${p.kode} kembali ke benih.`)}>
                            Kembalikan ke benih
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
                {k.templat.map((t) =>
                  suntingTemplat && !suntingTemplat.baru && suntingTemplat.kode === t.kode ? (
                    <PenyuntingTemplat key={t.kode} awal={suntingTemplat} kelompokBaku={kelompokBaku} sibuk={sibuk} simpan={simpanTemplat} batal={() => setSuntingTemplat(null)} />
                  ) : (
                    <div key={t.kode} className="border-t border-border/60 pt-2 text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant="netral">templat</Badge>
                        <span className="font-mono text-xs">{t.kode}</span>
                        <Badge variant={WARNA_STATUS[t.status]}>{t.status}</Badge>
                        <Badge variant={WARNA_ASAL[t.asal]}>{LABEL_ASAL[t.asal]}</Badge>
                        <span className="text-muted-foreground">{t.label}</span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-xs">{t.teks}</div>
                      <div className="mt-1 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk}
                          onClick={() => setSuntingTemplat({ baru: false, kode: t.kode, kelompok: t.kelompok, label: t.label, gaya: t.gaya, teks: t.teks, status: t.status, catatan: t.catatan })}
                        >
                          Sunting
                        </Button>
                        {t.status !== "nonaktif" ? (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "status", jenis: "templat", kode: t.kode, status: "nonaktif" }, `${t.kode} dinonaktifkan.`)}>
                            Nonaktifkan
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "status", jenis: "templat", kode: t.kode, status: "aktif" }, `${t.kode} diaktifkan.`)}>
                            Aktifkan
                          </Button>
                        )}
                        {t.asal === "database-menimpa" ? (
                          <Button size="sm" variant="outline" disabled={sibuk} onClick={() => void tindak({ tindakan: "kembalikan", jenis: "templat", kode: t.kode }, `${t.kode} kembali ke benih.`)}>
                            Kembalikan ke benih
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  )
                )}
              </div>
            ))}
          </TabsContent>

          {/* ── CALON DARI KOREKSI (P8) ── */}
          <TabsContent value="calon" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <NativeSelect className="h-9 w-auto" value={keadaanCalon} onChange={(e) => setKeadaanCalon(e.target.value)} aria-label="Keadaan calon">
                <option value="menunggu">menunggu tinjauan</option>
                <option value="diterima">diterima</option>
                <option value="ditolak">ditolak</option>
              </NativeSelect>
              <Button size="sm" variant="outline" onClick={() => void muatCalon()}>
                Susun ulang dari jejak koreksi
              </Button>
              <span className="text-xs text-muted-foreground">Calon tidak pernah aktif sendiri: terima sebagai draf/aktif, atau tolak.</span>
            </div>
            {calon && !calon.length ? <p className="text-sm text-muted-foreground">Belum ada calon - koreksi petugas yang berulang akan muncul di sini.</p> : null}
            {(calon ?? []).map((c) => {
              const ubah = ubahCalon[c.id] ?? { kode: c.usulKode, kelompok: c.kelompok };
              return (
                <div key={c.id} className="space-y-2 rounded-lg border border-border/70 p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={c.jenis === "pola" ? "info" : "netral"}>{c.jenis}</Badge>
                    <span className="font-medium">{c.usulLabel}</span>
                    <Badge variant="outline">variabel {c.variabel}</Badge>
                    <Badge variant="warning">
                      {c.jumlahKoreksi} koreksi / {c.jumlahPerkara} perkara
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{c.alasan}</div>
                  {c.usulRegex ? <div className="break-all font-mono text-[11px]">/{c.usulRegex}/{c.usulFlags}</div> : null}
                  {c.usulTeks ? <div className="whitespace-pre-wrap rounded-md bg-muted/60 p-2 text-xs">{c.usulTeks}</div> : null}
                  {c.contohSalah.length ? (
                    <div className="text-xs">
                      <span className="font-medium">Kalimat yang usulannya dikoreksi:</span>
                      {c.contohSalah.slice(0, 5).map((x, i) => (
                        <div key={i} className="text-muted-foreground">
                          - {x}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {c.keadaan === "menunggu" ? (
                    <div className="space-y-2">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input value={ubah.kode} onChange={(e) => setUbahCalon({ ...ubahCalon, [c.id]: { ...ubah, kode: e.target.value } })} aria-label="Kode hasil" />
                        <Input
                          value={ubah.kelompok}
                          list="kamus-deteksi-kelompok"
                          onChange={(e) => setUbahCalon({ ...ubahCalon, [c.id]: { ...ubah, kelompok: e.target.value } })}
                          aria-label="Kelompok hasil"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk}
                          onClick={async () => {
                            if (await tindak({ tindakan: "terima-calon", id: c.id, status: "draf", kode: ubah.kode, kelompok: ubah.kelompok }, "Calon diterima sebagai draf."))
                              await muatCalon();
                          }}
                        >
                          Terima sebagai draf
                        </Button>
                        <Button
                          size="sm"
                          disabled={sibuk}
                          onClick={async () => {
                            if (await tindak({ tindakan: "terima-calon", id: c.id, status: "aktif", kode: ubah.kode, kelompok: ubah.kelompok }, "Calon diterima dan diaktifkan."))
                              await muatCalon();
                          }}
                        >
                          Terima &amp; aktifkan
                        </Button>
                        <Input
                          className="h-9 w-56"
                          value={tolakAlasan[c.id] ?? ""}
                          onChange={(e) => setTolakAlasan({ ...tolakAlasan, [c.id]: e.target.value })}
                          placeholder="Alasan menolak"
                          aria-label="Alasan menolak"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={sibuk || !(tolakAlasan[c.id] ?? "").trim()}
                          onClick={async () => {
                            if (await tindak({ tindakan: "tolak-calon", id: c.id, alasan: tolakAlasan[c.id] }, "Calon ditolak.")) await muatCalon();
                          }}
                        >
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      {c.keadaan === "diterima" ? `Diterima menjadi ${c.hasilKode}.` : `Ditolak: ${c.alasanTolak}`}
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          {/* ── JEJAK KOREKSI (D2) ── */}
          <TabsContent value="jejak" className="space-y-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input type="checkbox" checked={hanyaKoreksi} onChange={(e) => setHanyaKoreksi(e.target.checked)} />
              hanya yang dikoreksi petugas (bukan diterima utuh)
            </label>
            {jejak ? (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2 text-left font-medium">Variabel</th>
                        <th className="py-1 pr-2 text-right font-medium">Jumlah</th>
                        <th className="py-1 pr-2 text-right font-medium">Diterima</th>
                        <th className="py-1 pr-2 text-right font-medium">Disunting</th>
                        <th className="py-1 pr-2 text-right font-medium">Diketik</th>
                        <th className="py-1 text-right font-medium">Dipilih</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jejak.ringkas.perVariabel.map((v) => (
                        <tr key={v.variabel} className="border-t">
                          <td className="py-1 pr-2 font-mono text-xs">#{v.variabel}#</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{v.jumlah}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{v.diterima}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{v.disunting}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{v.diketik}</td>
                          <td className="py-1 text-right tabular-nums">{v.dipilih}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {jejak.jejak.length ? null : <p className="text-sm text-muted-foreground">Belum ada jejak koreksi.</p>}
                {jejak.jejak.map((k) => (
                  <div key={k.id} className="border-t border-border/60 pt-2 text-xs">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-mono">#{k.variabel}#</span>
                      <Badge variant={k.hasil === "diterima" ? "success" : k.hasil === "disunting" ? "warning" : "outline"}>{k.hasil}</Badge>
                      <span>{k.nomorPerkara || `perkara ${k.perkaraId}`}</span>
                      <span className="text-muted-foreground">
                        {k.petugasNama} · {k.jalur} · {k.pada.slice(0, 16).replace("T", " ")}
                      </span>
                      {k.kodePola ? <Badge variant="outline">{k.kodePola}</Badge> : null}
                    </div>
                    <div className="mt-1 grid gap-1 sm:grid-cols-2">
                      <div>
                        <span className="text-muted-foreground">Usulan ALETA: </span>
                        {k.nilaiUsulan || "(kosong)"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Disimpan petugas: </span>
                        {k.nilaiAkhir}
                      </div>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Memuat...</p>
            )}
          </TabsContent>

          {/* ── PUSTAKA KALIMAT (D3) ── */}
          <TabsContent value="pustaka" className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Pustaka pertimbangan yang sama, kini juga untuk kalimat keterangan saksi, tuntutan, posita, dan amar. Label alasan (A-K) dan
              keadaan dipakai templat untuk memilih kalimat; label adalah usulan sampai butirnya disahkan.
            </p>
            <div className="grid gap-2 sm:grid-cols-5">
              <NativeSelect value={saringPustaka.keadaan} onChange={(e) => setSaringPustaka({ ...saringPustaka, keadaan: e.target.value })} aria-label="Keadaan butir">
                <option value="usulan">usulan</option>
                <option value="disahkan">disahkan</option>
              </NativeSelect>
              <NativeSelect value={saringPustaka.bagian} onChange={(e) => setSaringPustaka({ ...saringPustaka, bagian: e.target.value })} aria-label="Bagian">
                <option value="">semua bagian</option>
                {BAGIAN.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </NativeSelect>
              <Input value={saringPustaka.labelAlasan} onChange={(e) => setSaringPustaka({ ...saringPustaka, labelAlasan: e.target.value })} placeholder="alasan, mis. F" aria-label="Saring alasan" />
              <Input value={saringPustaka.labelKeadaan} onChange={(e) => setSaringPustaka({ ...saringPustaka, labelKeadaan: e.target.value })} placeholder="keadaan" aria-label="Saring keadaan" />
              <Input value={saringPustaka.cari} onChange={(e) => setSaringPustaka({ ...saringPustaka, cari: e.target.value })} placeholder="cari kata" aria-label="Cari kalimat" />
            </div>

            <div className="space-y-2 rounded-lg border border-dashed border-border/80 p-3">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tambah kalimat ke pustaka</div>
              <Textarea value={kalimatBaru.teks} onChange={(e) => setKalimatBaru({ ...kalimatBaru, teks: e.target.value })} rows={3} aria-label="Kalimat baru" />
              <div className="grid gap-2 sm:grid-cols-[12rem_10rem_minmax(0,1fr)_auto]">
                <NativeSelect value={kalimatBaru.bagian} onChange={(e) => setKalimatBaru({ ...kalimatBaru, bagian: e.target.value })} aria-label="Bagian kalimat baru">
                  {BAGIAN.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </NativeSelect>
                <Input value={kalimatBaru.alasan} onChange={(e) => setKalimatBaru({ ...kalimatBaru, alasan: e.target.value })} placeholder="alasan A-K" aria-label="Alasan kalimat baru" />
                <Input value={kalimatBaru.keadaan} onChange={(e) => setKalimatBaru({ ...kalimatBaru, keadaan: e.target.value })} placeholder="keadaan, dipisah koma" aria-label="Keadaan kalimat baru" />
                <Button
                  size="sm"
                  disabled={sibuk || kalimatBaru.teks.trim().length < 20}
                  onClick={async () => {
                    const d = await tindak(
                      { tindakan: "tambah", teks: kalimatBaru.teks, bagian: kalimatBaru.bagian, labelAlasan: kalimatBaru.alasan, labelKeadaan: kalimatBaru.keadaan },
                      "Kalimat masuk pustaka sebagai usulan.",
                      ALAMAT_PUSTAKA
                    );
                    if (d) {
                      setKalimatBaru({ ...kalimatBaru, teks: "" });
                      await muatPustaka();
                    }
                  }}
                >
                  Tambah
                </Button>
              </div>
            </div>

            {pustaka && !pustaka.length ? <p className="text-sm text-muted-foreground">Tidak ada butir yang cocok.</p> : null}
            {(pustaka ?? []).map((b) => {
              const l = labelSunting[b.id] ?? { bagian: b.bagian, alasan: b.labelAlasan.join(","), keadaan: b.labelKeadaan.join(",") };
              const setL = (x: Partial<typeof l>) => setLabelSunting({ ...labelSunting, [b.id]: { ...l, ...x } });
              return (
                <div key={b.id} className="space-y-2 border-t border-border/60 pt-2 text-sm">
                  <div className="whitespace-pre-wrap">{b.teks}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline">{b.bagian}</Badge>
                    {b.labelAlasan.map((x) => (
                      <Badge key={x} variant="info">
                        alasan {x}
                      </Badge>
                    ))}
                    {b.labelKeadaan.map((x) => (
                      <Badge key={x} variant="netral">
                        {x}
                      </Badge>
                    ))}
                    <span>
                      dipakai {b.jumlahPemakaian}× · {b.labelOleh ? "label ditetapkan orang" : "label belum ditetapkan"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[12rem_8rem_minmax(0,1fr)_auto_auto]">
                    <NativeSelect className="h-9" value={l.bagian} onChange={(e) => setL({ bagian: e.target.value })} aria-label="Bagian butir">
                      {BAGIAN.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </NativeSelect>
                    <Input className="h-9" value={l.alasan} onChange={(e) => setL({ alasan: e.target.value })} placeholder="A,F" aria-label="Label alasan" />
                    <Input className="h-9" value={l.keadaan} onChange={(e) => setL({ keadaan: e.target.value })} placeholder="keadaan" aria-label="Label keadaan" />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={sibuk}
                      onClick={async () => {
                        try {
                          const d = await kirimJson(ALAMAT_PUSTAKA, { tindakan: "usul-label", butirId: b.id });
                          if (d?.ok) setL({ alasan: (d.labelAlasan ?? []).join(","), keadaan: (d.labelKeadaan ?? []).join(",") });
                        } catch (e) {
                          setPesanGagal(e instanceof Error ? e.message : "Usulan label gagal.");
                        }
                      }}
                    >
                      Usulkan dari kamus
                    </Button>
                    <Button
                      size="sm"
                      disabled={sibuk}
                      onClick={async () => {
                        if (await tindak({ tindakan: "label", butirId: b.id, bagian: l.bagian, labelAlasan: l.alasan, labelKeadaan: l.keadaan }, "Label tersimpan.", ALAMAT_PUSTAKA))
                          await muatPustaka();
                      }}
                    >
                      Simpan label
                    </Button>
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
