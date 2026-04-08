import type { ComponentType } from 'react';

export interface MacroPagePlugin {
  id: string;
  name: string;
  icon: string;
  status: 'ready' | 'coming-soon';
  description: string;
  Page: ComponentType;
  badge?: string;
}
