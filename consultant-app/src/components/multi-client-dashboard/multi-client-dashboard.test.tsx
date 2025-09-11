import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockPen } from '../../test/test-utils';
import { MultiClientDashboard } from './multi-client-dashboard';

// Mock API hooks
vi.mock('../../hooks/use-consultant-operations', () => ({
  useConsultantOperations: vi.fn(),
}));

vi.mock('../../hooks/use-nutritionist-tasks', () => ({
  useNutritionistTasks: vi.fn(),
}));

vi.mock('../../hooks/use-pen-feeding-programs', () => ({
  usePenFeedingPrograms: vi.fn(),
}));

const mockUseConsultantOperations = vi.hoisted(() => vi.fn());
const mockUseNutritionistTasks = vi.hoisted(() => vi.fn());
const mockUsePenFeedingPrograms = vi.hoisted(() => vi.fn());

describe('MultiClientDashboard', () => {
  const user = userEvent.setup();
  
  const mockOperations = [
    {
      id: 'operation-123',
      name: 'Smith Ranch',
      location: 'Texas',
      operatorEmail: 'john@smithranch.com',
      totalPens: 5,
      activePens: 3,
      totalCattle: 1200,
    },
    {
      id: 'operation-456',
      name: 'Johnson Feedlot',
      location: 'Kansas',
      operatorEmail: 'bob@johnsonfeedlot.com',
      totalPens: 8,
      activePens: 6,
      totalCattle: 2400,
    },
  ];
  
  const mockTasks = [
    {
      id: 'task-123',
      operationId: 'operation-123',
      penId: 'pen-123',
      taskType: 'create_feeding_program',
      status: 'pending',
      priority: 'high',
      description: 'Create feeding program for new pen',
    },
    {
      id: 'task-456',
      operationId: 'operation-456',
      penId: 'pen-456',
      taskType: 'review_variance',
      status: 'in_progress',
      priority: 'medium',
      description: 'Review feeding variances',
    },
  ];
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseConsultantOperations.mockReturnValue({
      data: mockOperations,
      isLoading: false,
      error: null,
    });
    
    mockUseNutritionistTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    });
    
    mockUsePenFeedingPrograms.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
  });

  it('should render multi-client dashboard', () => {
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('Client Operations')).toBeInTheDocument();
    expect(screen.getByText('Manage all your client operations from one place')).toBeInTheDocument();
  });

  it('should display client operation cards', () => {
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('Smith Ranch')).toBeInTheDocument();
    expect(screen.getByText('Texas')).toBeInTheDocument();
    expect(screen.getByText('5 pens')).toBeInTheDocument();
    expect(screen.getByText('3 active')).toBeInTheDocument();
    expect(screen.getByText('1,200 head')).toBeInTheDocument();
    
    expect(screen.getByText('Johnson Feedlot')).toBeInTheDocument();
    expect(screen.getByText('Kansas')).toBeInTheDocument();
    expect(screen.getByText('8 pens')).toBeInTheDocument();
    expect(screen.getByText('6 active')).toBeInTheDocument();
    expect(screen.getByText('2,400 head')).toBeInTheDocument();
  });

  it('should show task summary for each operation', () => {
    render(<MultiClientDashboard />);
    
    // Smith Ranch should show 1 pending task
    const smithCard = screen.getByTestId('operation-card-operation-123');
    expect(smithCard).toHaveTextContent('1 pending task');
    
    // Johnson Feedlot should show 1 in-progress task
    const johnsonCard = screen.getByTestId('operation-card-operation-456');
    expect(johnsonCard).toHaveTextContent('1 in-progress task');
  });

  it('should filter operations by status', async () => {
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('Smith Ranch')).toBeInTheDocument();
    expect(screen.getByText('Johnson Feedlot')).toBeInTheDocument();
    
    const statusFilter = screen.getByLabelText(/filter by status/i);
    await user.selectOptions(statusFilter, 'needs_attention');
    
    // Should only show operations with pending tasks
    expect(screen.getByText('Smith Ranch')).toBeInTheDocument();
    expect(screen.queryByText('Johnson Feedlot')).not.toBeInTheDocument();
  });

  it('should search operations by name or location', async () => {
    render(<MultiClientDashboard />);
    
    const searchInput = screen.getByPlaceholderText(/search operations/i);
    await user.type(searchInput, 'Texas');
    
    expect(screen.getByText('Smith Ranch')).toBeInTheDocument();
    expect(screen.queryByText('Johnson Feedlot')).not.toBeInTheDocument();
    
    await user.clear(searchInput);
    await user.type(searchInput, 'Johnson');
    
    expect(screen.queryByText('Smith Ranch')).not.toBeInTheDocument();
    expect(screen.getByText('Johnson Feedlot')).toBeInTheDocument();
  });

  it('should navigate to operation details', async () => {
    render(<MultiClientDashboard />);
    
    const smithCard = screen.getByRole('button', { name: /view smith ranch details/i });
    await user.click(smithCard);
    
    // Should navigate to operation details view
    expect(smithCard).toHaveAttribute('data-operation-id', 'operation-123');
  });

  it('should show operation statistics summary', () => {
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('Total Operations: 2')).toBeInTheDocument();
    expect(screen.getByText('Total Pens: 13')).toBeInTheDocument();
    expect(screen.getByText('Active Pens: 9')).toBeInTheDocument();
    expect(screen.getByText('Total Cattle: 3,600')).toBeInTheDocument();
    expect(screen.getByText('Pending Tasks: 1')).toBeInTheDocument();
  });

  it('should display recent activity feed', () => {
    const recentActivities = [
      {
        id: 'activity-123',
        operationId: 'operation-123',
        operationName: 'Smith Ranch',
        type: 'pen_created',
        description: 'New pen A-6 created',
        timestamp: new Date().toISOString(),
      },
      {
        id: 'activity-456',
        operationId: 'operation-456',
        operationName: 'Johnson Feedlot',
        type: 'program_assigned',
        description: 'Feeding program assigned to pen B-3',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
      },
    ];
    
    render(<MultiClientDashboard activities={recentActivities} />);
    
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Smith Ranch: New pen A-6 created')).toBeInTheDocument();
    expect(screen.getByText('Johnson Feedlot: Feeding program assigned to pen B-3')).toBeInTheDocument();
  });

  it('should show urgent tasks requiring attention', () => {
    const urgentTasks = [
      {
        ...mockTasks[0],
        priority: 'high',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Due tomorrow
        operationName: 'Smith Ranch',
      },
    ];
    
    render(<MultiClientDashboard urgentTasks={urgentTasks} />);
    
    expect(screen.getByText('Urgent Tasks')).toBeInTheDocument();
    expect(screen.getByText('Smith Ranch - Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.getByText('Due in 1 day')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument(); // Urgent indicator
  });

  it('should display performance metrics across operations', () => {
    const performanceMetrics = {
      averageAdherence: 94.2,
      totalVarianceRecords: 150,
      topPerformingOperation: 'Johnson Feedlot',
      needsAttentionOperation: 'Smith Ranch',
    };
    
    render(<MultiClientDashboard performanceMetrics={performanceMetrics} />);
    
    expect(screen.getByText('Performance Overview')).toBeInTheDocument();
    expect(screen.getByText('94.2% Avg Adherence')).toBeInTheDocument();
    expect(screen.getByText('150 Variance Records')).toBeInTheDocument();
    expect(screen.getByText('Top: Johnson Feedlot')).toBeInTheDocument();
    expect(screen.getByText('Needs Attention: Smith Ranch')).toBeInTheDocument();
  });

  it('should support bulk actions on selected operations', async () => {
    render(<MultiClientDashboard />);
    
    // Select multiple operations
    const smithCheckbox = screen.getByLabelText(/select smith ranch/i);
    const johnsonCheckbox = screen.getByLabelText(/select johnson feedlot/i);
    
    await user.click(smithCheckbox);
    await user.click(johnsonCheckbox);
    
    expect(screen.getByText('2 operations selected')).toBeInTheDocument();
    
    const bulkActionsButton = screen.getByRole('button', { name: /bulk actions/i });
    await user.click(bulkActionsButton);
    
    expect(screen.getByText('Generate Report')).toBeInTheDocument();
    expect(screen.getByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Send Notification')).toBeInTheDocument();
  });

  it('should show operation alerts and notifications', () => {
    const operationsWithAlerts = [
      {
        ...mockOperations[0],
        alerts: [
          { type: 'variance_high', message: 'High variance detected in pen A-3' },
          { type: 'program_ending', message: 'Feeding program ends in 3 days' },
        ],
      },
    ];
    
    mockUseConsultantOperations.mockReturnValue({
      data: operationsWithAlerts,
      isLoading: false,
      error: null,
    });
    
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('2 alerts')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Alert indicator
  });

  it('should handle empty state when no operations exist', () => {
    mockUseConsultantOperations.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    
    render(<MultiClientDashboard />);
    
    expect(screen.getByText('No client operations found')).toBeInTheDocument();
    expect(screen.getByText('Start by connecting with your first client operation.')).toBeInTheDocument();
  });

  it('should refresh data when refresh button is clicked', async () => {
    render(<MultiClientDashboard />);
    
    const refreshButton = screen.getByRole('button', { name: /refresh data/i });
    await user.click(refreshButton);
    
    // Should trigger data refetch
    expect(mockUseConsultantOperations).toHaveBeenCalled();
    expect(mockUseNutritionistTasks).toHaveBeenCalled();
  });

  it('should sort operations by different criteria', async () => {
    render(<MultiClientDashboard />);
    
    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.selectOptions(sortSelect, 'cattle_count');
    
    const operationCards = screen.getAllByTestId(/operation-card/);
    
    // Should be sorted by cattle count descending (Johnson first, then Smith)
    expect(operationCards[0]).toHaveTextContent('Johnson Feedlot');
    expect(operationCards[1]).toHaveTextContent('Smith Ranch');
  });
});