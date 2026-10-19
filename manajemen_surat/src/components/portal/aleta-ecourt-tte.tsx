"use client";

/**
 * ============================================================================
 * TTE (TANDA TANGAN ELEKTRONIK TERSERTIFIKASI BSrE) PER PEJABAT
 * ============================================================================
 *
 * 19 Okt 2026: tombol "Passphrase TTE" dihapus dari panel ekstensi dan
 * pengaturannya dipindah ke sini (halaman Tanda tangan pejabat).
 *
 * Yang diatur: cara menandatangani tiap pejabat dan identitas sertifikatnya
 * (NIK / ID pengguna BSrE). PASSPHRASE TIDAK ADA DI LAYAR INI dan tidak
 * disimpan di server: menyimpannya membuat dokumen dapat ditandatangani atas
 * nama pejabat tanpa kehadirannya.
 *
 * Hak: Admin/Super Admin mengatur semua baris; pejabat lain (mode "saya")
 * hanya melihat pengaturan akunnya sendiri, tanpa dapat mengubahnya.
 */

import { useCallback, useEffect, useState } from "react";

import { KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiPath } from "@/lib/base-path";
import {
  KETERANGAN_DIALOG_PASSPHRASE,
  KETERANGAN_PASSPHRASE,
  kalimatTte,
  nikBsreSah,
  type BarisTte,
  type CaraTtd,
} from "@/lib/tte-bsre";

type StatusBsre = "tersambung" | "belum" | "tidak-terbaca";

type Jawaban = { admin: boolean; statusBsre: StatusBsre; baris: BarisTte[] };

const TEKS_STATUS: Record<StatusBsre, string> = {
  tersambung: "BSrE tersambung.",
  belum: "BSrE belum tersambung; dokumen memakai gambar tanda tangan yang disahkan.",
  "tidak-terbaca": "Status sambungan BSrE tidak terbaca (ALETA Bot belum dapat dihubungi).",
};

