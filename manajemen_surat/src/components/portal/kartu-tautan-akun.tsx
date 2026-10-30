"use client";

/**
 * Kartu tautan akun pegawai (G4, 30 Okt 2026) - Pusat Kendali, Super Admin & Admin.
 *
 * Dibuka = langsung dimuat; tautan SIPP yang pasti sudah ditautkan server sebelum
 * kartu tampil (tanpa klik). Yang ragu dipilih di sini. Akun e-Court pegawai dapat
 * diisi admin: kotak sandi HANYA-TULIS (tidak pernah berisi apa pun dari server),
 * dikosongkan begitu terkirim. Aturan di lib/kartu-tautan-akun.ts.
 */

import { useCallback, useEffect, useMemo, useState } from "react";

import { Info, KeyRound, Link2, LoaderCircle, RefreshCw, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiPath } from "@/lib/base-path";
import { LABEL_KEADAAN_TAUTAN, type BarisKartu, type KeadaanTautan, type SelEcourt } from "@/lib/kartu-tautan-akun";

type Varian = "success" | "warning" | "danger" | "muted" | "info" | "default";
const VARIAN: Record<KeadaanTautan, Varian> = {
  cocok: "success",
  kosong: "muted",
  "tidak-cocok": "danger",
  "perlu-dipilih": "warning",
  "belum-diuji": "info",
};

type Kartu = {
  baris: BarisKartu[];
  ringkas: { pegawai: number; perluPerhatian: number };
  otomatis: { ditautkan: Array<{ userId: string; usernameSipp: string }>; gagal: string };
  ecourtTersedia: boolean;
  ecourtPesan: string;
  abtTersedia: boolean;
  bolehIsiSuperAdmin: boolean;
};

type Jawaban<T> = { ok?: boolean; data?: T; error?: { message?: string } | string };

async function baca<T>(respons: Response): Promise<T> {
  const isi = (await respons.json().catch(() => null)) as Jawaban<T> | null;
  if (!respons.ok || !isi || isi.ok === false) {
    const pesan = typeof isi?.error === "string" ? isi.error : isi?.error?.message;
    throw new Error(pesan || `ALETA menjawab ${respons.status}.`);
  }
  return isi.data as T;
}

const ALAMAT = "/api/admin/tautan-akun";

function Lencana({ keadaan, judul }: { keadaan: KeadaanTautan; judul?: string }) {
  return (
    <Badge variant={VARIAN[keadaan]} title={judul || undefined}>
      {LABEL_KEADAAN_TAUTAN[keadaan]}
      {judul ? <Info aria-hidden className="ml-1 h-3 w-3 opacity-70" /> : null}
    </Badge>
  );
}

