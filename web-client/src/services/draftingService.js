import api from './api';


const EMPTY_RESPONSE = {
  status: 'error',
  message: 'An unexpected error occurred.',
  doc_type: null,
  language: null,
  missing_fields: [],
  docx_path: null,
  docx_file: null,
  pdf_path: null,
  pdf_file: null,
  drafted_content: null,
  error: null,
};


const extractFilename = (filePath) => {
  if (!filePath) return null;
  const normalized = String(filePath).replace(/\\/g, '/');
  const segments = normalized.split('/');
  return segments[segments.length - 1] || null;
};


const normalizeResponse = (payload = {}) => ({
  ...EMPTY_RESPONSE,
  ...payload,
  missing_fields: Array.isArray(payload?.missing_fields) ? payload.missing_fields : [],
  docx_file: extractFilename(payload?.docx_path),
  pdf_file: extractFilename(payload?.pdf_path),
  error: payload?.error || null,
});


const normalizeError = (error, fallbackMessage) => {
  const payload = error?.response?.data;
  if (payload && typeof payload === 'object') {
    return normalizeResponse(payload);
  }

  return normalizeResponse({
    status: 'error',
    message: error?.message || fallbackMessage,
    error: {
      code: 'drafting_request_failed',
      details: payload || null,
    },
  });
};


const postPrompt = async (url, prompt, fallbackMessage) => {
  try {
    const response = await api.post(url, { prompt });
    return normalizeResponse(response.data);
  } catch (error) {
    return normalizeError(error, fallbackMessage);
  }
};


const triggerBrowserDownload = (blob, filename) => {
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(downloadUrl);
};


const parseBlobError = async (error, fallbackMessage) => {
  const payload = error?.response?.data;
  if (payload instanceof Blob) {
    try {
      const text = await payload.text();
      const parsed = JSON.parse(text);
      return normalizeResponse(parsed);
    } catch {
      return normalizeResponse({
        status: 'error',
        message: fallbackMessage,
        error: {
          code: 'drafting_download_failed',
          details: null,
        },
      });
    }
  }

  return normalizeError(error, fallbackMessage);
};


const draftingService = {
  draftDocument: async (prompt) =>
    postPrompt(
      '/api/drafting/draft',
      prompt,
      'Failed to generate the drafting output. Please try again.'
    ),

  validateDraftPrompt: async (prompt) =>
    postPrompt(
      '/api/drafting/validate',
      prompt,
      'Failed to validate the drafting prompt. Please try again.'
    ),

  downloadDocument: async (filename, type) => {
    const fallbackMessage = `Failed to download the ${type || 'document'}. Please try again.`;

    try {
      const response = await api.get('/api/drafting/download', {
        params: { file: filename },
        responseType: 'blob',
      });

      triggerBrowserDownload(response.data, filename);
      return normalizeResponse({
        status: 'complete',
        message: `${type || 'Document'} download started.`,
      });
    } catch (error) {
      return parseBlobError(error, fallbackMessage);
    }
  },
};


export default draftingService;
