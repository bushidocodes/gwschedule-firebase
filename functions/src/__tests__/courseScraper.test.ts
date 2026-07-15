import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeSubject,
  parseDayTimes,
  parseFromTo,
  scrapeSections,
} from "../courseScraper";

const fixture = (name: string) =>
  readFileSync(join(__dirname, "fixtures", name), "utf-8");

describe("normalizeSubject", () => {
  it("splits department and course id", () => {
    expect(normalizeSubject("CSCI 1010")).toEqual(["CSCI", 1010]);
  });

  it("handles multiple internal spaces", () => {
    expect(normalizeSubject("MAE   2170")).toEqual(["MAE", 2170]);
  });

  it("returns 0 for unparseable course id", () => {
    expect(normalizeSubject("CSCI")).toEqual(["CSCI", 0]);
  });

  it("trims whitespace", () => {
    expect(normalizeSubject("  EMSE 4197 ")).toEqual(["EMSE", 4197]);
  });
});

describe("parseFromTo", () => {
  it("splits a date range on the hyphen", () => {
    expect(parseFromTo("01/11/21-04/26/21")).toEqual(["01/11/21", "04/26/21"]);
  });

  it("trims whitespace around tokens", () => {
    expect(parseFromTo(" 8/24 - 12/14 ")).toEqual(["8/24", "12/14"]);
  });

  it("returns empty strings on malformed input", () => {
    expect(parseFromTo("not a range")).toEqual(["", ""]);
  });
});

describe("parseDayTimes", () => {
  it("expands multi-day meeting strings into per-day records", () => {
    expect(parseDayTimes("MWF 09:00AM - 09:50AM", "TOMPKINS 101")).toEqual([
      {
        location: "TOMPKINS 101",
        day: "M",
        startTime: "09:00AM",
        endTime: "09:50AM",
      },
      {
        location: "TOMPKINS 101",
        day: "W",
        startTime: "09:00AM",
        endTime: "09:50AM",
      },
      {
        location: "TOMPKINS 101",
        day: "F",
        startTime: "09:00AM",
        endTime: "09:50AM",
      },
    ]);
  });

  it("handles a single day meeting", () => {
    expect(parseDayTimes("R 06:10PM - 08:40PM", "REMOTE INSTR")).toEqual([
      {
        location: "REMOTE INSTR",
        day: "R",
        startTime: "06:10PM",
        endTime: "08:40PM",
      },
    ]);
  });

  it("splits multiple meeting blocks joined with AND", () => {
    const result = parseDayTimes(
      "MW 10:00AM - 11:00AM AND F 12:00PM - 12:50PM",
      "ROOM A AND ROOM B",
    );
    expect(result).toHaveLength(3);
    expect(result).toContainEqual({
      location: "ROOM A",
      day: "M",
      startTime: "10:00AM",
      endTime: "11:00AM",
    });
    expect(result).toContainEqual({
      location: "ROOM B",
      day: "F",
      startTime: "12:00PM",
      endTime: "12:50PM",
    });
  });

  it("deduplicates identical entries", () => {
    const result = parseDayTimes(
      "M 09:00AM - 09:50AM AND M 09:00AM - 09:50AM",
      "ROOM A AND ROOM A",
    );
    expect(result).toEqual([
      {
        location: "ROOM A",
        day: "M",
        startTime: "09:00AM",
        endTime: "09:50AM",
      },
    ]);
  });

  it("returns empty array when input has no day prefix", () => {
    expect(parseDayTimes("TBA", "TBA")).toEqual([]);
  });
});

describe("scrapeSections (against saved GW fixture)", () => {
  const html = fixture("gw-csci-202101.html");
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  beforeEach(() => {
    fetchSpy.mockResolvedValue(new Response(html, { status: 200 }));
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  it("parses the saved page into 132 sections", async () => {
    const sections = await scrapeSections("1", "202101", "CSCI");
    expect(sections).toHaveLength(132);
  });

  it("calls the GW print endpoint with the supplied params", async () => {
    await scrapeSections("3", "202503", "MAE");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://my.gwu.edu/mod/pws/print.cfm?campId=3&termId=202503&subjId=MAE",
    );
  });

  it("produces well-formed Section objects", async () => {
    const sections = await scrapeSections("1", "202101", "CSCI");
    const first = sections[0];
    if (!first) throw new Error("expected at least one section");
    expect(first).toMatchObject({
      department: "CSCI",
      courseID: expect.any(Number),
      section: expect.any(String),
      name: expect.any(String),
      credit: expect.any(String),
      instructors: expect.any(Array),
      schedule: expect.any(Array),
      startDate: expect.any(String),
      endDate: expect.any(String),
    });
    expect(first.crn).toBeGreaterThan(0);
  });

  it("throws on non-OK HTTP responses", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 500 }));
    await expect(scrapeSections("1", "202101", "CSCI")).rejects.toThrow(/500/);
  });
});
