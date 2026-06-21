"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { markAcknowledgmentsReadAction, markWHNotificationsReadAction } from "@/app/actions/notifications";

export default function MarkReadClient() {
  const router = useRouter();

  useEffect(() => {
    markAcknowledgmentsReadAction().then(() => {
      router.refresh();
    });
  }, [router]);

  return null;
}

export function MarkWHReadClient() {
  const router = useRouter();

  useEffect(() => {
    markWHNotificationsReadAction().then(() => {
      router.refresh();
    });
  }, [router]);

  return null;
}
