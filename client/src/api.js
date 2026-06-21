import { getApiBase } from './config';

function headers(token) {
  const h = { 
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function request(path, options = {}) {
  const res = await fetch(`${getApiBase()}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  register: (body) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body), headers: headers() }),
  login: (body) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body), headers: headers() }),
  me: (token) => request('/auth/me', { headers: headers(token) }),
  gameState: () => request('/game/state'),
  gameHistory: () => request('/game/history'),
  transactions: (token) => request('/transactions', { headers: headers(token) }),
  leaderboard: (period) => request(`/leaderboard?period=${period}`),
  avatars: () => request('/avatars'),
  updateProfile: (token, body) =>
    request('/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: headers(token),
    }),
  dailyReward: (token) =>
    request('/daily-reward', { method: 'POST', headers: headers(token) }),
  currencyRequest: (token, body) =>
    request('/currency/request', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: headers(token),
    }),
  currencyRequests: (token) =>
    request('/currency/requests', { headers: headers(token) }),
  depositInfo: (token) =>
    request('/currency/deposit-info', { headers: headers(token) }),
  referral: (token) => request('/referral', { headers: headers(token) }),
  chat: () => request('/chat'),
  supportMessages: (token) => request('/support/messages', { headers: headers(token) }),
  sendSupportMessage: (token, message) =>
    request('/support/messages', {
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: headers(token),
    }),
  adminSupportThreads: (token) => request('/admin/support/threads', { headers: headers(token) }),
  adminSupportMessages: (token, userId) =>
    request(`/admin/support/messages/${userId}`, { headers: headers(token) }),
  adminSendSupportMessage: (token, userId, message) =>
    request(`/admin/support/messages/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: headers(token),
    }),
  adminStats: (token) => request('/admin/stats', { headers: headers(token) }),
  adminUsers: (token) => request('/admin/users', { headers: headers(token) }),
  adminPatchUser: (token, id, body) =>
    request(`/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: headers(token),
    }),
  adminBalance: (token, id, body) =>
    request(`/admin/users/${id}/balance`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: headers(token),
    }),
  adminRequests: (token) => request('/admin/requests', { headers: headers(token) }),
  adminPatchRequest: (token, id, body) =>
    request(`/admin/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers: headers(token),
    }),
  adminReplyRequest: (token, id, message) =>
    request(`/admin/requests/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
      headers: headers(token),
    }),
  adminTransactions: (token) =>
    request('/admin/transactions', { headers: headers(token) }),
  adminSettings: (token) => request('/admin/settings', { headers: headers(token) }),
  adminPatchSettings: (token, settings) =>
    request('/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
      headers: headers(token),
    }),
  adminChat: (token) => request('/admin/chat', { headers: headers(token) }),
  adminDeleteChat: (token, id) =>
    request(`/admin/chat/${id}`, { method: 'DELETE', headers: headers(token) }),
  placeBet: (token, body) => 
    request('/game/bet', { method: 'POST', body: JSON.stringify(body), headers: headers(token) }),
  cashout: (token) => 
    request('/game/cashout', { method: 'POST', headers: headers(token) }),
};
