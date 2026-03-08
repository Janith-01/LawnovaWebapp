import React from 'react';
import { Gavel, Github, Twitter, Linkedin, Mail } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';

const Footer = () => {
    const { isDarkMode } = useTheme();

    return (
        <footer className={`mt-auto py-8 px-6 lg:px-10 border-t transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
            <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">

                {/* Brand Section */}
                <div className="flex flex-col items-center md:items-start space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-lg">
                            <Gavel className="w-5 h-5" />
                        </div>
                        <span className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                            LawNova
                        </span>
                    </div>
                    <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-gray-500'}`}>
                        Pioneering Legal Education & Practice
                    </p>
                </div>

                {/* Quick Links */}
                <div className="flex gap-6 text-sm font-medium">
                    <a href="#" className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-purple-400' : 'text-gray-500 hover:text-purple-600'}`}>About Us</a>
                    <a href="#" className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-purple-400' : 'text-gray-500 hover:text-purple-600'}`}>Privacy Policy</a>
                    <a href="#" className={`transition-colors ${isDarkMode ? 'text-slate-400 hover:text-purple-400' : 'text-gray-500 hover:text-purple-600'}`}>Terms of Service</a>
                </div>

                {/* Socials */}
                <div className="flex gap-4">
                    <a href="#" className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-purple-600'}`}>
                        <Twitter className="w-4 h-4" />
                    </a>
                    <a href="#" className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-purple-600'}`}>
                        <Linkedin className="w-4 h-4" />
                    </a>
                    <a href="#" className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-purple-600'}`}>
                        <Github className="w-4 h-4" />
                    </a>
                    <a href="#" className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-purple-400' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-purple-600'}`}>
                        <Mail className="w-4 h-4" />
                    </a>
                </div>
            </div>

            <div className={`mt-8 text-center text-xs ${isDarkMode ? 'text-slate-500' : 'text-gray-400'}`}>
                &copy; {new Date().getFullYear()} LawNova. All rights reserved.
            </div>
        </footer>
    );
};

export default Footer;
