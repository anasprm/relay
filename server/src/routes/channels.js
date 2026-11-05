/* ==========================================================================
   MODULE 3: "ANTI-ALGORITHM" CREATOR ECONOMY & BROADCAST CHANNELS
   100% Organic Reach Channels & Native Tip Jars / Micropayments
   ========================================================================== */

import { router } from '../index';
import { api } from '../../lib/api';
import { db } from '../../lib/db';
import type { Conversation, Message } from '../../lib/types';

// ==========================================================================
// 3A. 100% Organic Reach Chronological Broadcast Channels
// ==========================================================================

/** Broadcast channel metadata */
interface BroadcastChannel {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  subscriberCount: number;
  isNSFW: boolean;
  isVerified: boolean;
  welcomeMessage: string;
  createdAt: string;
  updatedAt: string;
}

/** Subscriber to a broadcast channel */
interface ChannelSubscriber {
  userId: string;
  joinedAt: string;
  displayName: string;
  isMuted: boolean;
}

/** Create a new broadcast channel */
router.post('/api/v1/channels', async (req, res, next) => {
  try {
    const {
      title,
      description,
      isNSFW = false,
      welcomeMessage = 'Welcome to my broadcast channel',
    } = req.body || {};

    const creatorId = (req as any).user?.id || 'system';

    const channel: BroadcastChannel = {
      id: `channel_${Date.now()}-${Math.random().toString(36).slice(2)}`,
      creatorId,
      title,
      description,
      subscriberCount: 0,
      isNSFW,
      isVerified: false, // Would be set via verification flow
      welcomeMessage,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await db.dbSet('broadcast_channels', channel.id, channel);

    res.status(201).json({
      success: true,
      channel,
    });
  } catch (error) {
    next(error);
  }
}

/** List all broadcast channels — CHRONOLOGICAL, no algorithmic sorting */
router.get('/api/v1/channels', async (req, res, next) => {
  try {
    const channels = await db.dbGetAll('broadcast_channels');
    // Sort by creation date — newest first, but chronological order
    const sorted = channels.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      channels: sorted,
      total: sorted.length,
    });
  } catch (error) {
    next(error);
  }
}

/** Get a specific broadcast channel with subscribers */
router.get('/api/v1/channels/:channelId', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const channel = await db.dbGet('broadcast_channels', channelId);
    const subscribers = await db.dbGetAll('channel_subscribers');

    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // Filter subscribers who are not muted
    const activeSubscribers = (subscribers || [])
      .filter((s: ChannelSubscriber) => !s.isMuted);

    res.json({
      success: true,
      channel,
      subscriberCount: activeSubscribers.length,
      subscribers: activeSubscribers,
    });
  } catch (error) {
    next(error);
  }
})

