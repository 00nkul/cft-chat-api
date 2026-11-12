import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/http';
import * as chatService from '../services/chat.service';
import * as messageService from '../services/message.service';

export const chatRouter = Router();

const id = z.string().min(1);
const chatParams = z.object({ chatId: id });
const messageParams = z.object({ chatId: id, messageId: id });

// 1. Create or get a 1:1 chat
//    POST /chat/create  { userAId, userBId }
chatRouter.post(
  '/create',
  asyncHandler(async (req, res) => {
    const { userAId, userBId } = z.object({ userAId: id, userBId: id }).parse(req.body);
    const chat = await chatService.createOrGetDirectChat(userAId, userBId);
    res.status(201).json(chatService.toChatResponse(chat));
  }),
);

//    POST /chat/group/create  { name, memberIds: [] }
chatRouter.post(
  '/group/create',
  asyncHandler(async (req, res) => {
    const { name, memberIds } = z
      .object({ name: z.string().min(1), memberIds: z.array(id).min(2) })
      .parse(req.body);
    const chat = await chatService.createGroupChat(name, memberIds);
    res.status(201).json(chatService.toChatResponse(chat));
  }),
);

// 2. Send a message
//    POST /chat/:chatId/message/send  { senderId, text }
chatRouter.post(
  '/:chatId/message/send',
  asyncHandler(async (req, res) => {
    const { chatId } = chatParams.parse(req.params);
    const { senderId, text } = z.object({ senderId: id, text: z.string().min(1) }).parse(req.body);
    await chatService.assertMember(chatId, senderId);
    const message = await messageService.sendMessage(chatId, senderId, text);
    res.status(201).json(message);
  }),
);

// 3. Get messages
//    GET /chat/:chatId/messages?limit=50
chatRouter.get(
  '/:chatId/messages',
  asyncHandler(async (req, res) => {
    const { chatId } = chatParams.parse(req.params);
    const { limit } = z
      .object({ limit: z.coerce.number().int().positive().max(200).default(50) })
      .parse(req.query);
    await chatService.getChatOrThrow(chatId);
    const messages = await messageService.getMessages(chatId, limit);
    res.json({ chatId, messages });
  }),
);

// 4. Mark a message as read
//    POST /chat/:chatId/message/:messageId/read  { userId }
chatRouter.post(
  '/:chatId/message/:messageId/read',
  asyncHandler(async (req, res) => {
    const { chatId, messageId } = messageParams.parse(req.params);
    const { userId } = z.object({ userId: id }).parse(req.body);
    await chatService.assertMember(chatId, userId);
    await messageService.markMessageRead(chatId, messageId, userId);
    res.json({ success: true });
  }),
);

// 5. Update last seen message
//    POST /chat/:chatId/lastseen  { userId, messageId }
chatRouter.post(
  '/:chatId/lastseen',
  asyncHandler(async (req, res) => {
    const { chatId } = chatParams.parse(req.params);
    const { userId, messageId } = z.object({ userId: id, messageId: id }).parse(req.body);
    await chatService.assertMember(chatId, userId);
    const result = await messageService.updateLastSeen(chatId, userId, messageId);
    res.json(result);
  }),
);

//    PATCH /chat/:chatId/message/:messageId  { senderId, text }
chatRouter.patch(
  '/:chatId/message/:messageId',
  asyncHandler(async (req, res) => {
    const { chatId, messageId } = messageParams.parse(req.params);
    const { senderId, text } = z.object({ senderId: id, text: z.string().min(1) }).parse(req.body);
    await chatService.assertMember(chatId, senderId);
    const message = await messageService.editMessage(chatId, messageId, senderId, text);
    res.json(message);
  }),
);

//    DELETE /chat/:chatId/message/:messageId  { senderId }
chatRouter.delete(
  '/:chatId/message/:messageId',
  asyncHandler(async (req, res) => {
    const { chatId, messageId } = messageParams.parse(req.params);
    const { senderId } = z.object({ senderId: id }).parse(req.body);
    await chatService.assertMember(chatId, senderId);
    await messageService.deleteMessage(chatId, messageId, senderId);
    res.json({ success: true });
  }),
);

//    POST   /chat/:chatId/members         { userId }
//    DELETE /chat/:chatId/members/:userId
chatRouter.post(
  '/:chatId/members',
  asyncHandler(async (req, res) => {
    const { chatId } = chatParams.parse(req.params);
    const { userId } = z.object({ userId: id }).parse(req.body);
    const chat = await chatService.addMember(chatId, userId);
    res.json(chatService.toChatResponse(chat));
  }),
);

chatRouter.delete(
  '/:chatId/members/:userId',
  asyncHandler(async (req, res) => {
    const { chatId, userId } = z.object({ chatId: id, userId: id }).parse(req.params);
    const chat = await chatService.removeMember(chatId, userId);
    res.json(chatService.toChatResponse(chat));
  }),
);
