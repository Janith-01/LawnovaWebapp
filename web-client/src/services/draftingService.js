import api from './api';


const EMPTY_RESPONSE = {
  status: 'error',
  message: 'An unexpected error occurred.',
  doc_type: null,
  language: null,
  missing_fields: [],
  docx_path: null,
  pdf_path: null,
  drafted_content: null,
  error: null,
};


const normalizeResponse = (payload = {}) => ({
  ...EMPTY_RESPONSE,
  ...payload,
  missing_fields: Array.isArray(payload?.missing_fields) ? payload.missing_fields : [],
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
};


export default draftingService;
