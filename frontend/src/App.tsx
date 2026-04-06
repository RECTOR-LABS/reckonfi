import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 2,
    },
  },
});

function AppShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">
        ReckonFi
      </h1>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}
