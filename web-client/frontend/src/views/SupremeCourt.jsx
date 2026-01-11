import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Trash2,
    RefreshCw,
    Play,
    Square,
    FileText,
    AlertTriangle,
    Terminal
} from 'lucide-react';

const API_BASE = '/api';

export default function SupremeCourt() {
    // --- State ---
    const [documents, setDocuments] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const limit = 50;

    // Scraper State
    const [activeJob, setActiveJob] = useState(null);
    const [scrakerLogs, setScraperLogs] = useState("");
    const [isScraping, setIsScraping] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Stats State
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);


    const logsContainerRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        fetchDocuments(1); // Load page 1 initially
        fetchActiveJob(); // Check if something is already running
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [scrakerLogs]);

    // Poll active job logs
    useEffect(() => {
        let interval;
        if (activeJob && isScraping) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE}/jobs/${activeJob}`);
                    const job = res.data;

                    if (job.logs) setScraperLogs(job.logs);

                    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
                        setIsScraping(false);
                        fetchDocuments(page); // Refresh current page on completion
                    }
                } catch (e) {
                    console.error("Error polling job", e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeJob, isScraping]);

    // --- Actions ---

    const fetchDocuments = async (pageNum = page) => {
        setLoadingDocs(true);
        try {
            const res = await axios.get(`${API_BASE}/documents/supreme-court`, {
                params: { page: pageNum, limit }
            });
            // Handle PaginatedResponse
            setDocuments(res.data.items);
            setTotalPages(res.data.total_pages);
            setTotalCount(res.data.total);
            setPage(pageNum);
        } catch (e) {
            console.error("Failed to fetch documents", e);
        } finally {
            setLoadingDocs(false);
        }
    };

    const fetchActiveJob = async () => {
        // Find if there's a running SC job
        try {
            setCheckingStatus(true);
            const res = await axios.get(`${API_BASE}/jobs?limit=50`);
            const runningJob = res.data.find(j =>
                j.job_type === 'SCRAPE_SUPREME_COURT' &&
                (j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'CANCEL_REQUESTED')
            );
            if (runningJob) {
                setActiveJob(runningJob.id);
                setIsScraping(true);
                setScraperLogs(runningJob.logs || "Reconnecting to active job...");
            }

            // Also check for running STATS job
            const runningStatsJob = res.data.find(j =>
                j.job_type === 'CHECK_ONLINE_STATS' &&
                (j.status === 'RUNNING' || j.status === 'PENDING')
            );
            if (runningStatsJob) {
                setStatsJobId(runningStatsJob.id);
                setStatsJobLog(runningStatsJob.logs || "Resuming stats check...");
            }
        } catch (e) {
            console.error("Error fetching jobs", e);
        } finally {
            setCheckingStatus(false);
        }
    };

    // Stats Job State
    const [statsJobId, setStatsJobId] = useState(null);
    const [statsJobLog, setStatsJobLog] = useState("");

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await axios.get(`${API_BASE}/stats/supreme-court`);
            setStats(res.data);
        } catch (e) {
            console.error("Failed to fetch stats", e);
        } finally {
            setLoadingStats(false);
        }
    };

    const runStatsCheck = async () => {
        setLoadingStats(true);
        setStatsJobLog("Initializing check...");
        try {
            const res = await axios.post(`${API_BASE}/stats/supreme-court/check`);
            setStatsJobId(res.data.job_id);
        } catch (e) {
            alert("Failed to start stats check");
            setLoadingStats(false);
        }
    };

    // Poll Stats Job
    useEffect(() => {
        let interval;
        if (statsJobId) {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE}/jobs/${statsJobId}`);
                    const job = res.data;

                    // Update log text (get last line)
                    if (job.logs) {
                        const lines = job.logs.trim().split('\n');
                        setStatsJobLog(lines[lines.length - 1]);
                    }

                    if (job.status === 'COMPLETED') {
                        setStatsJobId(null);
                        setStatsJobLog("");
                        fetchStats(); // Update numbers
                    } else if (job.status === 'FAILED') {
                        setStatsJobId(null);
                        setStatsJobLog("Check failed.");
                        setLoadingStats(false);
                    }
                } catch (e) {
                    console.error(e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [statsJobId]);

    // Initial Load
    useEffect(() => {
        fetchStats();
    }, []);

    const startScraper = async () => {
        try {
            setScraperLogs("Starting scraper...");
            // max_pages=0 for unlimited (as per backend logic check)
            const res = await axios.post(`${API_BASE}/sync/supreme-court`, null, {
                params: { max_pages: 0 }
            });
            setActiveJob(res.data.job_id);
            setIsScraping(true);
        } catch (e) {
            alert(`Failed to start: ${e.response?.data?.detail || e.message}`);
        }
    };

    const stopScraper = async () => {
        if (!activeJob) return;
        try {
            await axios.post(`${API_BASE}/jobs/${activeJob}/cancel`);
            setScraperLogs(prev => prev + "\n[System] Cancellation requested...");
        } catch (e) {
            console.error("Failed to stop", e);
        }
    };

    const deleteDocument = async (id) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await axios.delete(`${API_BASE}/documents/supreme-court/${id}`);
            setDocuments(prev => prev.filter(d => d.id !== id));
        } catch (e) {
            alert("Failed to delete");
        }
    };

    const clearAllDocuments = async () => {
        const confirmText = prompt("Type 'DELETE' to confirm deleting ALL Supreme Court documents. This cannot be undone.");
        if (confirmText !== 'DELETE') return;

        try {
            const res = await axios.delete(`${API_BASE}/documents/supreme-court`);
            alert(res.data.message);
            fetchDocuments(1);
        } catch (e) {
            alert("Failed to clear all");
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / Intro */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Supreme Court Pipeline</h2>
                <p className="text-slate-600 leading-relaxed">
                    This pipeline manages the acquisition and processing of judgments from the Supreme Court of Sri Lanka website.
                    You can inspect the current collection, manage documents, and execute the scraping process with full observability.
                </p>
            </div>

            {/* SECTION 1: SYSTEM HEALTH (Stats) */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                        <AlertTriangle className="w-5 h-5 mr-2 text-blue-600" />
                        System Health & Sync Status
                    </h3>
                    <p className="text-sm text-slate-500">
                        Monitor the synchronization gap between your local database and the live Supreme Court archives.
                        Use this to determine if a new scraping job is required.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    {stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {/* Stat Cards */}
                            {/* Stat Cards */}
                            <div className="relative overflow-hidden p-0 bg-white rounded-xl border border-slate-200 shadow-sm group hover:border-blue-300 transition-all duration-300">
                                {/* Gradient Background for progress feeling */}
                                {statsJobId && (
                                    <div className="absolute inset-0 bg-blue-50/50 animate-pulse z-0"></div>
                                )}

                                <div className="p-5 flex flex-col h-full relative z-10">
                                    <div className="flex justify-between items-start">
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider flex items-center gap-2">
                                            Online Repository
                                            {statsJobId && (
                                                <span className="flex h-2 w-2 relative">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                                </span>
                                            )}
                                        </div>
                                        {statsJobId && (
                                            <div className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                                                SCANNING
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-4 mb-1">
                                        <div className="text-4xl font-bold text-slate-800 tracking-tight flex items-baseline gap-1">
                                            {statsJobId ? (
                                                <span className="text-blue-600">...</span>
                                            ) : (
                                                stats.online_total <= 0 ? "N/A" : stats.online_total.toLocaleString()
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 font-medium">
                                        Total Judgments Available
                                    </div>

                                    {/* Real-time Log Footer */}
                                    {statsJobId && (
                                        <div className="mt-4 -mx-5 -mb-5 bg-slate-900 p-3 border-t border-slate-800">
                                            <div className="flex items-center gap-2 text-blue-400 font-mono text-[10px]">
                                                <Terminal className="w-3 h-3" />
                                                <span className="truncate">{statsJobLog || "Connecting..."}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="text-xs text-blue-600 uppercase font-bold tracking-wider">Local Database</div>
                                <div className="text-3xl font-bold text-blue-700 mt-2">{stats.local_total.toLocaleString()}</div>
                                <div className="text-xs text-blue-400 mt-1">Judgments Ingested</div>
                            </div>

                            <div className={`p-4 rounded-xl border ${stats.missing > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                <div className={`text-xs uppercase font-bold tracking-wider ${stats.missing > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    Missing Documents
                                </div>
                                <div className={`text-3xl font-bold mt-2 ${stats.missing > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                    {stats.missing.toLocaleString()}
                                </div>
                                <div className={`text-xs mt-1 ${stats.missing > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                                    {stats.missing > 0 ? 'Pending Ingestion' : 'All Synced'}
                                </div>
                            </div>

                            <div className="flex flex-col justify-between">
                                <div className="text-right">
                                    <div className="text-xs text-slate-400 uppercase font-semibold">Last Sync</div>
                                    <div className="text-sm font-medium text-slate-700">
                                        {stats.last_synced_at ? new Date(stats.last_synced_at).toLocaleString() : 'Never'}
                                    </div>
                                </div>
                                <button
                                    onClick={runStatsCheck}
                                    disabled={loadingStats || statsJobId}
                                    className="mt-4 w-full flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 font-medium py-2 px-4 rounded-lg transition text-sm shadow-sm disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                                    <span>{statsJobId ? "Checking..." : "Refresh Stats"}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-8 flex items-center justify-center text-slate-400 text-sm italic">
                            {loadingStats ? "Loading live statistics..." : "No stats available. Click refresh."}
                        </div>
                    )}
                </div>
            </div>

            {/* SECTION 2: OPERATIONS (Control + Logs) */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                        <Terminal className="w-5 h-5 mr-2 text-purple-600" />
                        Scraper Operations
                    </h3>
                    <p className="text-sm text-slate-500">
                        Control the background scraping agent. The agent will traverse the Supreme Court website,
                        download new judgment PDFs, and extract their metadata into your local database.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Controls */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 h-full flex flex-col space-y-4">
                        <h4 className="font-medium text-slate-700">Job Controls</h4>

                        <div className="flex-1 space-y-3">
                            <button
                                onClick={startScraper}
                                disabled={isScraping || checkingStatus}
                                className="w-full flex items-center justify-center space-x-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition shadow-sm hover:shadow"
                            >
                                {checkingStatus ? (
                                    <RefreshCw className="animate-spin w-5 h-5" />
                                ) : isScraping ? (
                                    <RefreshCw className="animate-spin w-5 h-5" />
                                ) : (
                                    <Play className="w-5 h-5" />
                                )}
                                <span>
                                    {checkingStatus ? "Checking Status..." : isScraping ? "Scraper Running..." : "Start Scraper"}
                                </span>
                            </button>

                            <button
                                onClick={stopScraper}
                                disabled={!isScraping}
                                className="w-full flex items-center justify-center space-x-2 bg-white hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed text-red-600 font-medium py-3 px-4 rounded-lg transition border border-red-200"
                            >
                                <Square className="w-5 h-5 fill-current" />
                                <span>Stop Process</span>
                            </button>
                        </div>

                        <div className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <strong>Note:</strong> Pagination is automated. The scraper will continue until cancelled or all pages are processed.
                        </div>
                    </div>

                    {/* Logs */}
                    <div className="lg:col-span-2 bg-slate-900 rounded-xl shadow-sm overflow-hidden flex flex-col h-[300px] border border-slate-900">
                        <div className="bg-slate-950 px-4 py-2 flex items-center justify-between border-b border-slate-800">
                            <span className="text-slate-400 text-xs font-mono">Live Terminal Output</span>
                            <div className="flex space-x-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                            </div>
                        </div>
                        <div
                            ref={logsContainerRef}
                            className="flex-1 p-4 overflow-y-auto font-mono text-xs text-slate-300 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent leading-relaxed"
                        >
                            {scrakerLogs || <span className="text-slate-600 italic">Ready for tasks...</span>}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: DATA (Table) */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                            <FileText className="w-5 h-5 mr-2 text-teal-600" />
                            Stored Documents
                        </h3>
                        <p className="text-sm text-slate-500">
                            Browse, manage, and delete the judgments currently stored in your local system.
                        </p>
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <div className="text-sm font-medium text-slate-600">
                            Total Records: <span className="text-slate-900 font-bold">{totalCount}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => fetchDocuments(page)}
                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="Refresh List"
                            >
                                <RefreshCw className={`w-4 h-4 ${loadingDocs ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={clearAllDocuments}
                                className="text-xs flex items-center space-x-1 text-slate-400 hover:text-red-600 font-medium transition px-2 py-1.5 hover:bg-red-50 rounded-lg"
                            >
                                <Trash2 className="w-3 h-3" />
                                <span>Clear Data</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-100">
                                    <th className="px-6 py-4">Date Decided</th>
                                    <th className="px-6 py-4">Case Number</th>
                                    <th className="px-6 py-4">Title / Parties</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {documents.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="px-6 py-12 text-center text-slate-400">
                                            No documents found. Start the scraper to populate data.
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4 text-slate-600 text-sm whitespace-nowrap">
                                                {doc.date_decided ? doc.date_decided.split('T')[0] : 'Unknown'}
                                            </td>
                                            <td className="px-6 py-4 text-slate-800 font-medium text-sm whitespace-nowrap">
                                                {doc.case_number}
                                            </td>
                                            <td className="px-6 py-4 text-slate-600 text-sm max-w-md truncate">
                                                {doc.title || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => deleteDocument(doc.id)}
                                                    className="text-slate-300 group-hover:text-red-500 transition-colors p-1"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-sm text-slate-500">
                            Page <span className="font-medium text-slate-700">{page}</span> of <span className="font-medium text-slate-700">{totalPages}</span>
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => fetchDocuments(page - 1)}
                                disabled={page <= 1 || loadingDocs}
                                className="px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => fetchDocuments(page + 1)}
                                disabled={page >= totalPages || loadingDocs}
                                className="px-3 py-1 text-sm bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
