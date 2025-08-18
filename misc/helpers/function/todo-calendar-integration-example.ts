/**
 * Example of how the TODO and Calendar tools work together
 * This demonstrates the AI-powered event detection and automatic calendar creation
 */

import { TodoManager } from './todo';
import { CalendarManager } from './calendar';
import SessionManager from '../aistream/aistream';

// Example integration showing how both tools work together
export class TodoCalendarIntegration {
    private todoManager: TodoManager;
    private calendarManager: CalendarManager;

    constructor(session: SessionManager) {
        this.todoManager = new TodoManager(session);
        this.calendarManager = new CalendarManager(session);
    }

    // Example conversation flow showing the integration
    async demonstrateIntegration() {
        console.log('=== TODO + Calendar Integration Demo ===\n');

        // Example 1: User creates a task that gets detected as an event
        console.log('User: "Create a task for team meeting tomorrow at 2 PM"');
        
        // The AI will:
        // 1. Use the TODO tool to create the task
        // 2. Automatically detect it's an event
        // 3. Create a calendar event
        // 4. Link them together
        
        const todoResult = await this.todoManager.createTodo.handler({
            title: "Team meeting tomorrow at 2 PM",
            description: "Weekly team sync meeting",
            priority: "high",
            category: "work"
        });

        console.log('AI Response:', todoResult);
        console.log('Result: Task created + Calendar event created automatically!\n');

        // Example 2: User creates a simple task (no event detection)
        console.log('User: "Add buy groceries to my todo list"');
        
        const simpleTodoResult = await this.todoManager.createTodo.handler({
            title: "Buy groceries",
            description: "Milk, bread, eggs",
            priority: "medium",
            category: "shopping"
        });

        console.log('AI Response:', simpleTodoResult);
        console.log('Result: Task created (no calendar event - not detected as event)\n');

        // Example 3: User creates a task with specific time and location
        console.log('User: "Create a task for dentist appointment on Friday at 3 PM at Dr. Smith\'s office"');
        
        const appointmentResult = await this.todoManager.createTodo.handler({
            title: "Dentist appointment Friday at 3 PM at Dr. Smith's office",
            description: "Regular checkup",
            priority: "high",
            category: "health"
        });

        console.log('AI Response:', appointmentResult);
        console.log('Result: Task created + Calendar event with location!\n');

        // Example 4: User asks to see their tasks
        console.log('User: "Show me all my tasks"');
        
        const listResult = await this.todoManager.listTodos.handler({
            filter: "all",
            maxResults: 10
        });

        console.log('AI Response:', listResult);
        console.log('Result: All tasks listed with event indicators\n');

        // Example 5: User asks about calendar events
        console.log('User: "What events do I have this week?"');
        
        const calendarResult = await this.calendarManager.listEvents.handler({
            startDate: "this week",
            endDate: "next week",
            maxResults: 10
        });

        console.log('AI Response:', calendarResult);
        console.log('Result: Calendar events for the week\n');
    }

    // Example of how the AI determines what's an event
    demonstrateEventDetection() {
        console.log('=== AI Event Detection Examples ===\n');

        const examples = [
            "Team meeting tomorrow at 2 PM",
            "Buy groceries",
            "Doctor appointment on Monday at 10 AM",
            "Call mom",
            "Flight to New York on Friday at 8 AM",
            "Clean the house",
            "Dinner with friends at 7 PM",
            "Pay bills",
            "Conference call at 3 PM",
            "Take out the trash"
        ];

        examples.forEach(example => {
            const isEvent = this.detectIfEvent(example);
            console.log(`"${example}" -> ${isEvent ? 'EVENT' : 'TASK'}`);
        });
    }

    // Simple event detection logic (simplified version of what the AI uses)
    private detectIfEvent(text: string): boolean {
        const lowerText = text.toLowerCase();
        
        const timeIndicators = ['tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'am', 'pm', 'o\'clock'];
        const eventKeywords = ['meeting', 'appointment', 'call', 'conference', 'flight', 'dinner', 'lunch', 'breakfast'];
        const locationIndicators = ['at', 'in', 'on', 'office', 'hospital', 'restaurant'];
        
        const hasTime = timeIndicators.some(indicator => lowerText.includes(indicator));
        const hasEventKeyword = eventKeywords.some(keyword => lowerText.includes(keyword));
        const hasLocation = locationIndicators.some(indicator => lowerText.includes(indicator));
        
        return hasTime && (hasEventKeyword || hasLocation);
    }

