import Link from "next/link";
import { ContentBody } from "@/components/wp/content-body";
import type { ApiPost, ContentDoc } from "@/lib/api/content";
import { formatDateTime } from "@/lib/dates";

type ArticleTemplateProps = {
  page: ContentDoc;
  latestPosts: ApiPost[];
};

const socialLinks = [
  ["f", "Facebook"],
  ["◎", "Instagram"],
  ["t", "Twitter"],
  ["▶", "YouTube"],
];

export function ArticleTemplate({ page, latestPosts }: ArticleTemplateProps) {
  const contentHtml =
    page.slug === "huong-dan-mua-hang" ? removeImages(page.contentHtml ?? "") : page.contentHtml;

  return (
    <main className="bg-white">
      <div className="ktk-about-frame grid gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_276px]">
        <article className="min-w-0">
          {contentHtml ? (
            <ContentBody html={contentHtml} />
          ) : (
            <div className="wp-content">
              <h1>{page.title}</h1>
              {page.excerpt ? <p>{page.excerpt}</p> : null}
            </div>
          )}
        </article>

        <aside className="hidden min-w-0 lg:block">
          <section>
            <h2 className="text-center text-[16px] font-extrabold uppercase text-slate-950">
              Theo dõi chúng tôi
            </h2>
            <div className="mt-5 flex justify-center gap-2">
              {socialLinks.map(([label, title], index) => (
                <a
                  key={title}
                  href="#"
                  title={title}
                  aria-label={title}
                  className={
                    index === 0
                      ? "grid size-9 place-items-center rounded-full bg-[#4267b2] text-[15px] font-extrabold text-white"
                      : index === 1
                        ? "grid size-9 place-items-center rounded-full bg-[#232323] text-[15px] font-extrabold text-white"
                        : index === 2
                          ? "grid size-9 place-items-center rounded-full bg-[#1da1f2] text-[15px] font-extrabold text-white"
                          : "grid size-9 place-items-center rounded-full bg-[#d92525] text-[13px] font-extrabold text-white"
                  }
                >
                  {label}
                </a>
              ))}
            </div>
          </section>

          {latestPosts.length ? (
            <section className="mt-10 border-t border-[#e5e7eb] pt-8">
              <h2 className="text-[16px] font-extrabold uppercase text-slate-950">Bài viết mới</h2>
              <div className="mt-5 space-y-5">
                {latestPosts.map((post) => (
                  <Link key={post.id} href={`/${post.slug}`} className="block">
                    <h3 className="text-[16px] font-bold leading-6 text-slate-950">{post.title}</h3>
                    <time className="mt-1 block text-[13px] text-slate-400">
                      {formatDateTime(post.publishedAt ?? post.updatedAt).split(" ").pop()}
                    </time>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function removeImages(html: string) {
  return html.replace(/<img\b[^>]*>/gi, "");
}
