import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockPen } from '../../test/test-utils';
import { VarianceAnalysisInterface } from './variance-analysis-interface';

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock API hooks
vi.mock('../../hooks/use-variance-analysis', () => ({
  useVarianceRecords: vi.fn(),
  useVarianceSummary: vi.fn(),
}));

vi.mock('../../hooks/use-pen-feeding-programs', () => ({
  usePenFeedingPrograms: vi.fn(),
}));

const mockUseVarianceRecords = vi.hoisted(() => vi.fn());
const mockUseVarianceSummary = vi.hoisted(() => vi.fn());
const mockUsePenFeedingPrograms = vi.hoisted(() => vi.fn());

describe('VarianceAnalysisInterface', () => {
  const user = userEvent.setup();
  
  const mockVarianceData = [
    {
      id: 'variance-123',
      date: '2024-01-15',
      feedingTime: '06:00',
      ingredientName: 'Corn Silage',
      plannedAmount: 100,
      actualAmount: 95,
      variance: -5,
      variancePercent: -5.0,
    },
    {
      id: 'variance-456',
      date: '2024-01-15',
      feedingTime: '17:00',
      ingredientName: 'Corn Silage',
      plannedAmount: 100,
      actualAmount: 110,
      variance: 10,
      variancePercent: 10.0,
    },
  ];
  
  const mockSummaryData = {
    totalVarianceRecords: 25,
    averageVariancePercent: 2.5,
    mostVariedIngredient: 'Corn Silage',
    leastVariedIngredient: 'Alfalfa Hay',
    adherenceRate: 92.5,
  };
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseVarianceRecords.mockReturnValue({
      data: mockVarianceData,
      isLoading: false,
      error: null,
    });
    
    mockUseVarianceSummary.mockReturnValue({
      data: mockSummaryData,
      isLoading: false,
      error: null,
    });
    
    mockUsePenFeedingPrograms.mockReturnValue({
      data: [
        {
          id: 'program-123',
          penId: 'pen-123',
          programName: 'Feedlot Program A-1',
          status: 'active',
        },
      ],
      isLoading: false,
      error: null,
    });
  });

  it('should render variance analysis interface', () => {
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByText('Variance Analysis')).toBeInTheDocument();
    expect(screen.getByText('Feeding Program Performance Analysis')).toBeInTheDocument();
  });

  it('should display variance summary statistics', () => {
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByText('25 Records')).toBeInTheDocument();
    expect(screen.getByText('2.5% Avg Variance')).toBeInTheDocument();
    expect(screen.getByText('92.5% Adherence')).toBeInTheDocument();
    expect(screen.getByText('Most Varied: Corn Silage')).toBeInTheDocument();
    expect(screen.getByText('Least Varied: Alfalfa Hay')).toBeInTheDocument();
  });

  it('should filter variance data by date range', async () => {
    render(<VarianceAnalysisInterface />);
    
    const startDateInput = screen.getByLabelText(/start date/i);
    const endDateInput = screen.getByLabelText(/end date/i);
    
    await user.type(startDateInput, '2024-01-01');
    await user.type(endDateInput, '2024-01-31');
    
    const applyFilterButton = screen.getByRole('button', { name: /apply filter/i });
    await user.click(applyFilterButton);
    
    expect(mockUseVarianceRecords).toHaveBeenCalledWith({
      startDate: '2024-01-01',
      endDate: '2024-01-31',
    });
  });

  it('should filter by pen and feeding program', async () => {
    render(<VarianceAnalysisInterface />);
    
    const penSelect = screen.getByLabelText(/select pen/i);
    await user.selectOptions(penSelect, 'pen-123');
    
    const programSelect = screen.getByLabelText(/select program/i);
    await user.selectOptions(programSelect, 'program-123');
    
    const applyFilterButton = screen.getByRole('button', { name: /apply filter/i });
    await user.click(applyFilterButton);
    
    expect(mockUseVarianceRecords).toHaveBeenCalledWith({
      penId: 'pen-123',
      programId: 'program-123',
    });
  });

  it('should display variance data table', () => {
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
    expect(screen.getByText('Ingredient')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('Variance')).toBeInTheDocument();
    
    expect(screen.getByText('01/15/2024')).toBeInTheDocument();
    expect(screen.getByText('06:00')).toBeInTheDocument();
    expect(screen.getByText('Corn Silage')).toBeInTheDocument();
    expect(screen.getByText('100 lbs')).toBeInTheDocument();
    expect(screen.getByText('95 lbs')).toBeInTheDocument();
    expect(screen.getByText('-5 lbs (-5.0%)')).toBeInTheDocument();
  });

  it('should sort variance table by different columns', async () => {
    render(<VarianceAnalysisInterface />);
    
    const varianceHeader = screen.getByRole('button', { name: /sort by variance/i });
    await user.click(varianceHeader);
    
    // Should sort by variance ascending
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('-5 lbs');
    expect(rows[2]).toHaveTextContent('10 lbs');
    
    // Click again for descending
    await user.click(varianceHeader);
    expect(rows[1]).toHaveTextContent('10 lbs');
    expect(rows[2]).toHaveTextContent('-5 lbs');
  });

  it('should display variance charts', () => {
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should switch between chart types', async () => {
    render(<VarianceAnalysisInterface />);
    
    const chartTypeSelect = screen.getByLabelText(/chart type/i);
    await user.selectOptions(chartTypeSelect, 'line');
    
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    
    await user.selectOptions(chartTypeSelect, 'bar');
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('should export variance data', async () => {
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => 'mock-url');
    global.URL.revokeObjectURL = vi.fn();
    
    // Mock link click
    const mockLink = {
      click: vi.fn(),
      download: '',
      href: '',
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any);
    
    render(<VarianceAnalysisInterface />);
    
    const exportButton = screen.getByRole('button', { name: /export data/i });
    await user.click(exportButton);
    
    expect(document.createElement).toHaveBeenCalledWith('a');
    expect(mockLink.click).toHaveBeenCalled();
  });

  it('should show variance trends over time', () => {
    const trendData = [
      { date: '2024-01-01', avgVariance: 2.1 },
      { date: '2024-01-02', avgVariance: 3.5 },
      { date: '2024-01-03', avgVariance: 1.8 },
    ];
    
    mockUseVarianceRecords.mockReturnValue({
      data: trendData,
      isLoading: false,
      error: null,
    });
    
    render(<VarianceAnalysisInterface viewType="trends" />);
    
    expect(screen.getByText('Variance Trends')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('should highlight concerning variance patterns', () => {
    const concerningData = [
      {
        ...mockVarianceData[0],
        variancePercent: -15.0, // High negative variance
        isConcerning: true,
      },
      {
        ...mockVarianceData[1],
        variancePercent: 20.0, // High positive variance
        isConcerning: true,
      },
    ];
    
    mockUseVarianceRecords.mockReturnValue({
      data: concerningData,
      isLoading: false,
      error: null,
    });
    
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getAllByRole('alert')).toHaveLength(2); // Warning indicators
    expect(screen.getByText('High variance detected')).toBeInTheDocument();
  });

  it('should show ingredient-specific variance analysis', async () => {
    render(<VarianceAnalysisInterface />);
    
    const ingredientTab = screen.getByRole('tab', { name: /by ingredient/i });
    await user.click(ingredientTab);
    
    expect(screen.getByText('Variance by Ingredient')).toBeInTheDocument();
    expect(screen.getByText('Corn Silage')).toBeInTheDocument();
    expect(screen.getByText('Average: 2.5% variance')).toBeInTheDocument();
  });

  it('should provide variance recommendations', () => {
    const summaryWithRecommendations = {
      ...mockSummaryData,
      recommendations: [
        'Consider adjusting Corn Silage feeding protocols',
        'Monitor feeding consistency during evening feedings',
      ],
    };
    
    mockUseVarianceSummary.mockReturnValue({
      data: summaryWithRecommendations,
      isLoading: false,
      error: null,
    });
    
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Consider adjusting Corn Silage feeding protocols')).toBeInTheDocument();
    expect(screen.getByText('Monitor feeding consistency during evening feedings')).toBeInTheDocument();
  });

  it('should handle loading and error states', () => {
    mockUseVarianceRecords.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByText('Loading variance data...')).toBeInTheDocument();
    
    mockUseVarianceRecords.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to load variance data'),
    });
    
    render(<VarianceAnalysisInterface />);
    
    expect(screen.getByText('Error loading variance data')).toBeInTheDocument();
  });
});