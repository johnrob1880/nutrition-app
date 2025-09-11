import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockFeedingProgramTemplate, mockPen } from '../../test/test-utils';
import { ProgramAssignmentUI } from './program-assignment-ui';

// Mock API hooks
vi.mock('../../hooks/use-feeding-program-templates', () => ({
  useFeedingProgramTemplates: vi.fn(),
}));

vi.mock('../../hooks/use-pen-feeding-programs', () => ({
  usePenFeedingPrograms: vi.fn(),
  useAssignFeedingProgram: vi.fn(),
  useUpdatePenFeedingProgram: vi.fn(),
}));

vi.mock('../../hooks/use-pens', () => ({
  usePens: vi.fn(),
}));

const mockUseFeedingProgramTemplates = vi.hoisted(() => vi.fn());
const mockUsePenFeedingPrograms = vi.hoisted(() => vi.fn());
const mockUseAssignFeedingProgram = vi.hoisted(() => vi.fn());
const mockUseUpdatePenFeedingProgram = vi.hoisted(() => vi.fn());
const mockUsePens = vi.hoisted(() => vi.fn());

describe('ProgramAssignmentUI', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseFeedingProgramTemplates.mockReturnValue({
      data: [mockFeedingProgramTemplate],
      isLoading: false,
      error: null,
    });
    
    mockUsePenFeedingPrograms.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    
    mockUseAssignFeedingProgram.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseUpdatePenFeedingProgram.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUsePens.mockReturnValue({
      data: [mockPen],
      isLoading: false,
      error: null,
    });
  });

  it('should render program assignment interface', () => {
    render(<ProgramAssignmentUI />);
    
    expect(screen.getByText('Program Assignment')).toBeInTheDocument();
    expect(screen.getByText('Assign feeding programs to pens')).toBeInTheDocument();
  });

  it('should display available templates and pens', () => {
    render(<ProgramAssignmentUI />);
    
    expect(screen.getByText('Available Templates')).toBeInTheDocument();
    expect(screen.getByText('Standard Feedlot Program')).toBeInTheDocument();
    
    expect(screen.getByText('Pens')).toBeInTheDocument();
    expect(screen.getByText('Pen A-1')).toBeInTheDocument();
    expect(screen.getByText('180/200 head')).toBeInTheDocument();
  });

  it('should open assignment dialog when assigning template to pen', async () => {
    render(<ProgramAssignmentUI />);
    
    const assignButton = screen.getByRole('button', { name: /assign to pen a-1/i });
    await user.click(assignButton);
    
    expect(screen.getByText('Assign Feeding Program')).toBeInTheDocument();
    expect(screen.getByText('Template: Standard Feedlot Program')).toBeInTheDocument();
    expect(screen.getByText('Pen: Pen A-1')).toBeInTheDocument();
  });

  it('should customize program details during assignment', async () => {
    render(<ProgramAssignmentUI />);
    
    const assignButton = screen.getByRole('button', { name: /assign to pen a-1/i });
    await user.click(assignButton);
    
    // Fill program details
    await user.type(screen.getByLabelText(/program name/i), 'Custom Feedlot Program A-1');
    
    const startDateInput = screen.getByLabelText(/start date/i);
    await user.type(startDateInput, '2024-01-15');
    
    const endDateInput = screen.getByLabelText(/end date/i);
    await user.type(endDateInput, '2024-06-15');
    
    // Set feeding times
    const feedingTime1 = screen.getByLabelText(/feeding time 1/i);
    await user.type(feedingTime1, '06:00');
    
    const addFeedingTimeButton = screen.getByRole('button', { name: /add feeding time/i });
    await user.click(addFeedingTimeButton);
    
    const feedingTime2 = screen.getByLabelText(/feeding time 2/i);
    await user.type(feedingTime2, '17:00');
    
    expect(screen.getByDisplayValue('Custom Feedlot Program A-1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2024-01-15')).toBeInTheDocument();
    expect(screen.getByDisplayValue('06:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('17:00')).toBeInTheDocument();
  });

  it('should customize phase details for pen-specific requirements', async () => {
    const templateWithPhases = {
      ...mockFeedingProgramTemplate,
      phases: [
        {
          id: 'phase-123',
          phaseName: 'Receiving',
          phaseOrder: 1,
          durationDays: 14,
          targetMcalPerRation: 0.85,
          ingredients: [
            { ingredientId: 'ingredient-123', percentageOfRation: 65 },
          ],
        },
      ],
    };
    
    mockUseFeedingProgramTemplates.mockReturnValue({
      data: [templateWithPhases],
      isLoading: false,
      error: null,
    });
    
    render(<ProgramAssignmentUI />);
    
    const assignButton = screen.getByRole('button', { name: /assign to pen a-1/i });
    await user.click(assignButton);
    
    // Customize phase
    const customizePhaseButton = screen.getByRole('button', { name: /customize receiving phase/i });
    await user.click(customizePhaseButton);
    
    // Modify duration
    const durationInput = screen.getByLabelText(/duration \(days\)/i);
    await user.clear(durationInput);
    await user.type(durationInput, '21');
    
    // Modify target mcal
    const mcalInput = screen.getByLabelText(/target mcal per ration/i);
    await user.clear(mcalInput);
    await user.type(mcalInput, '0.90');
    
    // Modify ingredient percentage
    const percentageInput = screen.getByLabelText(/percentage of ration/i);
    await user.clear(percentageInput);
    await user.type(percentageInput, '70');
    
    const saveCustomizationButton = screen.getByRole('button', { name: /save customization/i });
    await user.click(saveCustomizationButton);
    
    expect(screen.getByText('Duration: 21 days')).toBeInTheDocument();
    expect(screen.getByText('Target: 0.90 Mcal')).toBeInTheDocument();
  });

  it('should assign program with customizations', async () => {
    const mockAssign = vi.fn();
    mockUseAssignFeedingProgram.mockReturnValue({
      mutate: mockAssign,
      isPending: false,
    });
    
    render(<ProgramAssignmentUI />);
    
    const assignButton = screen.getByRole('button', { name: /assign to pen a-1/i });
    await user.click(assignButton);
    
    // Fill required fields
    await user.type(screen.getByLabelText(/program name/i), 'Custom Program');
    await user.type(screen.getByLabelText(/start date/i), '2024-01-15');
    await user.type(screen.getByLabelText(/end date/i), '2024-06-15');
    await user.type(screen.getByLabelText(/feeding time 1/i), '06:00');
    
    const confirmAssignButton = screen.getByRole('button', { name: /assign program/i });
    await user.click(confirmAssignButton);
    
    expect(mockAssign).toHaveBeenCalledWith({
      penId: 'pen-123',
      templateId: 'template-123',
      programName: 'Custom Program',
      startDate: '2024-01-15',
      endDate: '2024-06-15',
      feedingTimes: ['06:00'],
      phases: expect.any(Array),
    });
  });

  it('should validate assignment form', async () => {
    render(<ProgramAssignmentUI />);
    
    const assignButton = screen.getByRole('button', { name: /assign to pen a-1/i });
    await user.click(assignButton);
    
    // Try to assign without required fields
    const confirmAssignButton = screen.getByRole('button', { name: /assign program/i });
    await user.click(confirmAssignButton);
    
    expect(screen.getByText('Program name is required')).toBeInTheDocument();
    expect(screen.getByText('Start date is required')).toBeInTheDocument();
    expect(screen.getByText('End date is required')).toBeInTheDocument();
    expect(screen.getByText('At least one feeding time is required')).toBeInTheDocument();
  });

  it('should show existing programs for pens', async () => {
    const existingProgram = {
      id: 'program-123',
      penId: 'pen-123',
      programName: 'Existing Program',
      startDate: '2024-01-01',
      endDate: '2024-05-01',
      status: 'active',
    };
    
    mockUsePenFeedingPrograms.mockReturnValue({
      data: [existingProgram],
      isLoading: false,
      error: null,
    });
    
    render(<ProgramAssignmentUI />);
    
    expect(screen.getByText('Current Program: Existing Program')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should allow editing existing pen programs', async () => {
    const existingProgram = {
      id: 'program-123',
      penId: 'pen-123',
      programName: 'Existing Program',
      startDate: '2024-01-01',
      endDate: '2024-05-01',
      status: 'active',
    };
    
    mockUsePenFeedingPrograms.mockReturnValue({
      data: [existingProgram],
      isLoading: false,
      error: null,
    });
    
    const mockUpdate = vi.fn();
    mockUseUpdatePenFeedingProgram.mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    });
    
    render(<ProgramAssignmentUI />);
    
    const editButton = screen.getByRole('button', { name: /edit existing program/i });
    await user.click(editButton);
    
    expect(screen.getByText('Edit Pen Feeding Program')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing Program')).toBeInTheDocument();
    
    // Modify program name
    const nameInput = screen.getByDisplayValue('Existing Program');
    await user.clear(nameInput);
    await user.type(nameInput, 'Updated Program');
    
    const saveButton = screen.getByRole('button', { name: /save changes/i });
    await user.click(saveButton);
    
    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'program-123',
      programName: 'Updated Program',
    });
  });

  it('should filter pens by status and program assignment', async () => {
    const pens = [
      mockPen,
      {
        ...mockPen,
        id: 'pen-456',
        name: 'Pen B-1',
        hasActiveProgram: true,
      },
    ];
    
    mockUsePens.mockReturnValue({
      data: pens,
      isLoading: false,
      error: null,
    });
    
    render(<ProgramAssignmentUI />);
    
    expect(screen.getByText('Pen A-1')).toBeInTheDocument();
    expect(screen.getByText('Pen B-1')).toBeInTheDocument();
    
    const filterSelect = screen.getByLabelText(/filter pens/i);
    await user.selectOptions(filterSelect, 'unassigned');
    
    expect(screen.getByText('Pen A-1')).toBeInTheDocument();
    expect(screen.queryByText('Pen B-1')).not.toBeInTheDocument();
  });
});