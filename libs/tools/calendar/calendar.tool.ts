import AppSettings from "@/misc/store/settingsstore";
import SessionManager from "../aistream/aistream";
import { FunctionParams } from "../types";
import UserItem from "@/misc/store/userstore";
import { fetchData } from "../db/db";
import WalletItem from "@/misc/store/wallet";
import { cleanNumber, convertSpeech, signTransactions } from "../miscfunctions.ts/extrafunctions";
import { completeConversation, getInTokenBalance, getUserDetails } from "../miscfunctions.ts";
import ToolsItem from "@/misc/store/toolsitems";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { CalendarUtils } from "../utils/CalendarUtils";
import { GOOGLE_CALENDAR_CONFIG } from "../config/GoogleCalendarConfig";

export class CalendarManager {
    public createEvent: FunctionParams;
    public updateEvent: FunctionParams;
    public deleteEvent: FunctionParams;
    public listEvents: FunctionParams;
    public getEventDetails: FunctionParams;
    public setReminder: FunctionParams;
    public findAvailableSlots: FunctionParams;
    public createRecurringEvent: FunctionParams;

    private calendarService: GoogleCalendarService;

    constructor(public session: SessionManager) {
        this.calendarService = new GoogleCalendarService({
            clientId: GOOGLE_CALENDAR_CONFIG.clientId,
            clientSecret: GOOGLE_CALENDAR_CONFIG.clientSecret,
            redirectUri: GOOGLE_CALENDAR_CONFIG.redirectUri,
            scopes: GOOGLE_CALENDAR_CONFIG.scopes
        });

        this.createEvent = this.create_calendar_event()
        this.updateEvent = this.update_calendar_event()
        this.deleteEvent = this.delete_calendar_event()
        this.listEvents = this.list_calendar_events()
        this.getEventDetails = this.get_event_details()
        this.setReminder = this.set_event_reminder()
        this.findAvailableSlots = this.find_available_slots()
        this.createRecurringEvent = this.create_recurring_event()
    }

