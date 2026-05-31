import { Message, User } from '../../db/models/index.js';
import { forbidden, notFound } from '../../lib/errors.js';
import { messageEvents } from './realtime-bridge.js';

export async function sendMessage(channelId: string, authorId: string, content: string) {
  // 1. Parse @username mentions and resolve to ObjectIds
  const mentionPattern = /@(\w+)/g;
  const matches = [...content.matchAll(mentionPattern)];
  const usernames = matches.map((m) => m[1]) as string[];
  
  let mentions: any[] = [];
  if (usernames.length > 0) {
    const mentionedUsers = await User.find({ username: { $in: usernames } }).select('_id');
    mentions = mentionedUsers.map((u) => u._id.toString());
  }

  // 2. Create message
  const msg = new Message({
    channelId,
    authorId,
    content,
    mentions,
  });
  await msg.save();

  // 3. Populate author data
  await msg.populate('authorId', 'id username displayName avatarUrl');

  // 4. Emit event
  messageEvents.emit('message:created', { channelId, message: msg });

  return msg;
}

export async function getMessages(channelId: string, options: { before?: string; limit: number }) {
  const query: any = { channelId, deletedAt: null };
  if (options.before) {
    // cursor-based pagination
    const beforeDate = new Date(options.before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit + 1)
    .populate('authorId', 'id username displayName avatarUrl')
    .exec();

  const hasMore = messages.length > options.limit;
  if (hasMore) {
    messages.pop(); // Remove the extra item we fetched to check hasMore
  }

  // Frontend expects messages in chronological order or we just return them descending and let frontend reverse
  // The plan says "sorted createdAt DESC" so we return descending and reverse infinite scroll handles it.
  return {
    messages,
    hasMore,
  };
}

export async function updateMessage(messageId: string, userId: string, content: string) {
  const msg = await Message.findById(messageId);
  if (!msg) {
    throw notFound('message');
  }

  if (msg.authorId.toString() !== userId) {
    throw forbidden();
  }

  msg.content = content;
  msg.editedAt = new Date();

  // Re-parse mentions
  const mentionPattern = /@(\w+)/g;
  const matches = [...content.matchAll(mentionPattern)];
  const usernames = matches.map((m) => m[1]) as string[];
  
  let mentions: any[] = [];
  if (usernames.length > 0) {
    const mentionedUsers = await User.find({ username: { $in: usernames } }).select('_id');
    mentions = mentionedUsers.map((u) => u._id.toString());
  }
  msg.mentions = mentions;

  await msg.save();
  await msg.populate('authorId', 'id username displayName avatarUrl');

  messageEvents.emit('message:updated', { channelId: msg.channelId, message: msg });

  return msg;
}

export async function deleteMessage(messageId: string, userId: string) {
  const msg = await Message.findById(messageId);
  if (!msg || msg.deletedAt) {
    return; // Already deleted or not found
  }

  if (msg.authorId.toString() !== userId) {
    throw forbidden();
  }

  msg.deletedAt = new Date();
  await msg.save();

  messageEvents.emit('message:deleted', { channelId: msg.channelId, messageId: msg.id });
}

export async function addReaction(messageId: string, userId: string, emoji: string) {
  const msg = await Message.findById(messageId);
  if (!msg) {
    throw notFound('message');
  }

  // Find existing reaction subdoc for this emoji
  const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
  if (existingReaction) {
    // Add user to the array if not already there
    if (!existingReaction.userIds.includes(userId as any)) {
      existingReaction.userIds.push(userId as any);
      await msg.save();
      messageEvents.emit('message:reaction_added', { channelId: msg.channelId, messageId: msg.id, emoji, userId });
    }
  } else {
    // Create new reaction subdoc
    msg.reactions.push({ emoji, userIds: [userId as any] });
    await msg.save();
    messageEvents.emit('message:reaction_added', { channelId: msg.channelId, messageId: msg.id, emoji, userId });
  }
}

export async function removeReaction(messageId: string, userId: string, emoji: string) {
  const msg = await Message.findById(messageId);
  if (!msg) {
    throw notFound('message');
  }

  const existingReaction = msg.reactions.find((r) => r.emoji === emoji);
  if (existingReaction) {
    const index = existingReaction.userIds.indexOf(userId as any);
    if (index > -1) {
      existingReaction.userIds.splice(index, 1);
      
      // If no users left for this emoji, remove the reaction subdoc entirely
      if (existingReaction.userIds.length === 0) {
        msg.reactions = msg.reactions.filter((r) => r.emoji !== emoji) as any;
      }
      
      await msg.save();
      messageEvents.emit('message:reaction_removed', { channelId: msg.channelId, messageId: msg.id, emoji, userId });
    }
  }
}
