// Test utilities for React components
import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a test query client with disabled retries and cache
const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
    mutations: {
      retry: false,
    },
  },
});

interface TestProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

// Test providers wrapper
const TestProviders = ({ children, queryClient }: TestProvidersProps) => {
  const client = queryClient || createTestQueryClient();
  
  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
};

// Custom render function with providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    queryClient?: QueryClient;
  }
) => {
  const { queryClient, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders queryClient={queryClient}>
        {children}
      </TestProviders>
    ),
    ...renderOptions,
  });
};

// Mock user authentication state
export const mockUserAuth = {
  email: 'test-consultant@example.com',
  role: 'consultant' as const,
  isAuthenticated: true,
};

// Mock feeding ingredient data
export const mockFeedingIngredient = {
  id: 'ingredient-123',
  name: 'Corn Silage',
  proteinPercent: 8.5,
  dryMatterPercent: 35.0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  user_id: 'user-123',
};

// Mock feeding program template data
export const mockFeedingProgramTemplate = {
  id: 'template-123',
  name: 'Standard Feedlot Program',
  description: 'A standard 150-day feedlot program',
  categoryTags: ['feedlot', 'standard'],
  consultantId: 'consultant-123',
  isShared: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock template phase data
export const mockTemplatePhase = {
  id: 'phase-123',
  templateId: 'template-123',
  phaseName: 'Receiving',
  phaseOrder: 1,
  durationDays: 14,
  targetMcalPerRation: 0.85,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock pen data
export const mockPen = {
  id: 'pen-123',
  name: 'Pen A-1',
  capacity: 200,
  currentCount: 180,
  cattleType: 'feedlot',
  targetWeight: 1400,
  operationId: 'operation-123',
  nutritionistId: 'consultant-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock nutritionist task data
export const mockNutritionistTask = {
  id: 'task-123',
  penId: 'pen-123',
  consultantId: 'consultant-123',
  taskType: 'create_feeding_program' as const,
  status: 'pending' as const,
  description: 'Create feeding program for new pen',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render, createTestQueryClient };