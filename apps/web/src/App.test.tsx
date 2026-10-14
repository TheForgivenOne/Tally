import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.js';

describe('App', () => {
  it('starts on the home screen', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /tally/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /start shopping/i })).toBeDefined();
  });
});
