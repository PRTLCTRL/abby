'use client';

import { useState } from 'react';
import { Activity, MessageSquare, TrendingUp } from 'lucide-react';
import ConversationList from '@/components/ConversationList';
import ActivityLogs from '@/components/ActivityLogs';
import StatsOverview from '@/components/StatsOverview';
import PhoneNumberInput from '@/components/PhoneNumberInput';

export default function Dashboard() {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'overview' | 'conversations' | 'activity'>('overview');

  if (!phoneNumber) {
    return <PhoneNumberInput onSubmit={setPhoneNumber} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Abby Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                AI Baby Coach - Tracking for {phoneNumber}
              </p>
            </div>
            <button
              onClick={() => setPhoneNumber('')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Change Number
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('overview')}
                className={`${
                  activeTab === 'overview'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <TrendingUp className="w-4 h-4" />
                Overview
              </button>
              <button
                onClick={() => setActiveTab('conversations')}
                className={`${
                  activeTab === 'conversations'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <MessageSquare className="w-4 h-4" />
                Conversations
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`${
                  activeTab === 'activity'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Activity className="w-4 h-4" />
                Activity Logs
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && <StatsOverview phoneNumber={phoneNumber} />}
        {activeTab === 'conversations' && <ConversationList phoneNumber={phoneNumber} />}
        {activeTab === 'activity' && <ActivityLogs phoneNumber={phoneNumber} />}
      </main>
    </div>
  );
}