    create_calendar_event() {
        return {
            name: "create-calendar-event",
            description: "This function is used to create a new calendar event in Google Calendar",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The title or name of the calendar event"
                    },
                    description: {
                        type: "string",
                        description: "A detailed description of the event"
                    },
                    startTime: {
                        type: "string",
                        description: "The start date and time of the event. Can be natural language like 'tomorrow at 2 PM' or ISO format"
                    },
                    endTime: {
                        type: "string",
                        description: "The end date and time of the event. Can be natural language like 'tomorrow at 3 PM' or ISO format"
                    },
                    location: {
                        type: "string",
                        description: "The location where the event will take place (optional)"
                    },
                    attendees: {
                        type: "array",
                        items: {
                            type: "string"
                        },
                        description: "Array of email addresses to invite to the event (optional)"
                    },
                    reminderMinutes: {
                        type: "number",
                        description: "Minutes before the event to set a reminder (optional, default: 15)"
                    }
                },
                required: ["title", "startTime", "endTime"],
            },
            handler: async (args: { 
                title: string, 
                description?: string, 
                startTime: string, 
                endTime: string, 
                location?: string, 
                attendees?: string[],
                reminderMinutes?: number
            }) => {
                try {
                    // Check if user has calendar access configured
                    const calendarAccess = ToolsItem.getState().getParameterValue("Calendar", "google", 'calendar_access');
                    if (!calendarAccess || calendarAccess === "") {
                        return "You have not configured Google Calendar access yet. Please set up your calendar integration first.";
                    }

                    // Parse natural language dates
                    let startDate = CalendarUtils.parseNaturalLanguageDateTime(args.startTime);
                    let endDate = CalendarUtils.parseNaturalLanguageDateTime(args.endTime);

                    // If natural language parsing failed, try ISO format
                    if (!startDate) {
                        startDate = CalendarUtils.fromISOString(args.startTime);
                    }
                    if (!endDate) {
                        endDate = CalendarUtils.fromISOString(args.endTime);
                    }

                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        return "Invalid date format. Please use natural language like 'tomorrow at 2 PM' or ISO format.";
                    }

                    // Validate date range
                    const validation = CalendarUtils.validateDateRange(startDate, endDate);
                    if (!validation.valid) {
                        return validation.error;
                    }

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        const authResult = await this.calendarService.authenticate();
                        if (!authResult) {
                            return "Failed to authenticate with Google Calendar. Please try again.";
                        }
                    }

                    // Create event object
                    const eventData = {
                        title: args.title,
                        description: args.description || "",
                        startTime: CalendarUtils.toISOStringWithTimezone(startDate),
                        endTime: CalendarUtils.toISOStringWithTimezone(endDate),
                        location: args.location || "",
                        attendees: args.attendees || [],
                        reminders: args.reminderMinutes ? [{
                            method: 'popup' as const,
                            minutes: args.reminderMinutes
                        }] : []
                    };

                    // Create event using Google Calendar service
                    const result = await this.calendarService.createEvent(eventData);
                    
                    if (result.success) {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Calendar event created with ID: ${result.eventId}`);
                        }

                        const duration = CalendarUtils.calculateDuration(startDate, endDate);
                        const durationText = duration < 60 ? `${duration} minutes` : `${Math.round(duration / 60)} hours`;
                        
                        return await convertSpeech(`Calendar event "${args.title}" has been created successfully for ${CalendarUtils.formatDate(startDate, 'long')} at ${CalendarUtils.formatDate(startDate, 'time')}. Duration: ${durationText}.`);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to create calendar event: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to create calendar event. Please try again.');
                }
            }
        }
    }

    update_calendar_event() {
        return {
            name: "update-calendar-event",
            description: "This function is used to update an existing calendar event",
            parameters: {
                type: "object",
                properties: {
                    eventId: {
                        type: "string",
                        description: "The unique identifier of the event to update"
                    },
                    title: {
                        type: "string",
                        description: "The new title for the event (optional)"
                    },
                    description: {
                        type: "string",
                        description: "The new description for the event (optional)"
                    },
                    startTime: {
                        type: "string",
                        description: "The new start time in natural language or ISO format (optional)"
                    },
                    endTime: {
                        type: "string",
                        description: "The new end time in natural language or ISO format (optional)"
                    },
                    location: {
                        type: "string",
                        description: "The new location for the event (optional)"
                    }
                },
                required: ["eventId"],
            },
            handler: async (args: { 
                eventId: string, 
                title?: string, 
                description?: string, 
                startTime?: string, 
                endTime?: string, 
                location?: string 
            }) => {
                try {
                    if (!args.eventId) {
                        return "Event ID is required to update an event.";
                    }

                    // Parse dates if provided
                    let startDate: Date | undefined;
                    let endDate: Date | undefined;

                    if (args.startTime) {
                        const parsedStart = CalendarUtils.parseNaturalLanguageDateTime(args.startTime);
                        startDate = parsedStart || CalendarUtils.fromISOString(args.startTime);
                        if (startDate && isNaN(startDate.getTime())) {
                            return "Invalid start time format. Please use natural language or ISO format.";
                        }
                    }

                    if (args.endTime) {
                        const parsedEnd = CalendarUtils.parseNaturalLanguageDateTime(args.endTime);
                        endDate = parsedEnd || CalendarUtils.fromISOString(args.endTime);
                        if (endDate && isNaN(endDate.getTime())) {
                            return "Invalid end time format. Please use natural language or ISO format.";
                        }
                    }

                    // Validate date range if both dates are provided
                    if (startDate && endDate) {
                        const validation = CalendarUtils.validateDateRange(startDate, endDate);
                        if (!validation.valid) {
                            return validation.error;
                        }
                    }

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // Prepare update data
                    const updateData: any = {};
                    if (args.title) updateData.title = args.title;
                    if (args.description !== undefined) updateData.description = args.description;
                    if (startDate) updateData.startTime = CalendarUtils.toISOStringWithTimezone(startDate);
                    if (endDate) updateData.endTime = CalendarUtils.toISOStringWithTimezone(endDate);
                    if (args.location !== undefined) updateData.location = args.location;

                    // Update event using Google Calendar service
                    const result = await this.calendarService.updateEvent(args.eventId, updateData);

                    if (result.success) {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Event ${args.eventId} updated successfully`);
                        }

                        return await convertSpeech(`Calendar event has been updated successfully.`);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to update calendar event: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to update calendar event. Please try again.');
                }
            }
        }
    }

    delete_calendar_event() {
        return {
            name: "delete-calendar-event",
            description: "This function is used to delete a calendar event",
            parameters: {
                type: "object",
                properties: {
                    eventId: {
                        type: "string",
                        description: "The unique identifier of the event to delete"
                    }
                },
                required: ["eventId"],
            },
            handler: async (args: { eventId: string }) => {
                try {
                    if (!args.eventId) {
                        return "Event ID is required to delete an event.";
                    }

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // Delete event using Google Calendar service
                    const result = await this.calendarService.deleteEvent(args.eventId);

                    if (result.success) {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Event ${args.eventId} deleted successfully`);
                        }

                        return await convertSpeech(`Calendar event has been deleted successfully.`);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to delete calendar event: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to delete calendar event. Please try again.');
                }
            }
        }
    }

    list_calendar_events() {
        return {
            name: "list-calendar-events",
            description: "This function is used to list calendar events for a specific date range",
            parameters: {
                type: "object",
                properties: {
                    startDate: {
                        type: "string",
                        description: "Start date for the range. Can be natural language like 'today' or 'tomorrow' or date format"
                    },
                    endDate: {
                        type: "string",
                        description: "End date for the range. Can be natural language like 'next week' or date format"
                    },
                    maxResults: {
                        type: "number",
                        description: "Maximum number of events to return (default: 10)"
                    }
                },
                required: ["startDate", "endDate"],
            },
            handler: async (args: { startDate: string, endDate: string, maxResults?: number }) => {
                try {
                    // Parse dates
                    let start = CalendarUtils.parseNaturalLanguageDateTime(args.startDate);
                    let end = CalendarUtils.parseNaturalLanguageDateTime(args.endDate);

                    if (!start) {
                        start = CalendarUtils.fromISOString(args.startDate);
                    }
                    if (!end) {
                        end = CalendarUtils.fromISOString(args.endDate);
                    }

                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        return "Invalid date format. Please use natural language like 'today' or date format.";
                    }

                    if (start > end) {
                        return "Start date must be before or equal to end date.";
                    }

                    const maxResults = args.maxResults || 10;

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // List events using Google Calendar service
                    const result = await this.calendarService.listEvents(
                        CalendarUtils.toISOStringWithTimezone(start),
                        CalendarUtils.toISOStringWithTimezone(end),
                        maxResults
                    );

                    if (result.success && result.events) {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Found ${result.events.length} events`);
                        }

                        if (result.events.length === 0) {
                            return await convertSpeech("No events found for the specified date range.");
                        }

                        const eventList = result.events.map(event => {
                            const startTime = CalendarUtils.fromISOString(event.startTime);
                            const endTime = CalendarUtils.fromISOString(event.endTime);
                            const duration = CalendarUtils.calculateDuration(startTime, endTime);
                            const durationText = duration < 60 ? `${duration} minutes` : `${Math.round(duration / 60)} hours`;
                            
                            return `${event.title} on ${CalendarUtils.formatDate(startTime, 'short')} from ${CalendarUtils.formatDate(startTime, 'time')} to ${CalendarUtils.formatDate(endTime, 'time')} (${durationText})`;
                        }).join(", ");

                        return await convertSpeech(`Found ${result.events.length} events: ${eventList}`);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to fetch calendar events: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to fetch calendar events. Please try again.');
                }
            }
        }
    }

    get_event_details() {
        return {
            name: "get-event-details",
            description: "This function is used to get detailed information about a specific calendar event",
            parameters: {
                type: "object",
                properties: {
                    eventId: {
                        type: "string",
                        description: "The unique identifier of the event to get details for"
                    }
                },
                required: ["eventId"],
            },
            handler: async (args: { eventId: string }) => {
                try {
                    if (!args.eventId) {
                        return "Event ID is required to get event details.";
                    }

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // Get event details using Google Calendar service
                    const result = await this.calendarService.getEventDetails(args.eventId);

                    if (result.success && result.event) {
                        const event = result.event;
                        const startTime = CalendarUtils.fromISOString(event.startTime);
                        const endTime = CalendarUtils.fromISOString(event.endTime);
                        const duration = CalendarUtils.calculateDuration(startTime, endTime);
                        const durationText = duration < 60 ? `${duration} minutes` : `${Math.round(duration / 60)} hours`;

                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Event details retrieved for ${args.eventId}`);
                        }

                        let details = `Event: ${event.title}. It's scheduled for ${CalendarUtils.formatDate(startTime, 'long')} from ${CalendarUtils.formatDate(startTime, 'time')} to ${CalendarUtils.formatDate(endTime, 'time')}. Duration: ${durationText}.`;
                        
                        if (event.location) {
                            details += ` Location: ${event.location}.`;
                        }
                        
                        if (event.description) {
                            details += ` Description: ${event.description}.`;
                        }
                        
                        if (event.attendees && event.attendees.length > 0) {
                            details += ` Attendees: ${event.attendees.join(', ')}.`;
                        }

                        return await convertSpeech(details);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to get event details: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to get event details. Please try again.');
                }
            }
        }
    }

    set_event_reminder() {
        return {
            name: "set-event-reminder",
            description: "This function is used to set a reminder for a calendar event",
            parameters: {
                type: "object",
                properties: {
                    eventId: {
                        type: "string",
                        description: "The unique identifier of the event to set a reminder for"
                    },
                    reminderTime: {
                        type: "number",
                        description: "Minutes before the event to trigger the reminder (e.g., 15 for 15 minutes before)"
                    },
                    reminderType: {
                        type: "string",
                        enum: ["popup", "email", "sms"],
                        description: "Type of reminder to set (default: popup)"
                    }
                },
                required: ["eventId", "reminderTime"],
            },
            handler: async (args: { eventId: string, reminderTime: number, reminderType?: string }) => {
                try {
                    if (!args.eventId) {
                        return "Event ID is required to set a reminder.";
                    }

                    if (args.reminderTime < 0) {
                        return "Reminder time must be a positive number.";
                    }

                    const reminderType = args.reminderType || "popup";

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // Set reminder using Google Calendar service
                    const result = await this.calendarService.setEventReminder(args.eventId, {
                        method: reminderType as 'popup' | 'email' | 'sms',
                        minutes: args.reminderTime
                    });

                    if (result.success) {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'complete', `Reminder set for event ${args.eventId}`);
                        }

                        return await convertSpeech(`Reminder set for ${args.reminderTime} minutes before the event using ${reminderType} notification.`);
                    } else {
                        const messageId = this.session.functionMessageId;
                        if (messageId !== null) {
                            completeConversation(messageId, 'failed');
                        }
                        return await convertSpeech(`Failed to set reminder: ${result.error}`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to set event reminder. Please try again.');
                }
            }
        }
    }

    find_available_slots() {
        return {
            name: "find-available-slots",
            description: "This function is used to find available time slots for scheduling events",
            parameters: {
                type: "object",
                properties: {
                    startDate: {
                        type: "string",
                        description: "Start date for the search range. Can be natural language like 'tomorrow' or date format"
                    },
                    endDate: {
                        type: "string",
                        description: "End date for the search range. Can be natural language like 'next week' or date format"
                    },
                    duration: {
                        type: "number",
                        description: "Duration of the event in minutes (default: 60)"
                    },
                    workingHours: {
                        type: "object",
                        properties: {
                            start: { type: "number", description: "Start hour (0-23, default: 9)" },
                            end: { type: "number", description: "End hour (0-23, default: 17)" }
                        },
                        description: "Working hours for finding available slots"
                    }
                },
                required: ["startDate", "endDate"],
            },
            handler: async (args: { 
                startDate: string, 
                endDate: string, 
                duration?: number, 
                workingHours?: { start: number; end: number } 
            }) => {
                try {
                    // Parse dates
                    let start = CalendarUtils.parseNaturalLanguageDateTime(args.startDate);
                    let end = CalendarUtils.parseNaturalLanguageDateTime(args.endDate);

                    if (!start) {
                        start = CalendarUtils.fromISOString(args.startDate);
                    }
                    if (!end) {
                        end = CalendarUtils.fromISOString(args.endDate);
                    }

                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        return "Invalid date format. Please use natural language like 'tomorrow' or date format.";
                    }

                    if (start > end) {
                        return "Start date must be before or equal to end date.";
                    }

                    const duration = args.duration || 60;
                    const workingHours = args.workingHours || { start: 9, end: 17 };

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        return "Not authenticated with Google Calendar. Please create an event first to authenticate.";
                    }

                    // Get busy slots from calendar
                    const busyResult = await this.calendarService.listEvents(
                        CalendarUtils.toISOStringWithTimezone(start),
                        CalendarUtils.toISOStringWithTimezone(end),
                        100
                    );

                    if (!busyResult.success) {
                        return `Failed to fetch calendar events: ${busyResult.error}`;
                    }

                    // Convert events to time slots
                    const busySlots = (busyResult.events || []).map(event => ({
                        start: CalendarUtils.fromISOString(event.startTime),
                        end: CalendarUtils.fromISOString(event.endTime),
                        duration: CalendarUtils.calculateDuration(
                            CalendarUtils.fromISOString(event.startTime),
                            CalendarUtils.fromISOString(event.endTime)
                        )
                    }));

                    // Find available slots
                    const availableSlots = CalendarUtils.findAvailableSlots(
                        { start, end },
                        busySlots,
                        duration,
                        workingHours
                    );

                    if (availableSlots.length === 0) {
                        return await convertSpeech("No available time slots found for the specified criteria.");
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Found ${availableSlots.length} available slots`);
                    }

                    const slotList = availableSlots.slice(0, 5).map(slot => 
                        `${CalendarUtils.formatDate(slot.start, 'short')} at ${CalendarUtils.formatDate(slot.start, 'time')}`
                    ).join(", ");

                    const moreText = availableSlots.length > 5 ? ` and ${availableSlots.length - 5} more` : '';

                    return await convertSpeech(`Found ${availableSlots.length} available ${duration}-minute slots: ${slotList}${moreText}.`);
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to find available time slots. Please try again.');
                }
            }
        }
    }

    create_recurring_event() {
        return {
            name: "create-recurring-event",
            description: "This function is used to create a recurring calendar event",
            parameters: {
                type: "object",
                properties: {
                    title: {
                        type: "string",
                        description: "The title or name of the calendar event"
                    },
                    description: {
                        type: "string",
                        description: "A detailed description of the event"
                    },
                    startTime: {
                        type: "string",
                        description: "The start date and time of the first event. Can be natural language or ISO format"
                    },
                    endTime: {
                        type: "string",
                        description: "The end date and time of the first event. Can be natural language or ISO format"
                    },
                    frequency: {
                        type: "string",
                        enum: ["daily", "weekly", "monthly", "yearly"],
                        description: "How often the event should repeat"
                    },
                    interval: {
                        type: "number",
                        description: "Every X days/weeks/months/years (default: 1)"
                    },
                    endDate: {
                        type: "string",
                        description: "When to stop repeating the event (optional)"
                    },
                    maxOccurrences: {
                        type: "number",
                        description: "Maximum number of event occurrences (default: 50)"
                    },
                    location: {
                        type: "string",
                        description: "The location where the event will take place (optional)"
                    },
                    attendees: {
                        type: "array",
                        items: { type: "string" },
                        description: "Array of email addresses to invite to the event (optional)"
                    }
                },
                required: ["title", "startTime", "endTime", "frequency"],
            },
            handler: async (args: { 
                title: string, 
                description?: string, 
                startTime: string, 
                endTime: string, 
                frequency: 'daily' | 'weekly' | 'monthly' | 'yearly',
                interval?: number,
                endDate?: string,
                maxOccurrences?: number,
                location?: string, 
                attendees?: string[]
            }) => {
                try {
                    // Check if user has calendar access configured
                    const calendarAccess = ToolsItem.getState().getParameterValue("Calendar", "google", 'calendar_access');
                    if (!calendarAccess || calendarAccess === "") {
                        return "You have not configured Google Calendar access yet. Please set up your calendar integration first.";
                    }

                    // Parse dates
                    let startDate = CalendarUtils.parseNaturalLanguageDateTime(args.startTime);
                    let endDate = CalendarUtils.parseNaturalLanguageDateTime(args.endTime);

                    if (!startDate) {
                        startDate = CalendarUtils.fromISOString(args.startTime);
                    }
                    if (!endDate) {
                        endDate = CalendarUtils.fromISOString(args.endTime);
                    }

                    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                        return "Invalid date format. Please use natural language or ISO format.";
                    }

                    // Validate date range
                    const validation = CalendarUtils.validateDateRange(startDate, endDate);
                    if (!validation.valid) {
                        return validation.error;
                    }

                    const interval = args.interval || 1;
                    const maxOccurrences = args.maxOccurrences || 50;

                    // Generate recurring dates
                    const recurringDates = CalendarUtils.generateRecurringDates(
                        startDate,
                        { frequency: args.frequency, interval },
                        maxOccurrences
                    );

                    if (args.endDate) {
                        const endDateLimit = CalendarUtils.parseNaturalLanguageDateTime(args.endDate) || CalendarUtils.fromISOString(args.endDate);
                        if (endDateLimit && !isNaN(endDateLimit.getTime())) {
                            recurringDates.splice(recurringDates.findIndex(date => date > endDateLimit));
                        }
                    }

                    if (recurringDates.length === 0) {
                        return "No recurring events could be generated with the specified parameters.";
                    }

                    // Initialize calendar service
                    const isInitialized = await this.calendarService.initialize();
                    if (!isInitialized) {
                        const authResult = await this.calendarService.authenticate();
                        if (!authResult) {
                            return "Failed to authenticate with Google Calendar. Please try again.";
                        }
                    }

                    // Create recurring events
                    let successCount = 0;
                    let failureCount = 0;

                    for (const date of recurringDates) {
                        const eventStart = new Date(date);
                        const eventEnd = new Date(date);
                        eventEnd.setTime(eventEnd.getTime() + (endDate.getTime() - startDate.getTime()));

                        const eventData = {
                            title: args.title,
                            description: args.description || "",
                            startTime: CalendarUtils.toISOStringWithTimezone(eventStart),
                            endTime: CalendarUtils.toISOStringWithTimezone(eventEnd),
                            location: args.location || "",
                            attendees: args.attendees || []
                        };

                        const result = await this.calendarService.createEvent(eventData);
                        if (result.success) {
                            successCount++;
                        } else {
                            failureCount++;
                        }
                    }

                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'complete', `Created ${successCount} recurring events`);
                    }

                    if (failureCount === 0) {
                        return await convertSpeech(`Successfully created ${successCount} recurring ${args.title} events. The events will repeat ${args.frequency} with ${interval > 1 ? `every ${interval} ${args.frequency}` : 'every ' + args.frequency}.`);
                    } else {
                        return await convertSpeech(`Created ${successCount} recurring events successfully, but ${failureCount} events failed to create.`);
                    }
                } catch (error) {
                    const messageId = this.session.functionMessageId;
                    if (messageId !== null) {
                        completeConversation(messageId, 'failed');
                    }
                    return await convertSpeech('Failed to create recurring calendar events. Please try again.');
                }
            }
        }
    }
}
