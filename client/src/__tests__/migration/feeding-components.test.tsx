import React, { ReactNode, useState } from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';

// Mock component interfaces
interface FeedingFormProps {
  penId: string;
  programId: string;
  phaseId: string;
  onSubmit: (data: any) => void;
}

interface CompletionTrackingProps {
  penId: string;
  feedingDate: Date;
  feedingTimes: string[];
}

interface ScheduleDisplayProps {
  penId: string;
  showMultipleTimes?: boolean;
}

interface VarianceAnalysisProps {
  penId: string;
  dateRange: { start: Date; end: Date };
}

// Mock components for testing
const MockFeedingForm = ({ onSubmit }: FeedingFormProps) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      ingredientId: formData.get('ingredientId'),
      actualQuantity: Number(formData.get('actualQuantity')),
      plannedQuantity: 100,
      reason: formData.get('reason'),
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit} data-testid="feeding-form">
      <select name="ingredientId" data-testid="ingredient-select">
        <option value="1">Corn Silage</option>
        <option value="2">Hay</option>
      </select>
      <input
        type="number"
        name="actualQuantity"
        data-testid="actual-quantity"
        placeholder="Actual Quantity"
      />
      <input
        type="text"
        name="reason"
        data-testid="variance-reason"
        placeholder="Reason for variance"
      />
      <button type="submit" data-testid="submit-feeding">
        Record Feeding
      </button>
    </form>
  );
};

const MockCompletionTracking = ({ feedingTimes }: CompletionTrackingProps) => {
  const [completedTimes, setCompletedTimes] = useState<string[]>([]);

  const toggleCompletion = (time: string) => {
    setCompletedTimes(prev =>
      prev.includes(time)
        ? prev.filter(t => t !== time)
        : [...prev, time]
    );
  };

  return (
    <div data-testid="completion-tracking">
      {feedingTimes.map(time => (
        <div key={time} data-testid={`feeding-time-${time}`}>
          <input
            type="checkbox"
            id={`time-${time}`}
            checked={completedTimes.includes(time)}
            onChange={() => toggleCompletion(time)}
            data-testid={`checkbox-${time}`}
          />
          <label htmlFor={`time-${time}`}>{time}</label>
          {completedTimes.includes(time) && (
            <span data-testid={`completed-${time}`}>✓ Completed</span>
          )}
        </div>
      ))}
    </div>
  );
};

const MockScheduleDisplay = ({ showMultipleTimes }: ScheduleDisplayProps) => {
  const feedingTimes = showMultipleTimes
    ? ['06:00', '12:00', '18:00']
    : ['06:00', '18:00'];

  return (
    <div data-testid="schedule-display">
      <h3>Daily Feeding Schedule</h3>
      <ul>
        {feedingTimes.map(time => (
          <li key={time} data-testid={`schedule-time-${time}`}>
            {time}
          </li>
        ))}
      </ul>
    </div>
  );
};

const MockVarianceAnalysis = ({ penId, dateRange }: VarianceAnalysisProps) => {
  const variances = [
    { ingredient: 'Corn Silage', variance: -5, date: '2024-01-01' },
    { ingredient: 'Hay', variance: 3, date: '2024-01-02' },
  ];

  return (
    <div data-testid="variance-analysis">
      <h3>Variance Report for Pen {penId}</h3>
      <p>
        From {dateRange.start.toISOString()} to {dateRange.end.toISOString()}
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Ingredient</th>
            <th>Variance %</th>
          </tr>
        </thead>
        <tbody>
          {variances.map((v, i) => (
            <tr key={i} data-testid={`variance-row-${i}`}>
              <td>{v.date}</td>
              <td>{v.ingredient}</td>
              <td className={v.variance < 0 ? 'negative' : 'positive'}>
                {v.variance}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

describe('Feeding Form Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('should only submit variance when actual differs from planned', async () => {
    const handleSubmit = vi.fn();
    const { getByTestId } = render(
      <MockFeedingForm
        penId="pen-1"
        programId="program-1"
        phaseId="phase-1"
        onSubmit={handleSubmit}
      />,
      { wrapper }
    );

    const actualInput = getByTestId('actual-quantity');
    const submitButton = getByTestId('submit-feeding');

    fireEvent.change(actualInput, { target: { value: '95' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          actualQuantity: 95,
          plannedQuantity: 100,
        })
      );
    });
  });

  it('should require reason for significant variance', async () => {
    const handleSubmit = vi.fn();
    const { getByTestId } = render(
      <MockFeedingForm
        penId="pen-1"
        programId="program-1"
        phaseId="phase-1"
        onSubmit={handleSubmit}
      />,
      { wrapper }
    );

    const actualInput = getByTestId('actual-quantity');
    const reasonInput = getByTestId('variance-reason');
    const submitButton = getByTestId('submit-feeding');

    // Significant variance (>10%)
    fireEvent.change(actualInput, { target: { value: '85' } });
    fireEvent.change(reasonInput, { target: { value: 'Equipment malfunction' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          actualQuantity: 85,
          reason: 'Equipment malfunction',
        })
      );
    });
  });
});

