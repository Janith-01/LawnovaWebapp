import api from './api';


const EMPTY_DOCUMENT = {
  id: null,
  user_id: null,
  doc_type: null,
  language: null,
  prompt: null,
  drafted_content: null,
  docx_filename: null,
  pdf_filename: null,
  created_at: null,
};


const EMPTY_RESPONSE = {
  status: 'error',
  message: 'An unexpected error occurred.',
  history: [],
  document: EMPTY_DOCUMENT,
  error: null,
};


const normalizeDocument = (payload = {}) => ({
  ...EMPTY_DOCUMENT,
  ...payload,
});


const normalizeResponse = (payload = {}) => ({
  ...EMPTY_RESPONSE,
  ...payload,
  history: Array.isArray(payload?.history) ? payload.history.map(normalizeDocument) : [],
  document: payload?.document ? normalizeDocument(payload.document) : EMPTY_DOCUMENT,
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
      code: 'history_request_failed',
      details: payload || null,
    },
  });
};


const historyService = {
  getHistory: async () => {
    try {
      const response = await api.get('/api/drafting/history');
      return normalizeResponse(response.data);
    } catch (error) {
      return normalizeError(error, 'Failed to load drafting history. Please try again.');
    }
  },

  getDocument: async (id) => {
    try {
      const response = await api.get(`/api/drafting/history/${id}`);
      return normalizeResponse(response.data);
    } catch (error) {
      return normalizeError(error, 'Failed to load the document details. Please try again.');
    }
  },
};


export default historyService;
