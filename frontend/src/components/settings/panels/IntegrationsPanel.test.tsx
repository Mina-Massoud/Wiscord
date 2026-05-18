import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { Integration } from '@/types/integration';
import { useIntegrationPrefs } from '@/lib/integration-prefs-store';

function renderPanel(): void {
  render(
    <TooltipProvider>
      <IntegrationsPanel />
    </TooltipProvider>,
  );
}

// vi.mock factories are hoisted above the imports, so any captured refs
// must come from vi.hoisted() — otherwise we hit "cannot access X before
// initialization".
const mocks = vi.hoisted(() => ({
  useIntegrationsMock: vi.fn(),
  useStartIntegrationConnectMock: vi.fn(),
  useDisconnectIntegrationMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock('@/queries/integrations', () => ({
  useIntegrations: () => mocks.useIntegrationsMock(),
  useStartIntegrationConnect: () => mocks.useStartIntegrationConnectMock(),
  useDisconnectIntegration: () => mocks.useDisconnectIntegrationMock(),
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
    loading: vi.fn(),
  },
}));

import { IntegrationsPanel } from './IntegrationsPanel';

const { useIntegrationsMock, useStartIntegrationConnectMock, useDisconnectIntegrationMock } = mocks;

function noopMutation() {
  return { isPending: false, variables: undefined, mutateAsync: vi.fn(), mutate: vi.fn() };
}

function resetPrefs() {
  useIntegrationPrefs.setState({
    prefs: {
      spotify: { showOnProfile: false, showAsStatus: true },
      google: { showOnProfile: false, showAsStatus: true },
    },
  });
}

describe('IntegrationsPanel', () => {
  beforeEach(() => {
    useStartIntegrationConnectMock.mockReturnValue(noopMutation());
    useDisconnectIntegrationMock.mockReturnValue(noopMutation());
    resetPrefs();
    // jsdom defaults to about:blank — give us a clean URL to start
    window.history.replaceState({}, '', '/app');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders the Connections title', () => {
    useIntegrationsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByRole('heading', { name: 'Connections' })).toBeInTheDocument();
  });

  test('renders a tile for each provider when none are connected', () => {
    useIntegrationsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();
    expect(screen.getByRole('button', { name: /add youtube music/i })).toBeInTheDocument();
    // Spotify is gated behind comingSoon until the dashboard owner has Premium
    expect(screen.getByRole('button', { name: /spotify \(soon\)/i })).toBeInTheDocument();
  });

  test('clicking a coming-soon tile fires an info toast instead of starting OAuth', async () => {
    const user = userEvent.setup();
    const startMutate = vi.fn();
    useStartIntegrationConnectMock.mockReturnValue({
      isPending: false,
      variables: undefined,
      mutateAsync: startMutate,
      mutate: vi.fn(),
    });
    useIntegrationsMock.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();

    await user.click(screen.getByRole('button', { name: /spotify \(soon\)/i }));

    expect(mocks.toastInfo).toHaveBeenCalledOnce();
    expect(startMutate).not.toHaveBeenCalled();
  });

  test('renders connected account card with handle, disconnect, and toggles', () => {
    const connection: Integration = {
      id: 'int_1',
      provider: 'google',
      providerHandle: 'mina@example.com',
      scopes: ['music.readonly'],
      connectedAt: new Date(Date.now() - 60_000).toISOString(),
      lastRefreshedAt: null,
    };
    useIntegrationsMock.mockReturnValue({
      data: [connection],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();

    expect(screen.getByText('mina@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /disconnect youtube music/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Display on profile')).toBeInTheDocument();
    expect(screen.getByLabelText('Display YouTube Music as your status')).toBeInTheDocument();
  });

  test('connected provider is removed from the add-account tile grid', () => {
    const connection: Integration = {
      id: 'int_1',
      provider: 'google',
      providerHandle: 'mina@example.com',
      scopes: [],
      connectedAt: new Date().toISOString(),
      lastRefreshedAt: null,
    };
    useIntegrationsMock.mockReturnValue({
      data: [connection],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();

    expect(screen.queryByRole('button', { name: /add youtube music/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /spotify \(soon\)/i })).toBeInTheDocument();
  });

  test('toggling "Display on profile" writes to the prefs store', async () => {
    const user = userEvent.setup();
    const connection: Integration = {
      id: 'int_1',
      provider: 'google',
      providerHandle: 'mina@example.com',
      scopes: [],
      connectedAt: new Date().toISOString(),
      lastRefreshedAt: null,
    };
    useIntegrationsMock.mockReturnValue({
      data: [connection],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
    renderPanel();

    expect(useIntegrationPrefs.getState().prefs.google.showOnProfile).toBe(false);
    await user.click(screen.getByLabelText('Display on profile'));
    expect(useIntegrationPrefs.getState().prefs.google.showOnProfile).toBe(true);
  });

  test('renders retry button on error', () => {
    const refetch = vi.fn();
    useIntegrationsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
      refetch,
    });
    renderPanel();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  // OAuth round-trip URL handling moved to IntegrationsReturnHandler (app
  // root) so the toast fires even when Settings is closed. Tests for that
  // behavior live with the handler, not here.
});
