import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import type { MacroPagePlugin } from '../../plugins/types';

interface LayoutProps {
  plugins: MacroPagePlugin[];
  children: ReactNode;
}

export function Layout({ plugins, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar plugins={plugins} />
      <main className="flex-1 p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
