import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileBadge2,
  FileCheck2,
  FileText,
  Loader2,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import draftingService from '@/services/draftingService';


const EXAMPLE_PROMPTS = [
  {
    key: 'AFFIDAVIT',
    title: 'Affidavit',
    accent: 'from-blue-500 to-cyan-500',
    prompt:
      'I, Kamal Perera, holding NIC 199034500123, residing at 45 Galle Road, Colombo 03, wish to make an affidavit declaring that the property at 12 Temple Road, Nugegoda belongs to me. Date: 2024-01-15. Jurisdiction: Colombo.',
  },
  {
    key: 'CONTRACT',
    title: 'Contract',
    accent: 'from-emerald-500 to-teal-500',
    prompt:
      'This contract is between ABC Private Limited and Nimal Silva for the provision of consulting services. Party A shall provide office space and project materials. Party B shall deliver consulting services and monthly reports. Payment Terms: Rs. 250,000 payable in two installments. Start Date: 2024-02-01. End Date: 2024-08-01. Jurisdiction: Colombo, Sri Lanka.',
  },
  {
    key: 'PETITION',
    title: 'Petition',
    accent: 'from-violet-500 to-fuchsia-500',
    prompt:
      'This petition is filed before the District Court of Kandy. Petitioner: Sunethra Jayasinghe, NIC 887654321V, Address: 12 Main Street, Kandy. Respondent: Registrar of Lands. Subject Matter: unlawful refusal to register a deed. Relief Sought: an order directing the registration of the deed. Date: 2024-03-20.',
  },
];


const toFileHref = (filePath) => {
  if (!filePath) return '#';

  const normalized = String(filePath).replace(/\\/g, '/');
  if (/^[A-Za-z]:\//.test(normalized)) {
    return encodeURI(`file:///${normalized}`);
  }

  return encodeURI(normalized);
};