function IsiEcourt({
  baris,
  e,
  onSelesai,
}: {
  baris: BarisKartu;
  e: SelEcourt;
  onSelesai: (pesan: string, galat?: boolean) => void;
}) {
  const [buka, setBuka] = useState(false);
  const [email, setEmail] = useState(e.email);
  const [sandi, setSandi] = useState("");
  const [sibuk, setSibuk] = useState(false);

  const kirim = async () => {
    setSibuk(true);
    try {
      const h = await baca<{ ok: boolean; pesan: string }>(
        await fetch(apiPath(ALAMAT), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "isi-ecourt", penggunaId: baris.userId, peran: e.peran, email, sandi }),
        })
      );
      onSelesai(h.pesan, !h.ok);
      if (h.ok) setBuka(false);
    } catch (g) {
      onSelesai(g instanceof Error ? g.message : "Akun e-Court belum tersimpan.", true);
    } finally {
      // Sandi tidak disimpan di layar, berhasil atau tidak.
      setSandi("");
      setSibuk(false);
    }
  };

  const hapus = async () => {
    if (!window.confirm(`Hapus akun e-Court ${e.sebutanPeran} milik ${baris.nama} dari ALETA? Akun di e-Court sendiri tidak terhapus.`)) return;
    setSibuk(true);
    try {
      const h = await baca<{ ok: boolean; pesan: string }>(
        await fetch(apiPath(ALAMAT), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "hapus-ecourt", penggunaId: baris.userId, peran: e.peran }),
        })
      );
      onSelesai(h.pesan, !h.ok);
    } catch (g) {
      onSelesai(g instanceof Error ? g.message : "Akun e-Court belum terhapus.", true);
    } finally {
      setSibuk(false);
    }
  };

  if (!buka) {
    return (
      <span className="inline-flex gap-1">
        <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => setBuka(true)} title="Isi surel dan sandi e-Court pegawai ini">
          <KeyRound className="mr-1 h-3.5 w-3.5" />
          {e.adaSandi ? "Ganti" : "Isi"}
        </Button>
        {e.adaSandi ? (
          <Button type="button" size="sm" variant="ghost" className="h-7 px-2" disabled={sibuk} onClick={() => void hapus()} title="Hapus akun e-Court tersimpan">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </span>
    );
  }
  return (
    <form
      className="mt-1 flex flex-wrap items-center gap-1"
      autoComplete="off"
      onSubmit={(ev) => {
        ev.preventDefault();
        void kirim();
      }}
    >
      <input
        type="email"
        className="h-7 w-44 rounded border border-border bg-background px-2 text-xs text-foreground"
        placeholder="surel akun e-Court"
        value={email}
        onChange={(ev) => setEmail(ev.target.value)}
        autoComplete="off"
        required
      />
      <input
        type="password"
        className="h-7 w-36 rounded border border-border bg-background px-2 text-xs text-foreground"
        placeholder={e.adaSandi ? "sandi baru (kosong = tetap)" : "sandi e-Court"}
        value={sandi}
        onChange={(ev) => setSandi(ev.target.value)}
        autoComplete="new-password"
        aria-label="Sandi e-Court (hanya-tulis, tidak pernah ditampilkan)"
      />
      <Button type="submit" size="sm" className="h-7 px-2" disabled={sibuk}>
        {sibuk ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Simpan"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setSandi(""); setBuka(false); }}>
        Batal
      </Button>
    </form>
  );
}

export function KartuTautanAkun() {
  const [kartu, setKartu] = useState<Kartu | null>(null);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState<{ teks: string; galat: boolean } | null>(null);
  const [semua, setSemua] = useState(false);
  const [cari, setCari] = useState("");
  const [pilih, setPilih] = useState<Record<string, string>>({});

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      setKartu(await baca<Kartu>(await fetch(apiPath(ALAMAT), { credentials: "include", cache: "no-store" })));
    } catch (e) {
      setGalat(e instanceof Error ? e.message : "Kartu tautan belum dapat dimuat.");
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const lapor = useCallback(
    (teks: string, g = false) => {
      setPesan({ teks, galat: g });
      if (!g) void muat();
    },
    [muat]
  );

  const tautkan = async (b: BarisKartu) => {
    const usernameSipp = pilih[b.userId] || b.sipp.saran[0]?.username || "";
    if (!usernameSipp) return;
    try {
      const h = await baca<{ ok: boolean; pesan: string }>(
        await fetch(apiPath(ALAMAT), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aksi: "tautkan-sipp", userId: b.userId, usernameSipp }),
        })
      );
      lapor(h.pesan, !h.ok);
    } catch (e) {
      lapor(e instanceof Error ? e.message : "Penautan gagal.", true);
    }
  };

  const tampil = useMemo(() => {
    const k = cari.trim().toLowerCase();
    return (kartu?.baris ?? []).filter((b) => (semua || b.perluPerhatian) && (!k || b.nama.toLowerCase().includes(k) || b.usernameAleta.toLowerCase().includes(k)));
  }, [kartu, semua, cari]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" /> Tautan akun pegawai
        </CardTitle>
        <CardDescription>
          Satu baris per pegawai: akun ALETA, SIPP, ABT, dan e-Court. Yang cocok pasti (nama atau NIP sama persis) sudah ditautkan sendiri; yang ragu dipilih di sini.
          Sandi e-Court tersimpan tersandi dan tidak pernah tampil; sandi SIPP tidak disimpan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => void muat()} disabled={memuat}>
            {memuat ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}Muat ulang
          </Button>
          <label className="flex items-center gap-1 text-sm text-muted-foreground">
            <input type="checkbox" checked={semua} onChange={(e) => setSemua(e.target.checked)} /> Tampilkan semua pegawai
          </label>
          <input
            className="h-8 w-48 rounded border border-border bg-background px-2 text-sm text-foreground"
            placeholder="Cari nama"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
          />
          {kartu ? (
            <span className="text-sm text-muted-foreground">
              {kartu.ringkas.perluPerhatian} dari {kartu.ringkas.pegawai} pegawai perlu diperhatikan
            </span>
          ) : null}
        </div>
        {galat ? <p className="text-sm text-destructive">{galat}</p> : null}
        {pesan ? <p className={pesan.galat ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{pesan.teks}</p> : null}
        {kartu?.otomatis.ditautkan.length ? (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {kartu.otomatis.ditautkan.length} akun baru saja ditautkan otomatis ke SIPP (cocok pasti). Dapat dibatalkan di Manajemen Akun, tab Tautan SIPP.
          </p>
        ) : null}
        {kartu?.otomatis.gagal ? <p className="text-sm text-amber-700 dark:text-amber-400">Penautan otomatis belum berjalan: {kartu.otomatis.gagal}</p> : null}
        {kartu && !kartu.ecourtTersedia ? <p className="text-sm text-amber-700 dark:text-amber-400">{kartu.ecourtPesan}</p> : null}
        {kartu && !tampil.length ? <p className="text-sm text-muted-foreground">{semua ? "Tidak ada pegawai yang cocok dengan pencarian." : "Semua tautan akun sudah cocok."}</p> : null}
        {tampil.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Pegawai (ALETA)</th>
                  <th className="py-2 pr-3">SIPP</th>
                  <th className="py-2 pr-3">ABT</th>
                  <th className="py-2">e-Court</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((b) => (
                  <tr key={b.userId} className="border-b border-border/60 align-top">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-foreground">{b.nama}</div>
                      <div className="text-xs text-muted-foreground">{b.usernameAleta}</div>
                    </td>
                    <td className="max-w-[16rem] py-2 pr-3">
                      <Lencana keadaan={b.sipp.keadaan} judul={b.sipp.sebab} />
                      {b.sipp.username ? <div className="mt-1 text-xs text-foreground">{b.sipp.username}</div> : null}
                      {b.sipp.keadaan === "perlu-dipilih" && b.sipp.saran.length ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <select
                            className="h-7 rounded border border-border bg-background px-1 text-xs text-foreground"
                            value={pilih[b.userId] ?? b.sipp.saran[0].username}
                            onChange={(e) => setPilih((p) => ({ ...p, [b.userId]: e.target.value }))}
                          >
                            {b.sipp.saran.map((s) => (
                              <option key={s.username} value={s.username}>
                                {s.username} - {s.namaLengkap}
                              </option>
                            ))}
                          </select>
                          <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={() => void tautkan(b)}>
                            Tautkan
                          </Button>
                        </div>
                      ) : null}
                    </td>
                    <td className="max-w-[14rem] py-2 pr-3">
                      <Lencana keadaan={b.abt.keadaan} judul={b.abt.sebab} />
                      {b.abt.folder.length ? <div className="mt-1 text-xs text-muted-foreground">Blangko: {b.abt.folder.map((f) => f.direktori).join(", ")}</div> : null}
                    </td>
                    <td className="py-2">
                      {b.ecourt.length ? (
                        <ul className="space-y-1">
                          {b.ecourt.map((e) => (
                            <li key={e.peran}>
                              <span className="mr-1 text-xs text-muted-foreground">{e.sebutanPeran}</span>
                              <Lencana keadaan={e.keadaan} judul={e.sebab} />
                              {e.email ? <span className="ml-1 text-xs text-foreground">{e.email}</span> : null}
                              {e.diisiOleh ? <span className="ml-1 text-xs text-muted-foreground">(diisi oleh {e.diisiOleh})</span> : null}{" "}
                              {kartu?.ecourtTersedia && (b.roleId !== "super-admin" || kartu.bolehIsiSuperAdmin) ? (
                                <IsiEcourt baris={b} e={e} onSelesai={lapor} />
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-xs text-muted-foreground">Tidak memerlukan e-Court</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
