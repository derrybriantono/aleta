"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Download, FileText, Loader2, Plus, Send, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiPath } from "@/lib/base-path";
import { JENIS_BLANGKO_SENDIRI, LABEL_JENIS_BLANGKO, LABEL_JENIS_ISIAN, type ButirPemetaan, type JenisBlangkoSendiri } from "@/lib/blangko-sendiri";
import type { RincianBlangkoPribadi, RingkasBlangkoPribadi } from "@/server/modules/aleta-ecourt/blangko-sendiri";

/**
 * Blangko Saya (buat blangko sendiri) - layar hakim, panitera, dan konseptor.
 *
 * Alurnya: tulis di sini atau unggah berkas -> periksa isian yang dikenali ->
 * putuskan tiap isian -> lihat pratinjau untuk satu perkara -> pakai untuk
 * putusan mandiri atau ajukan untuk ABT. Isian baru yang belum ada di ABT
 * hanya diusulkan; Super Admin yang memasang paketnya.
 */

const ALAMAT = "/api/aleta-ecourt/blangko-sendiri";

type Jawab<T> = { ok: boolean; data: T | null; galat: string };

async function panggil<T>(alamat: string, init?: RequestInit): Promise<Jawab<T>> {
  try {
    const jawaban = await fetch(apiPath(alamat), { cache: "no-store", ...init });
    const isi = (await jawaban.json().catch(() => null)) as { ok?: boolean; data?: T; error?: { message?: string } } | null;
    if (!jawaban.ok || isi?.ok === false) return { ok: false, data: null, galat: isi?.error?.message || "Permintaan tidak berhasil." };
    return { ok: true, data: (isi?.data ?? null) as T | null, galat: "" };
  } catch {
    return { ok: false, data: null, galat: "Server belum dapat dihubungi." };
  }
}

function kirim<T>(badan: Record<string, unknown>) {
  return panggil<T>(ALAMAT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(badan) });
}

