import type { Metadata } from "next";

import { FeedbackAdminPanel } from "@/components/portal/feedback-admin-panel";

export const metadata: Metadata = {
  title: "Masukan Pengguna - ALETA",
};

export default function AdminFeedbackPage() {
  return <FeedbackAdminPanel />;
}
