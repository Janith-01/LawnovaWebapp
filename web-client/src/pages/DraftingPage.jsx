import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileBadge2,
  FileCheck2,
  FileText,
  History,
  Loader2,
  ScrollText,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { useTheme } from '@/context/ThemeContext';
import { cn } from '@/lib/utils';
import draftingService from '@/services/draftingService';


const REFINEMENT_FIELD_METADATA = {
  AFFIDAVIT: {
    deponent_name: {
      label: 'Full name of the deponent',
      hint: 'e.g. Kamal Perera',
      appendLabel: 'Deponent Name',
    },
    deponent_nic: {
      label: 'NIC number',
      hint: 'e.g. 199034500123',
      appendLabel: 'NIC',
    },
    deponent_address: {
      label: 'Residential address',
      hint: 'e.g. 45 Galle Road, Colombo 03',
      appendLabel: 'Address',
    },
    statement_facts: {
      label: 'Facts being declared',
      hint: 'Describe what you are declaring',
      appendLabel: 'Statement Facts',
    },
    date: {
      label: 'Date of affidavit',
      hint: 'e.g. 2024-01-15',
      appendLabel: 'Date',
    },
    jurisdiction: {
      label: 'Jurisdiction',
      hint: 'e.g. Colombo',
      appendLabel: 'Jurisdiction',
    },
  },
  CONTRACT: {
    party_a: {
      label: 'First party name',
      hint: 'e.g. Nimal Fernando',
      appendLabel: 'Party A',
    },
    party_b: {
      label: 'Second party name',
      hint: 'e.g. Saman Builders Pvt Ltd',
      appendLabel: 'Party B',
    },
    contract_purpose: {
      label: 'Purpose of the contract',
      hint: 'e.g. construction of a house',
      appendLabel: 'Contract Purpose',
    },
    obligations_a: {
      label: 'First party obligations',
      hint: 'What the first party must do',
      appendLabel: 'Obligations of Party A',
    },
    obligations_b: {
      label: 'Second party obligations',
      hint: 'What the second party must do',
      appendLabel: 'Obligations of Party B',
    },
    payment_terms: {
      label: 'Payment terms',
      hint: 'e.g. Rs. 500,000 in 4 installments',
      appendLabel: 'Payment Terms',
    },
    start_date: {
      label: 'Start date',
      hint: 'e.g. 2024-03-01',
      appendLabel: 'Start Date',
    },
    end_date: {
      label: 'End date',
      hint: 'e.g. 2025-02-28',
      appendLabel: 'End Date',
    },
    jurisdiction: {
      label: 'Jurisdiction',
      hint: 'e.g. Colombo',
      appendLabel: 'Jurisdiction',
    },
  },
  PETITION: {
    petitioner_name: {
      label: 'Petitioner full name',
      hint: 'e.g. Kamal Perera',
      appendLabel: 'Petitioner',
    },
    petitioner_nic: {
      label: 'Petitioner NIC',
      hint: 'e.g. 197834512345',
      appendLabel: 'Petitioner NIC',
    },
    petitioner_address: {
      label: 'Petitioner address',
      hint: 'e.g. 12 Flower Road, Colombo 07',
      appendLabel: 'Petitioner Address',
    },
    respondent_name: {
      label: 'Respondent name',
      hint: 'e.g. Officer in Charge, Kollupitiya Police',
      appendLabel: 'Respondent',
    },
    court_name: {
      label: 'Court name',
      hint: 'e.g. Supreme Court of Sri Lanka',
      appendLabel: 'Court Name',
    },
    subject_matter: {
      label: 'Subject matter',
      hint: 'Brief description of the legal issue',
      appendLabel: 'Subject Matter',
    },
    relief_sought: {
      label: 'Relief sought',
      hint: 'What outcome you are requesting from court',
      appendLabel: 'Relief Sought',
    },
    date: {
      label: 'Date of petition',
      hint: 'e.g. 2024-02-15',
      appendLabel: 'Date',
    },
  },
};


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