function Pesan({ teks, baik }: { teks: string; baik?: boolean }) {
  if (!teks) return null;
  return (
    <p
      role="status"
      className={`flex items-start gap-2 break-words rounded-md border px-3 py-2 text-sm ${
        baik ? "border-emerald-300/70 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "border-amber-300/70 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
      }`}
    >
      {baik ? <Check className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
      <span className="min-w-0">{teks}</span>
    </p>
  );
}

function Angka({ nilai, label }: { nilai: number | string; label: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2">
      <div className="text-xl font-semibold tabular-nums">{nilai}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function BadgePaket({ status }: { status: string }) {
  if (status === "menunggu") return <Badge variant="warning">Menunggu Super Admin</Badge>;
  if (status === "disetujui") return <Badge variant="success">Paket disetujui</Badge>;
  if (status === "ditolak") return <Badge variant="danger">Paket ditolak</Badge>;
  return null;
}

function unduhBase64(base64: string, nama: string, jenis: string) {
  const bita = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bita], { type: jenis }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nama;
  a.click();
  URL.revokeObjectURL(url);
}

// ============================================================================
// Daftar
// ============================================================================

function Daftar({ superAdmin, onBuka }: { superAdmin: boolean; onBuka: (id: string) => void }) {
  const [daftar, setDaftar] = useState<RingkasBlangkoPribadi[]>([]);
  const [semua, setSemua] = useState(false);
  const [dimuatUntuk, setDimuatUntuk] = useState<boolean | null>(null);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [nama, setNama] = useState("");
  const [jenis, setJenis] = useState<JenisBlangkoSendiri>("putusan");
  const [isi, setIsi] = useState("");
  const [berkas, setBerkas] = useState<File | null>(null);

  const memuat = dimuatUntuk !== semua;

  useEffect(() => {
    let batal = false;
    void panggil<{ blangko: RingkasBlangkoPribadi[] }>(`${ALAMAT}${semua ? "?semua=1" : ""}`).then((h) => {
      if (batal) return;
      setDimuatUntuk(semua);
      if (h.ok) setDaftar(h.data?.blangko ?? []);
      else {
        setBaik(false);
        setPesan(h.galat);
      }
    });
    return () => {
      batal = true;
    };
  }, [semua]);

  const selesai = (h: Jawab<{ blangko: RincianBlangkoPribadi }>) => {
    setSibuk(false);
    if (!h.ok || !h.data) {
      setBaik(false);
      setPesan(h.galat);
      return;
    }
    onBuka(h.data.blangko.id);
  };

  const buatDariTeks = async () => {
    setSibuk(true);
    setPesan("");
    selesai(await kirim<{ blangko: RincianBlangkoPribadi }>({ tindakan: "buat-teks", nama, jenis, teks: isi }));
  };

  const unggah = async () => {
    if (!berkas) return;
    setSibuk(true);
    setPesan("");
    const f = new FormData();
    f.set("berkas", berkas);
    f.set("nama", nama);
    f.set("jenis", jenis);
    selesai(await panggil<{ blangko: RincianBlangkoPribadi }>(ALAMAT, { method: "POST", body: f }));
  };

  const menunggu = daftar.filter((b) => b.paketStatus === "menunggu");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" /> Buat blangko baru
          </CardTitle>
          <CardDescription>Tulis langsung di sini, atau unggah berkas blangko Anda (RTF, DOCX, atau PDF).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
            <label className="space-y-1 text-sm">
              <span className="font-medium">Nama blangko</span>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} placeholder="mis. Putusan cerai gugat verstek" />
            </label>
            <label className="space-y-1 text-sm">
              <span className="font-medium">Jenis</span>
              <NativeSelect value={jenis} onChange={(e) => setJenis(e.target.value as JenisBlangkoSendiri)}>
                {JENIS_BLANGKO_SENDIRI.map((j) => (
                  <option key={j} value={j}>
                    {LABEL_JENIS_BLANGKO[j]}
                  </option>
                ))}
              </NativeSelect>
            </label>
          </div>
          <Tabs defaultValue="tulis">
            <TabsList>
              <TabsTrigger value="tulis">Tulis di sini</TabsTrigger>
              <TabsTrigger value="unggah">Unggah berkas</TabsTrigger>
            </TabsList>
            <TabsContent value="tulis" className="space-y-3">
              <Textarea value={isi} onChange={(e) => setIsi(e.target.value)} rows={8} placeholder="Satu baris = satu paragraf. Tandai isian dengan titik-titik, [kurung siku], atau penanda isian yang sudah ada." />
              <Button onClick={buatDariTeks} disabled={sibuk || !nama.trim() || !isi.trim()}>
                {sibuk ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />} Simpan dan periksa isian
              </Button>
            </TabsContent>
            <TabsContent value="unggah" className="space-y-3">
              <input
                type="file"
                accept=".rtf,.docx,.pdf"
                onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
                className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-2"
              />
              <p className="text-xs text-muted-foreground">RTF paling baik karena batas paragrafnya asli. PDF hanya dibaca tulisannya, jadi hasilnya perlu dirapikan.</p>
              <Button onClick={unggah} disabled={sibuk || !berkas}>
                {sibuk ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />} Unggah dan periksa isian
              </Button>
            </TabsContent>
          </Tabs>
          <Pesan teks={pesan} baik={baik} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">{semua ? "Semua blangko pribadi" : "Blangko saya"}</CardTitle>
            <CardDescription>{memuat ? "Memuat..." : `${daftar.length} blangko`}</CardDescription>
          </div>
          {superAdmin ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} />
              Tampilkan blangko semua orang
            </label>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {superAdmin && menunggu.length > 0 ? (
            <Pesan teks={`${menunggu.length} paket blangko menunggu keputusan Anda. Buka blangkonya untuk menyetujui atau menolak.`} />
          ) : null}
          {!memuat && daftar.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada blangko. Buat yang pertama di atas.</p> : null}
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {daftar.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onBuka(b.id)}
                  className="flex h-full w-full flex-col gap-2 rounded-lg border border-border/70 bg-card/70 p-3 text-left transition hover:border-primary/40"
                >
                  <span className="break-words font-medium">{b.nama}</span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge variant="outline">{LABEL_JENIS_BLANGKO[b.jenis as JenisBlangkoSendiri] ?? b.jenis}</Badge>
                    {b.belumDiputus > 0 ? <Badge variant="warning">{b.belumDiputus} isian perlu ditinjau</Badge> : <Badge variant="success">Isian selesai</Badge>}
                    {b.untukPutusanMandiri ? <Badge variant="info">Putusan mandiri</Badge> : null}
                    <BadgePaket status={b.paketStatus} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {b.jumlahBagian} paragraf, {b.jumlahIsian} isian
                    {!b.milikSaya ? ` - milik ${b.pemilikNama || "pengguna lain"}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Rincian
// ============================================================================

type Pilihan = { mode: "usulan" | "tetap" | "baru" | "nomor"; noVar: string; usulanNama: string };

function pilihanAwal(b: ButirPemetaan): Pilihan {
  if (b.sasaran.tipe === "variabel") {
    const ada = b.usulan.some((u) => u.noVar === b.sasaran.noVar);
    return { mode: ada ? "usulan" : "nomor", noVar: b.sasaran.noVar, usulanNama: "" };
  }
  if (b.sasaran.tipe === "baru") return { mode: "baru", noVar: "", usulanNama: b.sasaran.usulanNama };
  return { mode: "tetap", noVar: "", usulanNama: "" };
}

function Konteks({ teks }: { teks: string }) {
  const [sebelum, sisa = ""] = teks.split("⟦");
  const [isi, sesudah = ""] = sisa.split("⟧");
  return (
    <p className="break-words rounded bg-muted/40 px-2 py-1.5 text-xs leading-relaxed text-muted-foreground">
      {sebelum}
      <mark className="rounded bg-amber-200/80 px-0.5 text-foreground dark:bg-amber-500/30">{isi}</mark>
      {sesudah}
    </p>
  );
}

function TabIsian({ rincian, onUbah }: { rincian: RincianBlangkoPribadi; onUbah: (r: RincianBlangkoPribadi) => void }) {
  const [pilih, setPilih] = useState<Record<string, Pilihan>>({});
  const [semua, setSemua] = useState(false);
  const [batas, setBatas] = useState(40);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const ubah = rincian.hak.ubah;

  const tampil = useMemo(
    () => rincian.pemetaan.filter((b) => semua || b.status === "usulan" || pilih[b.id] !== undefined),
    [rincian.pemetaan, semua, pilih]
  );
  const r = rincian.ringkasPemetaan;
  const nilai = (b: ButirPemetaan): Pilihan => pilih[b.id] ?? pilihanAwal(b);

  const simpan = async (terimaYakin?: number) => {
    setSibuk(true);
    setPesan("");
    const keputusan = Object.entries(pilih).map(([id, p]) => {
      const sasaran =
        p.mode === "tetap"
          ? { tipe: "tetap" }
          : p.mode === "baru"
            ? { tipe: "baru", usulanNama: p.usulanNama, kunciData: rincian.pemetaan.find((b) => b.id === id)?.sasaran.kunciData ?? "" }
            : { tipe: "variabel", noVar: p.noVar, kunciData: rincian.pemetaan.find((b) => b.id === id)?.sasaran.kunciData ?? "" };
      return { id, status: "dikonfirmasi", sasaran };
    });
    const h = await kirim<{ blangko: RincianBlangkoPribadi & { diterima: number } }>({ tindakan: "keputusan", id: rincian.id, keputusan, terimaYakin });
    setSibuk(false);
    if (!h.ok || !h.data) {
      setBaik(false);
      setPesan(h.galat);
      return;
    }
    setPilih({});
    onUbah(h.data.blangko);
    setBaik(true);
    setPesan(terimaYakin ? `${h.data.blangko.diterima} usulan yang yakin diterima.` : "Keputusan tersimpan.");
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Angka nilai={r.jumlah} label="isian dikenali" />
        <Angka nilai={r.belumDiputus} label="perlu ditinjau" />
        <Angka nilai={r.keIsianAda} label="ke isian ABT" />
        <Angka nilai={r.keIsianBaru} label="isian baru (usulan)" />
      </div>
      {ubah ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button variant="outline" onClick={() => void simpan(0.8)} disabled={sibuk || r.belumDiputus === 0}>
            Terima usulan yang yakin (80% ke atas)
          </Button>
          <Button onClick={() => void simpan()} disabled={sibuk || Object.keys(pilih).length === 0}>
            {sibuk ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />} Simpan keputusan ({Object.keys(pilih).length})
          </Button>
        </div>
      ) : (
        <Pesan teks="Anda melihat blangko milik orang lain. Isiannya hanya dapat diubah pemiliknya." />
      )}
      <Pesan teks={pesan} baik={baik} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan juga yang sudah diputuskan
      </label>
      {tampil.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada isian yang perlu ditinjau.</p> : null}
      <ul className="space-y-2">
        {tampil.slice(0, batas).map((b) => {
          const p = nilai(b);
          return (
            <li key={b.id} className="space-y-2 rounded-lg border border-border/70 bg-card/70 p-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline">{LABEL_JENIS_ISIAN[b.jenis]}</Badge>
                <Badge variant="muted">Paragraf {b.bagian}</Badge>
                {b.status === "usulan" && pilih[b.id] === undefined ? <Badge variant="warning">Perlu ditinjau</Badge> : <Badge variant="success">Diputuskan</Badge>}
                <Badge variant="muted">Keyakinan {Math.round(b.yakin * 100)}%</Badge>
              </div>
              <Konteks teks={b.konteks} />
              <p className="text-xs text-muted-foreground">{b.sebab}</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                <NativeSelect
                  disabled={!ubah}
                  value={p.mode === "usulan" ? `v:${p.noVar}` : p.mode}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPilih((x) => ({
                      ...x,
                      [b.id]: v.startsWith("v:")
                        ? { mode: "usulan", noVar: v.slice(2), usulanNama: "" }
                        : v === "baru"
                          ? { mode: "baru", noVar: "", usulanNama: b.sasaran.usulanNama || LABEL_JENIS_ISIAN[b.jenis] }
                          : v === "nomor"
                            ? { mode: "nomor", noVar: p.noVar, usulanNama: "" }
                            : { mode: "tetap", noVar: "", usulanNama: "" },
                    }));
                  }}
                >
                  {b.usulan.map((u) => (
                    <option key={u.noVar} value={`v:${u.noVar}`}>
                      {u.judul} (no. {u.noVar}) - {Math.round(u.yakin * 100)}%
                    </option>
                  ))}
                  <option value="nomor">Isian ABT lain (ketik nomornya)</option>
                  <option value="baru">Usulkan isian baru</option>
                  <option value="tetap">Biarkan tulisan apa adanya</option>
                </NativeSelect>
                {p.mode === "nomor" ? (
                  <Input
                    disabled={!ubah}
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="Nomor isian"
                    value={p.noVar}
                    onChange={(e) => setPilih((x) => ({ ...x, [b.id]: { mode: "nomor", noVar: e.target.value.replace(/\D/g, ""), usulanNama: "" } }))}
                  />
                ) : p.mode === "baru" ? (
                  <Input
                    disabled={!ubah}
                    maxLength={80}
                    placeholder="Nama isian baru"
                    value={p.usulanNama}
                    onChange={(e) => setPilih((x) => ({ ...x, [b.id]: { mode: "baru", noVar: "", usulanNama: e.target.value } }))}
                  />
                ) : null}
              </div>
              {p.mode === "baru" ? <p className="text-xs text-muted-foreground">Isian baru tidak dibuat otomatis di ABT; pada blangko tercetak &quot;...&quot; dan namanya masuk daftar usulan.</p> : null}
            </li>
          );
        })}
      </ul>
      {tampil.length > batas ? (
        <Button variant="outline" onClick={() => setBatas((n) => n + 40)}>
          Tampilkan lebih banyak ({tampil.length - batas} lagi)
        </Button>
      ) : null}
    </div>
  );
}

function TabPratinjau({ rincian }: { rincian: RincianBlangkoPribadi }) {
  const [nomor, setNomor] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [hasil, setHasil] = useState<{ nomorPerkara: string; alinea: Array<{ teks: string; rata: string; tebal: boolean }>; tersisa: string[]; docxBase64: string } | null>(null);

  const lihat = async () => {
    setSibuk(true);
    setPesan("");
    const h = await kirim<{ pratinjau: NonNullable<typeof hasil> }>({ tindakan: "pratinjau", id: rincian.id, nomor, docx: true });
    setSibuk(false);
    if (!h.ok || !h.data) {
      setHasil(null);
      setPesan(h.galat);
      return;
    }
    setHasil(h.data.pratinjau);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Isi blangko ini dengan data satu perkara untuk melihat hasilnya. Isian yang belum punya nilai tercetak &quot;...&quot;.</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input value={nomor} onChange={(e) => setNomor(e.target.value)} placeholder="Nomor perkara, mis. 123/Pdt.G/2026/PA.Dgl" className="sm:max-w-md" />
        <Button onClick={lihat} disabled={sibuk || !nomor.trim()}>
          {sibuk ? <Loader2 className="mr-2 size-4 animate-spin" /> : <FileText className="mr-2 size-4" />} Lihat pratinjau
        </Button>
      </div>
      <Pesan teks={pesan} />
      {hasil ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{hasil.nomorPerkara}</Badge>
            {hasil.tersisa.length > 0 ? <Badge variant="warning">{hasil.tersisa.length} isian belum terisi</Badge> : <Badge variant="success">Semua isian terisi</Badge>}
            {hasil.docxBase64 ? (
              <Button size="sm" variant="outline" onClick={() => unduhBase64(hasil.docxBase64, "pratinjau-blangko.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}>
                <Download className="mr-2 size-4" /> Unduh pratinjau (DOCX)
              </Button>
            ) : null}
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto rounded-lg border border-border/70 bg-background p-4 text-sm leading-relaxed">
            {hasil.alinea.map((a, n) => (
              <p key={n} className={`break-words ${a.tebal ? "font-semibold" : ""} ${a.rata === "tengah" ? "text-center" : a.rata === "kanan" ? "text-right" : a.rata === "justify" ? "text-justify" : ""}`}>
                {a.teks}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TabPakai({ rincian, superAdmin, onUbah }: { rincian: RincianBlangkoPribadi; superAdmin: boolean; onUbah: (r: RincianBlangkoPribadi) => void }) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const [catatan, setCatatan] = useState("");
  const r = rincian.ringkasPemetaan;
  const siap = r.belumDiputus === 0 && r.jumlah >= 0;
  const ubah = rincian.hak.ubah;

  const jalankan = async (badan: Record<string, unknown>, sukses: string) => {
    setSibuk(true);
    setPesan("");
    const h = await kirim<{ blangko?: RincianBlangkoPribadi }>({ ...badan, id: rincian.id });
    setSibuk(false);
    setBaik(h.ok);
    setPesan(h.ok ? sukses : h.galat);
    if (h.ok && h.data?.blangko) onUbah(h.data.blangko);
  };

  const unduh = (aksi: "unduh-abt" | "unduh-paket", bagian: "rtf" | "daftar") => `${apiPath(ALAMAT)}?id=${encodeURIComponent(rincian.id)}&aksi=${aksi}&bagian=${bagian}`;

  return (
    <div className="space-y-4">
      {!siap ? <Pesan teks={`Masih ${r.belumDiputus} isian yang belum diputuskan. Selesaikan di tab Isian sebelum blangko dipakai.`} /> : null}
      <Pesan teks={pesan} baik={baik} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pakai untuk putusan mandiri</CardTitle>
          <CardDescription>Blangko dipakai menyusun putusan tanpa ABT. Blangko tetap milik akun Anda.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {rincian.untukPutusanMandiri ? <Badge variant="info">Sudah siap untuk putusan mandiri</Badge> : null}
          <Button onClick={() => void jalankan({ tindakan: "ekspor-mandiri" }, "Blangko siap dipakai untuk putusan mandiri.")} disabled={!ubah || !siap || sibuk}>
            Jadikan blangko putusan mandiri
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pakai untuk ABT</CardTitle>
          <CardDescription>
            Sistem tidak menulis langsung ke folder blangko ABT. Anda mengunduh berkas blangko (RTF) beserta daftar isiannya, atau mengajukannya sebagai paket yang dipasang Super Admin setelah disetujui. Isian baru tidak dibuat otomatis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button asChild variant="outline" disabled={!siap}>
              <a href={unduh("unduh-abt", "rtf")} aria-disabled={!siap} onClick={(e) => !siap && e.preventDefault()}>
                <Download className="mr-2 size-4" /> Unduh blangko (RTF)
              </a>
            </Button>
            <Button asChild variant="outline" disabled={!siap}>
              <a href={unduh("unduh-abt", "daftar")} aria-disabled={!siap} onClick={(e) => !siap && e.preventDefault()}>
                <Download className="mr-2 size-4" /> Unduh daftar isian
              </a>
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <BadgePaket status={rincian.paket.status} />
            {rincian.paket.status === "disetujui" ? <span className="text-xs text-muted-foreground">oleh {rincian.paket.diputuskanOleh}</span> : null}
          </div>
          {rincian.paket.catatan ? <p className="break-words text-sm text-muted-foreground">Catatan: {rincian.paket.catatan}</p> : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {ubah && rincian.paket.status !== "menunggu" ? (
              <Button onClick={() => void jalankan({ tindakan: "ajukan-paket" }, "Paket diajukan ke Super Admin.")} disabled={!siap || sibuk}>
                <Send className="mr-2 size-4" /> Ajukan ke Super Admin
              </Button>
            ) : null}
            {ubah && rincian.paket.status === "menunggu" ? (
              <Button variant="outline" onClick={() => void jalankan({ tindakan: "tarik-paket" }, "Pengajuan ditarik.")} disabled={sibuk}>
                Tarik pengajuan
              </Button>
            ) : null}
            {rincian.paket.status !== "tidak" ? (
              <>
                <Button asChild variant="outline">
                  <a href={unduh("unduh-paket", "rtf")}>
                    <Download className="mr-2 size-4" /> Paket: blangko
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={unduh("unduh-paket", "daftar")}>
                    <Download className="mr-2 size-4" /> Paket: daftar isian
                  </a>
                </Button>
              </>
            ) : null}
          </div>
          {superAdmin && rincian.paket.status === "menunggu" ? (
            <div className="space-y-2 rounded-lg border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-950/30">
              <p className="text-sm font-medium">Keputusan Super Admin</p>
              <p className="text-xs text-muted-foreground">Menyetujui hanya mencatat persetujuan. Berkasnya dipasang manual ke folder blangko ABT.</p>
              <Textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} rows={2} maxLength={400} placeholder="Catatan (wajib bila menolak)" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => void jalankan({ tindakan: "putuskan-paket", setuju: true, catatan }, "Paket disetujui.")} disabled={sibuk}>
                  <Check className="mr-2 size-4" /> Setujui
                </Button>
                <Button variant="destructive" onClick={() => void jalankan({ tindakan: "putuskan-paket", setuju: false, catatan }, "Paket ditolak.")} disabled={sibuk || !catatan.trim()}>
                  Tolak
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function TabIsi({ rincian, onUbah }: { rincian: RincianBlangkoPribadi; onUbah: (r: RincianBlangkoPribadi) => void }) {
  const [nama, setNama] = useState(rincian.nama);
  const [jenis, setJenis] = useState(rincian.jenis as JenisBlangkoSendiri);
  const [isi, setIsi] = useState(rincian.bagian.map((b) => b.teks).join("\n"));
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState("");
  const [baik, setBaik] = useState(false);
  const ubah = rincian.hak.ubah;

  const simpan = async () => {
    setSibuk(true);
    setPesan("");
    const h = await kirim<{ blangko: RincianBlangkoPribadi }>({ tindakan: "simpan-isi", id: rincian.id, nama, jenis, teks: isi });
    setSibuk(false);
    setBaik(h.ok);
    setPesan(h.ok ? "Tersimpan. Isian dikenali ulang; keputusan lama dibawa untuk isian yang sama." : h.galat);
    if (h.ok && h.data) onUbah(h.data.blangko);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Nama blangko</span>
          <Input value={nama} onChange={(e) => setNama(e.target.value)} maxLength={120} disabled={!ubah} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Jenis</span>
          <NativeSelect value={jenis} onChange={(e) => setJenis(e.target.value as JenisBlangkoSendiri)} disabled={!ubah}>
            {JENIS_BLANGKO_SENDIRI.map((j) => (
              <option key={j} value={j}>
                {LABEL_JENIS_BLANGKO[j]}
              </option>
            ))}
          </NativeSelect>
        </label>
      </div>
      <Textarea value={isi} onChange={(e) => setIsi(e.target.value)} rows={18} disabled={!ubah} className="font-mono text-xs sm:text-sm" />
      <p className="text-xs text-muted-foreground">Satu baris = satu paragraf. Rata dan huruf tebal di berkas asal tidak diubah di sini. Mengubah isi membatalkan pengajuan paket yang sedang berjalan.</p>
      {ubah ? (
        <Button onClick={simpan} disabled={sibuk || !nama.trim() || !isi.trim()}>
          {sibuk ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Check className="mr-2 size-4" />} Simpan
        </Button>
      ) : null}
      <Pesan teks={pesan} baik={baik} />
    </div>
  );
}

function Rincian({ id, superAdmin, onKembali }: { id: string; superAdmin: boolean; onKembali: () => void }) {
  const [rincian, setRincian] = useState<RincianBlangkoPribadi | null>(null);
  const [galat, setGalat] = useState("");

  useEffect(() => {
    let batal = false;
    void panggil<{ blangko: RincianBlangkoPribadi }>(`${ALAMAT}?id=${encodeURIComponent(id)}`).then((h) => {
      if (batal) return;
      if (h.ok && h.data) setRincian(h.data.blangko);
      else setGalat(h.galat);
    });
    return () => {
      batal = true;
    };
  }, [id]);

  const hapus = async () => {
    if (!window.confirm("Hapus blangko ini beserta riwayatnya? Tindakan ini tidak dapat dibatalkan.")) return;
    const h = await kirim({ tindakan: "hapus", id });
    if (h.ok) onKembali();
    else setGalat(h.galat);
  };

  if (galat) {
    return (
      <div className="space-y-3">
        <Button variant="outline" onClick={onKembali}>
          <ArrowLeft className="mr-2 size-4" /> Kembali
        </Button>
        <Pesan teks={galat} />
      </div>
    );
  }
  if (!rincian) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Memuat blangko...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={onKembali} className="self-start">
          <ArrowLeft className="mr-2 size-4" /> Semua blangko
        </Button>
        <Button variant="ghost" onClick={hapus} className="self-start text-destructive">
          <Trash2 className="mr-2 size-4" /> Hapus blangko
        </Button>
      </div>
      <div>
        <h2 className="break-words text-xl font-semibold">{rincian.nama}</h2>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <Badge variant="outline">{LABEL_JENIS_BLANGKO[rincian.jenis as JenisBlangkoSendiri] ?? rincian.jenis}</Badge>
          <Badge variant="muted">{rincian.jumlahBagian} paragraf</Badge>
          {rincian.berkasAsal ? <Badge variant="muted">Dari berkas {rincian.berkasAsal}</Badge> : null}
          {!rincian.milikSaya ? <Badge variant="info">Milik {rincian.pemilikNama || "pengguna lain"}</Badge> : null}
          <BadgePaket status={rincian.paket.status} />
        </div>
      </div>
      {rincian.peringatan.map((p, n) => (
        <Pesan key={n} teks={p} />
      ))}
      <Tabs defaultValue="isian">
        <TabsList className="flex-wrap">
          <TabsTrigger value="isi">Isi</TabsTrigger>
          <TabsTrigger value="isian">Isian ({rincian.ringkasPemetaan.belumDiputus})</TabsTrigger>
          <TabsTrigger value="pratinjau">Pratinjau</TabsTrigger>
          <TabsTrigger value="pakai">Pakai</TabsTrigger>
        </TabsList>
        <TabsContent value="isi">
          <TabIsi key={rincian.versi} rincian={rincian} onUbah={setRincian} />
        </TabsContent>
        <TabsContent value="isian">
          <TabIsian rincian={rincian} onUbah={setRincian} />
        </TabsContent>
        <TabsContent value="pratinjau">
          <TabPratinjau rincian={rincian} />
        </TabsContent>
        <TabsContent value="pakai">
          <TabPakai rincian={rincian} superAdmin={superAdmin} onUbah={setRincian} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function BlangkoSaya({ superAdmin }: { superAdmin: boolean }) {
  const [id, setId] = useState("");
  return id ? <Rincian id={id} superAdmin={superAdmin} onKembali={() => setId("")} /> : <Daftar superAdmin={superAdmin} onBuka={setId} />;
}
