import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
    FileText, Scale, BookOpen, Activity, AlertCircle,
    CheckCircle, Clock, ArrowRight, BrainCircuit,
    Database, ScanText, LayoutTemplate, Server
} from 'lucide-react';

const API_BASE = '/api/judgment';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

function StatCard({ title, value, icon: Icon, color, subtext }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start space-x-4">
            <div className={`p-3 rounded-lg ${color} bg-opacity-10 text-white`}>
                <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
            </div>
            <div>
                <p className="text-sm font-medium text-slate-500">{title}</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{value}</h3>
                {subtext && <p className="text-xs text-slate-400 mt-1">{subtext}</p>}
            </div>
        </div>
    );
}

function WorkflowStep({ icon: Icon, title, desc, status }) {
    return (
        <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-lg border border-slate-100 relative group hover:bg-white hover:shadow-md transition-all">
            <div className={`p-3 rounded-full mb-3 ${status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                <Icon className="w-5 h-5" />
            </div>
            <h4 className="font-semibold text-slate-700 text-sm">{title}</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-[120px]">{desc}</p>
        </div>
    );
}

function InsightTip({ type, message }) {
    const styles = {
        warning: "bg-amber-50 text-amber-800 border-amber-200",
        info: "bg-blue-50 text-blue-800 border-blue-200",
        success: "bg-emerald-50 text-emerald-800 border-emerald-200"
    };
    const icons = {
        warning: AlertCircle,
        info: Activity,
        success: CheckCircle
    };
    const Icon = icons[type] || Activity;

    return (
        <div className={`flex items-start p-3 rounded-lg border ${styles[type]} text-sm`}>
            <Icon className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <span>{message}</span>
        </div>
    );
}

export default function Overview() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOverview();
    }, []);

    const fetchOverview = async () => {
        try {
            const res = await axios.get(`${API_BASE}/dashboard/overview`);
            setData(res.data);
        } catch (e) {
            console.error("Failed to fetch overview", e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading dashboard...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Failed to load dashboard data.</div>;

    // Prepare Chart Data
    const distributionData = [
        { name: 'Judgments', value: data.documents.judgments },
        { name: 'Acts', value: data.documents.acts }
    ];

    const pipelineData = [
        { name: 'OCR', Pending: data.pipelines.ocr_pending, Completed: data.pipelines.ocr_completed },
        { name: 'Segmentation', Pending: data.pipelines.seg_pending, Completed: data.pipelines.seg_completed }
    ];

    // Derived Insights
    const insights = [];
    if (data.pipelines.ocr_pending > 100) {
        insights.push({ type: 'warning', msg: `${data.pipelines.ocr_pending} documents pending OCR. Consider running the OCR Pipeline.` });
    }
    if (data.pipelines.seg_pending > 50) {
        insights.push({ type: 'info', msg: `${data.pipelines.seg_pending} processed documents are waiting for AI Segmentation.` });
    }
    if (data.documents.total === 0) {
        insights.push({ type: 'warning', msg: "Database is empty. Start by syncing documents from the Scrapers." });
    } else {
        insights.push({ type: 'success', msg: `System healthy. Managing ${data.documents.total} total documents.` });
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800">System Overview</h2>
                <p className="text-slate-500">Real-time insights and pipeline status.</p>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Total Documents"
                    value={data.documents.total.toLocaleString()}
                    icon={FileText}
                    color="bg-blue-500"
                />
                <StatCard
                    title="Judgments"
                    value={data.documents.judgments.toLocaleString()}
                    icon={Scale}
                    color="bg-indigo-500"
                />
                <StatCard
                    title="Acts"
                    value={data.documents.acts.toLocaleString()}
                    icon={BookOpen}
                    color="bg-emerald-500"
                />
                <StatCard
                    title="Pending Tasks"
                    value={(data.pipelines.ocr_pending + data.pipelines.seg_pending).toLocaleString()}
                    icon={Activity}
                    color="bg-amber-500"
                    subtext="OCR + Segmentation"
                />
            </div>

            {/* Workflow Visualization */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-6">Data Pipeline Workflow</h3>
                <div className="flex flex-wrap items-center justify-between gap-4 relative">
                    {/* Connecting Line (Desktop) */}
                    <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-100 -z-10 hidden md:block" />

                    <WorkflowStep icon={Database} title="1. Ingestion" desc="Sync from Gov sites" status="active" />
                    <ArrowRight className="text-slate-300 hidden md:block" />
                    <WorkflowStep icon={ScanText} title="2. OCR" desc="Extract text from PDFs" status={data.pipelines.ocr_pending > 0 ? 'active' : ''} />
                    <ArrowRight className="text-slate-300 hidden md:block" />
                    <WorkflowStep icon={LayoutTemplate} title="3. Segment" desc="Structure with AI" status={data.pipelines.seg_pending > 0 ? 'active' : ''} />
                    <ArrowRight className="text-slate-300 hidden md:block" />
                    <WorkflowStep icon={BrainCircuit} title="4. Features" desc="Extract Metadata & Train" status="active" />
                </div>
            </div>

            {/* Charts & Insights Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Pipeline Health */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Pipeline Health</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={pipelineData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                <YAxis axisLine={false} tickLine={false} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                <Legend />
                                <Bar dataKey="Completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                <Bar dataKey="Pending" fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Right: Distribution & Insights */}
                <div className="space-y-6">
                    {/* Document Distribution Pie */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Content Mix</h3>
                        <div className="h-48">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={distributionData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {distributionData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" height={36} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Admin Insights */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Admin Insights</h3>
                        <div className="space-y-3">
                            {insights.map((insight, i) => (
                                <InsightTip key={i} type={insight.type} message={insight.msg} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Server Health & Safety Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Server Metrics */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center"><Server className="mr-2" /> Server Health</h3>
                    <div className="space-y-6">
                        {data.server_stats ? (
                            <>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-600">CPU Usage</span>
                                        <span className="font-medium text-slate-800">{data.server_stats.cpu_usage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${data.server_stats.cpu_usage > 80 ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${data.server_stats.cpu_usage}%` }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-600">RAM Usage</span>
                                        <span className="font-medium text-slate-800">{data.server_stats.ram_usage}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full ${data.server_stats.ram_usage > 85 ? 'bg-red-500' : 'bg-purple-500'}`}
                                            style={{ width: `${data.server_stats.ram_usage}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-slate-400 mt-1 text-right">
                                        Free: {data.server_stats.ram_free} GB / Total: {data.server_stats.ram_total} GB
                                    </p>
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-400 italic">Metrics unavailable</p>
                        )}
                    </div>
                </div>

                {/* Safety Guide */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Pipeline Safety Guide</h3>
                    <div className="space-y-3 bg-slate-50 p-4 rounded-lg text-sm text-slate-600">
                        <p><strong>🛑 Stopping Pipelines:</strong> Always use the <span className="text-red-600 font-medium">Stop</span> button in the specific pipeline tab. This sets a `CANCEL_REQUESTED` flag allows the job to finish its current item cleanly.</p>
                        <p><strong>⚠️ Forced Termination:</strong> Killing the server (Ctrl+C or Docker Stop) while a job is writing to the DB may cause data inconsistency. Always wait for "Running" badges to disappear before restarting.</p>
                        <p><strong>💾 Data Persistence:</strong> The database is stored in `lawnowa.db`. Back this file up regularly if running locally.</p>
                    </div>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">Recent System Activity</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-slate-500">
                                <th className="pb-3 font-medium">Job Type</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium text-right">Job ID</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {data.recent_jobs.length > 0 ? data.recent_jobs.map((job) => (
                                <tr key={job.id}>
                                    <td className="py-3 font-medium text-slate-700">{job.type}</td>
                                    <td className="py-3">
                                        <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold
                                            ${job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                job.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {job.status}
                                        </span>
                                    </td>
                                    <td className="py-3 text-slate-500">{new Date(job.created_at).toLocaleString()}</td>
                                    <td className="py-3 text-right font-mono text-slate-400">#{job.id}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="4" className="py-8 text-center text-slate-400 italic">No recent activity.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
