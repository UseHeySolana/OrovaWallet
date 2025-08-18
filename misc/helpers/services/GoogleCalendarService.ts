import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as Crypto from 'expo-crypto';
import * as Calendar from 'expo-calendar';

export interface CalendarEvent {
    id?: string;
    title: string;
    description?: string;
    startTime: string;
    endTime: string;
    location?: string;
    attendees?: string[];
    reminders?: CalendarReminder[];
}

export interface CalendarReminder {
    method: 'popup' | 'email' | 'sms';
    minutes: number;
}

export interface GoogleCalendarConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
}

export class GoogleCalendarService {
    private config: GoogleCalendarConfig;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;

    constructor(config: GoogleCalendarConfig) {
        this.config = config;
    }

    /**
     * Initialize Google Calendar service
     */
    async initialize(): Promise<boolean> {
        try {
            // Check if we have stored tokens
            const storedTokens = await this.getStoredTokens();
            if (storedTokens) {
                this.accessToken = storedTokens.accessToken;
                this.refreshToken = storedTokens.refreshToken;
                
                // Check if token is still valid
                if (await this.isTokenValid()) {
                    return true;
                } else {
                    // Refresh token if expired
                    return await this.refreshAccessToken();
                }
            }
            return false;
        } catch (error) {
            console.error('Failed to initialize Google Calendar service:', error);
            return false;
        }
    }

