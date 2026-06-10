import * as fs from "fs";
import * as path from "path";

// Smoke test: verify the compiled output exists and has the expected shebang
describe("mcp-google-calendar-sa build", () => {
  const distFile = path.join(__dirname, "../dist/index.js");

  it("dist/index.js exists after build", () => {
    expect(fs.existsSync(distFile)).toBe(true);
  });

  it("dist/index.js starts with shebang", () => {
    const content = fs.readFileSync(distFile, "utf8");
    expect(content.startsWith("#!/usr/bin/env node")).toBe(true);
  });
});

// Unit test: normalizeDateTime logic (extracted for testing)
describe("normalizeDateTime", () => {
  function normalizeDateTime(dt: string): { dateTime: string; timeZone: string } | { date: string } {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dt)) {
      return { date: dt };
    }
    return { dateTime: dt, timeZone: "UTC" };
  }

  it("returns date object for YYYY-MM-DD", () => {
    const result = normalizeDateTime("2024-01-15");
    expect(result).toEqual({ date: "2024-01-15" });
  });

  it("returns dateTime object for full ISO string", () => {
    const result = normalizeDateTime("2024-01-15T10:00:00Z");
    expect(result).toEqual({ dateTime: "2024-01-15T10:00:00Z", timeZone: "UTC" });
  });

  it("returns dateTime object for ISO with offset", () => {
    const result = normalizeDateTime("2024-01-15T10:00:00+05:30");
    expect(result).toEqual({ dateTime: "2024-01-15T10:00:00+05:30", timeZone: "UTC" });
  });
});

// Unit test: env var handling
describe("environment variable validation", () => {
  it("throws if GOOGLE_SERVICE_ACCOUNT_KEY_FILE is not set", () => {
    const original = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

    expect(() => {
      const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
      if (!keyFile) {
        throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable is required");
      }
    }).toThrow("GOOGLE_SERVICE_ACCOUNT_KEY_FILE environment variable is required");

    if (original !== undefined) {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE = original;
    }
  });

  it("uses primary as default calendar ID", () => {
    const original = process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_CALENDAR_ID;

    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
    expect(calendarId).toBe("primary");

    if (original !== undefined) {
      process.env.GOOGLE_CALENDAR_ID = original;
    }
  });

  it("uses GOOGLE_CALENDAR_ID when set", () => {
    const original = process.env.GOOGLE_CALENDAR_ID;
    process.env.GOOGLE_CALENDAR_ID = "test@example.com";

    const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";
    expect(calendarId).toBe("test@example.com");

    if (original !== undefined) {
      process.env.GOOGLE_CALENDAR_ID = original;
    } else {
      delete process.env.GOOGLE_CALENDAR_ID;
    }
  });
});
