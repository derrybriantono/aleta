"use client";

/**
 * ============================================================================
 * TOMBOL "PENETAPAN KEMBALI" - JADWAL SIDANG (6 Okt 2026)
 * ============================================================================
 *
 * Permintaan pengguna: pop-up penetapan kembali PMH, PPP, PJS, dan PHS -
 * satu perkara atau massal; tiap perkara boleh hanya sebagian jenis; alasan
 * satu untuk semua KECUALI perkara yang ditandai (pilihan di samping nomor
 * perkaranya), atau per perkara; penetap menurut jenis - PMH Ketua/Wakil
 * (dipilih), PPP & PJS Panitera/Plh Panitera (dipilih), PHS ketua majelis
 * perkara itu.
 *
 * Alurnya sama dengan tulisan SIPP lain dari portal: PRATINJAU (kering) dulu,
 * lalu tulis sungguhan dengan DUA tekanan, satu perkara satu jenis per
 * permintaan, hasilnya per perkara per jenis. Bentuk tulisannya - borang
 * "penetapan/penunjukan kembali" SIPP - dirakit bot (penetapanKembaliService).
 *
 * Komponen ini berdiri sendiri supaya aleta-ecourt-sidang.tsx cukup
 * menyisipkan satu baris; ia memeriksa sendiri kewenangan pemakainya dan diam
 * (tidak tergambar) bagi yang tidak berwenang.
 */

