import { useNavigate } from 'react-router-dom';
import type { MacroPagePlugin } from '../../plugins/types';

interface DashboardProps {
  plugins: MacroPagePlugin[];
}

type Category = NonNullable<MacroPagePlugin['category']> | 'other';

const CATEGORY_LABELS: Record<Category, string> = {
  macro: '🛠 매크로',
  send: '📨 발송',
  scheduled: '⏰ 스케줄 자동화',
  other: '기타',
};

const CATEGORY_ORDER: Category[] = ['macro', 'send', 'scheduled', 'other'];

export function Dashboard({ plugins }: DashboardProps) {
  const navigate = useNavigate();

  const grouped = new Map<Category, MacroPagePlugin[]>();
  for (const p of plugins) {
    const cat = (p.category ?? 'other') as Category;
    const arr = grouped.get(cat) ?? [];
    arr.push(p);
    grouped.set(cat, arr);
  }

  const sections = CATEGORY_ORDER.filter((c) => grouped.has(c)).map((c) => ({
    category: c,
    plugins: grouped.get(c)!,
  }));

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-lg font-bold">👋 안녕하세요, Jeeves입니다</h2>
        <p className="text-sm text-muted mt-1">
          코드택스 세무회계 반복 업무를 자동화합니다. 필요한 매크로를 선택하세요.
        </p>
      </div>

      {sections.map(({ category, plugins: catPlugins }) => (
        <section key={category} className="mb-8">
          <h3 className="text-sm font-bold text-muted mb-3">{CATEGORY_LABELS[category]}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catPlugins.map((p) => (
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
                  {p.status === 'ready' ? '사용 가능' : '준비 중'}
                </div>
                <div className="text-3xl mb-3">{p.icon}</div>
                <h3 className="font-bold text-sm mb-1">{p.name}</h3>
                <p className="text-xs text-muted">{p.description}</p>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
