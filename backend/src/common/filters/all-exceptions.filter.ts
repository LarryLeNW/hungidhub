import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { EntityNotFoundError, QueryFailedError } from 'typeorm';

type MysqlDriverError = { errno?: number; sqlMessage?: string };

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error',
};

/**
 * Chuẩn hóa mọi lỗi trả về client: lỗi DB (trùng dữ liệu, khóa ngoại…) thành
 * HTTP status đúng + message tiếng Việt, lỗi bất ngờ thành 500 chung chung —
 * chi tiết SQL/stack chỉ ghi log server, không bao giờ lộ ra ngoài.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    // Lỗi HTTP chủ động (NotFound/Conflict/BadRequest…) đi qua nguyên trạng.
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(
          typeof body === 'string' ? { statusCode: status, message: body } : body,
        );
      return;
    }

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';

    if (exception instanceof EntityNotFoundError) {
      status = HttpStatus.NOT_FOUND;
      message = 'Không tìm thấy dữ liệu yêu cầu.';
    } else if (exception instanceof QueryFailedError) {
      const driver = (exception as QueryFailedError & {
        driverError?: MysqlDriverError;
      }).driverError;
      switch (driver?.errno) {
        case 1062: {
          // "Duplicate entry 'x' for key 'table.IDX_…'"
          const value = /Duplicate entry '(.*)' for key/.exec(
            driver.sqlMessage ?? '',
          )?.[1];
          status = HttpStatus.CONFLICT;
          message = value
            ? `Giá trị "${value}" đã tồn tại, vui lòng dùng giá trị khác.`
            : 'Dữ liệu bị trùng, vui lòng kiểm tra lại.';
          break;
        }
        case 1451:
          status = HttpStatus.CONFLICT;
          message = 'Không thể xóa vì dữ liệu đang được sử dụng ở nơi khác.';
          break;
        case 1452:
          status = HttpStatus.BAD_REQUEST;
          message = 'Dữ liệu tham chiếu không tồn tại.';
          break;
        case 1406:
          status = HttpStatus.BAD_REQUEST;
          message = 'Dữ liệu quá dài so với giới hạn cho phép.';
          break;
        default:
          this.logger.error(exception.message, exception.stack);
      }
    } else {
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(error.message, error.stack);
    }

    response
      .status(status)
      .json({ statusCode: status, message, error: REASONS[status] });
  }
}
