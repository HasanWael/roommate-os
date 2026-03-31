import { Link } from 'react-router-dom';

export default function NoApartment() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-text-primary p-8 text-center">
      <h1 className="text-4xl font-black mb-4">No Apartment Selected</h1>
      <p className="text-xl text-text-secondary mb-8">Please select or create an apartment to continue.</p>
      <Link to="/auth" className="bg-primary text-white font-bold py-3 px-8 rounded-xl hover:bg-primary-dark transition-colors">
        Go to Setup
      </Link>
    </div>
  );
}
