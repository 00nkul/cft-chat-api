import { prisma } from '../config/prisma';
import { AppError } from '../utils/http';

export function createUser(name: string, email?: string) {
  return prisma.user.create({ data: { name, email } });
}

export function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
}

export async function assertUserExists(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, `User ${userId} not found`);
  return user;
}
