import React from "react";
import { GlobalLayout } from "@/components/layout/GlobalLayout";
import { GlobalNotification } from "@/components/chat/GlobalNotification";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalLayout>
      <GlobalNotification />
      {children}
    </GlobalLayout>
  );
}
