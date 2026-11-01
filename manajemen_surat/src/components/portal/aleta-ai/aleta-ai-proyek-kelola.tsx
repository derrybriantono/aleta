"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, CircleAlert, FileText, FolderPlus, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ambil, kirimJson } from "@/lib/aleta-ai/klien";

/**
 * Pengelolaan proyek ALETA Ai - HANYA Super Admin (layar ini hanya dipasang di Pengaturan ALETA Ai,
 * dan server menolak peran lain dengan 403). Pengguna lain hanya memilih proyek saat bertanya.
 */

type Akses = "semua" | "peran" | "pengguna";
type Ringkas = {
  id: string;
  nama: string;
  deskripsi: string;
  sertakanBawaan: boolean;
  akses: Akses;
  aksesPeran: string[];
  aksesPengguna: string[];
  memoriAktif: boolean;
  aktif: boolean;
  versi: number;
  jumlahBerkas: number;
  jumlahMemori: number;
  jumlahUsulan: number;
  diubah: string;
};
type Berkas = { id: string; nama: string; jenis: string; ukuran: number; karakter: number; selalu: boolean; diubah: string };
type Memori = { id: string; isi: string; status: "disetujui" | "usulan"; sumber: string; dibuat: string };
type Rincian = Ringkas & { instruksi: string; berkas: Berkas[]; memori: Memori[]; riwayat: Array<{ aksi: string; ringkas: string; oleh: string; waktu: string }> };
type Orang = { id: string; name: string; jabatan?: string };
type HasilUnggah = { hasil: Array<{ nama: string; galat?: string; diganti?: boolean; peringatan?: string[]; zip?: boolean; jumlahBerkas?: number }> };

const KATA_AKSI: Record<string, string> = {
  buat: "Proyek dibuat",
  ubah: "Pengaturan diubah",
  hapus: "Proyek dihapus",
  "berkas-tambah": "Berkas ditambah",
  "berkas-ganti": "Berkas diganti",
  "berkas-ubah": "Berkas disunting",
  "berkas-hapus": "Berkas dihapus",
  "impor-zip": "Impor ZIP",
  "memori-tambah": "Memori ditambah",
  "memori-ubah": "Memori diubah",
  "memori-hapus": "Memori dihapus",
  "memori-setuju": "Usulan memori disetujui",
  "memori-tolak": "Usulan memori ditolak",
  "memori-usulan": "Usulan memori baru",
};

const ukuranTampil = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const tanggalTampil = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

