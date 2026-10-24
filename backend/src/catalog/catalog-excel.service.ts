import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { slugify } from '../common/utils/slug.js';
import { DeliveryType, ProductStatus, StockStatus } from './catalog.enums.js';
import { Category } from './entities/category.entity.js';
import { ProductVariant } from './entities/product-variant.entity.js';
import { Product } from './entities/product.entity.js';

export interface ImportResult {
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  errors: string[];
}

interface ColumnConfig {
  key: string;
  label: string;
  required?: boolean;
  width: number;
}

const PRODUCT_COLUMNS: ColumnConfig[] = [
  { key: 'slug', label: 'Mã sản phẩm (Slug)', required: false, width: 28 },
  { key: 'name', label: 'Tên sản phẩm', required: true, width: 34 },
  { key: 'category', label: 'Danh mục', required: false, width: 25 },
  { key: 'variantName', label: 'Tên gói', required: true, width: 26 },
  { key: 'duration', label: 'Thời hạn', required: false, width: 14 },
  { key: 'sku', label: 'Mã SKU', required: false, width: 16 },
  { key: 'regularPrice', label: 'Giá gốc (VNĐ)', required: false, width: 16 },
  { key: 'price', label: 'Giá bán (VNĐ)', required: true, width: 18 },
  { key: 'deliveryType', label: 'Hình thức giao', required: false, width: 16 },
  { key: 'stockStatus', label: 'Tồn kho', required: false, width: 14 },
  { key: 'warrantyDays', label: 'Bảo hành (ngày)', required: false, width: 16 },
  { key: 'status', label: 'Trạng thái', required: false, width: 14 },
  { key: 'featuredImage', label: 'Ảnh đại diện', required: false, width: 35 },
  { key: 'shortDescription', label: 'Mô tả ngắn', required: false, width: 40 },
];

const CATEGORY_EXPORT_COLUMNS: ColumnConfig[] = [
  { key: 'id', label: 'Mã ID', required: false, width: 10 },
  { key: 'name', label: 'Tên danh mục', required: true, width: 30 },
  { key: 'slug', label: 'Đường dẫn (Slug)', required: false, width: 26 },
  { key: 'path', label: 'Đường dẫn đầy đủ (Path)', required: false, width: 35 },
  { key: 'parent', label: 'Danh mục cha', required: false, width: 28 },
  { key: 'icon', label: 'Icon (Lucide)', required: false, width: 15 },
  { key: 'sortOrder', label: 'Thứ tự', required: false, width: 10 },
  { key: 'isVisible', label: 'Hiển thị', required: false, width: 12 },
  { key: 'description', label: 'Mô tả', required: false, width: 40 },
];

const CATEGORY_TEMPLATE_COLUMNS: ColumnConfig[] = [
  { key: 'name', label: 'Tên danh mục', required: true, width: 30 },
  { key: 'slug', label: 'Đường dẫn (Slug)', required: false, width: 26 },
  { key: 'parent', label: 'Danh mục cha', required: false, width: 28 },
  { key: 'icon', label: 'Icon (Lucide)', required: false, width: 15 },
  { key: 'sortOrder', label: 'Thứ tự', required: false, width: 10 },
  { key: 'isVisible', label: 'Hiển thị', required: false, width: 12 },
  { key: 'description', label: 'Mô tả', required: false, width: 40 },
];

/**
 * Định dạng hàng tiêu đề với chữ đậm, nền xám nhạt và DẤU SAO ĐỎ (*) cho cột bắt buộc.
 */
function applyHeaderRow(worksheet: ExcelJS.Worksheet, columns: ColumnConfig[]) {
  worksheet.columns = columns.map((col) => ({
    key: col.key,
    width: col.width,
  }));

  const headerRow = worksheet.getRow(1);
  headerRow.height = 26;

  columns.forEach((col, index) => {
    const cell = headerRow.getCell(index + 1);
    if (col.required) {
      cell.value = {
        richText: [
          {
            text: col.label,
            font: { bold: true, color: { argb: 'FF0F172A' }, size: 11, name: 'Calibri' },
          },
          {
            text: ' *',
            font: { bold: true, color: { argb: 'FFDC2626' }, size: 11, name: 'Calibri' }, // Dấu * màu đỏ
          },
        ],
      };
    } else {
      cell.value = {
        richText: [
          {
            text: col.label,
            font: { bold: true, color: { argb: 'FF0F172A' }, size: 11, name: 'Calibri' },
          },
        ],
      };
    }

    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });

  headerRow.commit();
}

