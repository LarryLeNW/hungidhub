import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Response } from 'express';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import bcrypt from 'bcrypt';
import { Role } from '../common/enums/role.enum.js';
import { User } from './entities/user.entity.js';

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

const CUSTOMER_EXPORT_COLUMNS: ColumnConfig[] = [
  { key: 'id', label: 'Mã KH', required: false, width: 10 },
  { key: 'fullName', label: 'Họ và tên', required: true, width: 28 },
  { key: 'email', label: 'Email', required: true, width: 32 },
  { key: 'phone', label: 'Số điện thoại', required: false, width: 18 },
  { key: 'role', label: 'Vai trò', required: false, width: 16 },
  { key: 'status', label: 'Trạng thái', required: false, width: 16 },
  { key: 'orderCount', label: 'Số đơn hàng', required: false, width: 14 },
  { key: 'totalSpent', label: 'Tổng chi tiêu (VNĐ)', required: false, width: 22 },
  { key: 'createdAt', label: 'Ngày đăng ký', required: false, width: 22 },
  { key: 'lastLoginAt', label: 'Đăng nhập gần nhất', required: false, width: 22 },
];

const CUSTOMER_TEMPLATE_COLUMNS: ColumnConfig[] = [
  { key: 'fullName', label: 'Họ và tên', required: true, width: 28 },
  { key: 'email', label: 'Email', required: true, width: 32 },
  { key: 'phone', label: 'Số điện thoại', required: false, width: 18 },
  { key: 'password', label: 'Mật khẩu', required: false, width: 20 },
  { key: 'role', label: 'Vai trò', required: false, width: 16 },
  { key: 'status', label: 'Trạng thái', required: false, width: 16 },
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
            font: { bold: true, color: { argb: 'FFDC2626' }, size: 11, name: 'Calibri' },
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
export class UsersExcelService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  async exportCustomers(res: Response) {
    const qb = this.users
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC')
      .addSelect(
        `(SELECT COUNT(*) FROM orders o WHERE o.user_id = user.id AND o.status IN ('processing','completed'))`,
        'order_count',
      )
      .addSelect(
        `(SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id = user.id AND o.status IN ('processing','completed'))`,
        'total_spent',
      );

    const { entities, raw } = await qb.getRawAndEntities<{
      order_count: string;
      total_spent: string;
    }>();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khach_Hang', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, CUSTOMER_EXPORT_COLUMNS);

    entities.forEach((user, idx) => {
      const orderCount = Number(raw[idx]?.order_count ?? 0);
      const totalSpent = Number(raw[idx]?.total_spent ?? 0);
      const roleLabel = user.role === Role.Admin ? 'Quản trị viên' : 'Khách hàng';
      const statusLabel = user.isActive ? 'Hoạt động' : 'Đang khóa';
      const createdAtStr = user.createdAt
        ? new Date(user.createdAt).toISOString().replace('T', ' ').slice(0, 19)
        : '';
      const lastLoginStr = user.lastLoginAt
        ? new Date(user.lastLoginAt).toISOString().replace('T', ' ').slice(0, 19)
        : '';

      const row = worksheet.addRow({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone ?? '',
        role: roleLabel,
        status: statusLabel,
        orderCount,
        totalSpent,
        createdAt: createdAtStr,
        lastLoginAt: lastLoginStr,
      });
      styleDataRow(row);
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="danh-sach-khach-hang.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async templateCustomers(res: Response) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Khach_Hang_Mau', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    applyHeaderRow(worksheet, CUSTOMER_TEMPLATE_COLUMNS);

    const sampleRows = [
      {
        fullName: 'Nguyễn Văn An',
        email: 'nguyenvanan@example.com',
        phone: '0912345678',
        password: '',
        role: 'Khách hàng',
        status: 'Hoạt động',
      },
      {
        fullName: 'Trần Thị Bình',
        email: 'tranthibinh@example.com',
        phone: '0987654321',
        password: '',
        role: 'Khách hàng',
        status: 'Hoạt động',
      },
      {
        fullName: 'Lê Hoàng Long',
        email: 'lehoanglong@example.com',
        phone: '0901234567',
        password: '',
        role: 'Khách hàng',
        status: 'Hoạt động',
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
      'attachment; filename="mau-nhap-khach-hang.xlsx"',
    );
    res.send(Buffer.from(buffer));
  }

  async importCustomers(buffer: Buffer): Promise<ImportResult> {
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

    for (let index = 0; index < rawRows.length; index++) {
      const row = rawRows[index];
      const fullName = String(
        getRowValue(row, 'Họ và tên *', 'Họ và tên', 'fullName', 'Tên khách hàng', 'Tên') || '',
      ).trim();
      const emailRaw = String(getRowValue(row, 'Email *', 'Email', 'email') || '').trim();
      const phone = String(
        getRowValue(row, 'Số điện thoại', 'phone', 'Điện thoại', 'SĐT') || '',
      ).trim() || null;
      const passwordInput = String(getRowValue(row, 'Mật khẩu', 'password') || '').trim();
      const roleRaw = String(getRowValue(row, 'Vai trò', 'role') || '').toLowerCase();
      const statusRaw = String(
        getRowValue(row, 'Trạng thái', 'status', 'isActive') || 'hoạt động',
      ).toLowerCase();

      if (!emailRaw) {
        errors.push(`Dòng ${index + 2}: Thiếu địa chỉ Email (*).`);
        continue;
      }

      if (!fullName) {
        errors.push(`Dòng ${index + 2}: Thiếu Họ và tên (*).`);
        continue;
      }

      const email = emailRaw.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        errors.push(`Dòng ${index + 2}: Email "${emailRaw}" không đúng định dạng.`);
        continue;
      }

      const role =
        roleRaw.includes('quản trị') || roleRaw === 'admin' ? Role.Admin : Role.Customer;
      const isActive = !(
        statusRaw.includes('khóa') ||
        statusRaw === 'inactive' ||
        statusRaw === 'false' ||
        statusRaw === '0'
      );

      try {
        let user = await this.users.findOneBy({ email });

        if (!user) {
          const rawPassword = passwordInput || 'Idhub@123456';
          const passwordHash = await bcrypt.hash(rawPassword, 12);

          user = this.users.create({
            email,
            fullName,
            phone,
            role,
            isActive,
            passwordHash,
            refreshTokenHash: null,
            lastLoginAt: null,
          });

          await this.users.save(user);
          createdCount++;
        } else {
          user.fullName = fullName;
          if (phone !== null) user.phone = phone;
          user.role = role;
          user.isActive = isActive;

          if (passwordInput) {
            user.passwordHash = await bcrypt.hash(passwordInput, 12);
            user.refreshTokenHash = null;
          }

          await this.users.save(user);
          updatedCount++;
        }
      } catch (err) {
        errors.push(
          `Khách hàng "${email}": ${err instanceof Error ? err.message : 'Lỗi không xác định'}`,
        );
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
