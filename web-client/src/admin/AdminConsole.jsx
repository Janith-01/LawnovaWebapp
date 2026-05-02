import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    LayoutDashboard,
    Users,
    Workflow,
    Play,
    Database,
    FileText,
    Activity,
    Server,
    AlertCircle,
    Scale,
    ScanText,
    LayoutTemplate
} from 'lucide-react';
import SupremeCourt from './views/SupremeCourt';
import AppealCourt from './views/AppealCourt';
import Acts from './views/Acts';

import OCRPipeline from './views/OCRPipeline';
import SegmentationPipeline from './views/SegmentationPipeline';
import Overview from './views/Overview';
import UserManagement from '../pages/admin/UserManagement';

const API_BASE = '/api/judgment';

// Canonical admin console used by `/admin/*` routes in App.jsx.

// --- Components ---

function MetricCard({ title, value, icon: Icon, color }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-center space-x-4">
            <div className={`p-4 rounded-full ${color} bg-opacity-20`}>
                <Icon className={`w-8 h-8 ${color.replace('bg-', 'text-')}`} />
            </div>
            <div>
                <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
            </div>
        </div>
    );
}





function Playground() {
    const [input, setInput] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handlePredict = async () => {
        setLoading(true);
        setError(null);
        setResult(null);
        try {
            const res = await axios.post(`${API_BASE}/predict/with-explanation`, null, {
                params: { text: input }
            });
            setResult(res.data);
        } catch (e) {
            setError(e.response?.data?.detail || e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Prediction Playground</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Input */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Case Facts / Scenario</label>
                    <textarea
                        className="w-full h-64 p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                        placeholder="Enter legal facts here..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                    ></textarea>
                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={handlePredict}
                            disabled={loading || !input}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50 flex items-center"
                        >
                            {loading && <Activity className="animate-spin mr-2 h-4 w-4" />}
                            Predict Outcome
                        </button>
                    </div>
                </div>

                {/* Output */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full overflow-y-auto">
                    <h3 className="text-lg font-semibold mb-4">Results</h3>

                    {error && (
                        <div className="p-4 bg-red-50 text-red-700 rounded-lg border border-red-100 flex items-start">
                            <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {!result && !error && (
                        <div className="text-slate-400 text-center mt-20">
                            Run a prediction to see results here.
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
                            <div>
                                <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Prediction</span>
                                <div className={`text-2xl font-bold mt-1 ${result.prediction === 'ALLOWED' ? 'text-green-600' : 'text-red-600'}`}>
                                    {result.prediction}
                                </div>
                            </div>

                            <div>
                                <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Confidence</span>
                                <div className="flex items-center mt-1 space-x-4">
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>Dismissed</span>
                                            <span>{(result.confidence.dismissed * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-red-400" style={{ width: `${result.confidence.dismissed * 100}%` }}></div>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span>Allowed</span>
                                            <span>{(result.confidence.allowed * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-400" style={{ width: `${result.confidence.allowed * 100}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <span className="text-sm text-slate-500 uppercase font-bold tracking-wider">Explanation</span>
                                <div className="mt-2 text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg text-sm">
                                    {result.explanation}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Icons (custom fallback for Lucide since I can't guarantee all exports) ---
const ScaleIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></svg>
)
const BookIcon = (props) => (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
)

// --- Layout ---

export default function AdminConsole() {
    const location = useLocation();
    const navigate = useNavigate();

    const routeToView = useMemo(() => ({
        '/admin/dashboard': 'overview',
        '/admin/users': 'users',
    }), []);

    const viewToRoute = useMemo(() => ({
        overview: '/admin/dashboard',
        users: '/admin/users',
        supremecourt: '/admin/dashboard',
        appealcourt: '/admin/dashboard',
        acts: '/admin/dashboard',
        ocr: '/admin/dashboard',
        segmentation: '/admin/dashboard',
        playground: '/admin/dashboard',
    }), []);

    const [view, setView] = useState(routeToView[location.pathname] || 'overview');

    useEffect(() => {
        setView(routeToView[location.pathname] || 'overview');
    }, [location.pathname, routeToView]);

    const handleNavChange = (id) => {
        setView(id);
        const targetRoute = viewToRoute[id] || '/admin/dashboard';
        if (location.pathname !== targetRoute) {
            navigate(targetRoute);
        }
    };

    const NavItem = ({ id, label, icon: Icon }) => (
        <button
            onClick={() => handleNavChange(id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${view === id ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'
                }`}
        >
            <Icon className="w-5 h-5" />
            <span className="font-medium">{label}</span>
        </button>
    );

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
                <div className="p-6 border-b border-slate-100">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        Lawnowa
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">Admin Console</p>
                </div>

                <nav className="flex-1 p-4 space-y-2">
                    <NavItem id="overview" label="Overview" icon={LayoutDashboard} />
                    <NavItem id="users" label="User Management" icon={Users} />
                    <NavItem id="supremecourt" label="Supreme Court" icon={Scale} />
                    <NavItem id="appealcourt" label="Appeal Court" icon={Scale} />
                    <NavItem id="acts" label="Government Acts" icon={BookIcon} />
                    <NavItem id="ocr" label="OCR Pipeline" icon={ScanText} />
                    <NavItem id="segmentation" label="AI Segmentation" icon={LayoutTemplate} />
                    <NavItem id="playground" label="Playground" icon={Play} />
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <div className="flex items-center space-x-3 text-slate-400 text-xs">
                        <Server className="w-4 h-4" />
                        <span>v1.0.0-beta</span>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white border-b border-slate-200 p-4 md:hidden flex items-center justify-between">
                    <span className="font-bold text-lg">Lawnowa</span>
                    {/* Mobile Menu Toggle (Simplified) */}
                </header>

                <div className="p-8 max-w-7xl mx-auto">
                    {view === 'overview' && <Overview />}
                    {view === 'users' && <UserManagement />}
                    {view === 'supremecourt' && <SupremeCourt />}
                    {view === 'appealcourt' && <AppealCourt />}
                    {view === 'acts' && <Acts />}
                    {view === 'ocr' && <OCRPipeline />}
                    {view === 'segmentation' && <SegmentationPipeline />}
                    {view === 'playground' && <Playground />}
                </div>
            </main>
        </div>
    );
}