function Kabar({ teks, baik }: { teks: string; baik: boolean }) {
  if (!teks) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 break-words rounded-md border px-3 py-2 text-sm ${
        baik ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {baik ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
      <span className="min-w-0 whitespace-pre-line">{teks}</span>
    </p>
  );
}

function Sub({ judul, deskripsi, children }: { judul: string; deskripsi?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4">
      <div>
        <h4 className="text-base font-semibold">{judul}</h4>
        {deskripsi ? <p className="text-sm text-muted-foreground">{deskripsi}</p> : null}
      </div>
      {children}
    </section>
  );
}

function BarisSakelar({ id, label, hint, nilai, onUbah }: { id: string; label: string; hint?: string; nilai: boolean; onUbah: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={id} className="min-w-0 text-sm">
        <span className="font-medium">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </label>
      <Switch id={id} checked={nilai} onCheckedChange={onUbah} aria-label={label} />
    </div>
  );
}

export function AletaAiProyekKelola({ pengguna, peran }: { pengguna: Orang[]; peran: Array<{ id: string; name: string }> }) {
  const [daftar, setDaftar] = useState<Ringkas[] | null>(null);
  const [galatDaftar, setGalatDaftar] = useState("");
  const [terbuka, setTerbuka] = useState<string | null>(null);
  const [kabar, setKabar] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [sibuk, setSibuk] = useState(false);
  const [namaBaru, setNamaBaru] = useState("");
  const berkasImpor = useRef<HTMLInputElement>(null);

  const muatDaftar = useCallback(async () => {
    const r = await ambil<Ringkas[]>("/api/aleta-ai/proyek/kelola");
    if (!r.ok) {
      setGalatDaftar(r.galat);
      return;
    }
    setGalatDaftar("");
    setDaftar(r.data);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari server
    void muatDaftar();
  }, [muatDaftar]);

  async function buat() {
    const nama = namaBaru.trim();
    if (!nama || sibuk) return;
    setSibuk(true);
    const r = await kirimJson<Ringkas>("/api/aleta-ai/proyek/kelola", "POST", { nama });
    setSibuk(false);
    if (!r.ok) return setKabar({ teks: r.galat, baik: false });
    setNamaBaru("");
    setKabar({ teks: `Proyek "${r.data.nama}" dibuat. Isi instruksi dan unggah berkasnya.`, baik: true });
    await muatDaftar();
    setTerbuka(r.data.id);
  }

  async function imporZip(f: File | null) {
    if (!f || sibuk) return;
    setSibuk(true);
    const data = new FormData();
    data.append("berkas", f);
    const r = await ambil<{ proyek: Ringkas; jumlahBerkas: number; dilewati: string[]; peringatan: string[] }>("/api/aleta-ai/proyek/kelola", { method: "POST", body: data });
    setSibuk(false);
    if (berkasImpor.current) berkasImpor.current.value = "";
    if (!r.ok) return setKabar({ teks: r.galat, baik: false });
    setKabar({ teks: `Proyek "${r.data.proyek.nama}" diimpor: ${r.data.jumlahBerkas} berkas.${r.data.dilewati.length ? ` ${r.data.dilewati.length} berkas dilewati.` : ""}`, baik: true });
    await muatDaftar();
    setTerbuka(r.data.proyek.id);
  }

  if (terbuka) {
    return (
      <DetailProyek
        id={terbuka}
        pengguna={pengguna}
        peran={peran}
        onKembali={() => {
          setTerbuka(null);
          void muatDaftar();
        }}
      />
    );
  }

  return (
    <Card className="border-border/80" id="proyek-pengetahuan">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Proyek pengetahuan</CardTitle>
        <CardDescription>
          Buat banyak proyek, masing-masing dengan instruksi, berkas pengetahuan, dan memori sendiri. Hanya Super Admin yang dapat membuat dan menyuntingnya; pengguna lain hanya memilih proyek yang Anda izinkan saat bertanya.
          Proyek V4.5 di atas tetap menjadi proyek bawaan satker.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Kabar teks={kabar.teks} baik={kabar.baik} />
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <label htmlFor="ai-proyek-nama-baru" className="text-sm font-medium">
              Nama proyek baru
            </label>
            <Input id="ai-proyek-nama-baru" value={namaBaru} maxLength={80} placeholder="Contoh: ALETA AI PA CLAUDE" onChange={(e) => setNamaBaru(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void buat()} />
          </div>
          <Button type="button" onClick={() => void buat()} disabled={!namaBaru.trim() || sibuk}>
            <FolderPlus className="size-4" aria-hidden="true" /> Buat proyek
          </Button>
          <div className="space-y-1.5">
            <label htmlFor="ai-proyek-impor" className="text-sm font-medium">
              Atau impor dari ZIP
            </label>
            <input
              id="ai-proyek-impor"
              ref={berkasImpor}
              type="file"
              accept=".zip,application/zip"
              disabled={sibuk}
              onChange={(e) => void imporZip(e.target.files?.[0] ?? null)}
              className="block max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </div>
        </div>
        {galatDaftar ? <Kabar teks={galatDaftar} baik={false} /> : null}
        {daftar === null && !galatDaftar ? (
          <p role="status" className="text-sm text-muted-foreground">
            <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
            Memuat proyek...
          </p>
        ) : null}
        {daftar && daftar.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada proyek tambahan. Buat satu, atau impor ZIP berformat proyek V4.5.</p> : null}
        {daftar?.length ? (
          <ul className="grid gap-3 md:grid-cols-2" data-testid="daftar-proyek-kelola">
            {daftar.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setTerbuka(p.id)}
                  className="flex h-full w-full flex-col gap-2 rounded-xl border border-border/70 bg-card p-4 text-left hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold">{p.nama}</span>
                    {!p.aktif ? <Badge variant="muted">Nonaktif</Badge> : null}
                    {p.jumlahUsulan ? <Badge variant="warning">{p.jumlahUsulan} usulan memori</Badge> : null}
                  </span>
                  {p.deskripsi ? <span className="text-sm text-muted-foreground">{p.deskripsi}</span> : null}
                  <span className="text-xs text-muted-foreground">
                    {p.jumlahBerkas} berkas, {p.jumlahMemori} memori, dipakai oleh {p.akses === "semua" ? "semua pengguna" : p.akses === "peran" ? `${p.aksesPeran.length} peran` : `${p.aksesPengguna.length} pengguna`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DetailProyek({ id, pengguna, peran, onKembali }: { id: string; pengguna: Orang[]; peran: Array<{ id: string; name: string }>; onKembali: () => void }) {
  const [r, setR] = useState<Rincian | null>(null);
  const [galat, setGalat] = useState("");
  const [kabar, setKabar] = useState<{ teks: string; baik: boolean }>({ teks: "", baik: true });
  const [sibuk, setSibuk] = useState(false);
  // Salinan kerja yang disunting (disimpan dengan tombol).
  const [nama, setNama] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [instruksi, setInstruksi] = useState("");
  const [akses, setAkses] = useState<Akses>("semua");
  const [aksesPeran, setAksesPeran] = useState<string[]>([]);
  const [aksesPengguna, setAksesPengguna] = useState<string[]>([]);
  const [cari, setCari] = useState("");
  const [sertakanBawaan, setSertakanBawaan] = useState(true);
  const [memoriAktif, setMemoriAktif] = useState(true);
  const [aktif, setAktif] = useState(true);
  const [selaluUnggah, setSelaluUnggah] = useState(false);
  const [sunting, setSunting] = useState<{ id: string; nama: string; teks: string; selalu: boolean } | null>(null);
  const [memoriBaru, setMemoriBaru] = useState("");
  const [suntingMemori, setSuntingMemori] = useState<{ id: string; isi: string } | null>(null);
  const masukanBerkas = useRef<HTMLInputElement>(null);

  const muat = useCallback(async () => {
    const x = await ambil<Rincian>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}`);
    if (!x.ok) {
      setGalat(x.galat);
      return;
    }
    setGalat("");
    const d: Rincian = { ...x.data, instruksi: x.data.instruksi ?? "", berkas: x.data.berkas ?? [], memori: x.data.memori ?? [], riwayat: x.data.riwayat ?? [], aksesPeran: x.data.aksesPeran ?? [], aksesPengguna: x.data.aksesPengguna ?? [] };
    setR(d);
    return d;
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari server
    void muat().then((d) => {
      if (!d) return;
      setNama(d.nama);
      setDeskripsi(d.deskripsi);
      setInstruksi(d.instruksi);
      setAkses(d.akses);
      setAksesPeran(d.aksesPeran);
      setAksesPengguna(d.aksesPengguna);
      setSertakanBawaan(d.sertakanBawaan);
      setMemoriAktif(d.memoriAktif);
      setAktif(d.aktif);
    });
  }, [muat]);

  const penggunaTersaring = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return pengguna.filter((p) => !k || p.name.toLowerCase().includes(k) || (p.jabatan ?? "").toLowerCase().includes(k)).slice(0, 80);
  }, [pengguna, cari]);

  async function simpan(bagian: Record<string, unknown>, pesanBerhasil: string) {
    setSibuk(true);
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}`, "PUT", bagian);
    setSibuk(false);
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setKabar({ teks: pesanBerhasil, baik: true });
    await muat();
  }

  async function unggah(daftarBerkas: FileList | null) {
    if (!daftarBerkas?.length || sibuk) return;
    setSibuk(true);
    setKabar({ teks: "", baik: true });
    const data = new FormData();
    for (const f of Array.from(daftarBerkas)) data.append("berkas", f);
    if (selaluUnggah) data.append("selalu", "1");
    const x = await ambil<HasilUnggah>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/berkas`, { method: "POST", body: data });
    setSibuk(false);
    if (masukanBerkas.current) masukanBerkas.current.value = "";
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    const gagal = x.data.hasil.filter((h) => h.galat);
    const baris = [
      `${x.data.hasil.length - gagal.length} berkas masuk${x.data.hasil.some((h) => h.diganti) ? " (sebagian menggantikan berkas bernama sama)" : ""}.`,
      ...gagal.map((h) => `${h.nama}: ${h.galat}`),
      ...x.data.hasil.flatMap((h) => (h.peringatan ?? []).map((p) => `${h.nama}: ${p}`)),
    ];
    setKabar({ teks: baris.join("\n"), baik: gagal.length === 0 });
    await muat();
  }

  async function bukaSunting(b: Berkas) {
    const x = await ambil<{ id: string; nama: string; teks: string; selalu: boolean }>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/berkas/${encodeURIComponent(b.id)}`);
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setSunting({ id: x.data.id, nama: x.data.nama, teks: x.data.teks, selalu: x.data.selalu });
  }

  async function simpanSunting() {
    if (!sunting) return;
    setSibuk(true);
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/berkas/${encodeURIComponent(sunting.id)}`, "PUT", { nama: sunting.nama, teks: sunting.teks, selalu: sunting.selalu });
    setSibuk(false);
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setSunting(null);
    setKabar({ teks: "Berkas disimpan.", baik: true });
    await muat();
  }

  async function hapusBerkas(b: Berkas) {
    if (!window.confirm(`Hapus berkas "${b.nama}" dari proyek ini?`)) return;
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/berkas/${encodeURIComponent(b.id)}`, "DELETE");
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setKabar({ teks: "Berkas dihapus.", baik: true });
    await muat();
  }

  async function selalukan(b: Berkas, nilai: boolean) {
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/berkas/${encodeURIComponent(b.id)}`, "PUT", { selalu: nilai });
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    await muat();
  }

  async function tambahMemori() {
    const isi = memoriBaru.trim();
    if (!isi) return;
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/memori`, "POST", { isi });
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setMemoriBaru("");
    await muat();
  }

  async function ubahMemori() {
    if (!suntingMemori) return;
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/memori/${encodeURIComponent(suntingMemori.id)}`, "PUT", { isi: suntingMemori.isi });
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    setSuntingMemori(null);
    await muat();
  }

  async function putuskan(m: Memori, putusan: "setuju" | "tolak") {
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/memori/${encodeURIComponent(m.id)}`, "PUT", { putusan });
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    await muat();
  }

  async function hapusMemori(m: Memori) {
    if (!window.confirm("Hapus memori ini?")) return;
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}/memori/${encodeURIComponent(m.id)}`, "DELETE");
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    await muat();
  }

  async function hapusProyek() {
    if (!r || !window.confirm(`Hapus proyek "${r.nama}" beserta semua berkas dan memorinya? Tindakan ini tidak dapat dibatalkan.`)) return;
    const x = await kirimJson<unknown>(`/api/aleta-ai/proyek/kelola/${encodeURIComponent(id)}`, "DELETE");
    if (!x.ok) return setKabar({ teks: x.galat, baik: false });
    onKembali();
  }

  const alih = (daftar: string[], nilai: string) => (daftar.includes(nilai) ? daftar.filter((x) => x !== nilai) : [...daftar, nilai]);

  if (galat) {
    return (
      <Card className="border-border/80">
        <CardContent className="space-y-3 pt-6">
          <Kabar teks={galat} baik={false} />
          <Button type="button" variant="outline" onClick={onKembali}>
            <ChevronLeft className="size-4" aria-hidden="true" /> Kembali
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!r) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
        Membuka proyek...
      </p>
    );
  }

  const usulan = r.memori.filter((m) => m.status === "usulan");
  const memoriSah = r.memori.filter((m) => m.status === "disetujui");

  return (
    <Card className="border-border/80" id="proyek-pengetahuan">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onKembali}>
            <ChevronLeft className="size-4" aria-hidden="true" /> Semua proyek
          </Button>
          <CardTitle className="text-lg">{r.nama}</CardTitle>
          {!r.aktif ? <Badge variant="muted">Nonaktif</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <Kabar teks={kabar.teks} baik={kabar.baik} />

        <Sub judul="Dasar proyek">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="ai-pk-nama" className="text-sm font-medium">
                Nama proyek
              </label>
              <Input id="ai-pk-nama" value={nama} maxLength={80} onChange={(e) => setNama(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ai-pk-desk" className="text-sm font-medium">
                Keterangan singkat (terlihat oleh pengguna yang memilih)
              </label>
              <Input id="ai-pk-desk" value={deskripsi} maxLength={300} onChange={(e) => setDeskripsi(e.target.value)} />
            </div>
          </div>
          <BarisSakelar id="ai-pk-aktif" label="Proyek ini aktif" hint="Proyek yang dinonaktifkan hilang dari pilihan pengguna; percakapan lama yang memakainya akan diminta memilih proyek lain." nilai={aktif} onUbah={setAktif} />
          <BarisSakelar id="ai-pk-bawaan" label="Sertakan proyek bawaan satker" hint="Hidup: pedoman dan modul V4.5 tetap dipakai, proyek ini menambahkan. Mati: instruksi proyek ini menggantikan pedoman V4.5." nilai={sertakanBawaan} onUbah={setSertakanBawaan} />
          <BarisSakelar id="ai-pk-memori" label="Biarkan ALETA Ai mengusulkan memori" hint="Usulan dari percakapan baru ikut ke prompt setelah Anda setujui di bagian Memori." nilai={memoriAktif} onUbah={setMemoriAktif} />
          <div className="space-y-2">
            <label htmlFor="ai-pk-akses" className="text-sm font-medium">
              Siapa yang boleh memakai
            </label>
            <NativeSelect id="ai-pk-akses" value={akses} onChange={(e) => setAkses(e.target.value as Akses)}>
              <option value="semua">Semua pengguna ALETA Ai</option>
              <option value="peran">Peran tertentu</option>
              <option value="pengguna">Pengguna tertentu</option>
            </NativeSelect>
            {akses === "peran" ? (
              <fieldset className="grid gap-1.5 sm:grid-cols-2">
                <legend className="sr-only">Peran yang boleh memakai</legend>
                {peran.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={aksesPeran.includes(p.id)} onChange={() => setAksesPeran((a) => alih(a, p.id))} className="size-4 accent-primary" />
                    {p.name}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {akses === "pengguna" ? (
              <div className="space-y-2">
                <Input value={cari} placeholder="Cari nama atau jabatan" aria-label="Cari pengguna" onChange={(e) => setCari(e.target.value)} />
                {aksesPengguna.length ? (
                  <p className="text-xs text-muted-foreground">
                    Dipilih: {aksesPengguna.map((u) => pengguna.find((p) => p.id === u)?.name ?? u).join(", ")}
                  </p>
                ) : null}
                <div className="max-h-56 overflow-y-auto rounded-lg border border-border/70 p-2">
                  {penggunaTersaring.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 px-1 py-1 text-sm">
                      <input type="checkbox" checked={aksesPengguna.includes(p.id)} onChange={() => setAksesPengguna((a) => alih(a, p.id))} className="size-4 accent-primary" />
                      <span className="min-w-0">
                        {p.name}
                        {p.jabatan ? <span className="text-muted-foreground"> - {p.jabatan}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <Button
            type="button"
            disabled={sibuk || !nama.trim()}
            onClick={() => void simpan({ nama, deskripsi, aktif, sertakanBawaan, memoriAktif, akses, aksesPeran, aksesPengguna }, "Pengaturan proyek disimpan.")}
          >
            Simpan pengaturan
          </Button>
        </Sub>

        <Sub judul="Instruksi" deskripsi="Arahan tetap untuk proyek ini (seperti system prompt). Dibaca ALETA Ai pada setiap pertanyaan yang memakai proyek ini.">
          <Textarea value={instruksi} onChange={(e) => setInstruksi(e.target.value)} rows={10} aria-label="Instruksi proyek" className="font-mono text-sm" />
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={sibuk} onClick={() => void simpan({ instruksi }, "Instruksi disimpan.")}>
              Simpan instruksi
            </Button>
            <span className="text-xs text-muted-foreground">{instruksi.length.toLocaleString("id-ID")} karakter</span>
          </div>
        </Sub>

        <Sub
          judul="Berkas pengetahuan"
          deskripsi="PDF, Word (.docx), RTF, Markdown, atau teks - unggah satu per satu atau beberapa sekaligus. ZIP berformat proyek V4.5 juga dapat ditambahkan. Hanya bagian yang cocok dengan pertanyaan yang dikirim, kecuali berkas yang ditandai selalu ikut."
        >
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={masukanBerkas}
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.rtf,.md,.markdown,.txt,.zip"
              disabled={sibuk}
              aria-label="Pilih berkas pengetahuan"
              onChange={(e) => void unggah(e.target.files)}
              className="block max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-border file:bg-card file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {sibuk ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4 text-muted-foreground" aria-hidden="true" />}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={selaluUnggah} onChange={(e) => setSelaluUnggah(e.target.checked)} className="size-4 accent-primary" />
              Selalu ikut pada setiap pertanyaan
            </label>
          </div>
          {r.berkas.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada berkas.</p> : null}
          <ul className="space-y-2">
            {r.berkas.map((b) => (
              <li key={b.id} className="rounded-lg border border-border/70 bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words text-sm font-medium">{b.nama}</span>
                  <span className="text-xs text-muted-foreground">
                    {b.jenis.toUpperCase()}, {ukuranTampil(b.ukuran)}, {b.karakter.toLocaleString("id-ID")} karakter
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={b.selalu} onCheckedChange={(v) => void selalukan(b, v)} aria-label={`Selalu ikut: ${b.nama}`} />
                    Selalu ikut
                  </label>
                  <Button type="button" variant="outline" size="sm" onClick={() => void bukaSunting(b)}>
                    <Pencil className="size-3.5" aria-hidden="true" /> Sunting
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void hapusBerkas(b)} aria-label={`Hapus ${b.nama}`}>
                    <Trash2 className="size-3.5" aria-hidden="true" /> Hapus
                  </Button>
                </div>
                {sunting?.id === b.id ? (
                  <div className="mt-3 space-y-2">
                    <Input value={sunting.nama} aria-label="Nama berkas" onChange={(e) => setSunting({ ...sunting, nama: e.target.value })} />
                    <Textarea value={sunting.teks} rows={14} aria-label="Isi berkas" className="font-mono text-sm" onChange={(e) => setSunting({ ...sunting, teks: e.target.value })} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={sibuk} onClick={() => void simpanSunting()}>
                        Simpan berkas
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSunting(null)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Sub>

        <Sub judul="Memori proyek" deskripsi="Fakta yang selalu diingat proyek ini dan ikut ke setiap pertanyaan. Hanya Anda yang dapat melihat dan mengubahnya.">
          {usulan.length ? (
            <div className="space-y-2 rounded-lg border border-amber-300/70 bg-amber-50 p-3 dark:bg-amber-950/30" data-testid="usulan-memori">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Usulan dari ALETA Ai (belum dipakai sampai Anda setujui)</p>
              {usulan.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-2 rounded-md bg-card p-2">
                  <span className="min-w-0 flex-1 break-words text-sm">{m.isi}</span>
                  <Button type="button" size="sm" onClick={() => void putuskan(m, "setuju")}>
                    <Check className="size-3.5" aria-hidden="true" /> Setujui
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => void putuskan(m, "tolak")}>
                    <X className="size-3.5" aria-hidden="true" /> Tolak
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          {memoriSah.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada memori.</p> : null}
          <ul className="space-y-2">
            {memoriSah.map((m) => (
              <li key={m.id} className="rounded-lg border border-border/70 bg-card p-3">
                {suntingMemori?.id === m.id ? (
                  <div className="space-y-2">
                    <Textarea value={suntingMemori.isi} rows={3} aria-label="Isi memori" onChange={(e) => setSuntingMemori({ id: m.id, isi: e.target.value })} />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void ubahMemori()}>
                        Simpan
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setSuntingMemori(null)}>
                        Batal
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 break-words text-sm">{m.isi}</span>
                    {m.sumber === "usulan-ai" ? <Badge variant="info">dari usulan</Badge> : null}
                    <Button type="button" variant="outline" size="sm" onClick={() => setSuntingMemori({ id: m.id, isi: m.isi })}>
                      <Pencil className="size-3.5" aria-hidden="true" /> Ubah
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => void hapusMemori(m)} aria-label="Hapus memori">
                      <Trash2 className="size-3.5" aria-hidden="true" /> Hapus
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1">
              <Textarea value={memoriBaru} rows={2} maxLength={1000} placeholder="Tulis satu fakta untuk diingat proyek ini" aria-label="Memori baru" onChange={(e) => setMemoriBaru(e.target.value)} />
            </div>
            <Button type="button" onClick={() => void tambahMemori()} disabled={memoriBaru.trim().length < 4}>
              <Plus className="size-4" aria-hidden="true" /> Tambah memori
            </Button>
          </div>
        </Sub>

        {r.riwayat.length ? (
          <Sub judul="Riwayat perubahan">
            <ul className="space-y-1 text-sm text-muted-foreground">
              {r.riwayat.slice(0, 15).map((h, i) => (
                <li key={`${h.waktu}-${i}`}>
                  {tanggalTampil(h.waktu)} - {KATA_AKSI[h.aksi] ?? h.aksi}
                  {h.ringkas ? `: ${h.ringkas}` : ""}
                </li>
              ))}
            </ul>
          </Sub>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => void hapusProyek()} className="text-destructive">
            <Trash2 className="size-4" aria-hidden="true" /> Hapus proyek ini
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
