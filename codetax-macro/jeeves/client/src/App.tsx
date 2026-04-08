import { Routes, Route } from 'react-router-dom';
import { Layout } from './core/components/Layout';
import { Dashboard } from './core/components/Dashboard';
import { plugins } from './plugins';

function App() {
  return (
    <Layout plugins={plugins}>
      <Routes>
        <Route path="/" element={<Dashboard plugins={plugins} />} />
        {plugins
          .filter((p) => p.status === 'ready')
          .map((p) => (
            <Route key={p.id} path={`/${p.id}`} element={<p.Page />} />
          ))}
      </Routes>
    </Layout>
  );
}

export default App;
