
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    FileText,
    RefreshCw,
    CheckCircle,
    Clock,
    AlertCircle,
    Eye,
    X,
    Play,
    Square,
    TerminalSquare
} from 'lucide-react';

const API_BASE = '/api';

function Terminal({ logs }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    return (
        <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs h-64 overflow-y-auto flex flex-col shadow-inner border border-slate-800">
            <div className="flex items-center text-slate-500 mb-2 pb-2 border-b border-slate-800">
                <TerminalSquare className="w-4 h-4 mr-2" />
                <span>Live Process Logs</span>
            </div>
            <div className="flex-1 space-y-1">
                {logs ? logs.split('\n').map((line, i) => (
                    <div key={i} className={`${line.includes("Error") ? "text-red-400" : "text-emerald-400/90"}`}>
                        {line}
                    </div>
                )) : (
                    <div className="text-slate-600 italic">Waiting for logs...</div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>
    );
}

export default function OCRPipeline() {
    // --- State ---
    const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0 });
    const [loadingStats, setLoadingStats] = useState(false);

    // Documents List
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statusFilter, setStatusFilter] = useState('all'); // all, completed, pending

    // Viewer
    const [viewDoc, setViewDoc] = useState(null);
    const [viewContent, setViewContent] = useState(null);
    const [loadingContent, setLoadingContent] = useState(false);

    // Job Control
    const [jobId, setJobId] = useState(null);
    const [jobStatus, setJobStatus] = useState(null);
    const [jobLogs, setJobLogs] = useState("");
    const [polling, setPolling] = useState(false);

    // --- Effects ---
    useEffect(() => {
        fetchStats();
        fetchDocuments(1);

        // Restore active job if any (simple check on mount, robust would be API check)
        checkActiveJob();
    }, []);

    useEffect(() => {
        fetchDocuments(1);
    }, [statusFilter]);

    useEffect(() => {
        let interval;
        if (polling && jobId) {
            interval = setInterval(checkJobStatus, 2000);
        }
        return () => clearInterval(interval);
    }, [polling, jobId]);

    // --- Actions ---
    const checkActiveJob = async () => {
        // Here we could hit an endpoint to find the latest running OCR job
        // For now, we'll rely on local state or user starting one.
    };

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await axios.get(`${API_BASE}/stats/ocr`);
            setStats(res.data);
        } catch (e) {
            console.error("Failed to fetch stats", e);
        } finally {
            setLoadingStats(false);
        }
    };

    const fetchDocuments = async (pageNum = 1, silent = false) => {
        if (!silent) setLoadingDocs(true);
        try {
            const res = await axios.get(`${API_BASE}/documents/ocr`, {
                params: { page: pageNum, limit: 50, status: statusFilter }
            });
            setDocuments(res.data.items);
            setTotalPages(res.data.total_pages);
            setPage(pageNum);
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            if (!silent) setLoadingDocs(false);
        }
    };

    const runOCR = async () => {
        try {
            const res = await axios.post(`${API_BASE}/process/ocr`, null, {
                params: { limit: 0 } // 0 means no limit
            });
            setJobId(res.data.job_id);
            setJobStatus('RUNNING');
            setJobLogs("Job Started...\n");
            setPolling(true);
        } catch (e) {
            console.error("Failed to start OCR", e);
            alert("Failed to start OCR job.");
        }
    };

    const stopOCR = async () => {
        if (!jobId) return;
        try {
            await axios.post(`${API_BASE}/jobs/${jobId}/cancel`);
            setJobLogs(prev => prev + "Cancellation Requested...\n");
        } catch (e) {
            console.error("Failed to stop job", e);
        }
    };

    const checkJobStatus = async () => {
        if (!jobId) return;
        try {
            const res = await axios.get(`${API_BASE}/jobs/${jobId}`);
            const job = res.data;
            setJobStatus(job.status);
            setJobLogs(job.logs || "");

            // Refresh data while running (silent mode)
            if (job.status === 'RUNNING') {
                fetchDocuments(page, true);
                fetchStats();
            }

            if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
                setPolling(false);
                fetchStats();
                fetchDocuments(page);
            }
        } catch (e) {
            console.error("Failed to check job", e);
            setPolling(false);
        }
    };

    const openViewer = async (doc) => {
        setViewDoc(doc);
        setLoadingContent(true);
        try {
            const res = await axios.get(`${API_BASE}/documents/${doc.id}/ocr-text`);
            setViewContent(res.data.text);
        } catch (e) {
            setViewContent("Failed to load content.");
        } finally {
            setLoadingContent(false);
        }
    };

    const closeViewer = () => {
        setViewDoc(null);
        setViewContent(null);
    };

    return (
        <div className="space-y-8 relative">
            {/* Header */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 mb-1">OCR Processing Pipeline</h2>
                    <p className="text-slate-600">Monitor and manage Optical Character Recognition status for all documents.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { fetchStats(); fetchDocuments(page); }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Refresh Data"
                    >
                        <RefreshCw className={`w-5 h-5 ${loadingStats ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Stats & Controls */}
                <div className="space-y-6 lg:col-span-1">
                    {/* Stats */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg text-blue-700">
                            <div className="flex items-center"><FileText className="w-5 h-5 mr-3" /> Total Docs</div>
                            <span className="font-bold text-lg">{stats.total.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg text-amber-700">
                            <div className="flex items-center"><Clock className="w-5 h-5 mr-3" /> Pending</div>
                            <span className="font-bold text-lg">{stats.pending.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg text-emerald-700">
                            <div className="flex items-center"><CheckCircle className="w-5 h-5 mr-3" /> Completed</div>
                            <span className="font-bold text-lg">{stats.completed.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <h3 className="font-semibold text-slate-800 mb-4">Pipeline Controls</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={runOCR}
                                disabled={polling}
                                className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
                            >
                                <Play className="w-4 h-4 mr-2" />
                                Start OCR (All)
                            </button>
                            <button
                                onClick={stopOCR}
                                disabled={!polling}
                                className="flex items-center justify-center px-4 py-3 bg-white border border-red-200 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 transition"
                            >
                                <Square className="w-4 h-4 mr-2 fill-current" />
                                Stop
                            </button>
                        </div>
                        {jobStatus && (
                            <div className="mt-4 pt-4 border-t border-slate-100">
                                <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-2">Current Job Status</div>
                                <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold
                                    ${jobStatus === 'RUNNING' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                                        jobStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                            jobStatus === 'FAILED' ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-700'}`}>
                                    {jobStatus}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Middle/Right: Terminal & List */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Live Logs */}
                    <Terminal logs={jobLogs} />

                    {/* Filter Tabs */}
                    <div className="flex space-x-2 border-b border-slate-200">
                        {['all', 'completed', 'pending'].map((filter) => (
                            <button
                                key={filter}
                                onClick={() => setStatusFilter(filter)}
                                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize
                                    ${statusFilter === filter
                                        ? 'border-indigo-600 text-indigo-600'
                                        : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                            >
                                {filter}
                            </button>
                        ))}
                    </div>

                    {/* Documents Table */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                                        <th className="p-4 font-semibold">ID</th>
                                        <th className="p-4 font-semibold">Type</th>
                                        <th className="p-4 font-semibold">Title / Case No</th>
                                        <th className="p-4 font-semibold">Status</th>
                                        <th className="p-4 font-semibold">Language</th>
                                        <th className="p-4 font-semibold text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {loadingDocs ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 text-sm">Loading documents...</td>
                                        </tr>
                                    ) : documents.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="p-8 text-center text-slate-400 text-sm">No documents found.</td>
                                        </tr>
                                    ) : (
                                        documents.map((doc) => (
                                            <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 text-slate-400 font-mono text-xs">#{doc.id}</td>
                                                <td className="p-4">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide
                                                        ${doc.doc_type === 'ACT' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                                                        {doc.doc_type}
                                                    </span>
                                                </td>
                                                <td className="p-4 max-w-xs truncate">
                                                    <div className="font-medium text-slate-800 text-sm truncate" title={doc.title}>
                                                        {doc.title || doc.case_number || "Untitled"}
                                                    </div>
                                                    <div className="text-xs text-slate-500 mt-0.5 font-mono">
                                                        {doc.year ? doc.year : ''}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    {doc.is_ocr_completed ? (
                                                        <span className="inline-flex items-center text-xs font-medium text-emerald-600">
                                                            <CheckCircle className="w-3 h-3 mr-1.5" />
                                                            Completed
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center text-xs font-medium text-amber-600">
                                                            <Clock className="w-3 h-3 mr-1.5" />
                                                            Pending
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-4 text-sm text-slate-500">
                                                    {doc.language || "-"}
                                                </td>
                                                <td className="p-4 text-right">
                                                    <button
                                                        onClick={() => openViewer(doc)}
                                                        disabled={!doc.is_ocr_completed}
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition disabled:opacity-30 disabled:hover:bg-transparent"
                                                        title="View Extracted Text"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
                            <div className="text-xs text-slate-500">
                                Page <b>{page}</b> of <b>{totalPages}</b>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => fetchDocuments(page - 1)}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Previous
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => fetchDocuments(page + 1)}
                                    className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Document Viewer Modal */}
            {viewDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-bold text-slate-800">
                                    {viewDoc.title || viewDoc.case_number || `Document #${viewDoc.id}`}
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">Extracted Text Content</p>
                            </div>
                            <button onClick={closeViewer} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto bg-white font-mono text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                            {loadingContent ? (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    <RefreshCw className="w-6 h-6 animate-spin mr-2" />
                                    Loading content...
                                </div>
                            ) : (
                                viewContent
                            )}
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <button onClick={closeViewer} className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition">
                                Close Viewer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
