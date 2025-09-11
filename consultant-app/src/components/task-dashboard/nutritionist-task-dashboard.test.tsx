import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockNutritionistTask, mockPen } from '../../test/test-utils';
import { NutritionistTaskDashboard } from './nutritionist-task-dashboard';

// Mock API hooks
vi.mock('../../hooks/use-nutritionist-tasks', () => ({
  useNutritionistTasks: vi.fn(),
  useCompleteNutritionistTask: vi.fn(),
  useUpdateNutritionistTask: vi.fn(),
}));

vi.mock('../../hooks/use-pens', () => ({
  usePens: vi.fn(),
}));

const mockUseNutritionistTasks = vi.hoisted(() => vi.fn());
const mockUseCompleteNutritionistTask = vi.hoisted(() => vi.fn());
const mockUseUpdateNutritionistTask = vi.hoisted(() => vi.fn());
const mockUsePens = vi.hoisted(() => vi.fn());

describe('NutritionistTaskDashboard', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseNutritionistTasks.mockReturnValue({
      data: [mockNutritionistTask],
      isLoading: false,
      error: null,
    });
    
    mockUseCompleteNutritionistTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseUpdateNutritionistTask.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUsePens.mockReturnValue({
      data: [mockPen],
      isLoading: false,
      error: null,
    });
  });

  it('should render task dashboard with pending tasks', () => {
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('Task Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.getByText('Pen: Pen A-1')).toBeInTheDocument();
  });

  it('should show task counts and statistics', () => {
    const tasks = [
      mockNutritionistTask,
      {
        ...mockNutritionistTask,
        id: 'task-456',
        status: 'in_progress',
        taskType: 'review_variance',
      },
      {
        ...mockNutritionistTask,
        id: 'task-789',
        status: 'completed',
        taskType: 'update_program',
      },
    ];
    
    mockUseNutritionistTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('1 Pending')).toBeInTheDocument();
    expect(screen.getByText('1 In Progress')).toBeInTheDocument();
    expect(screen.getByText('1 Completed')).toBeInTheDocument();
  });

  it('should filter tasks by status', async () => {
    const tasks = [
      mockNutritionistTask,
      {
        ...mockNutritionistTask,
        id: 'task-456',
        status: 'completed',
        description: 'Completed feeding program',
      },
    ];
    
    mockUseNutritionistTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.getByText('Completed feeding program')).toBeInTheDocument();
    
    const statusFilter = screen.getByLabelText(/filter by status/i);
    await user.selectOptions(statusFilter, 'pending');
    
    expect(screen.getByText('Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.queryByText('Completed feeding program')).not.toBeInTheDocument();
  });

  it('should filter tasks by type', async () => {
    const tasks = [
      mockNutritionistTask,
      {
        ...mockNutritionistTask,
        id: 'task-456',
        taskType: 'review_variance',
        description: 'Review feeding variances',
      },
    ];
    
    mockUseNutritionistTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.getByText('Review feeding variances')).toBeInTheDocument();
    
    const typeFilter = screen.getByLabelText(/filter by type/i);
    await user.selectOptions(typeFilter, 'create_feeding_program');
    
    expect(screen.getByText('Create feeding program for new pen')).toBeInTheDocument();
    expect(screen.queryByText('Review feeding variances')).not.toBeInTheDocument();
  });

  it('should open task details when task is clicked', async () => {
    render(<NutritionistTaskDashboard />);
    
    const taskCard = screen.getByRole('button', { name: /view task details/i });
    await user.click(taskCard);
    
    expect(screen.getByText('Task Details')).toBeInTheDocument();
    expect(screen.getByText('Type: Create Feeding Program')).toBeInTheDocument();
    expect(screen.getByText('Status: Pending')).toBeInTheDocument();
    expect(screen.getByText('Pen: Pen A-1 (180/200 head)')).toBeInTheDocument();
  });

  it('should mark task as in progress', async () => {
    const mockUpdate = vi.fn();
    mockUseUpdateNutritionistTask.mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    });
    
    render(<NutritionistTaskDashboard />);
    
    const startButton = screen.getByRole('button', { name: /start task/i });
    await user.click(startButton);
    
    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'task-123',
      status: 'in_progress',
    });
  });

  it('should complete task with notes', async () => {
    const mockComplete = vi.fn();
    mockUseCompleteNutritionistTask.mockReturnValue({
      mutate: mockComplete,
      isPending: false,
    });
    
    render(<NutritionistTaskDashboard />);
    
    const completeButton = screen.getByRole('button', { name: /complete task/i });
    await user.click(completeButton);
    
    expect(screen.getByText('Complete Task')).toBeInTheDocument();
    
    const notesTextarea = screen.getByLabelText(/completion notes/i);
    await user.type(notesTextarea, 'Feeding program created successfully');
    
    const submitButton = screen.getByRole('button', { name: /mark complete/i });
    await user.click(submitButton);
    
    expect(mockComplete).toHaveBeenCalledWith({
      id: 'task-123',
      completionNotes: 'Feeding program created successfully',
    });
  });

  it('should show task priority indicators', () => {
    const tasks = [
      {
        ...mockNutritionistTask,
        priority: 'high',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
      },
      {
        ...mockNutritionistTask,
        id: 'task-456',
        priority: 'medium',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      },
    ];
    
    mockUseNutritionistTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('High Priority')).toBeInTheDocument();
    expect(screen.getByText('Medium Priority')).toBeInTheDocument();
  });

  it('should show overdue task indicators', () => {
    const overdueTask = {
      ...mockNutritionistTask,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
      dueDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
    };
    
    mockUseNutritionistTasks.mockReturnValue({
      data: [overdueTask],
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('should navigate to create feeding program from task', async () => {
    render(<NutritionistTaskDashboard />);
    
    const actionButton = screen.getByRole('button', { name: /create feeding program/i });
    await user.click(actionButton);
    
    // Should navigate to program assignment UI or template designer
    // This would be tested with router mocking in real implementation
    expect(actionButton).toHaveAttribute('data-action', 'create_program');
  });

  it('should show notifications for new tasks', () => {
    const newTask = {
      ...mockNutritionistTask,
      createdAt: new Date().toISOString(), // Just created
      isNew: true,
    };
    
    mockUseNutritionistTasks.mockReturnValue({
      data: [newTask],
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Notification indicator
  });

  it('should sort tasks by priority and creation date', async () => {
    const tasks = [
      {
        ...mockNutritionistTask,
        id: 'task-low',
        priority: 'low',
        createdAt: new Date(Date.now() - 1000).toISOString(),
        description: 'Low priority task',
      },
      {
        ...mockNutritionistTask,
        id: 'task-high',
        priority: 'high',
        createdAt: new Date(Date.now() - 2000).toISOString(),
        description: 'High priority task',
      },
      {
        ...mockNutritionistTask,
        id: 'task-medium',
        priority: 'medium',
        createdAt: new Date(Date.now() - 1500).toISOString(),
        description: 'Medium priority task',
      },
    ];
    
    mockUseNutritionistTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    const taskCards = screen.getAllByTestId('task-card');
    
    // Should be sorted by priority: high, medium, low
    expect(taskCards[0]).toHaveTextContent('High priority task');
    expect(taskCards[1]).toHaveTextContent('Medium priority task');
    expect(taskCards[2]).toHaveTextContent('Low priority task');
  });

  it('should show empty state when no tasks exist', () => {
    mockUseNutritionistTasks.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    
    render(<NutritionistTaskDashboard />);
    
    expect(screen.getByText('No tasks found')).toBeInTheDocument();
    expect(screen.getByText('All caught up! No pending tasks at the moment.')).toBeInTheDocument();
  });
});