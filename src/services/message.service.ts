import { Timestamp } from 'firebase-admin/firestore';
import { db } from '../config/firestore';
import { AppError } from '../utils/http';

// Firestore layout:
//   chats/{chatId}/messages/{messageId}   -> message documents (+ readBy map)
//   chats/{chatId}/lastSeen/{userId}      -> last-seen pointer per user

interface MessageDoc {
  senderId: string;
  text: string;
  createdAt: Timestamp;
  editedAt: Timestamp | null;
  deleted: boolean;
  readBy: Record<string, Timestamp>; // userId -> time the message was read
}

const messagesCol = (chatId: string) => db.collection('chats').doc(chatId).collection('messages');
const lastSeenCol = (chatId: string) => db.collection('chats').doc(chatId).collection('lastSeen');

// Convert a stored document into a JSON-friendly response (Timestamps -> ISO strings).
function toMessageResponse(id: string, data: MessageDoc) {
  return {
    id,
    senderId: data.senderId,
    text: data.deleted ? null : data.text,
    deleted: data.deleted,
    createdAt: data.createdAt.toDate().toISOString(),
    editedAt: data.editedAt ? data.editedAt.toDate().toISOString() : null,
    readBy: Object.fromEntries(
      Object.entries(data.readBy ?? {}).map(([uid, ts]) => [uid, ts.toDate().toISOString()]),
    ),
  };
}

async function getMessageRef(chatId: string, messageId: string) {
  const ref = messagesCol(chatId).doc(messageId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError(404, `Message ${messageId} not found`);
  return { ref, data: snap.data() as MessageDoc };
}

export async function sendMessage(chatId: string, senderId: string, text: string) {
  const data: MessageDoc = {
    senderId,
    text,
    createdAt: Timestamp.now(),
    editedAt: null,
    deleted: false,
    readBy: {},
  };
  const ref = await messagesCol(chatId).add(data);
  return toMessageResponse(ref.id, data);
}

// Returns the most recent `limit` messages, ordered oldest -> newest.
export async function getMessages(chatId: string, limit: number) {
  const snap = await messagesCol(chatId).orderBy('createdAt', 'desc').limit(limit).get();
  return snap.docs
    .map((doc) => toMessageResponse(doc.id, doc.data() as MessageDoc))
    .reverse();
}

// Records that `userId` has read the message (read receipt).
export async function markMessageRead(chatId: string, messageId: string, userId: string) {
  const { ref } = await getMessageRef(chatId, messageId);
  await ref.update({ [`readBy.${userId}`]: Timestamp.now() });
}

// Stores the last message a user has seen in this chat.
export async function updateLastSeen(chatId: string, userId: string, messageId: string) {
  await getMessageRef(chatId, messageId); // ensure the message exists
  const data = { messageId, updatedAt: Timestamp.now() };
  await lastSeenCol(chatId).doc(userId).set(data);
  return { userId, messageId, updatedAt: data.updatedAt.toDate().toISOString() };
}

// Bonus: edit a message (sender only).
export async function editMessage(
  chatId: string,
  messageId: string,
  senderId: string,
  text: string,
) {
  const { ref, data } = await getMessageRef(chatId, messageId);
  if (data.senderId !== senderId) throw new AppError(403, 'Only the sender can edit this message');
  if (data.deleted) throw new AppError(400, 'Cannot edit a deleted message');

  const editedAt = Timestamp.now();
  await ref.update({ text, editedAt });
  return toMessageResponse(ref.id, { ...data, text, editedAt });
}

// Bonus: soft-delete a message (sender only).
export async function deleteMessage(chatId: string, messageId: string, senderId: string) {
  const { ref, data } = await getMessageRef(chatId, messageId);
  if (data.senderId !== senderId) {
    throw new AppError(403, 'Only the sender can delete this message');
  }
  await ref.update({ deleted: true });
}
