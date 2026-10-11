import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { CassoWebhookService, type CassoWebhookBody } from './casso-webhook.service.js';

@ApiTags('webhooks')
@Controller('webhooks/casso')
export class CassoWebhookController {
  constructor(private readonly casso: CassoWebhookService) {}

  @Public()
  @Post()
  @ApiOperation({ summary: 'Receive and reconcile Casso bank transactions' })
  receive(
    @Body() body: CassoWebhookBody,
    @Headers('x-casso-signature') signature?: string,
    @Headers('secure-token') secureToken?: string,
  ) {
    return this.casso.handle(body, { signature, secureToken });
  }
}