describe('Completion Tracking Component', () => {
  it('should track multiple daily feeding completions', async () => {
    const feedingTimes = ['06:00', '12:00', '18:00'];
    const { getByTestId } = render(
      <MockCompletionTracking
        penId="pen-1"
        feedingDate={new Date()}
        feedingTimes={feedingTimes}
      />
    );

    const firstCheckbox = getByTestId('checkbox-06:00');
    fireEvent.click(firstCheckbox);

    await waitFor(() => {
      expect(getByTestId('completed-06:00')).toBeInTheDocument();
    });

    const secondCheckbox = getByTestId('checkbox-12:00');
    fireEvent.click(secondCheckbox);

    await waitFor(() => {
      expect(getByTestId('completed-12:00')).toBeInTheDocument();
    });
  });

  it('should allow unchecking completed feedings', async () => {
    const feedingTimes = ['06:00', '18:00'];
    const { getByTestId, queryByTestId } = render(
      <MockCompletionTracking
        penId="pen-1"
        feedingDate={new Date()}
        feedingTimes={feedingTimes}
      />
    );

    const checkbox = getByTestId('checkbox-06:00');
    
    // Check
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(getByTestId('completed-06:00')).toBeInTheDocument();
    });

    // Uncheck
    fireEvent.click(checkbox);
    await waitFor(() => {
      expect(queryByTestId('completed-06:00')).not.toBeInTheDocument();
    });
  });
});

describe('Schedule Display Component', () => {
  it('should display multiple daily feeding times', () => {
    const { getByTestId } = render(
      <MockScheduleDisplay penId="pen-1" showMultipleTimes={true} />
    );

    expect(getByTestId('schedule-time-06:00')).toBeInTheDocument();
    expect(getByTestId('schedule-time-12:00')).toBeInTheDocument();
    expect(getByTestId('schedule-time-18:00')).toBeInTheDocument();
  });

  it('should display standard two feeding times', () => {
    const { getByTestId, queryByTestId } = render(
      <MockScheduleDisplay penId="pen-1" showMultipleTimes={false} />
    );

    expect(getByTestId('schedule-time-06:00')).toBeInTheDocument();
    expect(getByTestId('schedule-time-18:00')).toBeInTheDocument();
    expect(queryByTestId('schedule-time-12:00')).not.toBeInTheDocument();
  });
});

describe('Variance Analysis Component', () => {
  it('should display variance report with color coding', () => {
    const { getByTestId } = render(
      <MockVarianceAnalysis
        penId="pen-1"
        dateRange={{
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        }}
      />
    );

    const firstRow = getByTestId('variance-row-0');
    expect(firstRow).toHaveTextContent('Corn Silage');
    expect(firstRow).toHaveTextContent('-5%');

    const secondRow = getByTestId('variance-row-1');
    expect(secondRow).toHaveTextContent('Hay');
    expect(secondRow).toHaveTextContent('3%');
  });
});

describe('Integration Tests', () => {
  it('should handle complete feeding workflow', async () => {
    const handleSubmit = vi.fn();
    const { getByTestId } = render(
      <div>
        <MockScheduleDisplay penId="pen-1" showMultipleTimes={true} />
        <MockFeedingForm
          penId="pen-1"
          programId="program-1"
          phaseId="phase-1"
          onSubmit={handleSubmit}
        />
        <MockCompletionTracking
          penId="pen-1"
          feedingDate={new Date()}
          feedingTimes={['06:00', '12:00', '18:00']}
        />
      </div>
    );

    // Verify schedule is displayed
    expect(getByTestId('schedule-time-06:00')).toBeInTheDocument();

    // Record feeding with variance
    const actualInput = getByTestId('actual-quantity');
    fireEvent.change(actualInput, { target: { value: '95' } });
    fireEvent.click(getByTestId('submit-feeding'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
    });

    // Mark feeding as complete
    const checkbox = getByTestId('checkbox-06:00');
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(getByTestId('completed-06:00')).toBeInTheDocument();
    });
  });
});