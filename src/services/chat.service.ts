import type { Chat, ChatMember } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/http';
import { assertUserExists } from './user.service';

type ChatWithMembers = Chat & { members: ChatMember[] };

const withMembers = { include: { members: true } } as const;

export function toChatResponse(chat: ChatWithMembers) {
  return {
    chatId: chat.id,
    isGroup: chat.isGroup,
    name: chat.name,
    memberIds: chat.members.map((m) => m.userId),
    createdAt: chat.createdAt,
  };
}

export async function createOrGetDirectChat(
  userAId: string,
  userBId: string,
): Promise<ChatWithMembers> {
  if (userAId === userBId) {
    throw new AppError(400, 'Cannot create a chat with the same user twice');
  }
  await Promise.all([assertUserExists(userAId), assertUserExists(userBId)]);

  const existing = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      AND: [
        { members: { some: { userId: userAId } } },
        { members: { some: { userId: userBId } } },
      ],
    },
    ...withMembers,
  });
  if (existing) return existing;

  return prisma.chat.create({
    data: {
      isGroup: false,
      members: { create: [{ userId: userAId }, { userId: userBId }] },
    },
    ...withMembers,
  });
}

export async function createGroupChat(
  name: string,
  memberIds: string[],
): Promise<ChatWithMembers> {
  const unique = [...new Set(memberIds)];
  if (unique.length < 2) {
    throw new AppError(400, 'A group chat needs at least 2 distinct members');
  }
  await Promise.all(unique.map(assertUserExists));

  return prisma.chat.create({
    data: {
      isGroup: true,
      name,
      members: { create: unique.map((userId) => ({ userId })) },
    },
    ...withMembers,
  });
}

export async function getChatOrThrow(chatId: string): Promise<ChatWithMembers> {
  const chat = await prisma.chat.findUnique({ where: { id: chatId }, ...withMembers });
  if (!chat) throw new AppError(404, `Chat ${chatId} not found`);
  return chat;
}

export async function assertMember(chatId: string, userId: string): Promise<void> {
  const member = await prisma.chatMember.findUnique({
    where: { chatId_userId: { chatId, userId } },
  });
  if (!member) throw new AppError(403, `User ${userId} is not a member of chat ${chatId}`);
}

export async function listUserChats(userId: string): Promise<ChatWithMembers[]> {
  await assertUserExists(userId);
  return prisma.chat.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: 'desc' },
    ...withMembers,
  });
}

export async function addMember(chatId: string, userId: string): Promise<ChatWithMembers> {
  const chat = await getChatOrThrow(chatId);
  if (!chat.isGroup) throw new AppError(400, 'Cannot add members to a 1:1 chat');
  await assertUserExists(userId);

  await prisma.chatMember.upsert({
    where: { chatId_userId: { chatId, userId } },
    update: {},
    create: { chatId, userId },
  });
  return getChatOrThrow(chatId);
}

export async function removeMember(chatId: string, userId: string): Promise<ChatWithMembers> {
  const chat = await getChatOrThrow(chatId);
  if (!chat.isGroup) throw new AppError(400, 'Cannot remove members from a 1:1 chat');

  await prisma.chatMember.deleteMany({ where: { chatId, userId } });
  return getChatOrThrow(chatId);
}
