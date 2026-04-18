"use client";

import { ActingAssignmentPanel } from "@/components/portal/acting-assignment-panel";
import { AccessDeniedCard, PageIntro } from "@/components/portal/shared";
import { usePortal } from "@/lib/app-state";
import { canManageActingAssignments } from "@/lib/permissions";

export default function PenugasanPage() {
  const { currentUser } = usePortal();

  return (
    <div className="space-y-6">
      <PageIntro
        eyebrow="Penugasan"
        title="Manajemen Penugasan Jabatan"
        description="Kelola PLH dengan rentang waktu aktif dan PLT tanpa batas akhir hingga pejabat definitif tersedia, seluruhnya divalidasi ketat mengikuti hierarki jabatan."
      />
      {canManageActingAssignments(currentUser) ? <ActingAssignmentPanel /> : <AccessDeniedCard />}
    </div>
  );
}
