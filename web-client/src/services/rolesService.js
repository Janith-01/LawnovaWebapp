import api from './api';

export const assignRole = async (sessionId, userId, role) => {
  const response = await api.post(`/api/sessions/${sessionId}/roles/assign`, {
    userId,
    role,
  });
  return response.data.data;
};

export default { assignRole };
