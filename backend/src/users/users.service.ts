import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum.js';
import { QueryUsersDto } from './dto/query-users.dto.js';
import { User } from './entities/user.entity.js';

export type CreateUserInput = {
  email: string;
  passwordHash: string;
  fullName: string;
  phone?: string | null;
  role?: Role;
};

export type PaginatedUsers = {
  items: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  async create(input: CreateUserInput) {
    const user = this.users.create({
      email: this.normalizeEmail(input.email),
      passwordHash: input.passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone ?? null,
      role: input.role ?? Role.Customer,
      isActive: true,
      refreshTokenHash: null,
      lastLoginAt: null,
    });
    const saved = await this.users.save(user);
    return this.findById(saved.id);
  }

  async existsByEmail(email: string) {
    return this.users.exists({ where: { email: this.normalizeEmail(email) } });
  }

  findById(id: number) {
    return this.users.findOneByOrFail({ id }).catch(() => {
      throw new NotFoundException(`Không tìm thấy người dùng #${id}`);
    });
  }

  findByEmail(email: string) {
    return this.users.findOneBy({ email: this.normalizeEmail(email) });
  }

  /** Includes `passwordHash` and `refreshTokenHash` (hidden columns) for auth checks. */
  findByEmailWithSecrets(email: string) {
    return this.users
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.email = :email', { email: this.normalizeEmail(email) })
      .getOne();
  }

  findByIdWithSecrets(id: number) {
    return this.users
      .createQueryBuilder('user')
      .addSelect(['user.passwordHash', 'user.refreshTokenHash'])
      .where('user.id = :id', { id })
      .getOne();
  }

  async findAll(query: QueryUsersDto): Promise<PaginatedUsers> {
    const qb = this.users
      .createQueryBuilder('user')
      .orderBy('user.createdAt', 'DESC');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        '(user.email LIKE :search OR user.fullName LIKE :search OR user.phone LIKE :search)',
        { search: `%${query.search.trim()}%` },
      );
    }

    // Admin "Khách hàng": order count + lifetime spend per user (paid orders only).
    qb.addSelect(
      `(SELECT COUNT(*) FROM orders o WHERE o.user_id = user.id AND o.status IN ('processing','completed'))`,
      'order_count',
    ).addSelect(
      `(SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.user_id = user.id AND o.status IN ('processing','completed'))`,
      'total_spent',
    );

    const total = await qb.getCount();
    const { entities, raw } = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getRawAndEntities<{ order_count: string; total_spent: string }>();
    const items = entities.map((user, index) =>
      Object.assign(user, {
        orderCount: Number(raw[index]?.order_count ?? 0),
        totalSpent: Number(raw[index]?.total_spent ?? 0),
      }),
    );

    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    };
  }

  countByRole(role: Role) {
    return this.users.countBy({ role });
  }

  async updateRefreshTokenHash(id: number, refreshTokenHash: string | null) {
    await this.users.update({ id }, { refreshTokenHash });
  }

  async updatePassword(id: number, passwordHash: string) {
    // Changing the password also invalidates every refresh token.
    await this.users.update({ id }, { passwordHash, refreshTokenHash: null });
  }

  async markLogin(id: number) {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  async updateRole(id: number, role: Role) {
    await this.findById(id);
    await this.users.update({ id }, { role });
    return this.findById(id);
  }

  async updateStatus(id: number, isActive: boolean) {
    await this.findById(id);
    // Locking a user also revokes their refresh token so sessions end at the next refresh.
    await this.users.update(
      { id },
      isActive ? { isActive } : { isActive, refreshTokenHash: null },
    );
    return this.findById(id);
  }
}
