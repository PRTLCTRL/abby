'use client';

import { useEffect, useState } from 'react';
import { Activity, Milk, Moon, Baby } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLogsProps {
  phoneNumber: string;
}

interface Log {
  timestamp: string;
  phone: string;
  category: string;
  update: string;
}

const getCategoryIcon = (category: string) => {
  switch (category.toLowerCase()) {
    case 'feeding':
    case 'feed':
      return <Milk className="w-5 h-5 text-blue-600" />;
    case 'sleep':
    case 'nap':
      return <Moon className="w-5 h-5 text-purple-600" />;
    case 'diaper':
      return <Baby className="w-5 h-5 text-green-600" />;
    default:
      return <Activity className="w-5 h-5 text-gray-600" />;
  }
};

const getCategoryColor = (category: string) => {
  switch (category.toLowerCase()) {
    case 'feeding':
    case 'feed':
      return 'bg-blue-100';
    case 'sleep':
    case 'nap':
      return 'bg-purple-100';
    case 'diaper':
      return 'bg-green-100';
    default:
      return 'bg-gray-100';
  }
};

export default function ActivityLogs({ phoneNumber }: ActivityLogsProps) {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
        const response = await fetch(`${apiUrl}/api/logs/${encodeURIComponent(phoneNumber)}`);

        if (!response.ok) {
          throw new Error('Failed to fetch activity logs');
        }

        const data = await response.json();
        setLogs(data.data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load activity logs');
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
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
        Error loading activity logs: {error}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
        <Activity className="w-12 h-12 text-blue-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No activity logs yet</h3>
        <p className="text-gray-600">
          Activity logs from your conversations with Abby will appear here.
        </p>
      </div>
    );
  }

  // Get unique categories
  const categories = ['all', ...new Set(logs.map(log => log.category))];

  // Filter logs by category
  const filteredLogs = filterCategory === 'all'
    ? logs
    : logs.filter(log => log.category === filterCategory);

  return (
    <div className="space-y-6">
      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setFilterCategory(category)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filterCategory === category
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {/* Activity Timeline */}
      <div className="space-y-4">
        {filteredLogs.map((log, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className={`p-2 rounded-lg flex-shrink-0 ${getCategoryColor(log.category)}`}>
                {getCategoryIcon(log.category)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-blue-600 uppercase">
                    {log.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-gray-900">{log.update}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(log.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredLogs.length === 0 && filterCategory !== 'all' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No {filterCategory} activities found
          </h3>
          <p className="text-gray-600">Try selecting a different category.</p>
        </div>
      )}
    </div>
  );
}
