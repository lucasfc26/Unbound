import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { FriendsService } from './friends.service';
import { SendFriendRequestDto } from './dto/send-friend-request.dto';
import { SendFriendRequestByCodeDto } from './dto/send-friend-request-by-code.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}

  @Post('friends/requests')
  sendRequest(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendFriendRequestDto,
  ) {
    return this.friends.sendRequest(user.id, dto);
  }

  @Post('friends/requests/by-code')
  sendRequestByCode(
    @CurrentUser() user: RequestUser,
    @Body() dto: SendFriendRequestByCodeDto,
  ) {
    return this.friends.sendRequestByCode(user.id, dto);
  }

  @Get('friends/requests')
  listRequests(@CurrentUser() user: RequestUser) {
    return this.friends.listRequests(user.id);
  }

  @Post('friends/requests/:id/accept')
  accept(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.friends.accept(user.id, id);
  }

  @Post('friends/requests/:id/reject')
  @HttpCode(204)
  reject(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.friends.reject(user.id, id);
  }

  @Delete('friends/requests/:id')
  @HttpCode(204)
  cancel(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.friends.cancel(user.id, id);
  }

  @Get('friends')
  listFriends(@CurrentUser() user: RequestUser) {
    return this.friends.listFriends(user.id);
  }

  @Delete('friends/:userId')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('userId') userId: string) {
    return this.friends.remove(user.id, userId);
  }
}
