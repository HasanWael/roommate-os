import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text-primary p-8 text-center">
      <h1 className="text-6xl font-black mb-4">404</h1>
      <p className="text-2xl text-text-secondary mb-8">Page not found</p>
      <Link to="/" className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary-dark transition-colors">
        Go Home
      </Link>
    </div>
  );
}
