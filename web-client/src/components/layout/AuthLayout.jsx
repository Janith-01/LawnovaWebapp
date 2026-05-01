import React from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2a1d52] via-[#16132b] to-[#0a0a14] relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Cpath%20d%3D%22M36%2034v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6%2034v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6%204V0H4v4H0v2h4v4h2V6h4V4H6z%22%2F%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E')] opacity-50" />
        
        <div className="relative z-10 flex flex-col justify-center items-center w-full px-12">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center opacity-90 shadow-[0_0_15px_rgba(79,70,229,0.5)]">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <span className="text-4xl font-bold text-white tracking-tight">Lawnova</span>
          </div>
          
          <h1 className="text-3xl font-semibold text-white text-center mb-4">
            Master Legal Skills Through Practice
          </h1>
          <p className="text-slate-400 text-center text-lg max-w-md">
            Join thousands of law students and professionals enhancing their legal expertise with AI-powered mock trials.
          </p>

          <div className="mt-12 grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-white">10K+</div>
              <div className="text-slate-400 text-sm">Active Users</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">500+</div>
              <div className="text-slate-400 text-sm">Case Studies</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">95%</div>
              <div className="text-slate-400 text-sm">Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md relative">
          
          <div className="absolute -top-16 left-0 hidden lg:block">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                <Scale className="w-4 h-4 text-white" />
              </div>
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight">Lawnova</span>
            </div>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-12">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="text-2xl font-bold text-slate-900">Lawnova</span>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-2">{title}</h2>
            {subtitle && (
              <p className="text-slate-500 font-medium text-sm mt-3">{subtitle}</p>
            )}
          </div>
          
          <div className="w-full">
            {children}
          </div>

        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