/**
 * Định dạng các hàng dữ liệu bảng tính.
 */
function styleDataRow(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
      left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFF1F5F9' } },
    };
    cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  });
  row.commit();
}

/**
 * Lấy giá trị từ hàng Excel, tự động chuẩn hóa dấu *, khoảng trắng và chữ hoa thường.
 */
function getRowValue(row: Record<string, unknown>, ...keys: string[]): unknown {
  if (!row || typeof row !== 'object') return undefined;

  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== '') return row[key];
    const withStar = `${key} *`;
    if (row[withStar] !== undefined && row[withStar] !== '') return row[withStar];
    const starNoSpace = `${key}*`;
    if (row[starNoSpace] !== undefined && row[starNoSpace] !== '') return row[starNoSpace];
  }

  // Khớp mờ nếu người dùng đổi vị trí dấu * hoặc viết hoa/thường khác nhau
  const cleanKeyMap = new Map<string, unknown>();
  for (const [actualKey, val] of Object.entries(row)) {
    cleanKeyMap.set(actualKey.replace(/\*/g, '').trim().toLowerCase(), val);
  }

  for (const key of keys) {
    const cleanKey = key.replace(/\*/g, '').trim().toLowerCase();
    const val = cleanKeyMap.get(cleanKey);
    if (val !== undefined && val !== '') return val;
  }

  return undefined;
}

