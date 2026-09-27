import { replaceBrandText } from "@/lib/brand";

type ContentBodyProps = {
  html: string | null | undefined;
};

export function ContentBody({ html }: ContentBodyProps) {
  if (!html) return null;
  return (
    <div
      className="wp-content"
      dangerouslySetInnerHTML={{ __html: replaceBrandText(html) }}
    />
  );
}
