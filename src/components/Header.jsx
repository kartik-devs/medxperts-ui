import React from 'react';
import { Link } from 'react-router-dom';
import MedXprtsLogo from './MedXprtsLogo';

const Header = () => {
  return (
    <nav className="border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link to="/">
              <MedXprtsLogo size="default" />
            </Link>
            <div className="hidden md:flex gap-6 text-sm font-medium text-gray-600">
              <Link to="/services" className="hover:text-blue-600">Services</Link>
              <Link to="/how-it-works" className="hover:text-blue-600">How It Works</Link>
              <Link to="/about" className="hover:text-blue-600">About</Link>
              <Link to="/contact" className="hover:text-blue-600">Contact</Link>
            </div>
          </div>
          <div className="flex gap-3">
            <Link 
              to="/login" 
              className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50"
            >
              Login
            </Link>
            <Link 
              to="/register" 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Header;