const statusToneClasses = (isDarkMode, tone) => {
  if (tone === 'success') {
    return isDarkMode
      ? 'border-emerald-800/60 bg-emerald-900/20 text-emerald-200'
      : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  }

  if (tone === 'error') {
    return isDarkMode
      ? 'border-rose-800/60 bg-rose-900/20 text-rose-100'
      : 'border-rose-200 bg-rose-50 text-rose-800';
  }

  if (tone === 'info') {
    return isDarkMode
      ? 'border-blue-800/60 bg-blue-900/20 text-blue-100'
      : 'border-blue-200 bg-blue-50 text-blue-800';
  }

  return isDarkMode
    ? 'border-amber-800/60 bg-amber-900/20 text-amber-100'
    : 'border-amber-200 bg-amber-50 text-amber-800';
};


const getFeedbackConfig = (status) => {
  if (status === 'error') {
    return {
      title: 'Service error',
      tone: 'error',
    };
  }

  if (status === 'unknown_doc_type') {
    return {
      title: 'Document type not recognized',
      tone: 'info',
    };
  }

  return {
    title: 'Additional details required',
    tone: 'warning',
  };
};


const getRefinementFieldMetadata = (docType, field) =>
  REFINEMENT_FIELD_METADATA[docType]?.[field] || {
    label: field,
    hint: 'Provide this detail to continue.',
    appendLabel: field,
  };


const buildRefinedPrompt = (basePrompt, docType, missingFields, refinementValues) => {
  const appendedLines = missingFields
    .map((field) => {
      const value = refinementValues[field]?.trim();
      if (!value) {
        return null;
      }

      const metadata = getRefinementFieldMetadata(docType, field);
      const appendLabel = metadata.appendLabel || field;
      return `${appendLabel}: ${value}`;
    })
    .filter(Boolean);

  if (appendedLines.length === 0) {
    return basePrompt.trim();
  }

  return `${basePrompt.trim()}\n${appendedLines.join('\n')}`;
};


const formatFieldLabel = (docType, field) => {
  const metadata = getRefinementFieldMetadata(docType, field);
  if (metadata?.appendLabel) {
    return metadata.appendLabel;
  }

  return field
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};


const formatConfidenceLabel = (confidence) => {
  if (confidence === 'HIGH') return 'High';
  if (confidence === 'MEDIUM') return 'Medium';
  if (confidence === 'LOW') return 'Low';
  return confidence;
};


const confidenceBadgeClasses = (isDarkMode, confidence) => {
  if (confidence === 'HIGH') {
    return isDarkMode
      ? 'bg-emerald-900/40 text-emerald-200 border border-emerald-700/50'
      : 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  }

  if (confidence === 'MEDIUM') {
    return isDarkMode
      ? 'bg-amber-900/40 text-amber-200 border border-amber-700/50'
      : 'bg-amber-100 text-amber-700 border border-amber-200';
  }

  return isDarkMode
    ? 'bg-rose-900/40 text-rose-200 border border-rose-700/50'
    : 'bg-rose-100 text-rose-700 border border-rose-200';
};


