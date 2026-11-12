import { api } from '../api';
beforeEach(() => {
  global.fetch = jest.fn();
});
test('sends credentials and JSON bodies to same-origin endpoints', async () => {
  jest.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ user: { id: 'u' } }),
  } as Response);
  await api.login({ email: 'demo@example.test', password: 'example password' });
  expect(fetch).toHaveBeenCalledWith(
    '/api/auth/login',
    expect.objectContaining({
      credentials: 'same-origin',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }),
  );
});
test('surfaces server error messages', async () => {
  jest.mocked(fetch).mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({ error: 'Enter a title.' }),
  } as Response);
  await expect(api.createNote({ title: '', content: '' })).rejects.toThrow(
    'Enter a title.',
  );
});
test('handles successful empty logout responses', async () => {
  jest.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);
  await expect(api.logout()).resolves.toBeUndefined();
});
