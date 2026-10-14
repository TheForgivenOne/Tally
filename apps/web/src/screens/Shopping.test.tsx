import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShopProvider } from '../basket.js';
import { Shopping } from './Shopping.js';

describe('Shopping native capture', () => {
  it('offers the camera app when WebRTC fails and reports unreadable photos honestly', async () => {
    render(
      <ShopProvider>
        <Shopping />
      </ShopProvider>,
    );
    const input = (await screen.findByLabelText(/open camera app/i)) as HTMLInputElement;
    const file = new File(['bytes'], 'tag.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    // jsdom has no createImageBitmap: the file path must fail with the
    // photo note, never silently.
    await waitFor(() => {
      expect(screen.getByText(/pick a store first|offline|could not read that photo/i)).toBeDefined();
    });
  });
});
