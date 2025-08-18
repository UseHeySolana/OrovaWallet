import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";
import UserItem from "@/misc/store/userstore";
import { fetchData } from "../db/db";
import WalletItem from "@/misc/store/wallet";
import { cleanNumber, convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";
import { completeConversation, getInTokenBalance, getUserDetails } from "../miscfunctions.ts";
import ToolsItem from "@/misc/store/toolsitems";
import { useTodoStore } from "@/utils/store/todostore.store";
import { CalendarManager } from "../calendar/calendar.tool";
import { CalendarUtils } from "../utils/CalendarUtils";

export class TodoManager {
    public createTodo: FunctionParams;
    public updateTodo: FunctionParams;
    public deleteTodo: FunctionParams;
    public listTodos: FunctionParams;
    public getTodoDetails: FunctionParams;
    public toggleTodoComplete: FunctionParams;
    public addSubtask: FunctionParams;
    public searchTodos: FunctionParams;
    public getTodoStats: FunctionParams;
    public bulkCompleteTodos: FunctionParams;
    public bulkDeleteTodos: FunctionParams;

    private calendarManager: CalendarManager;

    constructor(public session: SessionManager) {
        this.calendarManager = new CalendarManager(session);
        
        this.createTodo = this.create_todo_item()
        this.updateTodo = this.update_todo_item()
        this.deleteTodo = this.delete_todo_item()
        this.listTodos = this.list_todo_items()
        this.getTodoDetails = this.get_todo_details()
        this.toggleTodoComplete = this.toggle_todo_complete()
        this.addSubtask = this.add_todo_subtask()
        this.searchTodos = this.search_todo_items()
        this.getTodoStats = this.get_todo_statistics()
        this.bulkCompleteTodos = this.bulk_complete_todos()
        this.bulkDeleteTodos = this.bulk_delete_todos()
    }

    create_todo_item() {
        return {
            name: "create-todo-item",
            description: "This function is used to create a new TODO item with AI-powered event detection",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The title or description of the TODO item"
                    },
                    description: {
                        type: "string",
                        description: "Additional details about the TODO item (optional)"
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "medium", "high", "urgent"],
                        description: "Priority level of the TODO item (default: medium)"
                    },
                    category: {
                        type: "string",
                        enum: ["personal", "work", "shopping", "health", "finance", "other"],
                        description: "Category of the TODO item (default: other)"
                    },
                    dueDate: {
                        type: "string",
                        description: "Due date for the TODO item. Can be natural language like 'tomorrow' or 'next week' or specific date (optional)"
                    },
                    tags: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of tags for the TODO item (optional)"
                    }
                },
                required: ["title"],
            },
            handler: async (args: { 
                title: string, 
                description?: string, 
                priority?: 'low' | 'medium' | 'high' | 'urgent',
                category?: 'personal' | 'work' | 'shopping' | 'health' | 'finance' | 'other',
                dueDate?: string,
                tags?: string[]
            }) => {
                try {
                    // Parse due date if provided
                    let dueDate: Date | undefined;
                    if (args.dueDate) {
                        dueDate = CalendarUtils.parseNaturalLanguageDateTime(args.dueDate);
                        if (!dueDate) {
                            dueDate = CalendarUtils.fromISOString(args.dueDate);
                        }
                        if (isNaN(dueDate.getTime())) {
                            return "Invalid due date format. Please use natural language like 'tomorrow' or date format.";
                        }
                    }

                    // Create TODO item
                    const todoData = {
                        title: args.title,
                        description: args.description || "",
                        completed: false,
                        priority: args.priority || "medium",
                        category: args.category || "other",
                        dueDate,
                        tags: args.tags || []
                    };

                    // Add to store
                    const todoId = useTodoStore.getState().addTodo(todoData);
                    const newTodo = useTodoStore.getState().getTodoById(todoId);

                    if (!newTodo) {
                        return "Failed to create TODO item.";
                    }

                    let responseMessage = `TODO item "${args.title}" has been created successfully.`;

                    // Check if this TODO is detected as an event
                    if (newTodo.isEvent) {
                        responseMessage += " This appears to be an event, so I'll also create a calendar event for you.";
                        
                        // Create calendar event if it's detected as an event
                        try {
                            const calendarAccess = ToolsItem.getState().getParameterValue("Calendar", "google", 'calendar_access');
                            if (calendarAccess && calendarAccess !== "") {
                                // Extract event details from the TODO
                                const eventDetails = newTodo.eventDetails;
                                
                                if (eventDetails && eventDetails.startTime && eventDetails.endTime) {
                                    const eventData = {
                                        title: args.title,
                                        description: args.description || "",
                                        startTime: CalendarUtils.toISOStringWithTimezone(eventDetails.startTime),
                                        endTime: CalendarUtils.toISOStringWithTimezone(eventDetails.endTime),
                                        location: eventDetails.location || "",
                                        attendees: eventDetails.attendees || [],
                                        reminderMinutes: eventDetails.reminderMinutes || 15
                                    };

                                    // Create calendar event
                                    const calendarResult = await this.calendarManager.calendarService.createEvent(eventData);
                                    
                                    if (calendarResult.success) {
                                        responseMessage += ` Calendar event created successfully with ID: ${calendarResult.eventId}.`;
                                        
                                        // Update TODO with calendar event ID
                                        useTodoStore.getState().updateTodo(todoId, {
                                            eventDetails: {
                                                ...eventDetails,
                                                calendarEventId: calendarResult.eventId
                                            }
                                        });
                                    } else {
                                        responseMessage += ` However, I couldn't create the calendar event: ${calendarResult.error}.`;
                                    }
                                } else {
                                    responseMessage += " However, I couldn't determine the exact time for the calendar event.";
                                }
                            } else {
                                responseMessage += " To create calendar events, please set up Google Calendar integration first.";
                            }
                        } catch (error) {
                            responseMessage += " There was an issue creating the calendar event, but your TODO item was saved.";
                        }
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `TODO item created with ID: ${todoId}`);
                    }

                    return await convertSpeech(responseMessage);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to create TODO item. Please try again.');
                }
            }
        }
    }

    update_todo_item() {
        return {
            name: "update-todo-item",
            description: "This function is used to update an existing TODO item",
            parameters: {
                type: "object",
                properties: {
                    todoId: {
                        type: "string",
                        description: "The unique identifier of the TODO item to update"
                    },
                    title: {
                        type: "string",
                        description: "The new title for the TODO item (optional)"
                    },
                    description: {
                        type: "string",
                        description: "The new description for the TODO item (optional)"
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "medium", "high", "urgent"],
                        description: "The new priority level (optional)"
                    },
                    category: {
                        type: "string",
                        enum: ["personal", "work", "shopping", "health", "finance", "other"],
                        description: "The new category (optional)"
                    },
                    dueDate: {
                        type: "string",
                        description: "The new due date in natural language or date format (optional)"
                    },
                    tags: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "The new tags array (optional)"
                    }
                },
                required: ["todoId"],
            },
            handler: async (args: { 
                todoId: string, 
                title?: string, 
                description?: string, 
                priority?: 'low' | 'medium' | 'high' | 'urgent',
                category?: 'personal' | 'work' | 'shopping' | 'health' | 'finance' | 'other',
                dueDate?: string,
                tags?: string[]
            }) => {
                try {
                    if (!args.todoId) {
                        return "TODO ID is required to update an item.";
                    }

                    // Check if TODO exists
                    const existingTodo = useTodoStore.getState().getTodoById(args.todoId);
                    if (!existingTodo) {
                        return "TODO item not found. Please check the ID.";
                    }

                    // Parse due date if provided
                    let dueDate: Date | undefined;
                    if (args.dueDate) {
                        dueDate = CalendarUtils.parseNaturalLanguageDateTime(args.dueDate);
                        if (!dueDate) {
                            dueDate = CalendarUtils.fromISOString(args.dueDate);
                        }
                        if (isNaN(dueDate.getTime())) {
                            return "Invalid due date format. Please use natural language or date format.";
                        }
                    }

                    // Prepare update data
                    const updateData: any = {};
                    if (args.title) updateData.title = args.title;
                    if (args.description !== undefined) updateData.description = args.description;
                    if (args.priority) updateData.priority = args.priority;
                    if (args.category) updateData.category = args.category;
                    if (dueDate) updateData.dueDate = dueDate;
                    if (args.tags) updateData.tags = args.tags;

                    // Update TODO
                    useTodoStore.getState().updateTodo(args.todoId, updateData);

                    // Check if this update affects the calendar event
                    if (existingTodo.isEvent && existingTodo.eventDetails?.calendarEventId) {
                        try {
                            const calendarAccess = ToolsItem.getState().getParameterValue("Calendar", "google", 'calendar_access');
                            if (calendarAccess && calendarAccess !== "") {
                                // Update calendar event if title or description changed
                                if (args.title || args.description) {
                                    const calendarUpdateData: any = {};
                                    if (args.title) calendarUpdateData.title = args.title;
                                    if (args.description !== undefined) calendarUpdateData.description = args.description;

                                    await this.calendarManager.calendarService.updateEvent(
                                        existingTodo.eventDetails.calendarEventId,
                                        calendarUpdateData
                                    );
                                }
                            }
                        } catch (error) {
                            // Calendar update failed, but TODO was updated
                            console.log('Calendar event update failed:', error);
                        }
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `TODO item ${args.todoId} updated successfully`);
                    }

                    return await convertSpeech(`TODO item has been updated successfully.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to update TODO item. Please try again.');
                }
            }
        }
    }

    delete_todo_item() {
        return {
            name: "delete-todo-item",
            description: "This function is used to delete a TODO item",
            parameters: {
                type: "object",
                properties: {
                    todoId: {
                        type: "string",
                        description: "The unique identifier of the TODO item to delete"
                    }
                },
                required: ["todoId"],
            },
            handler: async (args: { todoId: string }) => {
                try {
                    if (!args.todoId) {
                        return "TODO ID is required to delete an item.";
                    }

                    // Check if TODO exists
                    const existingTodo = useTodoStore.getState().getTodoById(args.todoId);
                    if (!existingTodo) {
                        return "TODO item not found. Please check the ID.";
                    }

                    // Delete associated calendar event if it exists
                    if (existingTodo.isEvent && existingTodo.eventDetails?.calendarEventId) {
                        try {
                            const calendarAccess = ToolsItem.getState().getParameterValue("Calendar", "google", 'calendar_access');
                            if (calendarAccess && calendarAccess !== "") {
                                await this.calendarManager.calendarService.deleteEvent(
                                    existingTodo.eventDetails.calendarEventId
                                );
                            }
                        } catch (error) {
                            // Calendar deletion failed, but TODO will be deleted
                            console.log('Calendar event deletion failed:', error);
                        }
                    }

                    // Delete TODO
                    useTodoStore.getState().deleteTodo(args.todoId);

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `TODO item ${args.todoId} deleted successfully`);
                    }

                    return await convertSpeech(`TODO item has been deleted successfully.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to delete TODO item. Please try again.');
                }
            }
        }
    }

    list_todo_items() {
        return {
            name: "list-todo-items",
            description: "This function is used to list TODO items with optional filtering",
            parameters: {
                type: "object",
                properties: {
                    filter: {
                        type: "string",
                        enum: ["all", "pending", "completed", "overdue", "due_today", "due_this_week"],
                        description: "Filter to apply to the TODO list (default: all)"
                    },
                    category: {
                        type: "string",
                        enum: ["personal", "work", "shopping", "health", "finance", "other"],
                        description: "Filter by specific category (optional)"
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "medium", "high", "urgent"],
                        description: "Filter by specific priority (optional)"
                    },
                    maxResults: {
                        type: "number",
                        description: "Maximum number of items to return (default: 20)"
                    }
                },
                required: [],
            },
            handler: async (args: { 
                filter?: string, 
                category?: string, 
                priority?: string, 
                maxResults?: number 
            }) => {
                try {
                    const { todos } = useTodoStore.getState();
                    let filteredTodos = todos;
                    const maxResults = args.maxResults || 20;

                    // Apply filters
                    if (args.filter) {
                        switch (args.filter) {
                            case 'pending':
                                filteredTodos = filteredTodos.filter(todo => !todo.completed);
                                break;
                            case 'completed':
                                filteredTodos = filteredTodos.filter(todo => todo.completed);
                                break;
                            case 'overdue':
                                filteredTodos = useTodoStore.getState().getOverdueTodos();
                                break;
                            case 'due_today':
                                filteredTodos = useTodoStore.getState().getDueTodayTodos();
                                break;
                            case 'due_this_week':
                                filteredTodos = useTodoStore.getState().getDueThisWeekTodos();
                                break;
                        }
                    }

                    if (args.category) {
                        filteredTodos = filteredTodos.filter(todo => todo.category === args.category);
                    }

                    if (args.priority) {
                        filteredTodos = filteredTodos.filter(todo => todo.priority === args.priority);
                    }

                    // Limit results
                    filteredTodos = filteredTodos.slice(0, maxResults);

                    if (filteredTodos.length === 0) {
                        return await convertSpeech("No TODO items found matching your criteria.");
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Found ${filteredTodos.length} TODO items`);
                    }

                    const todoList = filteredTodos.map(todo => {
                        const status = todo.completed ? "✓" : "○";
                        const priority = todo.priority.charAt(0).toUpperCase();
                        const dueInfo = todo.dueDate ? ` (due: ${CalendarUtils.formatDate(todo.dueDate, 'short')})` : '';
                        const eventInfo = todo.isEvent ? " [EVENT]" : "";
                        
                        return `${status} ${priority} ${todo.title}${dueInfo}${eventInfo}`;
                    }).join(", ");

                    return await convertSpeech(`Found ${filteredTodos.length} TODO items: ${todoList}`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to list TODO items. Please try again.');
                }
            }
        }
    }

    get_todo_details() {
        return {
            name: "get-todo-details",
            description: "This function is used to get detailed information about a specific TODO item",
            parameters: {
                type: "object",
                properties: {
                    todoId: {
                        type: "string",
                        description: "The unique identifier of the TODO item to get details for"
                    }
                },
                required: ["todoId"],
            },
            handler: async (args: { todoId: string }) => {
                try {
                    if (!args.todoId) {
                        return "TODO ID is required to get item details.";
                    }

                    const todo = useTodoStore.getState().getTodoById(args.todoId);
                    if (!todo) {
                        return "TODO item not found. Please check the ID.";
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `TODO details retrieved for ${args.todoId}`);
                    }

                    let details = `TODO: ${todo.title}. Status: ${todo.completed ? 'Completed' : 'Pending'}. Priority: ${todo.priority}. Category: ${todo.category}.`;
                    
                    if (todo.description) {
                        details += ` Description: ${todo.description}.`;
                    }
                    
                    if (todo.dueDate) {
                        details += ` Due: ${CalendarUtils.formatDate(todo.dueDate, 'long')}.`;
                    }
                    
                    if (todo.tags && todo.tags.length > 0) {
                        details += ` Tags: ${todo.tags.join(', ')}.`;
                    }
                    
                    if (todo.isEvent) {
                        details += ` This is also a calendar event.`;
                        if (todo.eventDetails?.location) {
                            details += ` Location: ${todo.eventDetails.location}.`;
                        }
                        if (todo.eventDetails?.startTime) {
                            details += ` Time: ${CalendarUtils.formatDate(todo.eventDetails.startTime, 'time')}.`;
                        }
                    }

                    return await convertSpeech(details);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to get TODO details. Please try again.');
                }
            }
        }
    }

    toggle_todo_complete() {
        return {
            name: "toggle-todo-complete",
            description: "This function is used to toggle the completion status of a TODO item",
            parameters: {
                type: "object",
                properties: {
                    todoId: {
                        type: "string",
                        description: "The unique identifier of the TODO item to toggle"
                    }
                },
                required: ["todoId"],
            },
            handler: async (args: { todoId: string }) => {
                try {
                    if (!args.todoId) {
                        return "TODO ID is required to toggle completion status.";
                    }

                    const todo = useTodoStore.getState().getTodoById(args.todoId);
                    if (!todo) {
                        return "TODO item not found. Please check the ID.";
                    }

                    // Toggle completion
                    useTodoStore.getState().toggleComplete(args.todoId);
                    const newStatus = !todo.completed;

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `TODO item ${args.todoId} ${newStatus ? 'completed' : 'marked as pending'}`);
                    }

                    return await convertSpeech(`TODO item "${todo.title}" has been ${newStatus ? 'marked as completed' : 'marked as pending'}.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to toggle TODO completion status. Please try again.');
                }
            }
        }
    }

    add_todo_subtask() {
        return {
            name: "add-todo-subtask",
            description: "This function is used to add a subtask to an existing TODO item",
            parameters: {
                type: "object",
                properties: {
                    parentId: {
                        type: "string",
                        description: "The unique identifier of the parent TODO item"
                    },
                    title: {
                        type: "string",
                        description: "The title of the subtask"
                    },
                    description: {
                        type: "string",
                        description: "Additional details about the subtask (optional)"
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "medium", "high", "urgent"],
                        description: "Priority level of the subtask (default: same as parent)"
                    }
                },
                required: ["parentId", "title"],
            },
            handler: async (args: { 
                parentId: string, 
                title: string, 
                description?: string, 
                priority?: 'low' | 'medium' | 'high' | 'urgent'
            }) => {
                try {
                    if (!args.parentId || !args.title) {
                        return "Parent ID and title are required to create a subtask.";
                    }

                    const parentTodo = useTodoStore.getState().getTodoById(args.parentId);
                    if (!parentTodo) {
                        return "Parent TODO item not found. Please check the ID.";
                    }

                    // Create subtask
                    const subtaskData = {
                        title: args.title,
                        description: args.description || "",
                        completed: false,
                        priority: args.priority || parentTodo.priority,
                        category: parentTodo.category,
                        tags: [],
                        isEvent: false
                    };

                    const subtaskId = useTodoStore.getState().addSubtask(args.parentId, subtaskData);

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Subtask created with ID: ${subtaskId}`);
                    }

                    return await convertSpeech(`Subtask "${args.title}" has been added to "${parentTodo.title}" successfully.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to create subtask. Please try again.');
                }
            }
        }
    }

    search_todo_items() {
        return {
            name: "search-todo-items",
            description: "This function is used to search TODO items by text",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query to find TODO items"
                    },
                    maxResults: {
                        type: "number",
                        description: "Maximum number of results to return (default: 10)"
                    }
                },
                required: ["query"],
            },
            handler: async (args: { query: string, maxResults?: number }) => {
                try {
                    if (!args.query) {
                        return "Search query is required.";
                    }

                    const maxResults = args.maxResults || 10;

                    // Set search filter
                    useTodoStore.getState().setFilter({ search: args.query });
                    const filteredTodos = useTodoStore.getState().getFilteredTodos();
                    
                    // Limit results
                    const searchResults = filteredTodos.slice(0, maxResults);

                    if (searchResults.length === 0) {
                        return await convertSpeech(`No TODO items found matching "${args.query}".`);
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Found ${searchResults.length} TODO items matching "${args.query}"`);
                    }

                    const resultList = searchResults.map(todo => {
                        const status = todo.completed ? "✓" : "○";
                        const priority = todo.priority.charAt(0).toUpperCase();
                        return `${status} ${priority} ${todo.title}`;
                    }).join(", ");

                    return await convertSpeech(`Found ${searchResults.length} TODO items matching "${args.query}": ${resultList}`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to search TODO items. Please try again.');
                }
            }
        }
    }

    get_todo_statistics() {
        return {
            name: "get-todo-statistics",
            description: "This function is used to get statistics about TODO items",
            parameters: {
                type: "object",
                properties: {},
            },
            handler: async () => {
                try {
                    const stats = useTodoStore.getState().getStats();

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Retrieved TODO statistics`);
                    }

                    const statsMessage = `Here are your TODO statistics: Total: ${stats.total}, Completed: ${stats.completed}, Pending: ${stats.pending}, Overdue: ${stats.overdue}, Due today: ${stats.dueToday}, Due this week: ${stats.dueThisWeek}. Priority breakdown: Low: ${stats.byPriority.low}, Medium: ${stats.byPriority.medium}, High: ${stats.byPriority.high}, Urgent: ${stats.byPriority.urgent}.`;

                    return await convertSpeech(statsMessage);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to get TODO statistics. Please try again.');
                }
            }
        }
    }

    bulk_complete_todos() {
        return {
            name: "bulk-complete-todos",
            description: "This function is used to mark multiple TODO items as completed",
            parameters: {
                type: "object",
                properties: {
                    todoIds: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of TODO item IDs to mark as completed"
                    }
                },
                required: ["todoIds"],
            },
            handler: async (args: { todoIds: string[] }) => {
                try {
                    if (!args.todoIds || args.todoIds.length === 0) {
                        return "TODO IDs are required to bulk complete items.";
                    }

                    // Complete todos
                    useTodoStore.getState().bulkComplete(args.todoIds);

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Bulk completed ${args.todoIds.length} TODO items`);
                    }

                    return await convertSpeech(`Successfully marked ${args.todoIds.length} TODO items as completed.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to bulk complete TODO items. Please try again.');
                }
            }
        }
    }

    bulk_delete_todos() {
        return {
            name: "bulk-delete-todos",
            description: "This function is used to delete multiple TODO items",
            parameters: {
                type: "object",
                properties: {
                    todoIds: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of TODO item IDs to delete"
                    }
                },
                required: ["todoIds"],
            },
            handler: async (args: { todoIds: string[] }) => {
                try {
                    if (!args.todoIds || args.todoIds.length === 0) {
                        return "TODO IDs are required to bulk delete items.";
                    }

                    // Delete todos
                    useTodoStore.getState().bulkDelete(args.todoIds);

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Bulk deleted ${args.todoIds.length} TODO items`);
                    }

                    return await convertSpeech(`Successfully deleted ${args.todoIds.length} TODO items.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to bulk delete TODO items. Please try again.');
                }
            }
        }
    }
}
