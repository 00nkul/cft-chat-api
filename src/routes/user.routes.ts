import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/http';
import * as chatService from '../services/chat.service';
import * as userService from '../services/user.service';

export const userRouter = Router();

//    POST /user  { name, email? }
userRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { name, email } = z
      .object({ name: z.string().min(1), email: z.string().email().optional() })
      .parse(req.body);
    const user = await userService.createUser(name, email);
    res.status(201).json(user);
  }),
);

//    GET /user
userRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json(await userService.listUsers());
  }),
);

// 6. List a user's chats
//    GET /user/:userId/chats
userRouter.get(
  '/:userId/chats',
  asyncHandler(async (req, res) => {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.params);
    const chats = await chatService.listUserChats(userId);
    res.json({ userId, chats: chats.map(chatService.toChatResponse) });
  }),
);
