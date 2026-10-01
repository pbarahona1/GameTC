// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useState } from 'react';
import { ErrorBoundary } from '../src/ui/components/ErrorBoundary';
import { store } from '../src/ui/store';

let explode = true;
function Boom() {
  if (explode) throw new Error('falla de dibujo');
  return <p>contenido sano</p>;
}

afterEach(() => {
  cleanup();
  explode = true;
  store.setSpeed(0);
});

describe('Fase 1 · Error Boundary', () => {
  it('un error de React muestra una pantalla recuperable (no queda en blanco) y pausa el reloj', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    store.setSpeed(8);
    render(<ErrorBoundary scope="section"><Boom /></ErrorBoundary>);
    expect(screen.getByRole('alert').textContent).toContain('Esta pantalla no se pudo mostrar');
    expect(store.getSnapshot().speed).toBe(0);
    // Los detalles técnicos están disponibles pero plegados.
    expect(screen.getByText('Detalles técnicos')).toBeTruthy();
  });

  it('reintentar vuelve a dibujar la pantalla cuando el problema desapareció', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary scope="section"><Boom /></ErrorBoundary>);
    explode = false;
    fireEvent.click(screen.getByText('Reintentar'));
    expect(screen.getByText('contenido sano')).toBeTruthy();
  });

  it('un error en una sección no tumba al resto de la app', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Shell() {
      const [n] = useState(1);
      return (
        <div>
          <nav>barra {n}</nav>
          <ErrorBoundary scope="section"><Boom /></ErrorBoundary>
        </div>
      );
    }
    render(<ErrorBoundary scope="app"><Shell /></ErrorBoundary>);
    expect(screen.getByText('barra 1')).toBeTruthy();
    expect(screen.queryByText('La aplicación encontró un error')).toBeNull();
  });
});