import { Loader2, RotateCcw, Search, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";
import { apiPath } from "@/lib/base-path";
import { kalimatLangkah } from "@/lib/ringkasan-langkah-sipp";
import { pesanGalatPortal } from "@/lib/pesan-galat-portal";
import {
  type BarisKembali,
  type ButirTulis,
  type JenisKembali,
  type Penetap,
  type PilihanAlasan,
  JENIS_KEMBALI,
  PILIHAN_ALASAN,
  badanTulis,
  kalimatTolakKembali,
  penetapPhs,
  sidikAntrean,
  susunAntreanKembali,
} from "@/lib/penetapan-kembali";
import { cn } from "@/lib/utils";

const ALAMAT = "/api/aleta-ecourt/penetapan-kembali";

const kelasMedan =
  "h-8 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

type Pilihan = { id: number; nama: string };
type Calon = { username: string; namaLengkap: string; sebutan: string; siap: boolean; sebab: string; otomatis: boolean };
type KeadaanPerkara = {
  perkaraId: number;
  nomorPerkara: string;
  sudahPutus: boolean;
  pmh: { tanggal: string; majelis: Array<{ hakimId: number; nama: string; jabatan: string }> };
  ppp: { tanggal: string; id: number; teks: string };
  pjs: { tanggal: string; id: number; teks: string };
  phs: { tanggal: string; tanggalSidang: string; jam: string; ruanganId: number; ruangan: string };
};
type Akun = { ok: boolean; username?: string; milik: string[]; pesan?: string; alasan?: string };
type HasilButir = { keadaan: "jalan" | "ok" | "tolak" | "dilewati"; pesan: string; rincian?: string[] };

async function bacaJson(jawaban: Response): Promise<Record<string, unknown>> {
  const isi = (await jawaban.json().catch(() => ({}))) as Record<string, unknown>;
  if (!jawaban.ok) throw new Error(pesanGalatPortal(isi, `HTTP ${jawaban.status}`));
  return ((isi && (isi.data as Record<string, unknown>)) ?? isi) as Record<string, unknown>;
}

function hariIniLokal() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** Kewenangan dibaca SEKALI per halaman - tombol ini ada di tiap muat ulang jadwal. */
let simpananBoleh: Promise<boolean> | null = null;
function bolehPenetapanKembali(): Promise<boolean> {
  if (!simpananBoleh) {
    simpananBoleh = fetch(apiPath(`${ALAMAT}?cek=1`), { cache: "no-store" })
      .then((r) => bacaJson(r))
      .then((d) => d.boleh === true)
      .catch(() => false);
  }
  return simpananBoleh;
}

function barisAwal(k: KeadaanPerkara, ruanganBawaan: number): BarisKembali {
  const ketua = k.pmh.majelis[0];
  return {
    perkaraId: k.perkaraId,
    nomorPerkara: k.nomorPerkara,
    jenis: {},
    hakimId: k.pmh.majelis.map((m) => m.hakimId),
    pppId: k.ppp.id,
    pjsId: k.pjs.id,
    tanggalSidang: "",
    jamSidang: k.phs.jam || "09:00",
    ruanganId: k.phs.ruanganId || ruanganBawaan,
    alasanSendiri: false,
    alasan: { kode: "", lainnya: "" },
    ketuaMajelis: ketua ? { hakimId: ketua.hakimId, nama: ketua.nama } : null,
  };
}

function PilihAlasan({ nilai, ubah, label }: { nilai: PilihanAlasan; ubah: (x: PilihanAlasan) => void; label: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <select aria-label={label} className={kelasMedan} value={nilai.kode} onChange={(e) => ubah({ ...nilai, kode: e.target.value as PilihanAlasan["kode"] })}>
        <option value="">— pilih alasan —</option>
        {PILIHAN_ALASAN.map((a) => (
          <option key={a.kode} value={a.kode}>
            {a.label}
          </option>
        ))}
      </select>
      {nilai.kode === "lainnya" ? (
        <input
          aria-label={`${label} - lainnya`}
          className={cn(kelasMedan, "w-56")}
          maxLength={450}
          placeholder="Tulis alasannya"
          value={nilai.lainnya}
          onChange={(e) => ubah({ ...nilai, lainnya: e.target.value })}
        />
      ) : null}
    </span>
  );
}

function PilihPenetap({
  label,
  calon,
  nilai,
  manual,
  ubah,
  ubahManual,
}: {
  label: string;
  calon: Calon[];
  nilai: string;
  manual: string;
  ubah: (x: string) => void;
  ubahManual: (x: string) => void;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <select aria-label={label} className={cn(kelasMedan, "min-w-56")} value={nilai} onChange={(e) => ubah(e.target.value)}>
          {calon.map((c) => (
            <option key={c.username} value={c.username}>
              {c.namaLengkap || c.username} — {c.sebutan}
              {c.otomatis ? " (otomatis)" : ""}
            </option>
          ))}
          <option value="__manual">Ketik nama penetap…</option>
        </select>
        {nilai === "__manual" || calon.length === 0 ? (
          <input aria-label={`${label} - manual`} className={cn(kelasMedan, "w-56")} placeholder="Nama dan jabatan (mis. Plh Panitera)" value={manual} onChange={(e) => ubahManual(e.target.value)} />
        ) : null}
      </span>
    </label>
  );
}

const WARNA: Record<HasilButir["keadaan"], string> = {
  jalan: "border-sky-500/40 text-sky-700 dark:text-sky-300",
  ok: "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
  tolak: "border-rose-500/40 text-rose-700 dark:text-rose-300",
  dilewati: "border-border text-muted-foreground",
};

export function TombolPenetapanKembali({ sidang }: { sidang: ReadonlyArray<{ perkaraId: string; nomorPerkara: string }> }) {
  const [boleh, setBoleh] = useState(false);
  const [terbuka, setTerbuka] = useState(false);

  useEffect(() => {
    let hidup = true;
    void bolehPenetapanKembali().then((x) => {
      if (hidup) setBoleh(x);
    });
    return () => {
      hidup = false;
    };
  }, []);

  if (!boleh) return null;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setTerbuka(true)}
        title="Penetapan kembali PMH, PPP, PJS, atau PHS - satu perkara atau massal, beserta alasannya. Dipratinjau dulu sebelum ditulis ke SIPP."
      >
        <RotateCcw className="mr-1.5 h-4 w-4" />
        Penetapan kembali
      </Button>
      {terbuka ? <PopupPenetapanKembali sidang={sidang} onTutup={() => setTerbuka(false)} /> : null}
    </>
  );
}

