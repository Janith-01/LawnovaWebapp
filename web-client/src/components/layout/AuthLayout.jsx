import React from 'react';
import { Link } from 'react-router-dom';
import { Scale } from 'lucide-react';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-blue-600 to-indigo-800 relative overflow-hidden items-center justify-center p-16">
        {/* Abstract Background Pattern (Subtle curved lines) */}
        <div className="absolute inset-0 opacity-20">
          <svg viewBox="0 0 800 800" className="w-full h-full text-white" preserveAspectRatio="none">
            <path fill="none" stroke="currentColor" strokeWidth="2" d="M-100,200 Q400,-100 900,300 M-100,300 Q400,0 900,400 M-100,400 Q400,100 900,500 M-100,500 Q400,200 900,600" />
          </svg>
        </div>
        
        <div className="relative z-10 w-full max-w-lg">
          <div className="mb-12">
            {/* Custom Star/Sparkle Icon */}
            <svg className="w-20 h-20 text-white mb-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="2" x2="12" y2="22" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              <line x1="4.93" y1="19.07" x2="19.07" y2="4.93" />
            </svg>
            
            <h1 className="text-6xl font-bold text-white tracking-tight mb-4 leading-tight">
              Hello<br />Lawnova! <span className="inline-block animate-wave">👋</span>
            </h1>
          </div>
          
          <p className="text-blue-100 text-xl font-light leading-relaxed max-w-md">
            Skip repetitive legal research. Get highly productive through AI-powered case analysis and save tons of time!
          </p>
          
          <div className="absolute bottom-0 pt-32 text-blue-200 text-sm">
            © {new Date().getFullYear()} Lawnova. All rights reserved.
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-[#0B0E14]">
        <div className="w-full max-w-md relative">
          
          <div className="absolute -top-32 left-0 hidden lg:block">
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-slate-900 dark:text-white" />
              <span className="text-xl font-bold text-slate-900 dark:text-white">Lawnova</span>
            </div>
          </div>

          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-12">
            <Scale className="w-8 h-8 text-slate-900 dark:text-white" />
            <span className="text-2xl font-bold text-slate-900 dark:text-white">Lawnova</span>
          </div>

          <div className="mb-10">
            <h2 className="text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">{title}</h2>
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
