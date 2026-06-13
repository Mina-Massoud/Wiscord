import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FocusingNowList } from './FocusingNowList';

describe('FocusingNowList', () => {
  it('renders the honest empty state instead of fabricated focus rooms', () => {
    render(<FocusingNowList />);
    expect(screen.getByText('Focusing now')).toBeInTheDocument();
    expect(screen.getByText(/Friends in focus sessions will show up here/i)).toBeInTheDocument();
    // No fake room rows leak through.
    expect(screen.queryByText(/focusing,/i)).not.toBeInTheDocument();
  });
});
