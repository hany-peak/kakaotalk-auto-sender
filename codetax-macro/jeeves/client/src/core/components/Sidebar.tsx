import { NavLink } from 'react-router-dom';
import type { MacroPagePlugin } from '../../plugins/types';

interface SidebarProps {
  plugins: MacroPagePlugin[];
}

export function Sidebar({ plugins }: SidebarProps) {
  return (
    <aside className="w-[220px] bg-surface border-r border-border flex flex-col shrink-0 py-6">
      <div className="px-5 pb-6 border-b border-border mb-4">
        <h1 className="text-[22px] font-extrabold tracking-tight text-white">
          <span className="text-accent">J</span>eeves
        </h1>
        <p className="text-[11px] text-muted mt-[3px]">CodeTax Macro</p>
      </div>

      <nav className="px-3 mb-2">
        <div className="text-[10px] uppercase tracking-widest text-muted px-2 mb-1.5">홈</div>
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all ${
              isActive
                ? 'bg-accent/15 text-accent font-semibold'
                : 'text-muted hover:bg-surface2 hover:text-text'
            }`
          }
        >
          <span className="text-base w-5 text-center">🏠</span>
          대시보드
        </NavLink>
      </nav>

      <NavSection label="매크로" plugins={plugins.filter((p) => p.category !== 'send')} />
      <NavSection label="전송" plugins={plugins.filter((p) => p.category === 'send')} />
    </aside>
  );
}

function NavSection({ label, plugins }: { label: string; plugins: MacroPagePlugin[] }) {
  if (plugins.length === 0) return null;
  return (
    <nav className="px-3 mb-2">
      <div className="text-[10px] uppercase tracking-widest text-muted px-2 mb-1.5">{label}</div>
      {plugins.map((p) => (
        <NavLink
          key={p.id}
          to={p.status === 'ready' ? `/${p.id}` : '#'}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13.5px] transition-all ${
              p.status === 'coming-soon'
                ? 'opacity-40 cursor-default text-muted'
                : isActive
                  ? 'bg-accent/15 text-accent font-semibold'
                  : 'text-muted hover:bg-surface2 hover:text-text'
            }`
          }
          onClick={(e) => p.status === 'coming-soon' && e.preventDefault()}
        >
          <span className="text-base w-5 text-center">{p.icon}</span>
          {p.name}
          {p.badge && (
            <span className="ml-auto bg-accent text-white text-[10px] px-1.5 py-px rounded-full">
              {p.badge}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