export function AletaEcourtTte({ mode = "semua" }: { mode?: "semua" | "saya" }) {
  const [data, setData] = useState<Jawaban | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState("");
  const [pesan, setPesan] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [suntingan, setSuntingan] = useState<Record<number, { cara: CaraTtd; nik: string }>>({});

  const muat = useCallback(async () => {
    setMemuat(true);
    setGalat("");
    try {
      const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan/tte"), { credentials: "include", cache: "no-store" });
      if (!respons.ok) {
        const badan = (await respons.json().catch(() => null)) as { error?: string | { message?: string } } | null;
        const sebab = typeof badan?.error === "string" ? badan.error : badan?.error?.message || "";
        throw new Error(sebab ? kalimatTte(sebab) : `ALETA menjawab ${respons.status}.`);
      }
      const bungkus = ((await respons.json())?.data ?? {}) as Partial<Jawaban>;
      setData({
        admin: bungkus.admin === true,
        statusBsre: bungkus.statusBsre === "tersambung" || bungkus.statusBsre === "belum" ? bungkus.statusBsre : "tidak-terbaca",
        // Baris yang bentuknya bukan baris TTE (mis. jawaban rute lain) dibuang, bukan dibiarkan menjatuhkan layar induknya.
        baris: Array.isArray(bungkus.baris)
          ? bungkus.baris
              .filter((b) => b && typeof b.id === "number" && typeof b.namaPejabat === "string")
              .map((b) => ({ ...b, caraTtd: b.caraTtd === "tte" ? "tte" : "gambar", nikBsre: String(b.nikBsre ?? ""), jabatan: String(b.jabatan ?? "") }))
          : [],
      });
      setSuntingan({});
    } catch (e) {
      setGalat(`Pengaturan TTE tidak terbaca. ${e instanceof Error ? e.message : ""}`.trim());
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const simpan = useCallback(
    async (b: BarisTte, cara: CaraTtd, nik: string) => {
      setSibuk(true);
      setPesan("");
      setGalat("");
      try {
        // Badan HANYA memuat id, cara, dan identitas sertifikat - tidak ada passphrase.
        const respons = await fetch(apiPath("/api/aleta-ecourt/tanda-tangan/tte"), {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: b.id, caraTtd: cara, nikBsre: nik.trim() }),
        });
        const badan = (await respons.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!respons.ok || badan?.ok === false) {
          throw new Error(kalimatTte(String(badan?.error || `ALETA menjawab ${respons.status}.`)));
        }
        setPesan(`Pengaturan TTE ${b.namaPejabat} tersimpan.`);
        await muat();
      } catch (e) {
        setGalat(e instanceof Error ? e.message : "Pengaturan TTE gagal disimpan.");
      } finally {
        setSibuk(false);
      }
    },
    [muat]
  );

  // Mode "saya": pejabat tanpa tanda tangan tertaut tidak melihat apa pun.
  if (mode === "saya" && (memuat || !data || data.baris.length === 0)) return null;

  const admin = data?.admin === true;
  const tersambung = data?.statusBsre === "tersambung";

  return (
    <Card data-testid="kartu-tte">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          {mode === "saya" ? "TTE saya" : "TTE (Tanda Tangan Elektronik tersertifikasi BSrE)"}
          {data ? (
            <Badge variant={tersambung ? "success" : "muted"}>{tersambung ? "tersambung" : data.statusBsre === "belum" ? "belum tersambung" : "status tidak terbaca"}</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          <span data-testid="status-bsre">{data ? TEKS_STATUS[data.statusBsre] : "Memuat status sambungan BSrE..."}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium" data-testid="keterangan-passphrase">
              {KETERANGAN_PASSPHRASE}
            </p>
            <p className="text-muted-foreground">{KETERANGAN_DIALOG_PASSPHRASE}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void muat()} disabled={memuat || sibuk}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Muat ulang
          </Button>
          {!admin && data ? <span className="text-xs text-muted-foreground">Hanya Admin/Super Admin yang dapat mengubah; ini pengaturan akun Anda.</span> : null}
        </div>

        {galat ? (
          <p role="alert" className="text-sm text-destructive">
            {galat}
          </p>
        ) : null}
        {pesan ? (
          <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
            {pesan}
          </p>
        ) : null}

        {memuat && !data ? <p className="text-sm text-muted-foreground">Memuat...</p> : null}
        {data && data.baris.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pejabat bernama.</p> : null}

        {data && data.baris.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {data.baris.map((b) => {
              const s = suntingan[b.id] ?? { cara: b.caraTtd, nik: b.nikBsre };
              const berubah = s.cara !== b.caraTtd || s.nik.trim() !== b.nikBsre;
              const nikSah = nikBsreSah(s.nik);
              const bolehTte = tersambung;
              return (
                <div key={b.id} className="space-y-2 rounded-md border p-3" data-testid={`tte-baris-${b.id}`}>
                  <div>
                    <p className="text-sm font-medium">{b.namaPejabat}</p>
                    <p className="text-xs text-muted-foreground">{b.jabatan || "Jabatan belum diisi"}</p>
                  </div>

                  <label className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">Cara tanda tangan</span>
                    <select
                      className="h-9 w-full rounded-md border bg-card px-2 text-sm disabled:opacity-60"
                      aria-label={`Cara tanda tangan ${b.namaPejabat}`}
                      value={s.cara}
                      disabled={!admin || sibuk}
                      onChange={(e) => setSuntingan((x) => ({ ...x, [b.id]: { ...s, cara: e.target.value === "tte" ? "tte" : "gambar" } }))}
                    >
                      <option value="gambar">Gambar tanda tangan disahkan (bawaan)</option>
                      <option value="tte" disabled={!bolehTte}>
                        TTE BSrE{bolehTte ? "" : " (nonaktif - BSrE belum tersambung)"}
                      </option>
                    </select>
                  </label>

                  <label className="block space-y-1 text-xs">
                    <span className="text-muted-foreground">NIK / ID pengguna BSrE (identitas sertifikat, bukan passphrase)</span>
                    <Input
                      aria-label={`NIK atau ID pengguna BSrE ${b.namaPejabat}`}
                      value={s.nik}
                      maxLength={32}
                      autoComplete="off"
                      inputMode="text"
                      disabled={!admin || sibuk}
                      placeholder={admin ? "mis. 16 digit NIK" : "belum diisi"}
                      onChange={(e) => setSuntingan((x) => ({ ...x, [b.id]: { ...s, nik: e.target.value } }))}
                    />
                  </label>
                  {!nikSah ? <p className="text-xs text-destructive">{kalimatTte("nik_bsre_tidak_sah")}</p> : null}

                  <div className="flex flex-wrap items-center gap-2">
                    {admin ? (
                      <Button type="button" size="sm" disabled={sibuk || !berubah || !nikSah} onClick={() => void simpan(b, s.cara, s.nik)}>
                        Simpan pengaturan TTE
                      </Button>
                    ) : null}
                    {b.disahkan ? <Badge variant="success">gambar disahkan</Badge> : <Badge variant="warning">gambar belum disahkan</Badge>}
                    {!b.tertaut ? <Badge variant="muted">belum ditautkan ke akun</Badge> : null}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
