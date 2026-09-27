import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity.js';
import { NotificationSection, NotificationTone } from './system.enums.js';

export type NotifyInput = {
  title: string;
  body?: string;
  section?: NotificationSection;
  tone?: NotificationTone;
  linkUrl?: string;
  entityType?: string;
  entityId?: number;
};

/** Admin bell notifications. Broadcasts (recipient = null) are visible to every admin. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
  ) {}

  /** Fire-and-forget: a failed notification must never break the business action. */
  async notifyAdmins(input: NotifyInput) {
    try {
      await this.notifications.save(
        this.notifications.create({
          recipientId: null,
          title: input.title,
          body: input.body ?? null,
          section: input.section ?? null,
          tone: input.tone ?? NotificationTone.Blue,
          linkUrl: input.linkUrl ?? null,
          entityType: input.entityType ?? null,
          entityId: input.entityId ?? null,
          readAt: null,
        }),
      );
    } catch {
      // swallow – notifications are best effort
    }
  }

  async listForAdmin(limit = 20) {
    const [items, unreadCount] = await Promise.all([
      this.notifications.find({
        where: { recipientId: IsNull() },
        order: { id: 'DESC' },
        take: limit,
      }),
      this.notifications.countBy({ recipientId: IsNull(), readAt: IsNull() }),
    ]);
    return { items, unreadCount };
  }

  async markRead(id: number) {
    const notification = await this.notifications.findOneBy({ id });
    if (!notification) {
      throw new NotFoundException(`Không tìm thấy thông báo #${id}`);
    }
    if (!notification.readAt) {
      notification.readAt = new Date();
      await this.notifications.save(notification);
    }
    return notification;
  }

  async markAllRead() {
    await this.notifications.update(
      { recipientId: IsNull(), readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}
