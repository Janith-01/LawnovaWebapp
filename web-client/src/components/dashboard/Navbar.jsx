import React from 'react';
import { Menu, Bell, Search, User } from 'lucide-react';

const Navbar = ({ onMenuClick, user }) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 shadow-sm lg:px-8">
      <div className="flex items-center">
        <button
          type="button"
          className="p-2 text-gray-500 rounded-md lg:hidden hover:bg-gray-100 focus:outline-none"
          onClick={onMenuClick}
        >
          <Menu className="w-6 h-6" />
        </button>

        <div className="hidden ml-4 lg:block">
          <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <Search className="w-4 h-4 text-gray-400" />
            </span>
            <input
              type="text"
              className="block w-full py-2 pl-10 pr-3 text-sm border border-gray-300 rounded-md bg-gray-50 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search cases, laws, or sessions..."
            />
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-500 rounded-full hover:bg-gray-100 focus:outline-none">
          <Bell className="w-6 h-6" />
          <span className="absolute top-0 right-0 block w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3 border-l border-gray-200 pl-4">
          <div className="hidden text-right lg:block">
            <p className="text-sm font-medium text-gray-900">{user?.fullName || 'Student'}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role || 'Student'}</p>
          </div>
          <div className="flex items-center justify-center w-10 h-10 bg-indigo-100 rounded-full">
            {user?.profile?.avatarUrl ? (
              <img 
                src={user.profile.avatarUrl} 
                alt="Avatar" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-indigo-600" />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
