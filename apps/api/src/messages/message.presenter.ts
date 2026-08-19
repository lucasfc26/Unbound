import type { Message, User } from '@prisma/client';
import {
  toPublicUser,
  maskInvisible,
  type PublicUser,
} from '../users/user.presenter';

export interface PublicLinkPreview {
  url: string;
  siteName: string;
  title: string;
  description?: string;
  domain: string;
}

export interface PublicMessage {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  editedAt: Date | null;
  linkPreview: PublicLinkPreview | null;
  author: PublicUser;
}

export function toPublicMessage(
  message: Message & { author: User },
): PublicMessage {
  return {
    id: message.id,
    channelId: message.channelId,
    authorId: message.authorId,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    linkPreview:
      (message.linkPreview as unknown as PublicLinkPreview | null) ?? null,
    author: maskInvisible(toPublicUser(message.author)),
  };
}