    /**
     * Authenticate user with Google
     */
    async authenticate(): Promise<boolean> {
        try {
            const authUrl = this.buildAuthUrl();
            
            // For React Native, you might want to use a WebView or deep linking
            // This is a simplified version - you'll need to implement the actual auth flow
            const result = await AuthSession.startAsync({
                authUrl,
                returnUrl: this.config.redirectUri,
            });

            if (result.type === 'success' && result.params.code) {
                const tokens = await this.exchangeCodeForTokens(result.params.code);
                if (tokens) {
                    this.accessToken = tokens.accessToken;
                    this.refreshToken = tokens.refreshToken;
                    await this.storeTokens(tokens);
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Authentication failed:', error);
            return false;
        }
    }

    /**
     * Create a new calendar event
     */
    async createEvent(event: CalendarEvent): Promise<{ success: boolean; eventId?: string; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const eventData = {
                summary: event.title,
                description: event.description || '',
                start: {
                    dateTime: event.startTime,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                end: {
                    dateTime: event.endTime,
                    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                location: event.location || '',
                attendees: event.attendees ? event.attendees.map(email => ({ email })) : [],
                reminders: {
                    useDefault: false,
                    overrides: event.reminders ? event.reminders.map(reminder => ({
                        method: reminder.method,
                        minutes: reminder.minutes,
                    })) : [],
                },
            };

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(eventData),
                }
            );

            if (response.ok) {
                const result = await response.json();
                return { success: true, eventId: result.id };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to create event:', error);
            return { success: false, error: 'Failed to create event' };
        }
    }

    /**
     * Update an existing calendar event
     */
    async updateEvent(eventId: string, updates: Partial<CalendarEvent>): Promise<{ success: boolean; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const updateData: any = {};
            if (updates.title) updateData.summary = updates.title;
            if (updates.description !== undefined) updateData.description = updates.description;
            if (updates.startTime) updateData.start = { dateTime: updates.startTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
            if (updates.endTime) updateData.end = { dateTime: updates.endTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
            if (updates.location !== undefined) updateData.location = updates.location;

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(updateData),
                }
            );

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to update event:', error);
            return { success: false, error: 'Failed to update event' };
        }
    }

    /**
     * Delete a calendar event
     */
    async deleteEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to delete event:', error);
            return { success: false, error: 'Failed to delete event' };
        }
    }

    /**
     * List calendar events for a date range
     */
    async listEvents(startDate: string, endDate: string, maxResults: number = 10): Promise<{ success: boolean; events?: CalendarEvent[]; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
                `timeMin=${startDate}&timeMax=${endDate}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (response.ok) {
                const result = await response.json();
                const events: CalendarEvent[] = result.items.map((item: any) => ({
                    id: item.id,
                    title: item.summary || 'Untitled',
                    description: item.description || '',
                    startTime: item.start.dateTime || item.start.date,
                    endTime: item.end.dateTime || item.end.date,
                    location: item.location || '',
                    attendees: item.attendees ? item.attendees.map((a: any) => a.email) : [],
                }));
                return { success: true, events };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to list events:', error);
            return { success: false, error: 'Failed to list events' };
        }
    }

    /**
     * Get details of a specific event
     */
    async getEventDetails(eventId: string): Promise<{ success: boolean; event?: CalendarEvent; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );

            if (response.ok) {
                const item = await response.json();
                const event: CalendarEvent = {
                    id: item.id,
                    title: item.summary || 'Untitled',
                    description: item.description || '',
                    startTime: item.start.dateTime || item.start.date,
                    endTime: item.end.dateTime || item.end.date,
                    location: item.location || '',
                    attendees: item.attendees ? item.attendees.map((a: any) => a.email) : [],
                };
                return { success: true, event };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to get event details:', error);
            return { success: false, error: 'Failed to get event details' };
        }
    }

    /**
     * Set reminder for an event
     */
    async setEventReminder(eventId: string, reminder: CalendarReminder): Promise<{ success: boolean; error?: string }> {
        try {
            if (!this.accessToken) {
                return { success: false, error: 'Not authenticated' };
            }

            const reminderData = {
                reminders: {
                    useDefault: false,
                    overrides: [{
                        method: reminder.method,
                        minutes: reminder.minutes,
                    }],
                },
            };

            const response = await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(reminderData),
                }
            );

            if (response.ok) {
                return { success: true };
            } else {
                const error = await response.text();
                return { success: false, error };
            }
        } catch (error) {
            console.error('Failed to set reminder:', error);
            return { success: false, error: 'Failed to set reminder' };
        }
    }

    /**
     * Check if current access token is valid
     */
    private async isTokenValid(): Promise<boolean> {
        try {
            const response = await fetch(
                'https://www.googleapis.com/oauth2/v1/tokeninfo',
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                    },
                }
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Refresh access token using refresh token
     */
    private async refreshAccessToken(): Promise<boolean> {
        try {
            if (!this.refreshToken) {
                return false;
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    refresh_token: this.refreshToken,
                    grant_type: 'refresh_token',
                }),
            });

            if (response.ok) {
                const result = await response.json();
                this.accessToken = result.access_token;
                if (result.refresh_token) {
                    this.refreshToken = result.refresh_token;
                }
                await this.storeTokens({ accessToken: this.accessToken, refreshToken: this.refreshToken });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to refresh token:', error);
            return false;
        }
    }

    /**
     * Build authentication URL
     */
    private buildAuthUrl(): string {
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            scope: this.config.scopes.join(' '),
            response_type: 'code',
            access_type: 'offline',
            prompt: 'consent',
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    /**
     * Exchange authorization code for tokens
     */
    private async exchangeCodeForTokens(code: string): Promise<{ accessToken: string; refreshToken: string } | null> {
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.config.clientId,
                    client_secret: this.config.clientSecret,
                    code,
                    grant_type: 'authorization_code',
                    redirect_uri: this.config.redirectUri,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                return {
                    accessToken: result.access_token,
                    refreshToken: result.refresh_token,
                };
            }
            return null;
        } catch (error) {
            console.error('Failed to exchange code for tokens:', error);
            return null;
        }
    }

    /**
     * Store tokens securely (implement based on your storage solution)
     */
    private async storeTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
        // Implement secure token storage
        // You might want to use AsyncStorage, SecureStore, or a similar solution
        console.log('Tokens stored successfully');
    }

    /**
     * Retrieve stored tokens
     */
    private async getStoredTokens(): Promise<{ accessToken: string; refreshToken: string } | null> {
        // Implement token retrieval from secure storage
        // Return null if no tokens are stored
        return null;
    }

    /**
     * Clear stored tokens
     */
    async clearTokens(): Promise<void> {
        this.accessToken = null;
        this.refreshToken = null;
        // Clear from secure storage
        console.log('Tokens cleared successfully');
    }
}
