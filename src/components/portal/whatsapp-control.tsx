"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Loader2, MessageSquare, RefreshCcw, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function WhatsAppControl() {
  const [status, setStatus] = useState<"inactive" | "initializing" | "qr" | "authenticated" | "ready" | "failed">("inactive");
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<Date>(new Date());

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/qr");
      const data = await res.json();
      if (data.ok) {
        setStatus(data.data.status);
        setQr(data.data.qr);
      }
    } catch (err) {
      console.error("Gagal mengambil status WhatsApp:", err);
    } finally {
      setLastCheck(new Date());
    }
  };

  const initializeClient = async () => {
    setLoading(true);
    try {
      await fetch("/api/whatsapp/init", { method: "POST" });
      await fetchStatus();
    } catch (err) {
      console.error("Gagal inisialisasi WhatsApp:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-border/80 overflow-hidden">
      <CardHeader className="bg-primary/5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Koneksi WhatsApp Web</CardTitle>
              <CardDescription>Hubungkan nomor resmi instansi via scanner barcode terpusat.</CardDescription>
            </div>
          </div>
          <Badge 
            variant={status === "ready" ? "success" : status === "qr" ? "warning" : "outline"}
            className="capitalize"
          >
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-6">
          {status === "ready" ? (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto">
                <Smartphone className="h-10 w-10 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold">Terhubung</h3>
                <p className="text-sm text-muted-foreground">Sistem siap mengirim notifikasi otomatis.</p>
              </div>
            </div>
          ) : status === "qr" && qr ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-white rounded-2xl border border-border inline-block">
                <Image src={qr} alt="WhatsApp QR Code" width={224} height={224} className="w-56 h-56" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold">Pindai QR Code</p>
                <p className="text-sm text-muted-foreground">Gunakan WhatsApp di ponsel Anda untuk memindai.</p>
              </div>
            </div>
          ) : status === "initializing" || loading ? (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Menyiapkan browser headless di server...</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto grayscale opacity-50">
                <Smartphone className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="font-semibold">WhatsApp Belum Aktif</h3>
                <p className="text-sm text-muted-foreground">Klik tombol di bawah untuk mulai menghubungkan.</p>
              </div>
              <Button onClick={initializeClient}>
                Mulai Inisialisasi
              </Button>
            </div>
          )}

          <div className="w-full pt-6 border-t border-dashed border-border flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <RefreshCcw className={cn("h-3 w-3", status === "initializing" && "animate-spin")} />
              <span>Update terakhir: {lastCheck.toLocaleTimeString()}</span>
            </div>
            <p>Sesi disimpan terpusat via LocalAuth</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
