import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { DmsService } from './dms.service';
import { OpenDmDto } from './dto/open-dm.dto';

@UseGuards(JwtAuthGuard)
@Controller('dms')
export class DmsController {
  constructor(private readonly dms: DmsService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.dms.list(user.id);
  }

  @Post()
  open(@CurrentUser() user: RequestUser, @Body() dto: OpenDmDto) {
    return this.dms.openWith(user.id, dto.userId);
  }

  @Post(':channelId/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('channelId') channelId: string,
  ) {
    return this.dms.markRead(user.id, channelId);
  }
}
