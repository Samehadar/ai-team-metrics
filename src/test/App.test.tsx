import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';
import { LanguageProvider } from '../i18n/LanguageContext';

function renderApp() {
  return render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the title', () => {
    renderApp();
    expect(screen.getByText('AI Team Metrics')).toBeInTheDocument();
  });

  it('shows upload prompt when no data is loaded', () => {
    renderApp();
    expect(screen.getByText(/upload csv or json files to start/i)).toBeInTheDocument();
  });

  it('renders the language toggle', () => {
    renderApp();
    expect(screen.getByText('EN')).toBeInTheDocument();
    expect(screen.getByText('RU')).toBeInTheDocument();
  });

  it('switches language when RU is clicked', () => {
    renderApp();
    fireEvent.click(screen.getByText('RU'));
    expect(screen.getByText('AI Team Metrics')).toBeInTheDocument();
    expect(screen.getByText(/загрузите/i)).toBeInTheDocument();
  });
});