/** Subscribe to a broadcast channel */
router.post('/api/v1/channels/:channelId/subscribe', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { userId, displayName } = req.body || {};
    const subscriberId = `user_${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const subscriber: ChannelSubscriber = {
      userId,
      joinedAt: new Date().toISOString(),
      displayName,
      isMuted: false,
    };

    // In channel subscription store
    await db.dbSet(`channel_sub:${channelId}:${subscriberId}`, subscriber);

    // Increment channel subscriber count
    const channel = await db.dbGet('broadcast_channels', channelId);
    if (channel) {
      channel.subscriberCount = (channel.subscriberCount || 0) + 1;
      channel.updatedAt = new Date().toISOString();
      await db.dbPut('broadcast_channels', channel.id, channel);
    }

    res.json({
      success: true,
      subscriber,
      newSubscriberCount: channel.subscriberCount,
    });
  } catch (error) {
    next(error);
  }
}

/** Unsubscribe from a broadcast channel */
router.post('/api/v1/channels/:channelId/unsubscribe', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const { subscriberId } = req.body || {};

    // Remove subscription
    await db.dbDelete(`channel_sub:${channelId}:${subscriberId}`);

    // Decrement channel subscriber count
    const channel = await db.dbGet('broadcast_channels', channelId);
    if (channel) {
      channel.subscriberCount = Math.max(0, (channel.subscriberCount || 0) - 1);
      channel.updatedAt = new Date().toISOString();
      await db.dbPut('broadcast_channels', channel.id, channel);
    }

    res.json({
      success: true,
      unsubscribed: true,
      remainingSubscriberCount: channel?.subscriberCount || 0,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// 3B. Native Tip Jars / Micropayments Integration
// ==========================================================================

/** Tip request interface */
interface TipRequest {
  channelId: string;
  amount: number; // in cents (or satoshis, or fiat cents)
  message?: string;
  currency: 'USD' | 'SAT' | 'ETH' | 'USDC';
  tipperId: string;
  tipperDisplayName: string;
}

/** Process a tip to a broadcast channel */
router.post('/api/v1/channels/tip', async (req, res, next) => {
  try {
    const tip: TipRequest = req.body;

    if (!tip.channelId || !tip.amount || tip.amount <= 0) {
      return res.status(400).json({
        error: 'channelId and positive amount are required',
      });
    }

    if (!['USD', 'SAT', 'ETH', 'USDC'].includes(tip.currency)) {
      return res.status(400).json({
        error: 'Unsupported currency',
      });
    }

    const channel = await db.dbGet('broadcast_channels', tip.channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // In a production system, this would integrate with:
    // - Stripe for fiat (USD)
    // - Lightning Network for SAT
    // - Coinbase/Metamask for ETH/USDC
    // - Zero-commission treasury contract

    // For now, record the tip in the channel's stats
    channel.totalTips = (channel.totalTips || 0) + tip.amount;
    channel.totalTipsCount = (channel.totalTipsCount || 0) + 1;
    channel.updatedAt = new Date().toISOString();
    await db.dbPut('broadcast_channels', channel.id, channel);

    // Emit tip event for real-time display
    console.log('[Tip] Tip received:', {
      amount: tip.amount,
      currency: tip.currency,
      channelId: tip.channelId,
      tipper: tip.tipperDisplayName,
    });

    res.json({
      success: true,
      tip,
      channelTotalTips: channel.totalTips,
      channelTotalTipsCount: channel.totalTipsCount,
      message: 'Tip processed — 0% platform commission (creator receives 100%)',
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================================================
// 3C. Channel Post Creation (Organic Reach Messages)
// ==========================================================================

/** Create a post in a broadcast channel */
interface ChannelPost {
  id: string;
  channelId: string;
  authorId: string;
  authorDisplayName: string;
  content: string;
  kind: 'text' | 'image' | 'video' | 'file';
  attachment?: {
    url: string;
    name: string;
    size: number;
    mime: string;
  };
  reactions: Record<string, number>; // emoji -> count
  createdAt: string;
  viewedBy: string[]; // viewers list for organic reach tracking
}

/** Create a post in a broadcast channel */
router.post('/api/v1/channels/:channelId/posts', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const {
      content,
      kind,
      authorId,
      authorDisplayName,
      attachment,
    } = req.body || {};

    if (!content && !attachment) {
      return res.status(400).json({
        error: 'content or attachment is required',
      });
    }

    const post: ChannelPost = {
      id: `post_${Date.now()}-${Math.random().toString(36).slice(2)}`,
      channelId,
      authorId,
      authorDisplayName: authorDisplayName || 'Unknown',
      content: content || '',
      kind: kind || 'text',
      attachment,
      reactions: {},
      createdAt: new Date().toISOString(),
      viewedBy: [],
    };

    await db.dbSet(`channel_post:${channelId}:${post.id}`, post);

    // Increment channel's post count
    const channel = await db.dbGet('broadcast_channels', channelId);
    if (channel) {
      channel.updatedAt = new Date().toISOString();
      await db.dbPut('broadcast_channels', channel.id, channel);
    }

    res.status(201).json({
      success: true,
      post,
    });
  } catch (error) {
    next(error);
  }
});

/** List posts in a broadcast channel (chronological) */
router.get('/api/v1/channels/:channelId/posts', async (req, res, next) => {
  try {
    const { channelId } = req.params;
    const postKeys = await db.dbGetAll(`channel_post:${channelId}:*`);

    const posts = await Promise.all(
      postKeys.map((key) => {
        const post = db.dbGet('channel_posts', key); // Would use proper db get
        return post || null;
      })
    );

    // Filter out nulls and sort by createdAt descending
    const validPosts = posts.filter((p: any) => p !== null);
    validPosts.sort(
      (a: any, b: any) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.json({
      success: true,
      posts: validPosts,
      total: validPosts.length,
    });
  } catch (error) {
    next(error);
  }
});

export { router as channelsRouter };