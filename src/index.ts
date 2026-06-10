#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";
import * as fs from "fs";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function getAuth() {
  const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  if (!keyFile) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable is required");
  }
  const keyData = JSON.parse(fs.readFileSync(keyFile, "utf8"));
  return new google.auth.GoogleAuth({
    credentials: keyData,
    scopes: [CALENDAR_SCOPE],
  });
}

function getCalendarId(): string {
  return process.env.GOOGLE_CALENDAR_ID ?? "primary";
}

function normalizeDateTime(dt: string): { dateTime: string; timeZone: string } | { date: string } {
  // If it looks like a date-only string YYYY-MM-DD, use date format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
    return { date: dt };
  }
  // Otherwise treat as full ISO datetime
  return { dateTime: dt, timeZone: "UTC" };
}

const server = new Server(
  { name: "mcp-google-calendar-sa", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "create-event",
        description: "Create a new Google Calendar event",
        inputSchema: {
          type: "object",
          properties: {
            summary: { type: "string", description: "Event title" },
            start: { type: "string", description: "Start datetime (ISO or YYYY-MM-DD)" },
            end: { type: "string", description: "End datetime (ISO or YYYY-MM-DD)" },
            description: { type: "string", description: "Event description (optional)" },
            attendees: {
              type: "array",
              items: { type: "string" },
              description: "List of attendee email addresses (optional)",
            },
          },
          required: ["summary", "start", "end"],
        },
      },
      {
        name: "list-events",
        description: "List events from Google Calendar",
        inputSchema: {
          type: "object",
          properties: {
            timeMin: { type: "string", description: "Start of time range (ISO, optional)" },
            timeMax: { type: "string", description: "End of time range (ISO, optional)" },
            maxResults: { type: "number", description: "Max results to return (default 10)" },
            query: { type: "string", description: "Free-text search query (optional)" },
          },
          required: [],
        },
      },
      {
        name: "get-event",
        description: "Get a specific Google Calendar event by ID",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "The event ID" },
          },
          required: ["eventId"],
        },
      },
      {
        name: "delete-event",
        description: "Delete a Google Calendar event",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "The event ID to delete" },
          },
          required: ["eventId"],
        },
      },
      {
        name: "update-event",
        description: "Update an existing Google Calendar event",
        inputSchema: {
          type: "object",
          properties: {
            eventId: { type: "string", description: "The event ID to update" },
            summary: { type: "string", description: "New event title (optional)" },
            start: { type: "string", description: "New start datetime (ISO or YYYY-MM-DD, optional)" },
            end: { type: "string", description: "New end datetime (ISO or YYYY-MM-DD, optional)" },
            description: { type: "string", description: "New description (optional)" },
          },
          required: ["eventId"],
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const auth = getAuth();
    const calendar = google.calendar({ version: "v3", auth });
    const calendarId = getCalendarId();

    if (name === "create-event") {
      const { summary, start, end, description, attendees } = args as {
        summary: string;
        start: string;
        end: string;
        description?: string;
        attendees?: string[];
      };

      const event = await calendar.events.insert({
        calendarId,
        requestBody: {
          summary,
          description,
          start: normalizeDateTime(start),
          end: normalizeDateTime(end),
          attendees: attendees?.map((email) => ({ email })),
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ id: event.data.id, htmlLink: event.data.htmlLink }),
          },
        ],
      };
    }

    if (name === "list-events") {
      const { timeMin, timeMax, maxResults = 10, query } = args as {
        timeMin?: string;
        timeMax?: string;
        maxResults?: number;
        query?: string;
      };

      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults,
        q: query,
        singleEvents: true,
        orderBy: "startTime",
      });

      const events = (response.data.items ?? []).map((e) => ({
        id: e.id,
        summary: e.summary,
        start: e.start,
        end: e.end,
        description: e.description,
        htmlLink: e.htmlLink,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(events) }],
      };
    }

    if (name === "get-event") {
      const { eventId } = args as { eventId: string };

      const event = await calendar.events.get({ calendarId, eventId });

      return {
        content: [{ type: "text", text: JSON.stringify(event.data) }],
      };
    }

    if (name === "delete-event") {
      const { eventId } = args as { eventId: string };

      await calendar.events.delete({ calendarId, eventId });

      return {
        content: [{ type: "text", text: JSON.stringify({ success: true }) }],
      };
    }

    if (name === "update-event") {
      const { eventId, summary, start, end, description } = args as {
        eventId: string;
        summary?: string;
        start?: string;
        end?: string;
        description?: string;
      };

      const patch: Record<string, unknown> = {};
      if (summary !== undefined) patch.summary = summary;
      if (description !== undefined) patch.description = description;
      if (start !== undefined) patch.start = normalizeDateTime(start);
      if (end !== undefined) patch.end = normalizeDateTime(end);

      const updated = await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: patch,
      });

      return {
        content: [{ type: "text", text: JSON.stringify(updated.data) }],
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text", text: `Error: ${message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
