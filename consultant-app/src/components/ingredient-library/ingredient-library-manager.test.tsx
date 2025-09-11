import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, mockFeedingIngredient } from '../../test/test-utils';
import { IngredientLibraryManager } from './ingredient-library-manager';

// Mock API hooks
vi.mock('../../hooks/use-feeding-ingredients', () => {
  const mockUseFeedingIngredients = vi.fn();
  const mockUseCreateFeedingIngredient = vi.fn();
  const mockUseUpdateFeedingIngredient = vi.fn();
  const mockUseDeleteFeedingIngredient = vi.fn();
  
  return {
    useFeedingIngredients: mockUseFeedingIngredients,
    useCreateFeedingIngredient: mockUseCreateFeedingIngredient,
    useUpdateFeedingIngredient: mockUseUpdateFeedingIngredient,
    useDeleteFeedingIngredient: mockUseDeleteFeedingIngredient,
  };
});

describe('IngredientLibraryManager', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mocked functions
    const mockUseFeedingIngredients = vi.mocked(await import('../../hooks/use-feeding-ingredients')).useFeedingIngredients;
    const mockUseCreateFeedingIngredient = vi.mocked(await import('../../hooks/use-feeding-ingredients')).useCreateFeedingIngredient;
    const mockUseUpdateFeedingIngredient = vi.mocked(await import('../../hooks/use-feeding-ingredients')).useUpdateFeedingIngredient;
    const mockUseDeleteFeedingIngredient = vi.mocked(await import('../../hooks/use-feeding-ingredients')).useDeleteFeedingIngredient;
    
    // Setup default mock implementations
    mockUseFeedingIngredients.mockReturnValue({
      data: [mockFeedingIngredient],
      isLoading: false,
      error: null,
    });
    
    mockUseCreateFeedingIngredient.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseUpdateFeedingIngredient.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    
    mockUseDeleteFeedingIngredient.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  it('should render ingredient library with existing ingredients', () => {
    render(<IngredientLibraryManager />);
    
    expect(screen.getByText('Ingredient Library')).toBeInTheDocument();
    expect(screen.getByText('Corn Silage')).toBeInTheDocument();
    expect(screen.getByText('8.5%')).toBeInTheDocument(); // protein
    expect(screen.getByText('35.0%')).toBeInTheDocument(); // dry matter
  });

  it('should show loading state when fetching ingredients', () => {
    mockUseFeedingIngredients.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    
    render(<IngredientLibraryManager />);
    
    expect(screen.getByText('Loading ingredients...')).toBeInTheDocument();
  });

  it('should display error message when fetch fails', () => {
    mockUseFeedingIngredients.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch ingredients'),
    });
    
    render(<IngredientLibraryManager />);
    
    expect(screen.getByText('Error loading ingredients')).toBeInTheDocument();
  });

  it('should open create ingredient dialog when add button is clicked', async () => {
    render(<IngredientLibraryManager />);
    
    const addButton = screen.getByRole('button', { name: /add ingredient/i });
    await user.click(addButton);
    
    expect(screen.getByText('Add New Ingredient')).toBeInTheDocument();
    expect(screen.getByLabelText(/ingredient name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/protein percent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dry matter percent/i)).toBeInTheDocument();
  });

  it('should create new ingredient with valid data', async () => {
    const mockCreate = vi.fn();
    mockUseCreateFeedingIngredient.mockReturnValue({
      mutate: mockCreate,
      isPending: false,
    });
    
    render(<IngredientLibraryManager />);
    
    // Open create dialog
    const addButton = screen.getByRole('button', { name: /add ingredient/i });
    await user.click(addButton);
    
    // Fill form
    await user.type(screen.getByLabelText(/ingredient name/i), 'Alfalfa Hay');
    await user.type(screen.getByLabelText(/protein percent/i), '18.5');
    await user.type(screen.getByLabelText(/dry matter percent/i), '89.0');
    
    // Submit form
    const createButton = screen.getByRole('button', { name: /create ingredient/i });
    await user.click(createButton);
    
    expect(mockCreate).toHaveBeenCalledWith({
      name: 'Alfalfa Hay',
      proteinPercent: 18.5,
      dryMatterPercent: 89.0,
    });
  });

  it('should validate ingredient form inputs', async () => {
    render(<IngredientLibraryManager />);
    
    // Open create dialog
    const addButton = screen.getByRole('button', { name: /add ingredient/i });
    await user.click(addButton);
    
    // Try to submit empty form
    const createButton = screen.getByRole('button', { name: /create ingredient/i });
    await user.click(createButton);
    
    expect(screen.getByText('Ingredient name is required')).toBeInTheDocument();
    expect(screen.getByText('Protein percent is required')).toBeInTheDocument();
    expect(screen.getByText('Dry matter percent is required')).toBeInTheDocument();
  });

  it('should open edit dialog when edit button is clicked', async () => {
    render(<IngredientLibraryManager />);
    
    const editButton = screen.getByRole('button', { name: /edit corn silage/i });
    await user.click(editButton);
    
    expect(screen.getByText('Edit Ingredient')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Corn Silage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('8.5')).toBeInTheDocument();
    expect(screen.getByDisplayValue('35.0')).toBeInTheDocument();
  });

  it('should update ingredient with modified data', async () => {
    const mockUpdate = vi.fn();
    mockUseUpdateFeedingIngredient.mockReturnValue({
      mutate: mockUpdate,
      isPending: false,
    });
    
    render(<IngredientLibraryManager />);
    
    // Open edit dialog
    const editButton = screen.getByRole('button', { name: /edit corn silage/i });
    await user.click(editButton);
    
    // Modify data
    const nameInput = screen.getByDisplayValue('Corn Silage');
    await user.clear(nameInput);
    await user.type(nameInput, 'High Quality Corn Silage');
    
    // Submit form
    const updateButton = screen.getByRole('button', { name: /update ingredient/i });
    await user.click(updateButton);
    
    expect(mockUpdate).toHaveBeenCalledWith({
      id: 'ingredient-123',
      name: 'High Quality Corn Silage',
      proteinPercent: 8.5,
      dryMatterPercent: 35.0,
    });
  });

  it('should confirm deletion before removing ingredient', async () => {
    const mockDelete = vi.fn();
    mockUseDeleteFeedingIngredient.mockReturnValue({
      mutate: mockDelete,
      isPending: false,
    });
    
    render(<IngredientLibraryManager />);
    
    const deleteButton = screen.getByRole('button', { name: /delete corn silage/i });
    await user.click(deleteButton);
    
    expect(screen.getByText('Delete Ingredient')).toBeInTheDocument();
    expect(screen.getByText(/are you sure you want to delete/i)).toBeInTheDocument();
    
    const confirmButton = screen.getByRole('button', { name: /delete/i });
    await user.click(confirmButton);
    
    expect(mockDelete).toHaveBeenCalledWith('ingredient-123');
  });

  it('should filter ingredients by search term', async () => {
    const multipleIngredients = [
      mockFeedingIngredient,
      {
        ...mockFeedingIngredient,
        id: 'ingredient-456',
        name: 'Alfalfa Hay',
      },
    ];
    
    mockUseFeedingIngredients.mockReturnValue({
      data: multipleIngredients,
      isLoading: false,
      error: null,
    });
    
    render(<IngredientLibraryManager />);
    
    expect(screen.getByText('Corn Silage')).toBeInTheDocument();
    expect(screen.getByText('Alfalfa Hay')).toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText(/search ingredients/i);
    await user.type(searchInput, 'corn');
    
    expect(screen.getByText('Corn Silage')).toBeInTheDocument();
    expect(screen.queryByText('Alfalfa Hay')).not.toBeInTheDocument();
  });

  it('should sort ingredients by name, protein, or dry matter', async () => {
    const multipleIngredients = [
      mockFeedingIngredient,
      {
        ...mockFeedingIngredient,
        id: 'ingredient-456',
        name: 'Alfalfa Hay',
        proteinPercent: 18.5,
        dryMatterPercent: 89.0,
      },
    ];
    
    mockUseFeedingIngredients.mockReturnValue({
      data: multipleIngredients,
      isLoading: false,
      error: null,
    });
    
    render(<IngredientLibraryManager />);
    
    const sortSelect = screen.getByLabelText(/sort by/i);
    await user.selectOptions(sortSelect, 'protein-desc');
    
    // Should be sorted by protein descending (Alfalfa first)
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Alfalfa Hay');
    expect(rows[2]).toHaveTextContent('Corn Silage');
  });
});