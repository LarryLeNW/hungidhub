import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import {
  DEFAULT_WP_CONTENT_PATH,
  WpImportModule,
} from '../import/wp-import.module.js';
import { WpImportService } from '../import/wp-import.service.js';

/**
 * Usage: node dist/cli/import-wp.js [path/to/wp-content.json]
 * Defaults to the Next.js app's generated file (../src/data/generated/wp-content.json).
 */
const filePath = process.argv[2] ?? DEFAULT_WP_CONTENT_PATH;
const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn', 'log'],
});

try {
  const summary = await app
    .select(WpImportModule)
    .get(WpImportService)
    .importFromFile(filePath);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await app.close();
}
