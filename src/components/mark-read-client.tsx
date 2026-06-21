"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markAcknowledgmentsReadAction } from "@/app/actions/notifications";

export default function MarkReadClient() {
  const router = useRouter();

  useEffect(() => {
    markAcknowledgmentsReadAction().then(() => {
      router.refresh();
    });
  }, [router]);

  return null;
}
