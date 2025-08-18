export const GOOGLE_CALENDAR_CONFIG = {
    // Google OAuth 2.0 credentials
    clientId: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    
    // OAuth redirect URI (should match your Google Console configuration)
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'com.heysolana.calendar://oauth2redirect',
    
    // Required scopes for Google Calendar access
    scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly'
    ],
    
    // Calendar API endpoints
    apiEndpoints: {
        calendarList: 'https://www.googleapis.com/calendar/v3/users/me/calendarList',
        events: 'https://www.googleapis.com/calendar/v3/calendars/primary/events',
        calendar: 'https://www.googleapis.com/calendar/v3/calendars/primary',
        tokenInfo: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
        token: 'https://oauth2.googleapis.com/token',
        auth: 'https://accounts.google.com/o/oauth2/v2/auth'
    },
    
    // Default calendar settings
    defaultCalendar: {
        id: 'primary',
        name: 'Primary Calendar',
        timeZone: 'UTC'
    },
    
    // Reminder options
    reminderOptions: {
        methods: ['popup', 'email', 'sms'] as const,
        defaultMinutes: [5, 10, 15, 30, 60, 1440] // 5min, 10min, 15min, 30min, 1hr, 1day
    },
    
    // Event validation rules
    validation: {
        minEventDuration: 15, // minutes
        maxEventDuration: 1440 * 7, // 7 days in minutes
        maxAttendees: 100,
        maxDescriptionLength: 1000
    },
    
    // Error messages
    errorMessages: {
        notAuthenticated: 'You are not authenticated with Google Calendar. Please sign in first.',
        invalidEventData: 'Invalid event data provided. Please check your input.',
        eventNotFound: 'Event not found. Please check the event ID.',
        permissionDenied: 'Permission denied. You may not have access to this calendar.',
        networkError: 'Network error occurred. Please check your connection.',
        quotaExceeded: 'API quota exceeded. Please try again later.',
        invalidToken: 'Authentication token is invalid or expired. Please sign in again.'
    },
    
    // Success messages
    successMessages: {
        eventCreated: 'Calendar event created successfully.',
        eventUpdated: 'Calendar event updated successfully.',
        eventDeleted: 'Calendar event deleted successfully.',
        reminderSet: 'Reminder set successfully.',
        authenticated: 'Successfully authenticated with Google Calendar.'
    }
};

export const CALENDAR_TOOL_CONFIG = {
    // Tool configuration for AI integration
    toolName: 'Google Calendar Manager',
    toolDescription: 'Manage your Google Calendar events, create meetings, set reminders, and organize your schedule.',
    
    // Available functions
    functions: [
        {
            name: 'create-calendar-event',
            description: 'Create a new calendar event',
            examples: [
                'Create a meeting with John tomorrow at 2 PM',
                'Schedule a team call for Friday at 10 AM',
                'Add dentist appointment on March 15th at 3 PM'
            ]
        },
        {
            name: 'update-calendar-event',
            description: 'Update an existing calendar event',
            examples: [
                'Change the meeting time to 3 PM',
                'Update the location to Conference Room B',
                'Add Sarah to the meeting attendees'
            ]
        },
        {
            name: 'delete-calendar-event',
            description: 'Delete a calendar event',
            examples: [
                'Cancel the team meeting',
                'Delete the dentist appointment',
                'Remove the client call from my calendar'
            ]
        },
        {
            name: 'list-calendar-events',
            description: 'List events for a specific date range',
            examples: [
                'Show my events for tomorrow',
                'What meetings do I have this week?',
                'List all events for next month'
            ]
        },
        {
            name: 'get-event-details',
            description: 'Get detailed information about a specific event',
            examples: [
                'Tell me about the team meeting',
                'What are the details of my dentist appointment?',
                'Show me the client call information'
            ]
        },
        {
            name: 'set-event-reminder',
            description: 'Set a reminder for an event',
            examples: [
                'Remind me 15 minutes before the meeting',
                'Set a reminder 1 hour before the appointment',
                'Notify me 30 minutes before the call'
            ]
        }
    ],
    
    // Common event types and templates
    eventTemplates: {
        meeting: {
            title: 'Team Meeting',
            duration: 60, // minutes
            reminder: 15 // minutes before
        },
        appointment: {
            title: 'Appointment',
            duration: 30,
            reminder: 30
        },
        call: {
            title: 'Phone Call',
            duration: 30,
            reminder: 5
        },
        reminder: {
            title: 'Reminder',
            duration: 0,
            reminder: 0
        }
    }
};
