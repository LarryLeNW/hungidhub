import { Body, Controller, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator.js';
import { CassoWebhookService, type CassoWebhookBody } from './casso-webhook.service.js';

@ApiTags('webhooks')
@Controller()
export class CassoWebhookController {
  constructor(private readonly casso: CassoWebhookService) {}

  @Public()
  @Post(['webhooks/casso', 'integrations/casso/webhook'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive and reconcile Casso bank transactions' })
  receive(
    @Body() body: CassoWebhookBody,
    @Headers('x-casso-signature') signature?: string,
    @Headers('secure-token') secureToken?: string,
    @Headers('x-casso-token') cassoToken?: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const token = secureToken ?? cassoToken ?? authHeader?.replace(/^Bearer\s+/i, '');
    return this.casso.handle(body, { signature, secureToken: token });
  }
}
