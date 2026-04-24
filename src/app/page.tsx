"use client";

import dynamic from "next/dynamic";

const DAWWorkspace = dynamic(() => import("@/components/DAWWorkspace"), {
  ssr: false,
  loading: () => (
    <div
      className="h-screen flex items-center justify-center"
      style={{ background: "#0d0d0d", color: "#666" }}
    >
      <span className="text-sm">Loading...</span>
    </div>
  ),
});

export default function Home() {
  return <DAWWorkspace />;
}