@Injectable()
export class CatalogExcelService {
  constructor(
    @InjectRepository(Product)
    private readonly products: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variants: Repository<ProductVariant>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // SẢN PHẨM: EXPORT, TEMPLATE & IMPORT
  // =========================================================================

  async exportProducts(res: Response) {
    const items = await this.products.find({
      relations: {
        categories: true,
        variants: true,
      },
      order: {
        id: 'ASC',
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('San_Pham', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, PRODUCT_COLUMNS);

    for (const product of items) {
      const categoryNames = (product.categories ?? []).map((c) => c.name).join(', ');
      const statusLabel =
        product.status === ProductStatus.Active
          ? 'Đang bán'
          : product.status === ProductStatus.Hidden
            ? 'Ẩn'
            : 'Bản nháp';

      const variants = product.variants?.length ? product.variants : [null];

      for (const variant of variants) {
        const row = worksheet.addRow({
          slug: product.slug,
          name: product.name,
          category: categoryNames,
          variantName: variant?.name ?? variant?.accountType ?? 'Gói mặc định',
          duration: variant?.duration ?? '',
          sku: variant?.sku ?? '',
          regularPrice: variant?.regularPrice ?? '',
          price: variant?.price ?? 0,
          deliveryType: variant?.deliveryType === DeliveryType.Auto ? 'Tự động' : 'Thủ công',
          stockStatus: variant?.stockStatus === StockStatus.InStock ? 'Còn hàng' : 'Hết hàng',
          warrantyDays: variant?.warrantyDays ?? product.warrantyDays ?? 0,
          status: statusLabel,
          featuredImage: product.featuredImage ?? '',
          shortDescription: product.shortDescription ?? '',
        });
        styleDataRow(row);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="danh-sach-san-pham.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async templateProducts(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('San_Pham_Mau', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, PRODUCT_COLUMNS);

    const sampleRows = [
      {
        slug: 'tai-khoan-chatgpt-plus',
        name: 'Tài khoản ChatGPT Plus & Pro',
        category: 'Công cụ AI',
        variantName: 'Tài khoản cấp sẵn',
        duration: '1 tháng',
        sku: 'CGPT-PLUS-1M',
        regularPrice: 450000,
        price: 280000,
        deliveryType: 'Tự động',
        stockStatus: 'Còn hàng',
        warrantyDays: 30,
        status: 'Đang bán',
        featuredImage: 'https://example.com/chatgpt.jpg',
        shortDescription: 'Tài khoản dùng riêng đầy đủ tính năng GPT-4o.',
      },
      {
        slug: 'tai-khoan-chatgpt-plus',
        name: 'Tài khoản ChatGPT Plus & Pro',
        category: 'Công cụ AI',
        variantName: 'Tài khoản cấp sẵn',
        duration: '1 năm',
        sku: 'CGPT-PLUS-1Y',
        regularPrice: 5400000,
        price: 2990000,
        deliveryType: 'Tự động',
        stockStatus: 'Còn hàng',
        warrantyDays: 365,
        status: 'Đang bán',
        featuredImage: 'https://example.com/chatgpt.jpg',
        shortDescription: 'Tài khoản dùng riêng đầy đủ tính năng GPT-4o.',
      },
      {
        slug: 'tai-khoan-canva-pro',
        name: 'Tài khoản Canva Pro Edu / Brand',
        category: 'Đồ họa & Thiết kế',
        variantName: 'Nâng chính chủ',
        duration: '1 năm',
        sku: 'CANVA-PRO-1Y',
        regularPrice: 890000,
        price: 199000,
        deliveryType: 'Thủ công',
        stockStatus: 'Còn hàng',
        warrantyDays: 365,
        status: 'Đang bán',
        featuredImage: 'https://example.com/canva.jpg',
        shortDescription: 'Mở khóa toàn bộ tính năng và mẫu cao cấp.',
      },
    ];

    for (const data of sampleRows) {
      const row = worksheet.addRow(data);
      styleDataRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mau-nhap-san-pham.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async importProducts(buffer: Buffer): Promise<ImportResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('File Excel không có sheet nào.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (!rawRows.length) {
      throw new BadRequestException('File Excel không có dữ liệu hàng nào.');
    }

    const errors: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    // Nhóm các dòng theo sản phẩm (dựa vào Slug hoặc Tên sản phẩm)
    type RawRow = Record<string, unknown>;
    const grouped = new Map<string, RawRow[]>();

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const name = String(getRowValue(row, 'Tên sản phẩm *', 'Tên sản phẩm', 'name', 'Tên') || '').trim();
      const slugInput = String(getRowValue(row, 'Mã sản phẩm (Slug)', 'slug', 'Mã sản phẩm') || '').trim();
      const slug = slugInput || (name ? slugify(name) : '');

      if (!slug && !name) {
        errors.push(`Dòng ${index + 2}: Thiếu thông tin Tên sản phẩm (*) hoặc mã slug.`);
        continue;
      }

      const key = slug || slugify(name);
      const list = grouped.get(key) ?? [];
      list.push(row);
      grouped.set(key, list);
    }

    // Xử lý từng sản phẩm trong database
    for (const [slugKey, rows] of grouped.entries()) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const firstRow = rows[0];
          const name = String(getRowValue(firstRow, 'Tên sản phẩm *', 'Tên sản phẩm', 'name', 'Tên') || slugKey).trim();
          const shortDescription = String(getRowValue(firstRow, 'Mô tả ngắn', 'shortDescription', 'Mô tả') || '').trim() || null;
          const featuredImage = String(getRowValue(firstRow, 'Ảnh đại diện', 'featuredImage', 'Ảnh') || '').trim() || null;
          const warrantyDaysRaw = Number(getRowValue(firstRow, 'Bảo hành (ngày)', 'warrantyDays') || 0);
          const warrantyDays = Number.isFinite(warrantyDaysRaw) && warrantyDaysRaw > 0 ? warrantyDaysRaw : null;

          const statusRaw = String(getRowValue(firstRow, 'Trạng thái', 'status') || '').toLowerCase();
          let status = ProductStatus.Active;
          if (statusRaw.includes('ẩn') || statusRaw === 'hidden') status = ProductStatus.Hidden;
          if (statusRaw.includes('nháp') || statusRaw === 'draft') status = ProductStatus.Draft;

          // Xử lý Danh mục
          const categoryRaw = String(getRowValue(firstRow, 'Danh mục', 'category', 'categories') || '').trim();
          const categoryList: Category[] = [];
          if (categoryRaw) {
            const catNames = categoryRaw.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
            for (const cName of catNames) {
              const cSlug = slugify(cName);
              let cat = await manager.findOne(Category, {
                where: [{ slug: cSlug }, { name: cName }],
              });
              if (!cat) {
                // Tự động tạo danh mục nếu chưa có
                cat = await manager.save(
                  manager.create(Category, {
                    name: cName,
                    slug: cSlug,
                    path: cSlug,
                    sortOrder: 0,
                    isVisible: true,
                  }),
                );
              }
              categoryList.push(cat);
            }
          }

          let product = await manager.findOne(Product, {
            where: [{ slug: slugKey }, { name }],
            relations: { variants: true, categories: true },
          });

          let isNew = false;
          if (!product) {
            isNew = true;
            product = manager.create(Product, {
              name,
              slug: slugKey,
              shortDescription,
              featuredImage,
              warrantyDays,
              status,
              sortOrder: 0,
              categories: categoryList,
            });
          } else {
            product.name = name;
            if (shortDescription !== null) product.shortDescription = shortDescription;
            if (featuredImage !== null) product.featuredImage = featuredImage;
            if (warrantyDays !== null) product.warrantyDays = warrantyDays;
            product.status = status;
            if (categoryList.length > 0) {
              product.categories = categoryList;
            }
          }

          product = await manager.save(product);
          if (isNew) createdCount++;
          else updatedCount++;

          // Xử lý các gói / biến thể của sản phẩm
          for (let vIdx = 0; vIdx < rows.length; vIdx++) {
            const vRow = rows[vIdx];
            const variantName = String(getRowValue(vRow, 'Tên gói *', 'Tên gói', 'variantName', 'accountType') || 'Gói mặc định').trim();
            const duration = String(getRowValue(vRow, 'Thời hạn', 'duration') || '').trim() || null;
            const skuInput = String(getRowValue(vRow, 'Mã SKU', 'sku') || '').trim();
            const sku = skuInput || `${slugKey.toUpperCase().slice(0, 30)}-${vIdx + 1}`;

            const price = Number(getRowValue(vRow, 'Giá bán (VNĐ) *', 'Giá bán (VNĐ)', 'price', 'Giá') || 0) || 0;
            const regPriceRaw = Number(getRowValue(vRow, 'Giá gốc (VNĐ)', 'regularPrice', 'Giá gốc') || 0);
            const regularPrice = Number.isFinite(regPriceRaw) && regPriceRaw > 0 ? regPriceRaw : null;

            const deliveryRaw = String(getRowValue(vRow, 'Hình thức giao', 'deliveryType') || '').toLowerCase();
            const deliveryType = deliveryRaw.includes('thủ công') || deliveryRaw === 'manual'
              ? DeliveryType.Manual
              : DeliveryType.Auto;

            const stockRaw = String(getRowValue(vRow, 'Tồn kho', 'stockStatus') || '').toLowerCase();
            const stockStatus = stockRaw.includes('hết') || stockRaw === 'out_of_stock'
              ? StockStatus.OutOfStock
              : StockStatus.InStock;

            let variant = await manager.findOne(ProductVariant, {
              where: { sku },
            });
            if (!variant) {
              variant = await manager.findOne(ProductVariant, {
                where: { productId: product.id, name: variantName },
              });
            }

            if (!variant) {
              variant = manager.create(ProductVariant, {
                productId: product.id,
                sku,
                name: variantName,
                accountType: variantName,
                duration,
                price,
                regularPrice,
                deliveryType,
                stockStatus,
                isEnabled: true,
                sortOrder: vIdx,
              });
            } else {
              variant.name = variantName;
              variant.accountType = variantName;
              if (duration !== null) variant.duration = duration;
              variant.price = price;
              variant.regularPrice = regularPrice;
              variant.deliveryType = deliveryType;
              variant.stockStatus = stockStatus;
            }

            await manager.save(variant);
          }
        });
      } catch (err) {
        errors.push(`Sản phẩm "${slugKey}": ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
      }
    }

    return {
      totalRows: rawRows.length,
      successCount: createdCount + updatedCount,
      createdCount,
      updatedCount,
      errors,
    };
  }

  // =========================================================================
  // DANH MỤC: EXPORT, TEMPLATE & IMPORT
  // =========================================================================

  async exportCategories(res: Response) {
    const items = await this.categories.find({
      relations: { parent: true },
      order: {
        parentId: 'ASC',
        sortOrder: 'ASC',
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh_Muc', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, CATEGORY_EXPORT_COLUMNS);

    for (const c of items) {
      const row = worksheet.addRow({
        id: c.id,
        name: c.name,
        slug: c.slug,
        path: c.path,
        parent: c.parent?.name ?? '',
        icon: c.icon ?? '',
        sortOrder: c.sortOrder ?? 0,
        isVisible: c.isVisible ? 'Có' : 'Không',
        description: c.description ?? '',
      });
      styleDataRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="danh-sach-danh-muc.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async templateCategories(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Danh_Muc_Mau', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, CATEGORY_TEMPLATE_COLUMNS);

    const sampleRows = [
      {
        name: 'Ứng dụng & Phần mềm',
        slug: 'ung-dung-phan-mem',
        parent: '',
        icon: 'Cpu',
        sortOrder: 1,
        isVisible: 'Có',
        description: 'Các ứng dụng và công cụ phần mềm làm việc',
      },
      {
        name: 'Công cụ AI',
        slug: 'cong-cu-ai',
        parent: 'Ứng dụng & Phần mềm',
        icon: 'Bot',
        sortOrder: 1,
        isVisible: 'Có',
        description: 'Tài khoản ChatGPT, Midjourney, Claude, Gemini',
      },
      {
        name: 'Giải trí & Phim ảnh',
        slug: 'giai-tri-phim-anh',
        parent: '',
        icon: 'Film',
        sortOrder: 2,
        isVisible: 'Có',
        description: 'Netflix, Spotify, Youtube Premium',
      },
    ];

    for (const data of sampleRows) {
      const row = worksheet.addRow(data);
      styleDataRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mau-nhap-danh-muc.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async importCategories(buffer: Buffer): Promise<ImportResult> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new BadRequestException('File Excel không có sheet nào.');
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (!rawRows.length) {
      throw new BadRequestException('File Excel không có dữ liệu hàng nào.');
    }

    const errors: string[] = [];
    let createdCount = 0;
    let updatedCount = 0;

    // Pass 1: Upsert categories without parent
    const rowParentMap = new Map<string, string>(); // slug -> parent name/slug

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const name = String(getRowValue(row, 'Tên danh mục *', 'Tên danh mục', 'name') || '').trim();
      const slugInput = String(getRowValue(row, 'Đường dẫn (Slug)', 'slug') || '').trim();
      const slug = slugInput || (name ? slugify(name) : '');
      const parentRaw = String(getRowValue(row, 'Danh mục cha', 'parent') || '').trim();
      const icon = String(getRowValue(row, 'Icon (Lucide)', 'icon') || '').trim() || null;
      const sortOrder = Number(getRowValue(row, 'Thứ tự', 'sortOrder') || 0) || 0;
      const visibleRaw = String(getRowValue(row, 'Hiển thị', 'isVisible') || 'có').toLowerCase();
      const isVisible = visibleRaw === 'có' || visibleRaw === '1' || visibleRaw === 'true' || visibleRaw === 'yes';
      const description = String(getRowValue(row, 'Mô tả', 'description') || '').trim() || null;

      if (!name) {
        errors.push(`Dòng ${index + 2}: Thiếu tên danh mục (*).`);
        continue;
      }

      if (parentRaw) {
        rowParentMap.set(slug, parentRaw);
      }

      try {
        let cat = await this.categories.findOne({
          where: [{ slug }, { name }],
        });

        if (!cat) {
          cat = this.categories.create({
            name,
            slug,
            path: slug,
            icon,
            sortOrder,
            isVisible,
            description,
          });
          createdCount++;
        } else {
          cat.name = name;
          if (icon !== null) cat.icon = icon;
          cat.sortOrder = sortOrder;
          cat.isVisible = isVisible;
          if (description !== null) cat.description = description;
          updatedCount++;
        }

        await this.categories.save(cat);
      } catch (err) {
        errors.push(`Danh mục "${name}": ${err instanceof Error ? err.message : 'Lỗi không xác định'}`);
      }
    }

    // Pass 2: Resolve parentId and update path
    for (const [slug, parentStr] of rowParentMap.entries()) {
      try {
        const cat = await this.categories.findOneBy({ slug });
        if (!cat) continue;

        const parent = await this.categories.findOne({
          where: [{ slug: slugify(parentStr) }, { name: parentStr }],
        });

        if (parent && parent.id !== cat.id) {
          cat.parentId = parent.id;
          cat.path = `${parent.path ? `${parent.path}/` : ''}${cat.slug}`;
          await this.categories.save(cat);
        }
      } catch {
        // Bỏ qua lỗi liên kết danh mục cha ở pass 2 nếu không tìm thấy
      }
    }

    return {
      totalRows: rawRows.length,
      successCount: createdCount + updatedCount,
      createdCount,
      updatedCount,
      errors,
    };
  }
}
