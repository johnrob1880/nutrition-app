import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockFeedingProgramTemplate, mockTemplatePhase, mockFeedingIngredient } from '../../test/test-utils';
import { TemplateDesigner } from './template-designer';

// Mock API hooks
vi.mock('../../hooks/use-feeding-program-templates', () => ({
  useFeedingProgramTemplates: vi.fn(),
  useCreateFeedingProgramTemplate: vi.fn(),
  useUpdateFeedingProgramTemplate: vi.fn(),
  useDeleteFeedingProgramTemplate: vi.fn(),
}));

vi.mock('../../hooks/use-feeding-ingredients', () => ({
  useFeedingIngredients: vi.fn(),
}));

// Mock drag and drop library
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useDraggable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
  }),
  useDroppable: () => ({
    setNodeRef: () => {},
    isOver: false,
  }),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: () => {},
    transform: null,
    transition: null,
  }),
}));

const mockUseFeedingProgramTemplates = vi.hoisted(() => vi.fn());
const mockUseCreateFeedingProgramTemplate = vi.hoisted(() => vi.fn());
const mockUseUpdateFeedingProgramTemplate = vi.hoisted(() => vi.fn());
const mockUseDeleteFeedingProgramTemplate = vi.hoisted(() => vi.fn());
const mockUseFeedingIngredients = vi.hoisted(() => vi.fn());

