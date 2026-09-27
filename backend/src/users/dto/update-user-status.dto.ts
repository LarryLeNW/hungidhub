import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  @ApiProperty({
    description: 'false = locked; the user can no longer log in or refresh',
  })
  @IsBoolean()
  isActive: boolean;
}