export function PopupPenetapanKembali({
  sidang,
  onTutup,
}: {
  sidang: ReadonlyArray<{ perkaraId: string; nomorPerkara: string }>;
  onTutup: () => void;
}) {
  // Perkara yang dapat dipilih: dari jadwal yang tampil, ditambah hasil cari.
  const awal = useMemo(() => {
    const peta = new Map<number, string>();
    for (const s of sidang) {
      const id = Number(s.perkaraId);
      if (id > 0 && !peta.has(id)) peta.set(id, s.nomorPerkara);
    }
    return [...peta.entries()].map(([perkaraId, nomorPerkara]) => ({ perkaraId, nomorPerkara }));
  }, [sidang]);
  const [tambahan, setTambahan] = useState<Array<{ perkaraId: number; nomorPerkara: string }>>([]);
  const semuaPerkara = useMemo(() => [...awal, ...tambahan.filter((t) => !awal.some((a) => a.perkaraId === t.perkaraId))], [awal, tambahan]);
  const [dipilih, setDipilih] = useState<Record<number, boolean>>({});
  const [saring, setSaring] = useState("");

  const [keadaan, setKeadaan] = useState<Record<number, KeadaanPerkara>>({});
  const [baris, setBaris] = useState<Record<number, BarisKembali>>({});
  const [ref, setRef] = useState<{ hakim: Pilihan[]; panitera: Pilihan[]; jurusita: Pilihan[]; ruangan: Pilihan[] }>({
    hakim: [],
    panitera: [],
    jurusita: [],
    ruangan: [],
  });
  const [calon, setCalon] = useState<{ pmh: Calon[]; panitera: Calon[]; catatan: string[] }>({ pmh: [], panitera: [], catatan: [] });
  const [akun, setAkun] = useState<Akun | null>(null);
  const [akunPilihan, setAkunPilihan] = useState("");
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");

  const [tanggalPenetapan, setTanggalPenetapan] = useState(hariIniLokal());
  const [alasanSama, setAlasanSama] = useState(true);
  const [alasan, setAlasan] = useState<PilihanAlasan>({ kode: "", lainnya: "" });
  const [penetapPmh, setPenetapPmh] = useState("");
  const [penetapPanitera, setPenetapPanitera] = useState("");
  const [manualPmh, setManualPmh] = useState("");
  const [manualPanitera, setManualPanitera] = useState("");

  const [kataCari, setKataCari] = useState("");
  const [temuan, setTemuan] = useState<Array<{ perkaraId: number; nomorPerkara: string }>>([]);

  const [hasil, setHasil] = useState<Record<string, HasilButir>>({});
  const [sidikPratinjau, setSidikPratinjau] = useState<string | null>(null);
  const [sedang, setSedang] = useState(false);
  // Tekanan pertama "dipasang" untuk satu sidik antrean; isian yang berubah
  // sesudahnya memadamkannya dengan sendirinya (sidik berbeda).
  const [yakinUntuk, setYakinUntuk] = useState<string | null>(null);
  const penundaYakin = useRef<ReturnType<typeof setTimeout> | null>(null);

  const terima = useCallback((d: Record<string, unknown>) => {
    const r = d.referensi as typeof ref | undefined;
    if (r) setRef({ hakim: r.hakim ?? [], panitera: r.panitera ?? [], jurusita: r.jurusita ?? [], ruangan: r.ruangan ?? [] });
    const c = d.calon as typeof calon | null | undefined;
    if (c) {
      setCalon({ pmh: c.pmh ?? [], panitera: c.panitera ?? [], catatan: c.catatan ?? [] });
      setPenetapPmh((x) => x || c.pmh?.[0]?.username || (c.pmh?.length ? "" : "__manual"));
      setPenetapPanitera((x) => x || c.panitera?.[0]?.username || (c.panitera?.length ? "" : "__manual"));
    }
    if (d.akun) {
      const a = d.akun as Akun;
      setAkun(a);
      if (!a.ok && a.milik?.length) setAkunPilihan((x) => x || a.milik[0]);
    }
    const daftar = (Array.isArray(d.perkara) ? d.perkara : []) as KeadaanPerkara[];
    if (daftar.length) {
      const ruangBawaan = r?.ruangan?.[0]?.id ?? 0;
      setKeadaan((x) => ({ ...x, ...Object.fromEntries(daftar.map((k) => [k.perkaraId, k])) }));
      setBaris((x) => {
        const baru = { ...x };
        for (const k of daftar) if (!baru[k.perkaraId]) baru[k.perkaraId] = barisAwal(k, ruangBawaan);
        return baru;
      });
    }
    if (Array.isArray(d.temuan)) setTemuan(d.temuan as typeof temuan);
    if (d.ok === false && d.alasan) setGalat(String(d.alasan));
  }, []);

  const muat = useCallback(
    async (param: Record<string, string>) => {
      setMemuat(true);
      setGalat("");
      try {
        const q = new URLSearchParams(param).toString();
        terima(await bacaJson(await fetch(apiPath(`${ALAMAT}?${q}`), { cache: "no-store" })));
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Keadaan penetapan tidak terbaca.");
      } finally {
        setMemuat(false);
      }
    },
    [terima]
  );

  // Seluruh perkara jadwal yang tampil sekaligus (bot membatasi 60) - hanya
  // saat dibuka; perubahan tanggal memuat ulang calon penetap di bawah.
  const muatAwal = useRef({ perkaraId: awal.map((x) => x.perkaraId).join(","), tanggal: tanggalPenetapan });
  useEffect(() => {
    let hidup = true;
    const t = setTimeout(() => {
      if (hidup) void muat(muatAwal.current);
    }, 0);
    return () => {
      hidup = false;
      clearTimeout(t);
    };
  }, [muat]);

  // Calon penetap bergantung tanggal penetapan (cuti, Plh pada tanggal itu).
  const tanggalPertama = useRef(tanggalPenetapan);
  useEffect(() => {
    if (tanggalPenetapan === tanggalPertama.current) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalPenetapan)) return;
    const t = setTimeout(() => {
      setPenetapPmh("");
      setPenetapPanitera("");
      void muat({ tanggal: tanggalPenetapan });
    }, 400);
    return () => clearTimeout(t);
  }, [tanggalPenetapan, muat]);

  const namaHakim = useCallback(
    (id: number) => {
      const r = ref.hakim.find((h) => h.id === id);
      if (r) return r.nama;
      for (const k of Object.values(keadaan)) {
        const m = k.pmh.majelis.find((x) => x.hakimId === id);
        if (m) return m.nama;
      }
      return "";
    },
    [ref.hakim, keadaan]
  );

  const penetapDari = (pilih: string, manual: string, daftar: Calon[]): Penetap | null => {
    if (pilih === "__manual" || daftar.length === 0) {
      const n = manual.trim();
      return n ? { username: "", nama: n, sebutan: "" } : null;
    }
    const c = daftar.find((x) => x.username === pilih) ?? daftar[0];
    return c ? { username: c.username, nama: c.namaLengkap, sebutan: c.sebutan } : null;
  };

  const terpilih = semuaPerkara.filter((p) => dipilih[p.perkaraId]);
  const barisTerpilih = terpilih.map((p) => baris[p.perkaraId]).filter(Boolean) as BarisKembali[];
  const atur = {
    tanggalPenetapan,
    alasanSama,
    alasan,
    penetap: {
      pmh: penetapDari(penetapPmh, manualPmh, calon.pmh),
      ppp: penetapDari(penetapPanitera, manualPanitera, calon.panitera),
      pjs: penetapDari(penetapPanitera, manualPanitera, calon.panitera),
    },
  };
  const susun = susunAntreanKembali(barisTerpilih, atur, namaHakim);
  const sidik = sidikAntrean(susun.butir);
  const pratinjauBerlaku = sidikPratinjau !== null && sidikPratinjau === sidik;
  const lolos = susun.butir.filter((b) => hasil[b.kunci]?.keadaan === "ok");
  const akunSipp = akun?.ok ? akun.username ?? "" : akunPilihan;
  const akunSiap = Boolean(akun && (akun.ok || (akun.alasan === "akun_sipp_ganda" && akunPilihan)));

  const ubahBaris = (id: number, f: (b: BarisKembali) => BarisKembali) => {
    setBaris((x) => (x[id] ? { ...x, [id]: f(x[id]) } : x));
  };

  const yakin = yakinUntuk !== null && yakinUntuk === sidik;
  const lepasYakin = () => {
    setYakinUntuk(null);
    if (penundaYakin.current) clearTimeout(penundaYakin.current);
  };

  async function jalankan(kering: boolean) {
    const antre: ButirTulis[] = kering ? susun.butir : lolos;
    if (antre.length === 0) return;
    setSedang(true);
    setGalat("");
    const awalHasil: Record<string, HasilButir> = {};
    for (const b of antre) awalHasil[b.kunci] = { keadaan: "jalan", pesan: kering ? "memeriksa…" : "menunggu giliran…" };
    setHasil((x) => (kering ? awalHasil : { ...x, ...awalHasil }));
    // Pada penulisan sungguhan, kegagalan satu jenis menghentikan jenis
    // berikutnya PERKARA ITU SAJA - perkara lain tetap jalan.
    const perkaraGagal = new Set<number>();
    try {
      for (const b of antre) {
        if (!kering && perkaraGagal.has(b.perkaraId)) {
          setHasil((x) => ({ ...x, [b.kunci]: { keadaan: "dilewati", pesan: "dilewati - jenis sebelumnya pada perkara ini gagal" } }));
          continue;
        }
        let isi: Record<string, unknown>;
        try {
          isi = await bacaJson(
            await fetch(apiPath(ALAMAT), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(badanTulis(b, { kering, akunSipp })),
            })
          );
        } catch (e) {
          isi = { ok: false, alasan: e instanceof Error ? e.message : "gagal" };
        }
        const berhasil = isi.ok === true;
        if (!berhasil) perkaraGagal.add(b.perkaraId);
        const rencana = Array.isArray(isi.rencana) ? (isi.rencana as Array<{ tabel: string; aksi: string; keterangan: string }>) : [];
        const catatan = Array.isArray(isi.catatan) ? (isi.catatan as string[]) : [];
        setHasil((x) => ({
          ...x,
          [b.kunci]: berhasil
            ? {
                keadaan: "ok",
                pesan: kering
                  ? `siap: ${String(isi.jumlahLangkah ?? rencana.length)} pernyataan${isi.ringkas ? ` - ${String(isi.ringkas)}` : ""}`
                  : `tertulis di SIPP${isi.ringkas ? ` - ${String(isi.ringkas)}` : ""}`,
                rincian: [...catatan, ...rencana.map((r) => kalimatLangkah(r)).filter((k): k is string => k !== null)],
              }
            : { keadaan: "tolak", pesan: kalimatTolakKembali(String(isi.alasan || isi.pesan || "ditolak")) },
        }));
      }
      if (kering) setSidikPratinjau(sidik);
      else setSidikPratinjau(null);
    } finally {
      setSedang(false);
    }
  }

  const tekanTulis = () => {
    if (!yakin) {
      setYakinUntuk(sidik);
      penundaYakin.current = setTimeout(() => setYakinUntuk(null), 8000);
      return;
    }
    lepasYakin();
    void jalankan(false);
  };

  const daftarTampil = semuaPerkara.filter((p) => !saring.trim() || p.nomorPerkara.toLowerCase().includes(saring.trim().toLowerCase()));

  // Lewat portal ke document.body: induk ber-transform di Jadwal Sidang membuat
  // "fixed" ikut induknya, dan pop-up muncul di puncak halaman (6 Okt 2026).
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Penetapan kembali"
      onClick={onTutup}
    >
      <div className="my-4 w-full max-w-5xl rounded-lg border bg-card p-4 text-card-foreground shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">Penetapan kembali</h3>
            <p className="text-sm text-muted-foreground">
              PMH, PPP, PJS, dan PHS pengganti - ditulis ke SIPP dalam bentuk blangko &quot;penetapan/penunjukan kembali&quot; SIPP. Pratinjau dulu,
              lalu tulis dengan dua tekanan.
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onTutup} aria-label="Tutup">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {galat ? <p className="mb-3 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{galat}</p> : null}

        {/* Akun yang tercatat di SIPP */}
        <div className="mb-3 rounded-md border bg-muted/40 px-3 py-2 text-sm">
          {!akun ? (
            <span className="text-muted-foreground">Membaca akun SIPP Anda…</span>
          ) : akun.ok ? (
            <span>
              Tercatat di SIPP atas akun SIPP Anda: <b>{akun.username}</b>. Penetap di bawah hanya dicatat di riwayat ALETA.
            </span>
          ) : akun.alasan === "akun_sipp_ganda" ? (
            <label className="flex flex-wrap items-center gap-2">
              <span>Akun SIPP yang dipakai:</span>
              <select className={kelasMedan} value={akunPilihan} onChange={(e) => setAkunPilihan(e.target.value)}>
                {akun.milik.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-amber-700 dark:text-amber-300">{akun.pesan || "Akun SIPP Anda belum tertaut - pratinjau dan penulisan tidak dapat dijalankan."}</span>
          )}
        </div>

        {/* Pengaturan bersama */}
        <section className="mb-3 grid gap-3 rounded-md border p-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Tanggal penetapan kembali</span>
            <input type="date" aria-label="Tanggal penetapan kembali" className={kelasMedan} value={tanggalPenetapan} max={hariIniLokal()} onChange={(e) => setTanggalPenetapan(e.target.value)} />
          </label>
          <div className="grid gap-1 text-sm">
            <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <input type="checkbox" aria-label="Alasan sama untuk semua" checked={alasanSama} onChange={(e) => setAlasanSama(e.target.checked)} />
              Alasan sama untuk semua perkara (kecuali yang ditandai &quot;alasan sendiri&quot;)
            </label>
            {alasanSama ? <PilihAlasan label="Alasan untuk semua" nilai={alasan} ubah={setAlasan} /> : <span className="text-xs text-muted-foreground">Alasan dipilih per perkara di samping nomornya.</span>}
          </div>
          <PilihPenetap
            label="Penetap PMH - Ketua / Wakil Ketua / Plh"
            calon={calon.pmh}
            nilai={penetapPmh}
            manual={manualPmh}
            ubah={setPenetapPmh}
            ubahManual={setManualPmh}
          />
          <PilihPenetap
            label="Penetap PPP & PJS - Panitera / Plh Panitera"
            calon={calon.panitera}
            nilai={penetapPanitera}
            manual={manualPanitera}
            ubah={setPenetapPanitera}
            ubahManual={setManualPanitera}
          />
          <p className="text-xs text-muted-foreground sm:col-span-2">
            Penetap PHS = ketua majelis perkara itu (ketua majelis BARU bila PMH perkara itu ikut ditetapkan kembali).
            {calon.catatan.length ? ` ${calon.catatan.join(" ")}` : ""}
          </p>
        </section>

        {/* Pilih perkara */}
        <section className="mb-3 rounded-md border p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Perkara ({terpilih.length} dipilih)</h4>
            <input aria-label="Saring nomor perkara" className={cn(kelasMedan, "w-48")} placeholder="Saring nomor…" value={saring} onChange={(e) => setSaring(e.target.value)} />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDipilih((x) => ({ ...x, ...Object.fromEntries(daftarTampil.map((p) => [p.perkaraId, true])) }))}
            >
              Pilih semua yang tampil
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDipilih({})}>
              Kosongkan
            </Button>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <input
                aria-label="Cari perkara di SIPP"
                className={cn(kelasMedan, "w-44")}
                placeholder="Tambah: nomor perkara"
                value={kataCari}
                onChange={(e) => setKataCari(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && kataCari.trim().length >= 2) void muat({ cari: kataCari.trim(), penetap: "0" });
                }}
              />
              <Button size="sm" variant="outline" disabled={kataCari.trim().length < 2 || memuat} onClick={() => void muat({ cari: kataCari.trim(), penetap: "0" })}>
                <Search className="mr-1 h-3.5 w-3.5" />
                Cari
              </Button>
            </span>
          </div>
          {temuan.length ? (
            <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
              {temuan.map((t) => (
                <Button
                  key={t.perkaraId}
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setTambahan((x) => (x.some((y) => y.perkaraId === t.perkaraId) ? x : [...x, t]));
                    setDipilih((x) => ({ ...x, [t.perkaraId]: true }));
                    if (!keadaan[t.perkaraId]) void muat({ perkaraId: String(t.perkaraId), penetap: "0" });
                    setTemuan([]);
                    setKataCari("");
                  }}
                >
                  + {t.nomorPerkara}
                </Button>
              ))}
            </div>
          ) : null}
          {memuat && !Object.keys(keadaan).length ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              Membaca penetapan perkara di SIPP…
            </p>
          ) : null}
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {daftarTampil.map((p) => (
              <label key={p.perkaraId} className={cn("inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs", dipilih[p.perkaraId] && "border-primary bg-primary/10")}>
                <input type="checkbox" aria-label={`Pilih ${p.nomorPerkara}`} checked={Boolean(dipilih[p.perkaraId])} onChange={(e) => setDipilih((x) => ({ ...x, [p.perkaraId]: e.target.checked }))} />
                {p.nomorPerkara}
              </label>
            ))}
            {daftarTampil.length === 0 ? <span className="text-xs text-muted-foreground">Tidak ada perkara - cari nomor perkara di SIPP.</span> : null}
          </div>
        </section>

        {/* Isian per perkara */}
        <div className="grid gap-2">
          {terpilih.map((p) => {
            const b = baris[p.perkaraId];
            const k = keadaan[p.perkaraId];
            if (!b || !k) {
              return (
                <div key={p.perkaraId} className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
                  {p.nomorPerkara}: keadaan penetapannya belum terbaca.
                </div>
              );
            }
            const phsPenetap = penetapPhs(b, namaHakim);
            return (
              <div key={p.perkaraId} className="rounded-md border p-3 text-sm" data-perkara-kembali={p.perkaraId}>
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{k.nomorPerkara}</span>
                  {k.sudahPutus ? <span className="rounded border border-amber-500/40 px-1 text-xs text-amber-700 dark:text-amber-300">sudah diputus</span> : null}
                  {alasanSama ? (
                    <label className="inline-flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        aria-label={`Alasan sendiri ${k.nomorPerkara}`}
                        checked={b.alasanSendiri}
                        onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, alasanSendiri: e.target.checked }))}
                      />
                      alasan sendiri
                    </label>
                  ) : null}
                  {!alasanSama || b.alasanSendiri ? (
                    <PilihAlasan label={`Alasan ${k.nomorPerkara}`} nilai={b.alasan} ubah={(a) => ubahBaris(p.perkaraId, (x) => ({ ...x, alasan: a }))} />
                  ) : null}
                  <span className="ml-auto inline-flex flex-wrap gap-2">
                    {JENIS_KEMBALI.map((j) => {
                      const ada = Boolean(k[j].tanggal);
                      return (
                        <label key={j} className={cn("inline-flex items-center gap-1 text-xs", !ada && "opacity-50")} title={ada ? "" : `${j.toUpperCase()} pertama belum ada - tidak dapat ditetapkan kembali`}>
                          <input
                            type="checkbox"
                            aria-label={`${j.toUpperCase()} ${k.nomorPerkara}`}
                            disabled={!ada}
                            checked={Boolean(b.jenis[j])}
                            onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, jenis: { ...x.jenis, [j]: e.target.checked } }))}
                          />
                          {j.toUpperCase()}
                        </label>
                      );
                    })}
                  </span>
                </div>

                <div className="grid gap-2">
                  {b.jenis.pmh ? (
                    <BarisJenis jenis="pmh" sekarang={k.pmh.majelis.map((m) => m.nama).join(", ") || "-"} hasil={hasil[`${p.perkaraId}:pmh`]}>
                      <label className="inline-flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={b.hakimId.length === 1}
                          onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, hakimId: e.target.checked ? x.hakimId.slice(0, 1) : [x.hakimId[0] ?? 0, x.hakimId[1] ?? 0, x.hakimId[2] ?? 0] }))}
                        />
                        hakim tunggal
                      </label>
                      {(b.hakimId.length === 1 ? [0] : [0, 1, 2]).map((i) => (
                        <select
                          key={i}
                          aria-label={`${i === 0 ? (b.hakimId.length === 1 ? "Hakim tunggal" : "Ketua majelis") : `Anggota ${i}`} ${k.nomorPerkara}`}
                          className={kelasMedan}
                          value={b.hakimId[i] ?? 0}
                          onChange={(e) =>
                            ubahBaris(p.perkaraId, (x) => {
                              const h = [...x.hakimId];
                              h[i] = Number(e.target.value);
                              return { ...x, hakimId: h };
                            })
                          }
                        >
                          <option value={0}>{i === 0 ? (b.hakimId.length === 1 ? "Hakim tunggal" : "Ketua") : `Anggota ${i}`}</option>
                          {ref.hakim.map((h) => (
                            <option key={h.id} value={h.id}>
                              {h.nama}
                            </option>
                          ))}
                        </select>
                      ))}
                    </BarisJenis>
                  ) : null}
                  {b.jenis.ppp ? (
                    <BarisJenis jenis="ppp" sekarang={k.ppp.teks || "-"} hasil={hasil[`${p.perkaraId}:ppp`]}>
                      <select aria-label={`Panitera pengganti ${k.nomorPerkara}`} className={kelasMedan} value={b.pppId} onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, pppId: Number(e.target.value) }))}>
                        <option value={0}>Panitera pengganti</option>
                        {ref.panitera.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nama}
                          </option>
                        ))}
                      </select>
                    </BarisJenis>
                  ) : null}
                  {b.jenis.pjs ? (
                    <BarisJenis jenis="pjs" sekarang={k.pjs.teks || "-"} hasil={hasil[`${p.perkaraId}:pjs`]}>
                      <select aria-label={`Juru sita ${k.nomorPerkara}`} className={kelasMedan} value={b.pjsId} onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, pjsId: Number(e.target.value) }))}>
                        <option value={0}>Juru sita</option>
                        {ref.jurusita.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nama}
                          </option>
                        ))}
                      </select>
                    </BarisJenis>
                  ) : null}
                  {b.jenis.phs ? (
                    <BarisJenis
                      jenis="phs"
                      sekarang={`${k.phs.tanggalSidang || "-"}${k.phs.jam ? ` ${k.phs.jam}` : ""}${k.phs.ruangan ? `, ${k.phs.ruangan}` : ""}`}
                      hasil={hasil[`${p.perkaraId}:phs`]}
                    >
                      <input type="date" aria-label={`Tanggal sidang baru ${k.nomorPerkara}`} className={kelasMedan} value={b.tanggalSidang} min={tanggalPenetapan} onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, tanggalSidang: e.target.value }))} />
                      <input type="time" aria-label={`Jam sidang ${k.nomorPerkara}`} className={kelasMedan} value={b.jamSidang} onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, jamSidang: e.target.value.slice(0, 5) }))} />
                      <select aria-label={`Ruang sidang ${k.nomorPerkara}`} className={kelasMedan} value={b.ruanganId} onChange={(e) => ubahBaris(p.perkaraId, (x) => ({ ...x, ruanganId: Number(e.target.value) }))}>
                        <option value={0}>Ruang sidang</option>
                        {ref.ruangan.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.nama}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">penetap: {phsPenetap ? `${phsPenetap.sebutan} ${phsPenetap.nama}` : "ketua majelis tidak terbaca"}</span>
                    </BarisJenis>
                  ) : null}
                  {!JENIS_KEMBALI.some((j) => b.jenis[j]) ? <p className="text-xs text-muted-foreground">Centang jenis yang ditetapkan kembali (boleh sebagian).</p> : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Masalah, tombol, hasil */}
        {susun.masalah.length ? (
          <ul className="mt-3 grid gap-0.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {susun.masalah.map((m, i) => (
              <li key={i}>
                {m.nomorPerkara ? `${m.nomorPerkara}${m.jenis ? ` ${m.jenis.toUpperCase()}` : ""}: ` : ""}
                {m.pesan}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" disabled={sedang || !akunSiap || susun.butir.length === 0} onClick={() => void jalankan(true)}>
            {sedang ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Pratinjau ({susun.butir.length} penetapan)
          </Button>
          <Button size="sm" variant={yakin ? "destructive" : "default"} disabled={sedang || !akunSiap || !pratinjauBerlaku || lolos.length === 0} onClick={tekanTulis}>
            {yakin ? `Yakin? Tekan lagi untuk menulis ${lolos.length} penetapan ke SIPP` : `Tulis ke SIPP (${lolos.length})`}
          </Button>
          <span className="text-xs text-muted-foreground">
            {pratinjauBerlaku
              ? "Pratinjau berlaku. Yang ditolak pratinjau tidak ikut ditulis."
              : sidikPratinjau
                ? "Isian berubah sesudah pratinjau - pratinjau ulang dulu."
                : "Tulis ke SIPP menyala sesudah pratinjau."}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BarisJenis({
  jenis,
  sekarang,
  hasil,
  children,
}: {
  jenis: JenisKembali;
  sekarang: string;
  hasil?: HasilButir;
  children: ReactNode;
}) {
  const [buka, setBuka] = useState(false);
  return (
    <div className="rounded border px-2 py-1.5" data-jenis-kembali={jenis}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-14 text-xs font-semibold">{jenis.toUpperCase()}</span>
        {children}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">sekarang: {sekarang}</div>
      {hasil ? (
        <div className={cn("mt-1 rounded border px-1.5 py-0.5 text-xs", WARNA[hasil.keadaan])}>
          {hasil.pesan}
          {hasil.rincian?.length ? (
            <button type="button" className="ml-2 underline" onClick={() => setBuka((x) => !x)}>
              {buka ? "sembunyikan rincian" : "rincian"}
            </button>
          ) : null}
          {buka && hasil.rincian ? (
            <ul className="mt-1 list-disc pl-4">
              {hasil.rincian.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
