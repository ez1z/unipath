'use client';

import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/constants';
import type { EntityType } from '@/lib/data/discussion-types';

export type ClientViewer = {
  authed: boolean;
  nickname: string | null;
  promptDismissed: boolean;
  maskedEmail: string | null;
};

export type DiscussionContextValue = {
  locale: Locale;
  entityType: EntityType;
  entityId: string;
  viewer: ClientViewer;
  isSuperuser: boolean;
  openLink: (url: string) => void;
};

const DiscussionContext = createContext<DiscussionContextValue | null>(null);

export const DiscussionProvider = DiscussionContext.Provider;

export function useDiscussion(): DiscussionContextValue {
  const ctx = useContext(DiscussionContext);
  if (!ctx) throw new Error('useDiscussion must be used within DiscussionProvider');
  return ctx;
}
