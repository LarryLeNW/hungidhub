import Link from "next/link";
import { CategoryProductBrowser } from "@/components/wp/category-product-browser";
import { ContentBody } from "@/components/wp/content-body";
import type { ApiCategory } from "@/lib/api/catalog";
import { replaceBrandText } from "@/lib/brand";
import type { Product } from "@/types/commerce";

type CategoryTemplateProps = {
  category: ApiCategory;
  parent: ApiCategory | null;
  products: Product[];
};

export function CategoryTemplate({ category, parent, products }: CategoryTemplateProps) {
  const { introHtml, articleHtml } = splitCategoryHtml(category.contentHtml ?? "");

  return (
    <main className="bg-[#f5f5f5]">
      <section className="bg-white py-5">
        <div className="ktk-category-frame">
          <div className="mb-3 flex flex-col gap-2 text-[16px] text-slate-500 lg:flex-row lg:items-center lg:justify-between">
            <nav className="overflow-hidden whitespace-nowrap">
              <Link href="/">Trang chủ</Link>
              {parent ? (
                <>
                  <span className="mx-2 text-slate-300">/</span>
                  <Link href={`/${parent.path}`}>{parent.name}</Link>
                </>
              ) : null}
              <span className="mx-2 text-slate-300">/</span>
              <strong className="text-slate-950">{category.name}</strong>
            </nav>
            <p className="hidden text-[16px] text-slate-950 lg:block">
              {products.length} sản phẩm
            </p>
          </div>

          {introHtml ? (
            <ContentBody html={introHtml} />
          ) : (
            <div className="wp-content">
              <h1>{category.name}</h1>
              {category.description ? <p>{replaceBrandText(category.description)}</p> : null}
            </div>
          )}
        </div>
      </section>

      <CategoryProductBrowser title={category.name} products={products} />

      {articleHtml ? (
        <section className="ktk-category-frame pb-10">
          <ContentBody html={articleHtml} />
        </section>
      ) : null}
    </main>
  );
}

/**
 * Splits the category copy at the first <h2> so products sit between intro and article.
 * The cut can land inside a wrapper <div>; rebalance the tags so both halves are valid HTML
 * (otherwise the browser repairs them differently from React and hydration fails).
 */
function splitCategoryHtml(html: string) {
  const splitAt = html.indexOf("<h2");
  if (splitAt === -1) {
    return { introHtml: html, articleHtml: "" };
  }

  let introHtml = html.slice(0, splitAt);
  let articleHtml = html.slice(splitAt);
  const openDivs = (introHtml.match(/<div\b/gi) ?? []).length - (introHtml.match(/<\/div>/gi) ?? []).length;

  for (let index = 0; index < openDivs; index += 1) {
    introHtml += "</div>";
    const lastClose = articleHtml.lastIndexOf("</div>");
    if (lastClose !== -1) {
      articleHtml = articleHtml.slice(0, lastClose) + articleHtml.slice(lastClose + "</div>".length);
    }
  }

  return { introHtml, articleHtml };
}
