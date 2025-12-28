'use client';

import { useEffect, useState } from 'react';
import { MessageSquare, Clock, Tag, Heart, Frown, Meh } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  phoneNumber: string;
}

interface Conversation {
  timestamp: string;
  duration_seconds: number;
  summary: string;
  key_topics: string[];
  concerns_raised: string[];
  action_items: string[];
  sentiment: string;
}

const getSentimentIcon = (sentiment: string) => {
  switch (sentiment) {
    case 'positive':
      return <Heart className="w-4 h-4 text-green-600" />;
    case 'worried':
      return <Frown className="w-4 h-4 text-red-600" />;
    default:
      return <Meh className="w-4 h-4 text-gray-600" />;
  }
};

const getSentimentColor = (sentiment: string) => {
  switch (sentiment) {
    case 'positive':
      return 'bg-green-100 text-green-800';
    case 'worried':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default function ConversationList({ phoneNumber }: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(
          `${apiUrl}/api/conversations/${encodeURIComponent(phoneNumber)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch conversations');
        }

        const data = await response.json();
        setConversations(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversations');
      } finally {
        setLoading(false);
      }
    };

    fetchConversations();
  }, [phoneNumber]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading conversations: {error}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <MessageSquare className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No conversations yet</h3>
        <p className="text-gray-600">
          Your conversations with Abby will appear here.
        </p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {conversations.map((convo, index) => (
        <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {formatDistanceToNow(new Date(convo.timestamp), { addSuffix: true })}
                </p>
                <p className="text-sm text-gray-500">
                  {new Date(convo.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${getSentimentColor(convo.sentiment)}`}>
                <div className="flex items-center gap-1">
                  {getSentimentIcon(convo.sentiment)}
                  <span>{convo.sentiment}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(convo.duration_seconds)}</span>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-4">
            <p className="text-gray-700">{convo.summary}</p>
          </div>

          {/* Topics */}
          {convo.key_topics && convo.key_topics.length > 0 && (
            <div className="mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-gray-400" />
                {convo.key_topics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
                  >
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Concerns */}
          {convo.concerns_raised && convo.concerns_raised.length > 0 && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm font-medium text-amber-900 mb-2">Concerns Raised:</p>
              <ul className="space-y-1">
                {convo.concerns_raised.map((concern, idx) => (
                  <li key={idx} className="text-sm text-amber-800 flex items-start gap-2">
                    <span className="text-amber-600">•</span>
                    <span>{concern}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Items */}
          {convo.action_items && convo.action_items.length > 0 && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900 mb-2">Action Items:</p>
              <ul className="space-y-1">
                {convo.action_items.map((item, idx) => (
                  <li key={idx} className="text-sm text-green-800 flex items-start gap-2">
                    <span className="text-green-600">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
