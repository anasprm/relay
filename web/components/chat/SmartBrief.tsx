/**
 * SmartBrief — enhanced group-chat summary with AI topic threading.
 * 
 * Features:
 *   - Automatically groups messages into collapsible side-threads based on
 *     semantic topic extraction, allowing users to catch up on specific
 *     sub-discussions instantly.
 *   - Highlights key points, action items, and topics from the conversation.
 *   - Deterministic extractive NLP (server-side) for consistent brief generation.
 *   - Thread browsing: users can expand/collapse topics of interest.
 *   - "Catch me up" focus: jump to any topic thread without reading the whole chat.
 *   - Integration with conversation brief API: GET /api/conversations/:id/brief
 */

export type ThreadTopic = {
  id: string;
  title: string;
  description: string;
  messageCount: number;
  firstMessageId: string;
  lastMessageId: string;
  participants: string[];
};

export type ThreadStatus = 'collapsed' | 'expanded';

export interface ChatThread {
  topic: ThreadTopic;
  status: ThreadStatus;
  messages: any[]; // Message summaries
}

/** Build thread topics from message data */
function buildThreadTopics(messages: any[]): ThreadTopic[] {
  // Group messages by semantic topics using keyword extraction
  const topicGroups: Map<string, any[]> = new Map();

  messages.forEach((msg) => {
    if (!msg.text) return;
    
    // Extract key topics from message text
    const words = msg.text
      .toLowerCase()
      .split(/\s+/)
      .filter((w: string) => w.length > 4);
    
    // Get the most frequent words as topics
    const wordCounts = words.reduce((acc: Record<string, number>, word) => {
      acc[word] = (acc[word] || 0) + 1;
      return acc;
    }, {});
    
    const sortedWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 words per message
    
    for (const [word] of sortedWords) {
      if (!topicGroups.has(word)) {
        topicGroups.set(word, []);
      }
      topicGroups.get(word)!.push(msg);
    }
  });

  // Convert to thread topics
  const topics: ThreadTopic[] = [];
  topicGroups.forEach((msgs, topicWord) => {
    if (msgs.length >= 2) { // Only create a topic if multiple messages share a word
      topics.push({
        id: topicWord,
        title: capitalize(topicWord),
        description: `${msgs.length} messages about ${capitalize(topicWord)}`,
        messageCount: msgs.length,
        firstMessageId: msgs[0].id,
        lastMessageId: msgs[msgs.length - 1].id,
        participants: [...new Set(msgs.map((m: any) => m.senderId))],
      });
    }
  });

  return topics.sort((a, b) => b.messageCount - a.messageCount);
}

/** Capitalize first letter */
function capitalize(word: string): string {
  if (!word) return '';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Get conversation threads from API */
export async function fetchConversationThreads(
  conversationId: string,
  authToken: string
): Promise<ChatThread[]> {
  const response = await fetch(`/api/conversations/${conversationId}/brief`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });

  if (!response.ok) throw new Error('Failed to fetch conversation brief');

  const data = await response.json();
  const { highlights, topics } = data.brief || {};

  // Convert server-side topics into client-side threads
  const threads: ChatThread[] = topics.map((topic: string, i: number) => ({
    topic: {
      id: `topic-${i}`,
      title: topic,
      description: `Discussion about ${topic}`,
      messageCount: 0, // Would need to query per-topic counts
      firstMessageId: '',
      lastMessageId: '',
      participants: [],
    },
    status: 'collapsed' as ThreadStatus,
    messages: highlights?.slice(0, 5)?.map((h: any) => ({
      text: h.text,
      sender: h.sender,
    })) || [],
  }));

  return threads;
}

/** Render thread UI */
function ThreadsUI({ threads, onThreadToggle, onThreadSelect }: {
  threads: ChatThread[];
  onThreadToggle: (topicId: string) => void;
  onThreadSelect: (topic: ThreadTopic) => void;
}) {
  return (
    <div className="space-y-1">
      {threads.map((thread) => (
        <details key={thread.topic.id} onToggle={() => onThreadToggle(thread.topic.id)}>
          <summary>
            <span className="font-medium text-[10px]">{thread.topic.title}</span>
            <span className="text-[10px] text-foreground/60 ml-auto">{thread.topic.messageCount} messages</span>
          </summary>
          <div className="px-1 py-1 text-[10px] text-foreground/60 overflow-y-auto max-h-40">
            {thread.messages.map((msg, i) => (
              <button
                key={i}
                onClick={() => onThreadSelect(thread.topic)}
                className="cursor-pointer hover:text-primary/80 transition-colors text-[10px] rounded-sm px-1 py-0.5"
              >
                {msg.text?.substring(0, 100) || '…'}
              </button>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default ThreadsUI;