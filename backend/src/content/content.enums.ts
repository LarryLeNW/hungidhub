export enum PublishStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

/** Admin "Nội dung" rows: banner, thông báo hệ thống, bài trợ giúp. */
export enum ContentBlockType {
  Banner = 'banner',
  Announcement = 'announcement',
  HelpArticle = 'help_article',
}

/** "Vị trí" column: Trang chủ / Toàn hệ thống / Trung tâm trợ giúp / Danh mục. */
export enum ContentPlacement {
  Home = 'home',
  Global = 'global',
  HelpCenter = 'help_center',
  Category = 'category',
  Product = 'product',
}