    // Example conversation scenarios
    getConversationExamples() {
        return {
            "Simple Task Creation": {
                user: "Create a task to buy groceries",
                ai: "I'll create a task for buying groceries. This will be added to your TODO list.",
                result: "Task created in TODO store"
            },
            
            "Event Detection": {
                user: "Add team meeting tomorrow at 2 PM to my todo list",
                ai: "I'll create a task for your team meeting and also add it to your calendar since it's an event.",
                result: "Task created + Calendar event created automatically"
            },
            
            "Task Management": {
                user: "Show me all my work tasks",
                ai: "I'll show you all your work-related tasks.",
                result: "Filtered TODO list displayed"
            },
            
            "Calendar Integration": {
                user: "What meetings do I have this week?",
                ai: "I'll check your calendar for this week's meetings.",
                result: "Calendar events for the week displayed"
            },
            
            "Smart Updates": {
                user: "Change the team meeting time to 3 PM",
                ai: "I'll update both your TODO task and the calendar event to 3 PM.",
                result: "Both TODO and calendar updated"
            }
        };
    }

    // Example of how the tools integrate in the AI system
    getToolIntegrationExample() {
        return {
            // When user says: "Create a task for team meeting tomorrow at 2 PM"
            userInput: "Create a task for team meeting tomorrow at 2 PM",
            
            // AI analysis:
            aiAnalysis: {
                intent: "create_task",
                detectedEvent: true,
                time: "tomorrow at 2 PM",
                type: "meeting",
                category: "work"
            },
            
            // AI actions:
            actions: [
                {
                    tool: "create-todo-item",
                    params: {
                        title: "Team meeting tomorrow at 2 PM",
                        priority: "high",
                        category: "work"
                    }
                },
                {
                    tool: "create-calendar-event",
                    params: {
                        title: "Team meeting",
                        startTime: "tomorrow at 2 PM",
                        endTime: "tomorrow at 3 PM",
                        description: "Team meeting created via TODO system"
                    }
                }
            ],
            
            // Final response:
            response: "I've created a task for your team meeting and added it to your calendar for tomorrow at 2 PM. The task is marked as high priority and categorized as work."
        };
    }

    // Example of bulk operations
    getBulkOperationExample() {
        return {
            user: "Mark all my shopping tasks as complete",
            ai: "I'll find all your shopping tasks and mark them as complete.",
            actions: [
                {
                    tool: "list-todo-items",
                    params: { category: "shopping" }
                },
                {
                    tool: "bulk-complete-todos",
                    params: { todoIds: ["shopping_task_1", "shopping_task_2"] }
                }
            ],
            response: "I've marked all 2 shopping tasks as complete."
        };
    }

    // Example of search functionality
    getSearchExample() {
        return {
            user: "Find all tasks containing 'meeting'",
            ai: "I'll search your tasks for anything containing 'meeting'.",
            action: {
                tool: "search-todo-items",
                params: { query: "meeting" }
            },
            response: "I found 3 tasks containing 'meeting': Team meeting tomorrow, Client meeting on Friday, and Monthly review meeting."
        };
    }

    // Example of statistics
    getStatisticsExample() {
        return {
            user: "Show me my todo statistics",
            ai: "I'll show you a summary of your tasks and progress.",
            action: {
                tool: "get-todo-statistics",
                params: {}
            },
            response: "Here are your TODO statistics: Total: 15, Completed: 8, Pending: 7, Overdue: 2, Due today: 3, Due this week: 5. Priority breakdown: Low: 3, Medium: 8, High: 3, Urgent: 1."
        };
    }
}

// Example usage in your AI conversation handler
export async function handleTodoCalendarRequest(userInput: string, session: SessionManager) {
    const integration = new TodoCalendarIntegration(session);
    
    // Check if user wants to use TODO or Calendar functions
    if (userInput.toLowerCase().includes('todo') || userInput.toLowerCase().includes('task')) {
        // Handle TODO-related requests
        if (userInput.toLowerCase().includes('create') || userInput.toLowerCase().includes('add')) {
            return {
                tool: integration.todoManager.createTodo,
                message: "I'll help you create that task. Let me add it to your TODO list."
            };
        } else if (userInput.toLowerCase().includes('show') || userInput.toLowerCase().includes('list')) {
            return {
                tool: integration.todoManager.listTodos,
                message: "I'll show you your tasks."
            };
        } else if (userInput.toLowerCase().includes('complete') || userInput.toLowerCase().includes('mark')) {
            return {
                tool: integration.todoManager.toggleTodoComplete,
                message: "I'll mark that task as complete for you."
            };
        }
    }
    
    if (userInput.toLowerCase().includes('calendar') || userInput.toLowerCase().includes('event')) {
        // Handle Calendar-related requests
        if (userInput.toLowerCase().includes('meeting') || userInput.toLowerCase().includes('appointment')) {
            return {
                tool: integration.calendarManager.createEvent,
                message: "I'll help you schedule that event in your calendar."
            };
        } else if (userInput.toLowerCase().includes('show') || userInput.toLowerCase().includes('what')) {
            return {
                tool: integration.calendarManager.listEvents,
                message: "I'll check your calendar and show you what's scheduled."
            };
        }
    }
    
    return null;
}

// This integration provides a seamless experience where:
// 1. Users can create tasks using natural language
// 2. AI automatically detects if it's an event
// 3. Calendar events are created automatically for events
// 4. Both systems stay in sync
// 5. Users can manage everything through voice commands
