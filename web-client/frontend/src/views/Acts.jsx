
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    Trash2,
    RefreshCw,
    Play,
    Square,
    FileText,
    AlertTriangle,
    Terminal,
    BookOpen
} from 'lucide-react';

const API_BASE = '/api';

export default function Acts() {
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
    const [scraperLogs, setScraperLogs] = useState("");
    const [isScraping, setIsScraping] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(true);

    // Stats State
    const [stats, setStats] = useState(null);
    const [loadingStats, setLoadingStats] = useState(false);

    // Stats Job State
    const [statsJobId, setStatsJobId] = useState(null);
    const [statsJobLog, setStatsJobLog] = useState("");


    const logsContainerRef = useRef(null);

    // --- Effects ---
    useEffect(() => {
        fetchDocuments(1);
        fetchActiveJob();
        fetchStats();
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [scraperLogs]);

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
                        fetchDocuments(page);
                    }
                } catch (e) {
                    console.error("Error polling job", e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeJob, isScraping]);

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


    // --- Actions ---

    const fetchDocuments = async (pageNum = page) => {
        setLoadingDocs(true);
        try {
            const res = await axios.get(`${API_BASE}/documents/acts`, {
                params: { page: pageNum, limit }
            });
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
        try {
            setCheckingStatus(true);
            const res = await axios.get(`${API_BASE}/jobs?limit=50`);

            // Check Scraper Job
            const runningJob = res.data.find(j =>
                j.job_type === 'SCRAPE_ACTS' &&
                (j.status === 'RUNNING' || j.status === 'PENDING' || j.status === 'CANCEL_REQUESTED')
            );
            if (runningJob) {
                setActiveJob(runningJob.id);
                setIsScraping(true);
                setScraperLogs(runningJob.logs || "Reconnecting to active job...");
            }

            // Check Stats Job
            const runningStatsJob = res.data.find(j =>
                j.job_type === 'CHECK_ONLINE_STATS_ACTS' &&
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

    const fetchStats = async () => {
        setLoadingStats(true);
        try {
            const res = await axios.get(`${API_BASE}/stats/acts`);
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
            const res = await axios.post(`${API_BASE}/stats/acts/check`);
            setStatsJobId(res.data.job_id);
        } catch (e) {
            alert("Failed to start stats check");
            setLoadingStats(false);
        }
    };

    const startScraper = async () => {
        try {
            setScraperLogs("Starting scraper...");
            // Scrape ALL years (max_years=0)
            const res = await axios.post(`${API_BASE}/sync/acts`, null, { params: { max_years: 0 } });
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
            await axios.delete(`${API_BASE}/documents/acts/${id}`);
            setDocuments(prev => prev.filter(d => d.id !== id));
        } catch (e) {
            alert("Failed to delete");
        }
    };

    const clearAllDocuments = async () => {
        const confirmText = prompt("Type 'DELETE' to confirm deleting ALL Acts. This cannot be undone.");
        if (confirmText !== 'DELETE') return;

        try {
            const res = await axios.delete(`${API_BASE}/documents/acts`);
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
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Government Acts Pipeline</h2>
                <p className="text-slate-600 leading-relaxed">
                    This pipeline manages the acquisition and categorization of Government Acts from the official archives (documents.gov.lk).
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
                        Check the "Deep Scan" to verify how many Acts are available online versus your local collection.
                    </p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                    {stats ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                                                // Try to parse number from log "Total: 123"
                                                statsJobLog.match(/Total:\s*(\d+)/)
                                                    ? parseInt(statsJobLog.match(/Total:\s*(\d+)/)[1]).toLocaleString()
                                                    : (stats.online_total > 0 ? stats.online_total.toLocaleString() : "...")
                                            ) : (
                                                stats.online_total <= 0 ? "N/A" : stats.online_total.toLocaleString()
                                            )}
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-400 font-medium">
                                        Total Verified Acts
                                    </div>

                                    {/* Real-time Log Footer */}
                                    {statsJobId && (
                                        <div className="mt-4 -mx-5 -mb-5 bg-slate-900 p-3 border-t border-slate-800">
                                            <div className="flex items-center gap-2 text-blue-400 font-mono text-[10px]">
                                                <Terminal className="w-3 h-3" />
                                                <span className="truncate">{statsJobLog || "Initializing..."}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                                <div className="text-xs text-blue-600 uppercase font-bold tracking-wider">Local Database</div>
                                <div className="text-3xl font-bold text-blue-700 mt-2">{stats.local_total.toLocaleString()}</div>
                                <div className="text-xs text-blue-400 mt-1">Acts Ingested</div>
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

            {/* SECTION 2: PIPELINE OPERATIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                            <Play className="w-5 h-5 mr-2 text-indigo-600" />
                            Pipeline Controls
                        </h3>
                        <p className="text-sm text-slate-500">
                            Start the scraping process. Use <b>Stop</b> to gracefully cancel.
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                        <div className="flex flex-col gap-4">
                            <button
                                onClick={startScraper}
                                disabled={isScraping || checkingStatus}
                                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg text-white font-medium transition shadow-md
                                    ${isScraping || checkingStatus
                                        ? 'bg-slate-300 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg transform active:scale-95'}`}
                            >
                                <Play className="w-4 h-4" />
                                <span>{isScraping ? "Scraper Running..." : "Start Scraper (All Years)"}</span>
                            </button>

                            <button
                                onClick={stopScraper}
                                disabled={!isScraping}
                                className={`w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition border
                                    ${!isScraping
                                        ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                        : 'bg-white text-red-600 border-red-200 hover:bg-red-50'}`}
                            >
                                <Square className="w-4 h-4 fill-current" />
                                <span>Stop Process</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                            <Terminal className="w-5 h-5 mr-2 text-slate-600" />
                            Live Process Logs
                        </h3>
                        <p className="text-sm text-slate-500">
                            Real-time streaming logs from the scraping agent.
                        </p>
                    </div>

                    <div className="bg-slate-900 rounded-xl shadow-inner border border-slate-800 overflow-hidden flex flex-col h-[280px]">
                        <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-mono">system_output.log</span>
                            <div className="flex gap-1.5">
                                <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center text-[8px]">●</div>
                                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center text-[8px]">●</div>
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-[8px]">●</div>
                            </div>
                        </div>
                        <div
                            ref={logsContainerRef}
                            className="flex-1 p-4 overflow-y-auto font-mono text-xs leading-relaxed"
                        >
                            {scraperLogs ? (
                                <pre className="whitespace-pre-wrap text-emerald-400">
                                    {scraperLogs}
                                    {isScraping && <span className="animate-pulse inline-block w-2 h-4 bg-emerald-500 ml-1 align-middle"></span>}
                                </pre>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                                    <Terminal className="w-8 h-8 opacity-20" />
                                    <span className="opacity-50">Waiting for process start...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 3: DATA MANAGEMENT */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center">
                            <BookOpen className="w-5 h-5 mr-2 text-indigo-600" />
                            Downloaded Acts
                        </h3>
                        <p className="text-sm text-slate-500">
                            Manage the collection of PDF acts stored in the database.
                        </p>
                    </div>
                    <button
                        onClick={clearAllDocuments}
                        className="text-xs text-red-500 hover:text-red-700 hover:underline flex items-center underline-offset-2"
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear All Data
                    </button>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-xs text-slate-500 uppercase tracking-wider">
                                    <th className="p-4 font-semibold">ID</th>
                                    <th className="p-4 font-semibold">Act Year</th>
                                    <th className="p-4 font-semibold">Act Details</th>
                                    <th className="p-4 font-semibold">Date Decided</th>
                                    <th className="p-4 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {loadingDocs ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-400 text-sm">
                                            Loading documents...
                                        </td>
                                    </tr>
                                ) : documents.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" className="p-8 text-center text-slate-400 text-sm">
                                            No acts found locally.
                                        </td>
                                    </tr>
                                ) : (
                                    documents.map((doc) => (
                                        <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 text-slate-400 font-mono text-xs">#{doc.id}</td>
                                            <td className="p-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 text-indigo-600 text-xs font-medium">
                                                    {doc.year}
                                                </span>
                                            </td>
                                            <td className="p-4 max-w-md">
                                                <div className="font-medium text-slate-800 text-sm line-clamp-1">{doc.title}</div>
                                                <div className="text-xs text-slate-500 mt-0.5 font-mono">{doc.case_number}</div>
                                            </td>
                                            <td className="p-4 text-sm text-slate-600">
                                                {doc.date_decided ? new Date(doc.date_decided).toLocaleDateString() : '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <a
                                                        href={doc.source_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition"
                                                        title="View Source PDF"
                                                    >
                                                        <FileText className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => deleteDocument(doc.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                                                        title="Delete Document"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                            Page <b>{page}</b> of <b>{totalPages}</b> (Total {totalCount} items)
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => fetchDocuments(page - 1)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                            >
                                Previous
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => fetchDocuments(page + 1)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded text-slate-600 text-xs font-medium hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
