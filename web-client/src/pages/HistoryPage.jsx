import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileClock,
  FileText,
  Loader2,
  ScrollText,
} from 'lucide-react';
import { toast } from 'sonner';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import draftingService from '@/services/draftingService';
import historyService from '@/services/historyService';


const formatLanguage = (language) => (language === 'si' ? 'Sinhala' : 'English');


const formatDate = (value) => {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};


const HistoryPage = () => {
  const { isDarkMode } = useTheme();
  const [historyItems, setHistoryItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [expandedDocumentId, setExpandedDocumentId] = useState(null);
  const [documentDetails, setDocumentDetails] = useState({});
  const [loadingDocumentId, setLoadingDocumentId] = useState(null);
  const [downloadTarget, setDownloadTarget] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadHistory = async () => {
      setIsLoading(true);
      const response = await historyService.getHistory();
      if (!isMounted) {
        return;
      }

      if (response.status === 'complete') {
        setHistoryItems(response.history);
        setErrorMessage('');
      } else {
        setHistoryItems([]);
        setErrorMessage(response.message || 'Failed to load your drafting history.');
      }

      setIsLoading(false);
    };

    loadHistory();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleDocument = async (documentId) => {
    if (expandedDocumentId === documentId) {
      setExpandedDocumentId(null);
      return;
    }

    setExpandedDocumentId(documentId);

    if (documentDetails[documentId]) {
      return;
    }

    setLoadingDocumentId(documentId);
    const response = await historyService.getDocument(documentId);
    if (response.status === 'complete' && response.document?.id) {
      setDocumentDetails((current) => ({
        ...current,
        [documentId]: response.document,
      }));
    } else {
      toast.error(response.message || 'Failed to load the document details.');
    }
    setLoadingDocumentId(null);
  };

  const handleDownload = async (filename, type) => {
    if (!filename || downloadTarget) {
      return;
    }

    setDownloadTarget(`${type}-${filename}`);
    const response = await draftingService.downloadDocument(filename, type);
    if (response.status === 'complete') {
      toast.success(response.message || `${type} download started.`);
    } else {
      toast.error(response.message || `Failed to download the ${type}.`);
    }
    setDownloadTarget(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
                isDarkMode
                  ? 'from-indigo-600 to-blue-500 shadow-indigo-900/40'
                  : 'from-indigo-500 to-blue-400 shadow-indigo-200/80'
              )}
            >
              <FileClock className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={cn('text-2xl font-bold tracking-tight sm:text-3xl', isDarkMode ? 'text-white' : 'text-gray-900')}>
                Draft History
              </h1>
              <p className={cn('text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                Review, reopen, and download your previously generated drafting documents.
              </p>
            </div>
          </div>
          <div
            className={cn(
              'max-w-3xl rounded-2xl border px-4 py-3 text-sm leading-relaxed',
              isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-gray-200 bg-white text-gray-600'
            )}
          >
            Every completed draft is stored per user. Expand a record to view the drafted text, or download the DOCX and PDF files again through the gateway.
          </div>
        </div>

        <Link
          to="/drafts"
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all',
            isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          <ScrollText className="h-4 w-4" />
          Back to Drafting
        </Link>
      </div>

      {isLoading ? (
        <section
          className={cn(
            'rounded-3xl border p-8',
            isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-gray-200 bg-white text-gray-700'
          )}
        >
          <div className="flex items-center gap-3 text-sm font-medium">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading your document history...
          </div>
        </section>
      ) : errorMessage ? (
        <section
          className={cn(
            'rounded-3xl border p-6',
            isDarkMode ? 'border-rose-800/60 bg-rose-900/20 text-rose-100' : 'border-rose-200 bg-rose-50 text-rose-800'
          )}
        >
          <h2 className="text-base font-semibold">Unable to load history</h2>
          <p className="mt-2 text-sm leading-6">{errorMessage}</p>
        </section>
      ) : historyItems.length === 0 ? (
        <section
          className={cn(
            'rounded-3xl border p-8',
            isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-gray-200 bg-white text-gray-600'
          )}
        >
          <h2 className="text-base font-semibold">No drafts yet</h2>
          <p className="mt-2 text-sm leading-6">
            Generate your first affidavit, contract, or petition from the drafting assistant to start building your history.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {historyItems.map((item) => {
            const isExpanded = expandedDocumentId === item.id;
            const detail = documentDetails[item.id];
            const isDetailLoading = loadingDocumentId === item.id;

            return (
              <article
                key={item.id}
                className={cn(
                  'rounded-3xl border p-5 sm:p-6',
                  isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'
                )}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                          isDarkMode ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-100 text-blue-700'
                        )}
                      >
                        {item.doc_type || 'Unknown'}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                          isDarkMode ? 'bg-emerald-900/40 text-emerald-200' : 'bg-emerald-100 text-emerald-700'
                        )}
                      >
                        {formatLanguage(item.language)}
                      </span>
                    </div>

                    <div>
                      <h2 className={cn('text-base font-semibold', isDarkMode ? 'text-white' : 'text-gray-900')}>
                        Generated {formatDate(item.created_at)}
                      </h2>
                      <p className={cn('mt-1 text-sm leading-6', isDarkMode ? 'text-slate-400' : 'text-gray-600')}>
                        {item.prompt}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={!item.docx_filename || !!downloadTarget}
                      onClick={() => handleDownload(item.docx_filename, 'DOCX')}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
                        isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      )}
                    >
                      {downloadTarget === `DOCX-${item.docx_filename}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      DOCX
                    </button>
                    <button
                      type="button"
                      disabled={!item.pdf_filename || !!downloadTarget}
                      onClick={() => handleDownload(item.pdf_filename, 'PDF')}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
                        isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      )}
                    >
                      {downloadTarget === `PDF-${item.pdf_filename}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleDocument(item.id)}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                        isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      {isExpanded ? 'Hide Draft' : 'View Draft'}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    className={cn(
                      'mt-5 rounded-3xl border p-5',
                      isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-gray-200 bg-gray-50 text-gray-900'
                    )}
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Draft content</h3>
                    </div>
                    {isDetailLoading ? (
                      <div className="flex items-center gap-3 text-sm font-medium">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading document details...
                      </div>
                    ) : (
                      <div className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-6">
                        {detail?.drafted_content || 'Drafted content is not available for this document.'}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
};


export default HistoryPage;
