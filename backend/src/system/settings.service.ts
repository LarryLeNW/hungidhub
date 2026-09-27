import {
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity.js';
import { SettingGroup } from './system.enums.js';

type SettingSeed = {
  key: string;
  group: SettingGroup;
  value: unknown;
  description: string;
  isPublic: boolean;
};

/**
 * Defaults created on first boot. Values mirror what the storefront used to hard-code
 * (hotline, Zalo, home sections…) so admins can change them without a deploy.
 */
export const DEFAULT_SETTINGS: SettingSeed[] = [
  {
    key: 'store.name',
    group: SettingGroup.Store,
    value: 'IDHUB',
    description: 'Tên cửa hàng',
    isPublic: true,
  },
  {
    key: 'store.tagline',
    group: SettingGroup.Store,
    value: 'Tài khoản số giá tốt',
    description: 'Khẩu hiệu dưới logo',
    isPublic: true,
  },
  {
    key: 'store.hotline',
    group: SettingGroup.Store,
    value: '0931 729 316',
    description: 'Số điện thoại hỗ trợ',
    isPublic: true,
  },
  {
    key: 'store.zalo',
    group: SettingGroup.Store,
    value: 'https://zalo.me/0931729316',
    description: 'Link Zalo hỗ trợ',
    isPublic: true,
  },
  {
    key: 'store.email',
    group: SettingGroup.Store,
    value: 'larrylenw@gmail.com',
    description: 'Email liên hệ',
    isPublic: true,
  },
  {
    key: 'store.domain',
    group: SettingGroup.Store,
    value: 'https://khotaikhoan.net',
    description: 'Tên miền cửa hàng',
    isPublic: true,
  },
  {
    key: 'payment.bank',
    group: SettingGroup.Payment,
    value: {
      bankName: 'VCB',
      accountNumber: '1017164832',
      accountName: 'AIHUB',
    },
    description:
      'Tài khoản nhận chuyển khoản (hiện cho khách sau khi đặt hàng)',
    isPublic: false,
  },
  {
    key: 'payment.methods',
    group: SettingGroup.Payment,
    value: ['bank_transfer', 'zalo', 'wallet'],
    description: 'Phương thức thanh toán được bật',
    isPublic: true,
  },
  {
    key: 'payment.min_deposit',
    group: SettingGroup.Payment,
    value: 10000,
    description: 'Số tiền nạp tối thiểu (VND)',
    isPublic: true,
  },
  {
    key: 'home.sections',
    group: SettingGroup.Store,
    value: [
      {
        key: 'flash_sale',
        title: 'Flash Sale',
        subtitle: '',
        slugs: [
          'tai-khoan-pia-vpn',
          'tai-khoan-chatgpt-plus',
          'tai-khoan-hma-vpn-premium',
          'canva-pro',
          'tai-khoan-claude-ai',
          'tai-khoan-google-ai-pro',
          'tai-khoan-cursor-ai',
          'tai-khoan-perlexity-ai-pro',
          'tai-khoan-capcut-pro',
          'tai-khoan-kling-ai',
        ],
      },
      {
        key: 'ai',
        title: 'Công cụ AI 2026',
        subtitle: 'Tệp những công cụ AI mới và được mua nhiều nhất',
        slugs: [
          'tai-khoan-chatgpt-plus',
          'tai-khoan-kling-ai',
          'tai-khoan-google-ai-pro',
          'tai-khoan-cursor-ai',
          'tai-khoan-perlexity-ai-pro',
          'tai-khoan-gamma',
          'tai-khoan-google-ai-ultra',
          'tai-khoan-invideo-ai',
          'nang-cap-tai-khoan-heygen-ai',
          'nang-cap-tai-khoan-krea-ai',
        ],
      },
      {
        key: 'top',
        title: 'Top tài khoản bán chạy',
        subtitle: 'Các gói tài khoản premium được khách hàng chọn nhiều',
        tone: 'green',
        slugs: [
          'tai-khoan-chatgpt-plus',
          'tai-khoan-pia-vpn',
          'canva-pro',
          'tai-khoan-capcut-pro',
          'tai-khoan-kling-ai',
          'tai-khoan-nordvpn',
          'tai-khoan-surfshark-vpn',
          'tai-khoan-hma-vpn-premium',
          'tai-khoan-adobe-creative-cloud',
          'tai-khoan-vpn-premium',
        ],
      },
      {
        key: 'study',
        title: 'Tài Khoản Học Tập',
        subtitle: 'Ngoại Ngữ · Học Online · Dạy Sách · Tài Khoản Khác',
        slugs: [
          'tai-khoan-grammarly-premium',
          'tai-khoan-chegg-study-pack',
          'nang-cap-elsa-speak-premium-1-nam',
          'nang-cap-coursera-plus',
          'nang-cap-tai-khoan-quizlet-plus',
          'tai-khoa-hoc-udemy',
        ],
      },
    ],
    description: 'Các khối sản phẩm trên trang chủ (tiêu đề + danh sách slug)',
    isPublic: true,
  },
  {
    key: 'notifications.channels',
    group: SettingGroup.Notifications,
    value: { email: true, browser: true, lowStockThreshold: 10 },
    description: 'Kênh cảnh báo vận hành',
    isPublic: false,
  },
  {
    key: 'integrations.webhook_url',
    group: SettingGroup.Integrations,
    value: '',
    description: 'Webhook nhận sự kiện đơn hàng',
    isPublic: false,
  },
  {
    key: 'roles.admin_emails',
    group: SettingGroup.Roles,
    value: ['admin@aihub.local'],
    description: 'Danh sách email được cấp quyền quản trị khi đăng ký',
    isPublic: false,
  },
];

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting) private readonly settings: Repository<Setting>,
  ) {}

  async onApplicationBootstrap() {
    const existing = new Set(
      (await this.settings.find({ select: { key: true } })).map((s) => s.key),
    );
    const missing = DEFAULT_SETTINGS.filter((seed) => !existing.has(seed.key));
    if (missing.length) {
      await this.settings.save(
        missing.map((seed) =>
          this.settings.create({ ...seed, updatedById: null }),
        ),
      );
      this.logger.log(`Seeded ${missing.length} default settings`);
    }

    // Defaults only create missing rows, so migrate the previous brand value for
    // existing installations without overwriting a name customized by an admin.
    const storeName = await this.settings.findOneBy({ key: 'store.name' });
    if (storeName?.value === 'AIHUB') {
      storeName.value = 'IDHUB';
      storeName.updatedById = null;
      await this.settings.save(storeName);
      this.logger.log('Migrated store.name from AIHUB to IDHUB');
    }
  }

  findAll() {
    return this.settings.find({
      order: { group: 'ASC', key: 'ASC' },
      relations: { updatedBy: true },
    });
  }

  /** Key/value map of public settings for the storefront. */
  async publicMap() {
    const rows = await this.settings.findBy({ isPublic: true });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    const row = await this.settings.findOneBy({ key });
    return row?.value as T | undefined;
  }

  async upsert(
    key: string,
    input: {
      value: unknown;
      description?: string;
      isPublic?: boolean;
      group?: SettingGroup;
    },
    updatedById: number,
  ) {
    const existing = await this.settings.findOneBy({ key });
    if (!existing && !input.group) {
      throw new NotFoundException(
        `Cấu hình "${key}" chưa tồn tại; truyền "group" để tạo mới`,
      );
    }
    const setting =
      existing ??
      this.settings.create({
        key,
        group: input.group!,
        isPublic: false,
        description: null,
      });
    setting.value = input.value;
    if (input.description !== undefined)
      setting.description = input.description;
    if (input.isPublic !== undefined) setting.isPublic = input.isPublic;
    if (input.group !== undefined) setting.group = input.group;
    setting.updatedById = updatedById;
    return this.settings.save(setting);
  }
}
