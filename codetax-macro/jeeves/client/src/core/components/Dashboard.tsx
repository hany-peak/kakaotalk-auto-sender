import { useNavigate } from 'react-router-dom';
import type { MacroPagePlugin } from '../../plugins/types';

interface DashboardProps {
  plugins: MacroPagePlugin[];
}

export function Dashboard({ plugins }: DashboardProps) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-lg font-bold">Hello, Jeeves here</h2>
        <p className="text-sm text-muted mt-1">
          Automate your tax accounting tasks. Choose a macro below.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plugins.map((p) => (
          <div
            key={p.id}
            onClick={() => p.status === 'ready' && navigate(`/${p.id}`)}
            className={`bg-surface border border-border rounded-xl p-6 transition-all ${
              p.status === 'ready'
                ? 'cursor-pointer hover:border-accent hover:shadow-lg hover:shadow-accent/10'
                : 'opacity-50 cursor-not-allowed'
            }`}
          >
            <div
              className={`inline-block text-[10px] px-2 py-0.5 rounded-full mb-3 ${
                p.status === 'ready'
                  ? 'bg-success/20 text-success'
                  : 'bg-muted/20 text-muted'
              }`}
            >
              {p.status === 'ready' ? 'Available' : 'Coming Soon'}
            </div>
            <div className="text-3xl mb-3">{p.icon}</div>
            <h3 className="font-bold text-sm mb-1">{p.name}</h3>
            <p className="text-xs text-muted">{p.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
