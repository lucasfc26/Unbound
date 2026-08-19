import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { ChannelsService } from './channels.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
import { ReorderChannelsDto } from './dto/reorder-channels.dto';

@UseGuards(JwtAuthGuard)
@Controller('servers/:serverId')
export class ChannelsController {
  constructor(private readonly channels: ChannelsService) {}

  @Get('categories')
  listCategories(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
  ) {
    return this.channels.listCategories(serverId, user.id);
  }

  @Post('categories')
  createCategory(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.channels.createCategory(serverId, user.id, dto);
  }

  @Patch('categories/reorder')
  reorderCategories(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Body() dto: ReorderCategoriesDto,
  ) {
    return this.channels.reorderCategories(serverId, user.id, dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.channels.updateCategory(serverId, user.id, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(204)
  deleteCategory(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.channels.deleteCategory(serverId, user.id, categoryId);
  }

  @Get('channels')
  listChannels(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
  ) {
    return this.channels.listChannels(serverId, user.id);
  }

  @Post('channels')
  createChannel(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Body() dto: CreateChannelDto,
  ) {
    return this.channels.createChannel(serverId, user.id, dto);
  }

  @Patch('channels/reorder')
  reorderChannels(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Body() dto: ReorderChannelsDto,
  ) {
    return this.channels.reorderChannels(serverId, user.id, dto);
  }

  @Patch('channels/:channelId')
  updateChannel(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateChannelDto,
  ) {
    return this.channels.updateChannel(serverId, user.id, channelId, dto);
  }

  @Delete('channels/:channelId')
  @HttpCode(204)
  deleteChannel(
    @CurrentUser() user: RequestUser,
    @Param('serverId') serverId: string,
    @Param('channelId') channelId: string,
  ) {
    return this.channels.deleteChannel(serverId, user.id, channelId);
  }
}
