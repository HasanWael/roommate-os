import { Loader2 } from 'lucide-react';

export default function LoadingScreen({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text-primary">
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-xl font-medium text-text-secondary">{message}</p>
    </div>
  );
}
