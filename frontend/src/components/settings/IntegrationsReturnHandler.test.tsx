import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/settings-store', () => ({
  useSettingsStore: (selector: (s: unknown) => unknown) => selector({ open: mocks.open }),
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: vi.fn(),
    loading: vi.fn(),
  },
}));

import { IntegrationsReturnHandler } from './IntegrationsReturnHandler';

function renderAt(url: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <IntegrationsReturnHandler />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('IntegrationsReturnHandler', () => {
  beforeEach(() => {
    mocks.open.mockClear();
    mocks.toastSuccess.mockClear();
    mocks.toastError.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('opens settings + fires success toast on ?connected=spotify', () => {
    renderAt('/app?settings=integrations&connected=spotify');
    expect(mocks.open).toHaveBeenCalledWith('integrations');
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess.mock.calls[0]![0]).toMatch(/Spotify/);
  });

  test('opens settings + fires success toast on ?connected=google with YouTube Music name', () => {
    renderAt('/app?settings=integrations&connected=google');
    expect(mocks.open).toHaveBeenCalledWith('integrations');
    expect(mocks.toastSuccess.mock.calls[0]![0]).toMatch(/YouTube Music/);
  });

  test('opens settings + fires error toast on ?error=oauth_exchange_failed', () => {
    renderAt('/app?settings=integrations&error=oauth_exchange_failed');
    expect(mocks.open).toHaveBeenCalledWith('integrations');
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
  });

  test('does nothing when settings param is missing', () => {
    renderAt('/app?connected=spotify');
    expect(mocks.open).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  test('does nothing when neither connected nor error is present', () => {
    renderAt('/app?settings=integrations');
    expect(mocks.open).not.toHaveBeenCalled();
  });

  test('uses fallback copy for unknown error codes', () => {
    renderAt('/app?settings=integrations&error=something_weird');
    expect(mocks.toastError).toHaveBeenCalledTimes(1);
    expect(mocks.toastError.mock.calls[0]![0]).toMatch(/sideways|again/i);
  });
});
