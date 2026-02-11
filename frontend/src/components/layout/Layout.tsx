import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuthStore } from '@/stores/authStore';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const aiSettings = useAuthStore((s) => s.aiSettings);
  const needsAiKey = aiSettings && !aiSettings.hasAnthropicKey && !aiSettings.hasOpenaiKey;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="pl-64">
        {needsAiKey && (
          <div className="bg-amber-50 border-b border-amber-200 px-8 py-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              Set up an AI provider to use AI-powered features like OCR, image description, and analysis.{' '}
              <Link to="/settings" className="font-medium underline hover:text-amber-900">
                Configure AI Providers
              </Link>
            </p>
          </div>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