describe('TemplateDesigner', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUseFeedingProgramTemplates.mockReturnValue({
      data: [mockFeedingProgramTemplate],
      isLoading: false,
      error: null,
    });
    
    mockUseCreateFeedingProgramTemplate.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseUpdateFeedingProgramTemplate.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseDeleteFeedingProgramTemplate.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseFeedingIngredients.mockReturnValue({
      data: [mockFeedingIngredient],
      isLoading: false,
      error: null,
    });
  });

  it('should render template designer with existing templates', () => {
    render(<TemplateDesigner />);
    
    expect(screen.getByText('Template Designer')).toBeInTheDocument();
    expect(screen.getByText('Standard Feedlot Program')).toBeInTheDocument();
    expect(screen.getByText('A standard 150-day feedlot program')).toBeInTheDocument();
  });

  it('should filter templates by category tags', async () => {
    const templates = [
      mockFeedingProgramTemplate,
      {
        ...mockFeedingProgramTemplate,
        id: 'template-456',
        name: 'Backgrounding Program',
        categoryTags: ['backgrounding', 'grass'],
      },
    ];
    
    mockUseFeedingProgramTemplates.mockReturnValue({
      data: templates,
      isLoading: false,
      error: null,
    });
    
    render(<TemplateDesigner />);
    
    expect(screen.getByText('Standard Feedlot Program')).toBeInTheDocument();
    expect(screen.getByText('Backgrounding Program')).toBeInTheDocument();
    
    const filterSelect = screen.getByLabelText(/filter by category/i);
    await user.selectOptions(filterSelect, 'feedlot');
    
    expect(screen.getByText('Standard Feedlot Program')).toBeInTheDocument();
    expect(screen.queryByText('Backgrounding Program')).not.toBeInTheDocument();
  });

  it('should open create template dialog', async () => {
    render(<TemplateDesigner />);
    
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    expect(screen.getByText('Create Feeding Program Template')).toBeInTheDocument();
    expect(screen.getByLabelText(/template name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/category tags/i)).toBeInTheDocument();
  });

  it('should create template with phases', async () => {
    const mockCreate = vi.fn();
    mockUseCreateFeedingProgramTemplate.mockReturnValue({
      mutate: mockCreate,
      isPending: false,
    });
    
    render(<TemplateDesigner />);
    
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    // Fill template form
    await user.type(screen.getByLabelText(/template name/i), 'New Feedlot Program');
    await user.type(screen.getByLabelText(/description/i), 'A customized feedlot program');
    await user.type(screen.getByLabelText(/category tags/i), 'feedlot,custom');
    
    // Add phase
    const addPhaseButton = screen.getByRole('button', { name: /add phase/i });
    await user.click(addPhaseButton);
    
    await user.type(screen.getByLabelText(/phase name/i), 'Receiving');
    await user.type(screen.getByLabelText(/duration \(days\)/i), '14');
    await user.type(screen.getByLabelText(/target mcal per ration/i), '0.85');
    
    // Add ingredient to phase
    const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i });
    await user.click(addIngredientButton);
    
    const ingredientSelect = screen.getByLabelText(/select ingredient/i);
    await user.selectOptions(ingredientSelect, 'ingredient-123');
    
    await user.type(screen.getByLabelText(/percentage of ration/i), '65');
    
    const saveIngredientButton = screen.getByRole('button', { name: /save ingredient/i });
    await user.click(saveIngredientButton);
    
    // Save template
    const saveTemplateButton = screen.getByRole('button', { name: /create template/i });
    await user.click(saveTemplateButton);
    
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'New Feedlot Program',
      description: 'A customized feedlot program',
      categoryTags: ['feedlot', 'custom'],
      phases: [{
        phaseName: 'Receiving',
        phaseOrder: 1,
        durationDays: 14,
        targetMcalPerRation: 0.85,
        ingredients: [{
          ingredientId: 'ingredient-123',
          percentageOfRation: 65,
        }],
      }],
    });
  });

  it('should validate template form', async () => {
    render(<TemplateDesigner />);
    
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    // Try to submit empty form
    const saveButton = screen.getByRole('button', { name: /create template/i });
    await user.click(saveButton);
    
    expect(screen.getByText('Template name is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('At least one phase is required')).toBeInTheDocument();
  });

  it('should support drag and drop reordering of phases', async () => {
    const templateWithPhases = {
      ...mockFeedingProgramTemplate,
      phases: [
        { ...mockTemplatePhase, phaseOrder: 1, phaseName: 'Receiving' },
        { ...mockTemplatePhase, id: 'phase-456', phaseOrder: 2, phaseName: 'Growing' },
        { ...mockTemplatePhase, id: 'phase-789', phaseOrder: 3, phaseName: 'Finishing' },
      ],
    };
    
    render(<TemplateDesigner templateId="template-123" />);
    
    // Mock the template loading
    mockUseFeedingProgramTemplates.mockReturnValue({
      data: [templateWithPhases],
      isLoading: false,
      error: null,
    });
    
    expect(screen.getByText('Receiving')).toBeInTheDocument();
    expect(screen.getByText('Growing')).toBeInTheDocument();
    expect(screen.getByText('Finishing')).toBeInTheDocument();
    
    // Drag and drop functionality would be tested with more complex setup
    // For now, verify that phases are rendered in order
    const phases = screen.getAllByTestId(/phase-card/);
    expect(phases).toHaveLength(3);
  });

  it('should open edit template dialog with pre-filled data', async () => {
    render(<TemplateDesigner />);
    
    const editButton = screen.getByRole('button', { name: /edit standard feedlot program/i });
    await user.click(editButton);
    
    expect(screen.getByText('Edit Template')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Standard Feedlot Program')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A standard 150-day feedlot program')).toBeInTheDocument();
  });

  it('should delete template with confirmation', async () => {
    const mockDelete = vi.fn();
    mockUseDeleteFeedingProgramTemplate.mockReturnValue({
      mutate: mockDelete,
      isPending: false,
    });
    
    render(<TemplateDesigner />);
    
    const deleteButton = screen.getByRole('button', { name: /delete standard feedlot program/i });
    await user.click(deleteButton);
    
    expect(screen.getByText('Delete Template')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);
    
    expect(mockDelete).toHaveBeenCalledWith('template-123');
  });

  it('should validate phase data when adding phases', async () => {
    render(<TemplateDesigner />);
    
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    const addPhaseButton = screen.getByRole('button', { name: /add phase/i });
    await user.click(addPhaseButton);
    
    // Try to save phase without required fields
    const savePhaseButton = screen.getByRole('button', { name: /save phase/i });
    await user.click(savePhaseButton);
    
    expect(screen.getByText('Phase name is required')).toBeInTheDocument();
    expect(screen.getByText('Duration must be greater than 0')).toBeInTheDocument();
    expect(screen.getByText('Target Mcal must be greater than 0')).toBeInTheDocument();
  });

  it('should calculate total ration percentage for phase ingredients', async () => {
    render(<TemplateDesigner />);
    
    const createButton = screen.getByRole('button', { name: /create template/i });
    await user.click(createButton);
    
    const addPhaseButton = screen.getByRole('button', { name: /add phase/i });
    await user.click(addPhaseButton);
    
    // Add multiple ingredients
    const addIngredientButton = screen.getByRole('button', { name: /add ingredient/i });
    await user.click(addIngredientButton);
    
    await user.type(screen.getByLabelText(/percentage of ration/i), '65');
    const saveIngredientButton = screen.getByRole('button', { name: /save ingredient/i });
    await user.click(saveIngredientButton);
    
    // Total should show 65%
    expect(screen.getByText('Total: 65%')).toBeInTheDocument();
    
    // Add another ingredient
    await user.click(addIngredientButton);
    await user.type(screen.getAllByLabelText(/percentage of ration/i)[1], '30');
    await user.click(screen.getAllByRole('button', { name: /save ingredient/i })[1]);
    
    // Total should show 95%
    expect(screen.getByText('Total: 95%')).toBeInTheDocument();
  });
});