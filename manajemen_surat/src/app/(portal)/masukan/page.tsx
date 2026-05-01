import type { Metadata } from "next";

import { FeedbackCenter } from "@/components/portal/feedback-center";

export const metadata: Metadata = {
  title: "Pusat Masukan ALETA - ALETA",
};

export default function FeedbackPage() {
  return <FeedbackCenter />;
}
