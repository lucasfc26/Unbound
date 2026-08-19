import { Injectable, NotFoundException } from '@nestjs/common';
import type { Channel, ChannelCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MembershipService } from '../common/membership.service';
import { Permission } from '../common/permissions';
import { RealtimeEmitterService } from '../realtime/realtime-emitter.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { CreateChannelDto } from './dto/create-channel.dto';
import type { UpdateChannelDto } from './dto/update-channel.dto';
import type { ReorderChannelsDto } from './dto/reorder-channels.dto';
import type { ReorderCategoriesDto } from './dto/reorder-categories.dto';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly membership: MembershipService,
    private readonly emitter: RealtimeEmitterService,
  ) {}

  async listCategories(
    serverId: string,
    userId: string,
  ): Promise<ChannelCategory[]> {
    await this.membership.getMembership(serverId, userId);
    return this.prisma.channelCategory.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });
  }

  async createCategory(
    serverId: string,
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<ChannelCategory> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    const position = await this.prisma.channelCategory.count({
      where: { serverId },
    });
    const category = await this.prisma.channelCategory.create({
      data: { serverId, name: dto.name, position },
    });
    this.emitter.emit('category:create', category);
    return category;
  }

  async updateCategory(
    serverId: string,
    userId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<ChannelCategory> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.assertCategoryBelongsToServer(serverId, categoryId);
    const category = await this.prisma.channelCategory.update({
      where: { id: categoryId },
      data: { name: dto.name },
    });
    this.emitter.emit('category:update', category);
    return category;
  }

  async deleteCategory(
    serverId: string,
    userId: string,
    categoryId: string,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.assertCategoryBelongsToServer(serverId, categoryId);
    await this.prisma.channelCategory.delete({ where: { id: categoryId } });
    this.emitter.emit('category:delete', { id: categoryId, serverId });
  }

  async reorderCategories(
    serverId: string,
    userId: string,
    dto: ReorderCategoriesDto,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.prisma.$transaction(
      dto.orderedIds.map((id, position) =>
        this.prisma.channelCategory.updateMany({
          where: { id, serverId },
          data: { position },
        }),
      ),
    );
    const categories = await this.prisma.channelCategory.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });
    this.emitter.emit('category:reorder', { serverId, categories });
  }

  async listChannels(serverId: string, userId: string): Promise<Channel[]> {
    await this.membership.getMembership(serverId, userId);
    return this.prisma.channel.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });
  }

  async createChannel(
    serverId: string,
    userId: string,
    dto: CreateChannelDto,
  ): Promise<Channel> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    if (dto.categoryId)
      await this.assertCategoryBelongsToServer(serverId, dto.categoryId);

    const position = await this.prisma.channel.count({
      where: { serverId, categoryId: dto.categoryId ?? null },
    });
    const channel = await this.prisma.channel.create({
      data: {
        serverId,
        categoryId: dto.categoryId ?? null,
        name: dto.name,
        type: dto.type,
        topic: dto.topic,
        position,
      },
    });
    this.emitter.emit('channel:create', channel);
    return channel;
  }

  async updateChannel(
    serverId: string,
    userId: string,
    channelId: string,
    dto: UpdateChannelDto,
  ): Promise<Channel> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.assertChannelBelongsToServer(serverId, channelId);
    if (dto.categoryId)
      await this.assertCategoryBelongsToServer(serverId, dto.categoryId);

    const channel = await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: dto.name,
        topic: dto.topic,
        categoryId: dto.categoryId === undefined ? undefined : dto.categoryId,
      },
    });
    this.emitter.emit('channel:update', channel);
    return channel;
  }

  async deleteChannel(
    serverId: string,
    userId: string,
    channelId: string,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.assertChannelBelongsToServer(serverId, channelId);
    await this.prisma.channel.delete({ where: { id: channelId } });
    this.emitter.emit('channel:delete', { id: channelId, serverId });
  }

  async reorderChannels(
    serverId: string,
    userId: string,
    dto: ReorderChannelsDto,
  ): Promise<void> {
    await this.membership.assertPermission(
      serverId,
      userId,
      Permission.MANAGE_CHANNELS,
    );
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.channel.updateMany({
          where: { id: item.id, serverId },
          data: {
            position: item.position,
            categoryId: item.categoryId ?? null,
          },
        }),
      ),
    );
    const channels = await this.prisma.channel.findMany({
      where: { serverId },
      orderBy: { position: 'asc' },
    });
    this.emitter.emit('channel:reorder', { serverId, channels });
  }

  private async assertCategoryBelongsToServer(
    serverId: string,
    categoryId: string,
  ): Promise<void> {
    const category = await this.prisma.channelCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category || category.serverId !== serverId) {
      throw new NotFoundException('Categoria não encontrada');
    }
  }

  private async assertChannelBelongsToServer(
    serverId: string,
    channelId: string,
  ): Promise<void> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel || channel.serverId !== serverId) {
      throw new NotFoundException('Canal não encontrado');
    }
  }
}
