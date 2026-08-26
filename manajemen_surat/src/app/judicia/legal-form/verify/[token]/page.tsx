import Link from "next/link";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDatabase } from "@/server/db/client";
import { verifyDocumentToken } from "@/server/modules/judicia/legal-form/verification/jlf-document-verification-service";

export const dynamic = "force-dynamic";

export default async function PublicJudiciaLegalFormVerifyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDatabase();
  const result = await verifyDocumentToken(db, token);
  const valid = result.valid === true;
  const verifiedDocument = "documentType" in result ? result : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto max-w-2xl space-y-6">
        <Card className="border-border/80">
          <CardHeader>
            <div className="rounded-2xl bg-primary/10 p-3 text-primary w-fit">
              {valid ? <CheckCircle2 className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
            </div>
            <CardTitle>Verifikasi Dokumen ALETA Judicia</CardTitle>
            <CardDescription>
              Halaman ini hanya menampilkan informasi minimal. Detail dokumen tetap memerlukan login dan otorisasi.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={valid ? "success" : "danger"}>{result.status}</Badge>
              <Badge variant="outline">{result.publicView ? "Public minimal" : "Login detail"}</Badge>
            </div>
            {verifiedDocument ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Jenis dokumen" value={verifiedDocument.documentType || "-"} />
                <Info label="Tanggal generate" value={verifiedDocument.generatedAt || "-"} />
                <Info label="Tanggal final" value={verifiedDocument.finalizedAt || "-"} />
                <Info label="Nomor perkara" value={verifiedDocument.nomorPerkara || "-"} />
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {"message" in result ? result.message : "Token verifikasi tidak valid."}
              </p>
            )}
            <div className="flex flex-wrap gap-2 pt-3">
              <Button asChild variant="outline">
                <Link href="/login">Login ALETA</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/portal">Portal</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
