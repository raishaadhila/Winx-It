import { type ReactNode } from 'react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { render, type RenderOptions } from '@testing-library/react';
import { AuthProvider } from '../contexts/AuthContext';
import { ProfileProvider } from '../contexts/ProfileContext';
import { ToastProvider } from '../contexts/ToastContext';

/**
 * Render with all the providers the app normally has.
 * Use this for page-level integration tests.
 */
export function renderWithProviders(
  ui: ReactNode,
  {
    initialEntries = ['/'],
    routes,
    ...rest
  }: { initialEntries?: string[]; routes?: ReactNode } & RenderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>
          <ProfileProvider>
            <ToastProvider>
              {routes ? <Routes>{routes}</Routes> : children}
            </ToastProvider>
          </ProfileProvider>
        </AuthProvider>
      </MemoryRouter>
    );
  }
  return render(ui, { wrapper: Wrapper, ...rest });
}
