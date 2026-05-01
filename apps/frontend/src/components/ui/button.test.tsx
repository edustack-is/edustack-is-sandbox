import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
    it('renders with default variant', () => {
        render(<Button>Click me</Button>);
        const button = screen.getByRole('button', { name: /click me/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-primary');
    });

    it('renders with destructive variant', () => {
        render(<Button variant="destructive">Delete</Button>);
        const button = screen.getByRole('button', { name: /delete/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('bg-destructive');
    });

    it('renders with outline variant', () => {
        render(<Button variant="outline">Outline</Button>);
        const button = screen.getByRole('button', { name: /outline/i });
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('border-input');
    });

    it('renders with different sizes', () => {
        render(<Button size="sm">Small</Button>);
        const button = screen.getByRole('button', { name: /small/i });
        expect(button).toHaveClass('h-9');
    });

    it('is disabled when disabled prop is set', () => {
        render(<Button disabled>Disabled</Button>);
        const button = screen.getByRole('button', { name: /disabled/i });
        expect(button).toBeDisabled();
    });
});
