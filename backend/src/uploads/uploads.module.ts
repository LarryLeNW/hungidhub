import {
  BadRequestException,
  Controller,
  Module,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { diskStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Role } from '../common/enums/role.enum.js';

/** Root folder for uploaded media (served by `main.ts` under `/uploads/`). */
export function uploadRoot() {
  return resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const imageStorage = diskStorage({
  // Resolved per request so `.env` (loaded after this module is imported) is honoured.
  destination: (_req, _file, cb) => {
    const dir = resolve(uploadRoot(), 'images');
    mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = IMAGE_EXTENSIONS[file.mimetype] ?? '.bin';
    cb(null, `${Date.now().toString(36)}-${randomBytes(6).toString('hex')}${ext}`);
  },
});

@Controller('admin/uploads')
@Roles(Role.Admin)
export class UploadsController {
  /**
   * Multipart upload (`file` field) → a same-origin URL.
   *
   * Do not bake the API container's hostname into persisted content. In production
   * that hostname is commonly `localhost:4000` (or a private Docker hostname),
   * which is not reachable from a visitor's browser. `/uploads/...` is served by
   * this app and routed by the public reverse proxy alongside `/api`.
   */
  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage,
      limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
      fileFilter: (_req, file, cb) => {
        if (IMAGE_EXTENSIONS[file.mimetype]) cb(null, true);
        else cb(new BadRequestException('Chỉ nhận ảnh JPG, PNG, WEBP, GIF hoặc AVIF.'), false);
      },
    }),
  )
  uploadImage(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Chưa chọn file ảnh.');
    const path = `/uploads/images/${file.filename}`;
    return {
      url: path,
      path,
      size: file.size,
      mimeType: file.mimetype,
      originalName: file.originalname,
    };
  }
}

@Module({ controllers: [UploadsController] })
export class UploadsModule {}
