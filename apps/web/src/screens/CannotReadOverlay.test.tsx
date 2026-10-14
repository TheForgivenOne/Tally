import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CannotReadOverlay } from './CannotReadOverlay.js';

describe('CannotReadOverlay', () => {
  it('guides the camera to the barcode with retry', () => {
    const onRetry = vi.fn();
    render(<CannotReadOverlay onRetry={onRetry} onClose={() => undefined} />);
    expect(screen.getByRole('heading', { name: /can't read that/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /try again/i })).toBeDefined();
  });
});
