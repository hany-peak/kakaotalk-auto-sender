function App() {
  return (
    <div className="flex min-h-screen">
      <aside className="w-[220px] bg-surface border-r border-border p-6">
        <h1 className="text-xl font-extrabold text-white">
          <span className="text-accent">Jeeves</span>
        </h1>
        <p className="text-xs text-muted mt-1">CodeTax Macro</p>
      </aside>
      <main className="flex-1 p-8">
        <h2 className="text-lg font-bold">Setup Complete</h2>
      </main>
    </div>
  );
}

export default App;
