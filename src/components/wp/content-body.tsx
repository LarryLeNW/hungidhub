"use client";

import { usePublicSettings } from "@/components/settings/settings-provider";
import { replaceBrandText } from "@/lib/brand";

type ContentBodyProps = {
  html: string | null | undefined;
};

export function ContentBody({ html }: ContentBodyProps) {
  const settings = usePublicSettings();
  if (!html) return null;

  const transformed = replaceBrandText(html, {
    brandName: settings["store.name"],
    phone: settings["store.hotline"],
    email: settings["store.email"],
    zalo: settings["store.zalo"],
    domain: settings["store.domain"],
  });

  return (
    <div
      className="wp-content"
      dangerouslySetInnerHTML={{ __html: transformed }}
    />
  );
}
