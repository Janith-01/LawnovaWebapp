import React, { useState } from 'react';
import {
    X,
    FileText,
    FolderOpen,
    Users,
    Shield,
    Sword,
    AlertTriangle,
    CheckCircle,
    Eye,
    User,
    BookOpen,
    Lock,
    Unlock,
    Scale,
    ChevronRight,
    Sparkles
} from 'lucide-react';

/**
 * EvidenceModal - The Case Dossier Dashboard
 * Theme: Antigravity (Dark mode, glassmorphism, neon accents)
 * 
 * Features:
 * - Tabbed navigation (Briefing, Evidence Locker, Witness Manifest)
 * - Full case details display
 * - Role-aware evidence styling
 */
const EvidenceModal = ({ isOpen, onClose, caseDetails, userRole }) => {
    const [activeTab, setActiveTab] = useState('briefing');

    if (!isOpen) return null;

    // Determine if user is Defense or Prosecution
    const isDefense = userRole === 'Defense';
    const userTeamName = isDefense ? 'DEFENSE' : 'PROSECUTION';
    const userTeamColor = isDefense ? 'cyan' : 'orange';
    const opponentTeamName = isDefense ? 'PROSECUTION' : 'DEFENSE';

    // Tab definitions
    const tabs = [
        { id: 'briefing', label: 'BRIEFING', icon: FileText },
        { id: 'evidence', label: 'EVIDENCE LOCKER', icon: FolderOpen },
        { id: 'witnesses', label: 'WITNESS MANIFEST', icon: Users }
    ];

    // Get personality badge colors
    const getPersonalityColor = (personality) => {
        const p = personality?.toLowerCase() || '';
        if (p.includes('nervous') || p.includes('anxious')) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
        if (p.includes('hostile') || p.includes('aggressive')) return 'bg-red-500/20 text-red-400 border-red-500/40';
        if (p.includes('arrogant') || p.includes('confident')) return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
        if (p.includes('cooperative') || p.includes('friendly')) return 'bg-green-500/20 text-green-400 border-green-500/40';
        return 'bg-slate-500/20 text-slate-400 border-slate-500/40';
    };

    // Get affiliation indicator
    const getAffiliationStyle = (affiliation) => {
        if (affiliation === 'User') return { color: 'text-emerald-400', bg: 'bg-emerald-500/20', label: 'YOUR WITNESS' };
        if (affiliation === 'Opponent') return { color: 'text-red-400', bg: 'bg-red-500/20', label: 'HOSTILE' };
        return { color: 'text-slate-400', bg: 'bg-slate-500/20', label: 'NEUTRAL' };
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900/90 backdrop-blur-2xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Top Accent Line */}
                <div className={`h-1 w-full bg-gradient-to-r ${isDefense ? 'from-cyan-500 via-blue-500 to-purple-500' : 'from-orange-500 via-red-500 to-rose-500'}`} />

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/50">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${isDefense ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-orange-500/20 border-orange-500/50'} border`}>
                            <FolderOpen size={24} className={isDefense ? 'text-cyan-400' : 'text-orange-400'} />
                        </div>
                        <div>
                            <h2 className={`text-xl font-black font-serif tracking-tight ${isDefense ? 'text-cyan-300' : 'text-orange-300'}`}>
                                CASE DOSSIER
                            </h2>
                            <p className="text-xs text-slate-400 truncate max-w-md">
                                {caseDetails?.title || 'Classified Case File'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-all border border-transparent hover:border-slate-700"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 px-6 py-3 border-b border-slate-800/50 bg-slate-900/50">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${isActive
                                        ? `${isDefense ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-orange-500/20 text-orange-400 border-orange-500/50'} border shadow-lg`
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                                    }`}
                            >
                                <Icon size={16} />
                                <span className="hidden sm:inline">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {/* ===================== TAB 1: BRIEFING ===================== */}
                    {activeTab === 'briefing' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Case Summary */}
                            <section>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <BookOpen size={14} />
                                    CASE SUMMARY
                                </h3>
                                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm">
                                    <p className="text-sm leading-relaxed text-slate-300">
                                        {caseDetails?.summary || 'No summary available. Review the evidence and witness statements to build your case.'}
                                    </p>
                                </div>
                            </section>

                            {/* Relevant Law */}
                            {caseDetails?.relevantLaw && (
                                <section>
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Scale size={14} />
                                        APPLICABLE LAW
                                    </h3>
                                    <div className={`p-5 rounded-2xl border backdrop-blur-sm ${isDefense ? 'bg-cyan-950/30 border-cyan-500/30' : 'bg-orange-950/30 border-orange-500/30'}`}>
                                        <p className={`text-sm leading-relaxed ${isDefense ? 'text-cyan-200' : 'text-orange-200'}`}>
                                            {caseDetails.relevantLaw}
                                        </p>
                                    </div>
                                </section>
                            )}

                            {/* Facts Established */}
                            <section>
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                    <CheckCircle size={14} />
                                    FACTS ESTABLISHED
                                </h3>
                                <div className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm">
                                    {caseDetails?.facts?.length > 0 ? (
                                        <ul className="space-y-3">
                                            {caseDetails.facts.map((fact, index) => (
                                                <li key={index} className="flex items-start gap-3">
                                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mt-0.5 shrink-0">
                                                        <span className="text-[10px] font-bold text-emerald-400">{index + 1}</span>
                                                    </div>
                                                    <p className="text-sm text-slate-300 leading-relaxed">{fact}</p>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">No established facts on record.</p>
                                    )}
                                </div>
                            </section>

                            {/* Opening Hint */}
                            {caseDetails?.openingHint && (
                                <section>
                                    <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                        <Sparkles size={14} />
                                        STRATEGIC HINT
                                    </h3>
                                    <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-500/30 backdrop-blur-sm">
                                        <p className="text-sm leading-relaxed text-purple-200 italic">
                                            💡 {caseDetails.openingHint}
                                        </p>
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* ===================== TAB 2: EVIDENCE LOCKER ===================== */}
                    {activeTab === 'evidence' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">

                            {/* YOUR EVIDENCE (Left Column) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDefense ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-orange-500/20 border-orange-500/50'} border`}>
                                        {isDefense ? <Shield size={20} className="text-cyan-400" /> : <Sword size={20} className="text-orange-400" />}
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-black uppercase tracking-wider ${isDefense ? 'text-cyan-400' : 'text-orange-400'}`}>
                                            {userTeamName} EVIDENCE
                                        </h3>
                                        <p className="text-[10px] text-slate-500">Evidence in your favor</p>
                                    </div>
                                </div>

                                <div className={`p-5 rounded-2xl border backdrop-blur-sm ${isDefense ? 'bg-cyan-950/20 border-cyan-500/30' : 'bg-orange-950/20 border-orange-500/30'}`}>
                                    {caseDetails?.userEvidence?.length > 0 ? (
                                        <ul className="space-y-3">
                                            {caseDetails.userEvidence.map((item, index) => (
                                                <li key={index} className="flex items-start gap-3 group">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 shrink-0 transition-all ${isDefense ? 'bg-cyan-500/20 border-cyan-500/40 group-hover:bg-cyan-500/30' : 'bg-orange-500/20 border-orange-500/40 group-hover:bg-orange-500/30'} border`}>
                                                        <Unlock size={12} className={isDefense ? 'text-cyan-400' : 'text-orange-400'} />
                                                    </div>
                                                    <div>
                                                        <p className={`text-sm font-medium ${isDefense ? 'text-cyan-200' : 'text-orange-200'}`}>{item}</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Exhibit {String.fromCharCode(65 + index)}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center py-8">
                                            <FolderOpen size={32} className="mx-auto text-slate-600 mb-2" />
                                            <p className="text-sm text-slate-500">No evidence available</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* OPPONENT EVIDENCE (Right Column) */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/50 flex items-center justify-center">
                                        <AlertTriangle size={20} className="text-red-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black text-red-400 uppercase tracking-wider">
                                            OPPOSITION DISCLOSURE
                                        </h3>
                                        <p className="text-[10px] text-slate-500">Evidence against you</p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/30 backdrop-blur-sm relative overflow-hidden">
                                    {/* CLASSIFIED Watermark */}
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 pointer-events-none">
                                        <span className="text-6xl font-black text-red-500/10 uppercase tracking-[0.3em]">
                                            CLASSIFIED
                                        </span>
                                    </div>

                                    {caseDetails?.opponentEvidence?.length > 0 ? (
                                        <ul className="space-y-3 relative z-10">
                                            {caseDetails.opponentEvidence.map((item, index) => (
                                                <li key={index} className="flex items-start gap-3 group">
                                                    <div className="w-6 h-6 rounded-lg bg-red-500/20 border border-red-500/40 flex items-center justify-center mt-0.5 shrink-0 group-hover:bg-red-500/30 transition-all">
                                                        <Lock size={12} className="text-red-400" />
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-medium text-red-200">{item}</p>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">Opposition Exhibit {index + 1}</p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <div className="text-center py-8 relative z-10">
                                            <Lock size={32} className="mx-auto text-slate-600 mb-2" />
                                            <p className="text-sm text-slate-500">No disclosed evidence</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ===================== TAB 3: WITNESS MANIFEST ===================== */}
                    {activeTab === 'witnesses' && (
                        <div className="animate-in fade-in duration-300">
                            <div className="flex items-center gap-3 mb-6">
                                <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                    <Users size={14} />
                                    WITNESS PERSONNEL FILE
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                    {caseDetails?.witnesses?.length || 0} REGISTERED
                                </span>
                            </div>

                            {caseDetails?.witnesses?.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {caseDetails.witnesses.map((witness, index) => {
                                        const affiliation = getAffiliationStyle(witness.affiliation);
                                        return (
                                            <div
                                                key={index}
                                                className="p-5 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm hover:border-slate-600 transition-all group"
                                            >
                                                {/* Affiliation Badge */}
                                                <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider mb-3 border ${affiliation.bg} ${affiliation.color}`}>
                                                    {witness.affiliation === 'User' && <Shield size={10} />}
                                                    {witness.affiliation === 'Opponent' && <Sword size={10} />}
                                                    {witness.affiliation === 'Neutral' && <Scale size={10} />}
                                                    {affiliation.label}
                                                </div>

                                                {/* Avatar & Name */}
                                                <div className="flex items-center gap-3 mb-3">
                                                    <div className="w-12 h-12 rounded-xl bg-slate-700/50 border border-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                                                        <User size={24} className="text-slate-400" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-white">{witness.name}</h4>
                                                        <p className="text-xs text-slate-400">{witness.role}</p>
                                                    </div>
                                                </div>

                                                {/* Personality Badge */}
                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${getPersonalityColor(witness.personality)}`}>
                                                    <Eye size={10} />
                                                    {witness.personality || 'Unknown'}
                                                </div>

                                                {/* Testified Status */}
                                                {witness.hasTestified && (
                                                    <div className="mt-3 flex items-center gap-1.5 text-[10px] text-emerald-400">
                                                        <CheckCircle size={12} />
                                                        <span>Has Testified</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-16">
                                    <Users size={48} className="mx-auto text-slate-700 mb-4" />
                                    <p className="text-slate-400 text-sm">No witnesses registered for this case.</p>
                                    <p className="text-slate-600 text-xs mt-1">Witness profiles will appear here when available.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-800/50 bg-slate-900/50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <Lock size={12} />
                        <span>CONFIDENTIAL CASE MATERIALS</span>
                    </div>
                    <button
                        onClick={onClose}
                        className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${isDefense ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/50' : 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/50'}`}
                    >
                        CLOSE DOSSIER
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EvidenceModal;
