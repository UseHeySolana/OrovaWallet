import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TodoItem {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'personal' | 'work' | 'shopping' | 'health' | 'finance' | 'other';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  isEvent: boolean;
  eventDetails?: {
    startTime?: Date;
    endTime?: Date;
    location?: string;
    attendees?: string[];
    reminderMinutes?: number;
  };
  aiGenerated: boolean;
  parentId?: string; // For subtasks
  subtasks: string[]; // Array of subtask IDs
}

export interface TodoFilter {
  completed?: boolean;
  priority?: TodoItem['priority'];
  category?: TodoItem['category'];
  dueDate?: Date;
  tags?: string[];
  search?: string;
}

export interface TodoStats {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  byPriority: Record<TodoItem['priority'], number>;
  byCategory: Record<TodoItem['category'], number>;
}

interface TodoStore {
  // State
  todos: TodoItem[];
  filters: TodoFilter;
  selectedTodo: TodoItem | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  addTodo: (todo: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt' | 'aiGenerated' | 'subtasks'>) => string;
  updateTodo: (id: string, updates: Partial<TodoItem>) => void;
  deleteTodo: (id: string) => void;
  toggleComplete: (id: string) => void;
  addSubtask: (parentId: string, subtask: Omit<TodoItem, 'id' | 'createdAt' | 'updatedAt' | 'aiGenerated' | 'subtasks' | 'parentId'>) => string;
  removeSubtask: (parentId: string, subtaskId: string) => void;
  
  // Filtering and Search
  setFilter: (filter: Partial<TodoFilter>) => void;
  clearFilters: () => void;
  getFilteredTodos: () => TodoItem[];
  
  // Selection
  selectTodo: (todo: TodoItem | null) => void;
  
  // Statistics
  getStats: () => TodoStats;
  
  // AI Event Detection
  detectEventFromTodo: (todo: TodoItem) => boolean;
  extractEventDetails: (title: string, description?: string) => {
    isEvent: boolean;
    startTime?: Date;
    endTime?: Date;
    location?: string;
    attendees?: string[];
    reminderMinutes?: number;
  };
  
  // Bulk Operations
  bulkComplete: (ids: string[]) => void;
  bulkDelete: (ids: string[]) => void;
  bulkUpdate: (ids: string[], updates: Partial<TodoItem>) => void;
  
  // Import/Export
  importTodos: (todos: TodoItem[]) => void;
  exportTodos: () => TodoItem[];
  
  // Utilities
  generateId: () => string;
  getTodoById: (id: string) => TodoItem | undefined;
  getSubtasks: (parentId: string) => TodoItem[];
  getOverdueTodos: () => TodoItem[];
  getDueTodayTodos: () => TodoItem[];
  getDueThisWeekTodos: () => TodoItem[];
}

// AI-powered event detection patterns
const EVENT_PATTERNS = {
  timeIndicators: [
    'tomorrow', 'today', 'next week', 'next month', 'this weekend',
    'morning', 'afternoon', 'evening', 'night', 'tonight',
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'am', 'pm', 'o\'clock', 'hour', 'minute'
  ],
  eventKeywords: [
    'meeting', 'appointment', 'call', 'conference', 'presentation',
    'interview', 'session', 'workshop', 'training', 'seminar',
    'party', 'celebration', 'dinner', 'lunch', 'breakfast',
    'doctor', 'dentist', 'therapy', 'consultation', 'checkup',
    'flight', 'trip', 'travel', 'vacation', 'holiday'
  ],
  locationIndicators: [
    'at', 'in', 'on', 'room', 'office', 'building', 'center',
    'hospital', 'clinic', 'restaurant', 'cafe', 'hotel', 'airport'
  ],
  durationIndicators: [
    'for', 'duration', 'minutes', 'hours', 'days', 'weeks'
  ]
};

// AI-powered event detection function
const detectEventFromText = (title: string, description?: string): {
  isEvent: boolean;
  startTime?: Date;
  endTime?: Date;
  location?: string;
  attendees?: string[];
  reminderMinutes?: number;
} => {
  const text = `${title} ${description || ''}`.toLowerCase();
  
  // Check if it contains event-like patterns
  const hasTimeIndicators = EVENT_PATTERNS.timeIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  const hasEventKeywords = EVENT_PATTERNS.eventKeywords.some(keyword => 
    text.includes(keyword)
  );
  
  const hasLocationIndicators = EVENT_PATTERNS.locationIndicators.some(indicator => 
    text.includes(indicator)
  );
  
  // Determine if this is likely an event
  const isEvent = hasTimeIndicators && (hasEventKeywords || hasLocationIndicators);
  
  if (!isEvent) {
    return { isEvent: false };
  }
  
  // Extract event details
  let startTime: Date | undefined;
  let endTime: Date | undefined;
  let location: string | undefined;
  let attendees: string[] = [];
  let reminderMinutes: number | undefined;
  
  // Extract time information
  const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const period = timeMatch[3]?.toLowerCase();
    
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    
    const now = new Date();
    startTime = new Date(now);
    startTime.setHours(hours, minutes, 0, 0);
    
    // Default duration of 1 hour
    endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);
  }
  
  // Extract location
  const locationMatch = text.match(/(?:at|in|on)\s+([a-zA-Z0-9\s]+?)(?:\s+(?:tomorrow|today|next|this|am|pm|o'clock|hour|minute|meeting|appointment|call|conference|presentation|interview|session|workshop|training|seminar|party|celebration|dinner|lunch|breakfast|doctor|dentist|therapy|consultation|checkup|flight|trip|travel|vacation|holiday))/i);
  if (locationMatch) {
    location = locationMatch[1].trim();
  }
  
  // Extract attendees (email patterns)
  const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    attendees = emailMatches;
  }
  
  // Set default reminder
  reminderMinutes = 15;
  
  return {
    isEvent: true,
    startTime,
    endTime,
    location,
    attendees,
    reminderMinutes
  };
};

export const useTodoStore = create<TodoStore>()(
  persist(
    (set, get) => ({
      // Initial state
      todos: [],
      filters: {},
      selectedTodo: null,
      isLoading: false,
      error: null,
      
      // Add new todo
      addTodo: (todoData) => {
        const id = get().generateId();
        const now = new Date();
        
        // Detect if this is an event
        const eventDetails = get().extractEventDetails(todoData.title, todoData.description);
        
        const newTodo: TodoItem = {
          ...todoData,
          id,
          createdAt: now,
          updatedAt: now,
          aiGenerated: false,
          subtasks: [],
          ...eventDetails
        };
        
        set((state) => ({
          todos: [...state.todos, newTodo]
        }));
        
        return id;
      },
      
      // Update existing todo
      updateTodo: (id, updates) => {
        set((state) => ({
          todos: state.todos.map(todo => 
            todo.id === id 
              ? { ...todo, ...updates, updatedAt: new Date() }
              : todo
          )
        }));
      },
      
      // Delete todo
      deleteTodo: (id) => {
        set((state) => ({
          todos: state.todos.filter(todo => todo.id !== id)
        }));
      },
      
      // Toggle completion status
      toggleComplete: (id) => {
        set((state) => ({
          todos: state.todos.map(todo => 
            todo.id === id 
              ? { ...todo, completed: !todo.completed, updatedAt: new Date() }
              : todo
          )
        }));
      },
      
      // Add subtask
      addSubtask: (parentId, subtaskData) => {
        const subtaskId = get().generateId();
        const now = new Date();
        
        const newSubtask: TodoItem = {
          ...subtaskData,
          id: subtaskId,
          createdAt: now,
          updatedAt: now,
          aiGenerated: false,
          parentId,
          subtasks: []
        };
        
        // Add subtask to todos
        set((state) => ({
          todos: [...state.todos, newSubtask]
        }));
        
        // Add subtask ID to parent
        set((state) => ({
          todos: state.todos.map(todo => 
            todo.id === parentId 
              ? { ...todo, subtasks: [...todo.subtasks, subtaskId], updatedAt: new Date() }
              : todo
          )
        }));
        
        return subtaskId;
      },
      
      // Remove subtask
      removeSubtask: (parentId, subtaskId) => {
        // Remove subtask ID from parent
        set((state) => ({
          todos: state.todos.map(todo => 
            todo.id === parentId 
              ? { 
                  ...todo, 
                  subtasks: todo.subtasks.filter(id => id !== subtaskId),
                  updatedAt: new Date()
                }
              : todo
          )
        }));
        
        // Delete the subtask
        get().deleteTodo(subtaskId);
      },
      
      // Set filters
      setFilter: (filter) => {
        set((state) => ({
          filters: { ...state.filters, ...filter }
        }));
      },
      
      // Clear all filters
      clearFilters: () => {
        set({ filters: {} });
      },
      
      // Get filtered todos
      getFilteredTodos: () => {
        const { todos, filters } = get();
        let filtered = todos;
        
        if (filters.completed !== undefined) {
          filtered = filtered.filter(todo => todo.completed === filters.completed);
        }
        
        if (filters.priority) {
          filtered = filtered.filter(todo => todo.priority === filters.priority);
        }
        
        if (filters.category) {
          filtered = filtered.filter(todo => todo.category === filters.category);
        }
        
        if (filters.dueDate) {
          filtered = filtered.filter(todo => 
            todo.dueDate && todo.dueDate <= filters.dueDate!
          );
        }
        
        if (filters.tags && filters.tags.length > 0) {
          filtered = filtered.filter(todo => 
            filters.tags!.some(tag => todo.tags.includes(tag))
          );
        }
        
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(todo => 
            todo.title.toLowerCase().includes(searchLower) ||
            (todo.description && todo.description.toLowerCase().includes(searchLower))
          );
        }
        
        return filtered;
      },
      
      // Select todo
      selectTodo: (todo) => {
        set({ selectedTodo: todo });
      },
      
      // Get statistics
      getStats: () => {
        const { todos } = get();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        const stats: TodoStats = {
          total: todos.length,
          completed: todos.filter(todo => todo.completed).length,
          pending: todos.filter(todo => !todo.completed).length,
          overdue: todos.filter(todo => 
            !todo.completed && todo.dueDate && todo.dueDate < today
          ).length,
          dueToday: todos.filter(todo => 
            !todo.completed && todo.dueDate && 
            todo.dueDate >= today && todo.dueDate < weekFromNow
          ).length,
          dueThisWeek: todos.filter(todo => 
            !todo.completed && todo.dueDate && 
            todo.dueDate >= today && todo.dueDate < weekFromNow
          ).length,
          byPriority: {
            low: todos.filter(todo => todo.priority === 'low').length,
            medium: todos.filter(todo => todo.priority === 'medium').length,
            high: todos.filter(todo => todo.priority === 'high').length,
            urgent: todos.filter(todo => todo.priority === 'urgent').length
          },
          byCategory: {
            personal: todos.filter(todo => todo.category === 'personal').length,
            work: todos.filter(todo => todo.category === 'work').length,
            shopping: todos.filter(todo => todo.category === 'shopping').length,
            health: todos.filter(todo => todo.category === 'health').length,
            finance: todos.filter(todo => todo.category === 'finance').length,
            other: todos.filter(todo => todo.category === 'other').length
          }
        };
        
        return stats;
      },
      
      // AI Event Detection
      detectEventFromTodo: (todo) => {
        return todo.isEvent;
      },
      
      // Extract event details from text
      extractEventDetails: (title, description) => {
        return detectEventFromText(title, description);
      },
      
      // Bulk operations
      bulkComplete: (ids) => {
        set((state) => ({
          todos: state.todos.map(todo => 
            ids.includes(todo.id) 
              ? { ...todo, completed: true, updatedAt: new Date() }
              : todo
          )
        }));
      },
      
      bulkDelete: (ids) => {
        set((state) => ({
          todos: state.todos.filter(todo => !ids.includes(todo.id))
        }));
      },
      
      bulkUpdate: (ids, updates) => {
        set((state) => ({
          todos: state.todos.map(todo => 
            ids.includes(todo.id) 
              ? { ...todo, ...updates, updatedAt: new Date() }
              : todo
          )
        }));
      },
      
      // Import/Export
      importTodos: (todos) => {
        set({ todos });
      },
      
      exportTodos: () => {
        return get().todos;
      },
      
      // Utilities
      generateId: () => {
        return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      },
      
      getTodoById: (id) => {
        return get().todos.find(todo => todo.id === id);
      },
      
      getSubtasks: (parentId) => {
        return get().todos.filter(todo => todo.parentId === parentId);
      },
      
      getOverdueTodos: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return get().todos.filter(todo => 
          !todo.completed && todo.dueDate && todo.dueDate < today
        );
      },
      
      getDueTodayTodos: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return get().todos.filter(todo => 
          !todo.completed && todo.dueDate && 
          todo.dueDate >= today && todo.dueDate < tomorrow
        );
      },
      
      getDueThisWeekTodos: () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        
        return get().todos.filter(todo => 
          !todo.completed && todo.dueDate && 
          todo.dueDate >= today && todo.dueDate < weekFromNow
        );
      }
    }),
    {
      name: 'todo-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ 
        todos: state.todos,
        filters: state.filters
      })
    }
  )
);