const statusToneClasses = (isDarkMode, tone) => {
  if (tone === 'success') {
    return isDarkMode
      ? 'border-emerald-800/60 bg-emerald-900/20 text-emerald-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  return isDarkMode
    ? 'border-amber-800/60 bg-amber-900/20 text-amber-100'
    : 'border-amber-200 bg-amber-50 text-amber-800';
};


const DraftingPage = () => {
  const { isDarkMode } = useTheme();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [draftResult, setDraftResult] = useState(null);

  const resetResults = () => {
    setValidationResult(null);
    setDraftResult(null);
  };

  const handleExampleClick = (examplePrompt) => {
    setPrompt(examplePrompt);
    resetResults();
  };

  const handleGenerate = async () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      toast.error('Enter a drafting request before generating a document.');
      return;
    }

    setIsGenerating(true);
    resetResults();

    const validation = await draftingService.validateDraftPrompt(normalizedPrompt);
    setValidationResult(validation);

    if (validation.status !== 'complete') {
      if (validation.status === 'error') {
        toast.error(validation.message || 'Validation failed.');
      } else if (validation.status === 'unknown_doc_type') {
        toast.error('Document type could not be determined.');
      } else {
        toast.error('More drafting details are required.');
      }
      setIsGenerating(false);
      return;
    }

    const draft = await draftingService.draftDocument(normalizedPrompt);
    setDraftResult(draft);

    if (draft.status === 'complete') {
      toast.success('Document generated successfully.');
    } else if (draft.status === 'error') {
      toast.error(draft.message || 'Draft generation failed.');
    } else {
      toast.error(draft.message || 'Unable to complete document generation.');
    }

    setIsGenerating(false);
  };

  const activeFeedback = draftResult && draftResult.status !== 'complete' ? draftResult : validationResult;
  const completedResult = draftResult?.status === 'complete' ? draftResult : null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg',
                isDarkMode
                  ? 'from-blue-600 to-sky-500 shadow-blue-900/40'
                  : 'from-blue-500 to-sky-400 shadow-blue-200/80'
              )}
            >
              <ScrollText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className={cn('text-2xl font-bold tracking-tight sm:text-3xl', isDarkMode ? 'text-white' : 'text-gray-900')}>
                Drafting Assistant
              </h1>
              <p className={cn('text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                Generate bilingual Sri Lankan legal drafts for affidavits, contracts, and petitions.
              </p>
            </div>
          </div>
          <div
            className={cn(
              'max-w-3xl rounded-2xl border px-4 py-3 text-sm leading-relaxed',
              isDarkMode ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-gray-200 bg-white text-gray-600'
            )}
          >
            Describe the legal document in natural language. The service will validate the prompt first, then generate DOCX and PDF outputs when all required details are present.
          </div>
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
            isDarkMode
              ? 'bg-blue-600 text-white hover:bg-blue-500'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          )}
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isGenerating ? 'Generating...' : 'Generate Document'}
        </button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section
          className={cn(
            'rounded-3xl border p-5 sm:p-6',
            isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className={cn('text-lg font-semibold', isDarkMode ? 'text-white' : 'text-gray-900')}>
                Describe the document
              </h2>
              <p className={cn('text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                Include names, NIC numbers, addresses, dates, jurisdiction, and the core legal facts.
              </p>
            </div>
            <span className={cn('text-xs font-medium', isDarkMode ? 'text-slate-500' : 'text-gray-400')}>
              {prompt.trim().length}/3000
            </span>
          </div>

          <textarea
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (validationResult || draftResult) {
                resetResults();
              }
            }}
            placeholder="Type your affidavit, contract, or petition request here..."
            className={cn(
              'min-h-[280px] w-full resize-none rounded-2xl border p-4 text-sm leading-6 outline-none transition-all',
              isDarkMode
                ? 'border-slate-600 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30'
                : 'border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
            )}
          />
        </section>

        <section className="space-y-6">
          <div
            className={cn(
              'rounded-3xl border p-5 sm:p-6',
              isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-white'
            )}
          >
            <div className="mb-4">
              <h2 className={cn('text-lg font-semibold', isDarkMode ? 'text-white' : 'text-gray-900')}>
                Example prompts
              </h2>
              <p className={cn('text-sm', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                Click an example to auto-fill the drafting prompt.
              </p>
            </div>

            <div className="space-y-3">
              {EXAMPLE_PROMPTS.map((example) => (
                <button
                  key={example.key}
                  type="button"
                  onClick={() => handleExampleClick(example.prompt)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    isDarkMode
                      ? 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-900/70'
                      : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-white'
                  )}
                >
                  <div className="mb-2 flex items-center gap-3">
                    <div className={cn('h-9 w-9 rounded-xl bg-gradient-to-br', example.accent)} />
                    <div>
                      <div className={cn('text-sm font-semibold', isDarkMode ? 'text-white' : 'text-gray-900')}>
                        {example.title}
                      </div>
                      <div className={cn('text-xs uppercase tracking-[0.18em]', isDarkMode ? 'text-slate-500' : 'text-gray-400')}>
                        {example.key}
                      </div>
                    </div>
                  </div>
                  <p className={cn('line-clamp-4 text-sm leading-6', isDarkMode ? 'text-slate-400' : 'text-gray-600')}>
                    {example.prompt}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {activeFeedback && activeFeedback.status !== 'complete' && (
            <div className={cn('rounded-3xl border p-5 sm:p-6', statusToneClasses(isDarkMode, activeFeedback.status === 'error' ? 'warning' : 'warning'))}>
              <div className="mb-3 flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold">Validation feedback</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{activeFeedback.message}</p>
                </div>
              </div>

              {activeFeedback.missing_fields?.length > 0 && (
                <div className="mt-4 rounded-2xl bg-black/5 px-4 py-3 text-sm">
                  <div className="mb-2 font-semibold">Missing fields</div>
                  <ul className="list-disc space-y-1 pl-5">
                    {activeFeedback.missing_fields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {completedResult && (
        <section
          className={cn(
            'rounded-3xl border p-5 sm:p-6',
            statusToneClasses(isDarkMode, 'success')
          )}
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold">Document generated</h2>
                  <p className="mt-1 text-sm leading-6">{completedResult.message}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  <FileBadge2 className="h-3.5 w-3.5" />
                  {completedResult.doc_type}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
                  <FileCheck2 className="h-3.5 w-3.5" />
                  {completedResult.language === 'si' ? 'Sinhala' : 'English'}
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <a
                  href={toFileHref(completedResult.docx_path)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                    isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-white text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <Download className="h-4 w-4" />
                  Download DOCX
                </a>
                <a
                  href={toFileHref(completedResult.pdf_path)}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                    isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-white text-gray-900 hover:bg-gray-100'
                  )}
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </a>
              </div>

              <div className="space-y-2 text-xs">
                <div className={cn('font-semibold uppercase tracking-[0.18em]', isDarkMode ? 'text-slate-300' : 'text-gray-700')}>
                  Generated files
                </div>
                <div className={cn('break-all rounded-2xl bg-black/5 px-3 py-2', isDarkMode ? 'text-slate-300' : 'text-gray-700')}>
                  DOCX: {completedResult.docx_path}
                </div>
                <div className={cn('break-all rounded-2xl bg-black/5 px-3 py-2', isDarkMode ? 'text-slate-300' : 'text-gray-700')}>
                  PDF: {completedResult.pdf_path}
                </div>
              </div>
            </div>

            <div
              className={cn(
                'w-full max-w-3xl rounded-3xl border p-5',
                isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-emerald-100 bg-white text-gray-900'
              )}
            >
              <div className="mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Draft preview</h3>
              </div>
              <div className="max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-6">
                {completedResult.drafted_content}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};


export default DraftingPage;