const DraftingPage = () => {
  const { isDarkMode } = useTheme();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [selectedExampleKey, setSelectedExampleKey] = useState(null);
  const [downloadTarget, setDownloadTarget] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [draftResult, setDraftResult] = useState(null);
  const [refinementValues, setRefinementValues] = useState({});
  const textareaRef = useRef(null);

  const resetResults = () => {
    setValidationResult(null);
    setDraftResult(null);
  };

  const resetRefinement = () => {
    setRefinementValues({});
    setIsRefining(false);
  };

  const handleExampleClick = (example) => {
    setPrompt(example.prompt);
    setSelectedExampleKey(example.key);
    resetResults();
    resetRefinement();
    window.requestAnimationFrame(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      textareaRef.current?.focus();
    });
  };

  const handleGenerate = async () => {
    const normalizedPrompt = prompt.trim();
    if (!normalizedPrompt) {
      toast.error('Enter a drafting request before generating a document.');
      return;
    }

    setIsGenerating(true);
    resetResults();
    resetRefinement();

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

  const handleRefinementChange = (field, value) => {
    setRefinementValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCompleteGenerate = async () => {
    const missingFields = activeFeedback?.missing_fields || [];
    const hasAnyFilledValue = missingFields.some((field) => refinementValues[field]?.trim());

    if (!hasAnyFilledValue) {
      toast.error('Fill at least one missing field before continuing.');
      return;
    }

    const refinedPrompt = buildRefinedPrompt(prompt, activeFeedback?.doc_type, missingFields, refinementValues);

    setIsRefining(true);
    setDraftResult(null);

    const draft = await draftingService.draftDocument(refinedPrompt);
    setDraftResult(draft);

    if (draft.status === 'complete') {
      toast.success('Document generated successfully.');
      resetRefinement();
    } else if (draft.status === 'error') {
      toast.error(draft.message || 'Draft generation failed.');
    } else if (draft.status === 'unknown_doc_type') {
      toast.error('Document type could not be determined.');
    } else {
      toast.error(draft.message || 'More drafting details are required.');
    }

    setIsRefining(false);
  };

  const handleDownload = async (filename, type) => {
    if (!filename || downloadTarget) {
      return;
    }

    setDownloadTarget(type);
    const result = await draftingService.downloadDocument(filename, type);
    if (result.status === 'complete') {
      toast.success(result.message || `${type} download started.`);
    } else {
      toast.error(result.message || `Failed to download the ${type}.`);
    }
    setDownloadTarget(null);
  };

  const activeFeedback = draftResult && draftResult.status !== 'complete' ? draftResult : validationResult;
  const completedResult = draftResult?.status === 'complete' ? draftResult : null;
  const feedbackConfig = activeFeedback ? getFeedbackConfig(activeFeedback.status) : null;
  const refinementFields =
    activeFeedback?.status === 'incomplete' && activeFeedback?.missing_fields?.length > 0
      ? activeFeedback.missing_fields
      : [];
  const extractedFieldEntries = completedResult
    ? Object.entries(completedResult.extracted_fields || {}).filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
    : [];

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

      <div className="flex justify-end">
        <Link
          to="/history"
          className={cn(
            'inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
            isDarkMode ? 'bg-slate-800 text-slate-100 hover:bg-slate-700' : 'bg-white text-gray-900 hover:bg-gray-100',
            isDarkMode ? 'border border-slate-700' : 'border border-gray-200'
          )}
        >
          <History className="h-4 w-4" />
          View Draft History
        </Link>
      </div>

      {isGenerating && (
        <section
          className={cn(
            'rounded-3xl border p-5 sm:p-6',
            statusToneClasses(isDarkMode, 'info')
          )}
        >
          <div className="flex items-start gap-3">
            <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" />
            <div>
              <h2 className="text-base font-semibold">Generating your document, please wait...</h2>
              <p className="mt-1 text-sm leading-6">
                Lawnova is validating the prompt, drafting the document text, and preparing the DOCX and PDF outputs.
              </p>
            </div>
          </div>
        </section>
      )}

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
            <div className="flex items-center gap-3">
              {selectedExampleKey && (
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]',
                    isDarkMode ? 'bg-blue-900/50 text-blue-200' : 'bg-blue-100 text-blue-700'
                  )}
                >
                  Selected: {selectedExampleKey}
                </span>
              )}
              <span className={cn('text-xs font-medium', isDarkMode ? 'text-slate-500' : 'text-gray-400')}>
                {prompt.trim().length}/3000
              </span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => {
              setPrompt(event.target.value);
              setSelectedExampleKey(null);
              resetRefinement();
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
                  onClick={() => handleExampleClick(example)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition-all',
                    selectedExampleKey === example.key
                      ? isDarkMode
                        ? 'border-blue-500 bg-slate-900 ring-2 ring-blue-500/40'
                        : 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : isDarkMode
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
            <div className={cn('space-y-4 rounded-3xl border p-5 sm:p-6', statusToneClasses(isDarkMode, feedbackConfig?.tone || 'warning'))}>
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <h3 className="text-base font-semibold">{feedbackConfig?.title || 'Drafting feedback'}</h3>
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

              {refinementFields.length > 0 && (
                <div
                  className={cn(
                    'rounded-2xl border px-4 py-4',
                    isDarkMode ? 'border-slate-700 bg-slate-900/70 text-slate-100' : 'border-white/70 bg-white/80 text-gray-900'
                  )}
                >
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em]">Refine missing details</h4>
                    <p className={cn('mt-1 text-sm leading-6', isDarkMode ? 'text-slate-300' : 'text-gray-600')}>
                      Fill only the fields you have available. Empty inputs will be left out and the backend will keep showing only the remaining missing details.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {refinementFields.map((field) => {
                      const metadata = getRefinementFieldMetadata(activeFeedback?.doc_type, field);

                      return (
                        <label key={field} className="block space-y-2">
                          <span className="block text-sm font-semibold">{metadata.label}</span>
                          <input
                            type="text"
                            value={refinementValues[field] || ''}
                            onChange={(event) => handleRefinementChange(field, event.target.value)}
                            placeholder={metadata.hint}
                            className={cn(
                              'w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all',
                              isDarkMode
                                ? 'border-slate-600 bg-slate-950 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30'
                                : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                            )}
                          />
                          <span className={cn('block text-xs', isDarkMode ? 'text-slate-400' : 'text-gray-500')}>
                            {metadata.hint}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={handleCompleteGenerate}
                      disabled={isRefining}
                      className={cn(
                        'inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
                        isDarkMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      {isRefining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isRefining ? 'Completing...' : 'Complete & Generate'}
                    </button>
                  </div>
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
                <button
                  type="button"
                  disabled={!completedResult.docx_file || !!downloadTarget}
                  onClick={() => handleDownload(completedResult.docx_file, 'DOCX')}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
                    isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-white text-gray-900 hover:bg-gray-100'
                  )}
                >
                  {downloadTarget === 'DOCX' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloadTarget === 'DOCX' ? 'Preparing DOCX...' : 'Download DOCX'}
                </button>
                <button
                  type="button"
                  disabled={!completedResult.pdf_file || !!downloadTarget}
                  onClick={() => handleDownload(completedResult.pdf_file, 'PDF')}
                  className={cn(
                    'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60',
                    isDarkMode ? 'bg-slate-900 text-white hover:bg-slate-950' : 'bg-white text-gray-900 hover:bg-gray-100'
                  )}
                >
                  {downloadTarget === 'PDF' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloadTarget === 'PDF' ? 'Preparing PDF...' : 'Download PDF'}
                </button>
              </div>
            </div>

            <div
              className={cn(
                'w-full max-w-3xl rounded-3xl border p-5',
                isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-emerald-100 bg-white text-gray-900'
              )}
            >
              {extractedFieldEntries.length > 0 && (
                <div className="mb-5">
                  <div className="mb-3 flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">Extraction confidence</h3>
                  </div>
                  <div className="space-y-2">
                    {extractedFieldEntries.map(([field, value]) => {
                      const confidence = completedResult.confidence_scores?.[field] || 'LOW';
                      return (
                        <div
                          key={field}
                          className={cn(
                            'flex flex-col gap-2 rounded-2xl px-3 py-3 text-sm leading-6 sm:flex-row sm:items-center',
                            isDarkMode ? 'bg-slate-800' : 'bg-gray-50'
                          )}
                        >
                          <span
                            className={cn(
                              'inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.16em]',
                              confidenceBadgeClasses(isDarkMode, confidence)
                            )}
                          >
                            {formatConfidenceLabel(confidence)}
                          </span>
                          <span>
                            <span className="font-semibold">{formatFieldLabel(completedResult.doc_type, field)}:</span> {value}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
