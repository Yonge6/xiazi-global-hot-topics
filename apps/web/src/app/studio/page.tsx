import type { Metadata } from "next";

import { StudioEditor } from "@/components/studio-editor";

export const metadata: Metadata = {
  title: "手机编辑后台",
  robots: { index: false, follow: false },
};

export default function StudioPage() {
  return <StudioEditor />;
}
