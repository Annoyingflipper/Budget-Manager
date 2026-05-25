import AuthGate from './auth/AuthGate';

export default function App() {
  return (
    <AuthGate>
      <div className="p-8 text-2xl">Budget Manager — Authenticated</div>
    </AuthGate>
  );
}
