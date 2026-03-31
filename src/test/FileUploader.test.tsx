import { render, screen, fireEvent } from '@testing-library/react';
import FileUploader from '../components/FileUploader';
import { LanguageProvider } from '../i18n/LanguageContext';
import type { PersonData } from '../types';

function renderUploader(people: PersonData[] = [], onDataChange = vi.fn()) {
  return render(
    <LanguageProvider>
      <FileUploader people={people} onDataChange={onDataChange} />
    </LanguageProvider>,
  );
}

describe('FileUploader', () => {
  it('renders the drop zone', () => {
    renderUploader();
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
  });

  it('shows loaded count when people are present', () => {
    const people: PersonData[] = [
      { name: 'Alice', fileName: 'Alice.csv', rows: [{ date: new Date(), dateStr: '2026-01-01', hour: 10, kind: 'Included', model: 'auto', maxMode: false, inputWithCache: 0, inputWithoutCache: 0, cacheRead: 0, outputTokens: 0, totalTokens: 0 }], note: '' },
    ];
    renderUploader(people);
    expect(screen.getByText(/\(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('calls onDataChange when clear all is clicked', () => {
    const onChange = vi.fn();
    const people: PersonData[] = [
      { name: 'Bob', fileName: 'Bob.csv', rows: [{ date: new Date(), dateStr: '2026-01-01', hour: 10, kind: 'Included', model: 'auto', maxMode: false, inputWithCache: 0, inputWithoutCache: 0, cacheRead: 0, outputTokens: 0, totalTokens: 0 }], note: '' },
    ];
    renderUploader(people, onChange);
    fireEvent.click(screen.getByText(/clear all|очистить/i));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('calls onDataChange when a person is removed', () => {
    const onChange = vi.fn();
    const people: PersonData[] = [
      { name: 'Charlie', fileName: 'Charlie.csv', rows: [{ date: new Date(), dateStr: '2026-01-01', hour: 10, kind: 'Included', model: 'auto', maxMode: false, inputWithCache: 0, inputWithoutCache: 0, cacheRead: 0, outputTokens: 0, totalTokens: 0 }], note: '' },
    ];
    renderUploader(people, onChange);
    const removeBtn = screen.getByTitle(/remove developer|удалить разработчика/i);
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
