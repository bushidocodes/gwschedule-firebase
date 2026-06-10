import { JSDOM } from "jsdom";

export interface ScheduledMeeting {
  location: string;
  day: string;
  startTime: string;
  endTime: string;
}

export interface Section {
  crn: number;
  department: string;
  courseID: number;
  section: string;
  name: string;
  credit: string;
  instructors: string[];
  schedule: ScheduledMeeting[];
  startDate: string;
  endDate: string;
}

const SCHEDULE_URL = "https://my.gwu.edu/mod/pws/print.cfm";

// "CSCI 1010" -> ["CSCI", 1010]
export function normalizeSubject(input: string): [string, number] {
  const [dept = "", id = ""] = input.trim().split(/\s+/);
  return [dept, Number.parseInt(id, 10) || 0];
}

// "8/24-12/14" -> ["8/24", "12/14"]
export function parseFromTo(input: string): [string, string] {
  const parts = input.split("-").map((s) => s.trim());
  if (parts.length !== 2) {
    console.warn(`parseFromTo expected two tokens, got ${parts.length}`);
    return ["", ""];
  }
  return [parts[0] ?? "", parts[1] ?? ""];
}

export function parseDayTimes(
  dayTimesRaw: string,
  locationsRaw: string,
): ScheduledMeeting[] {
  // A course listing may contain multiple meeting blocks joined with "AND"
  const dayTimes = dayTimesRaw.split("AND").map((s) => s.trim());
  const locations = locationsRaw.split("AND").map((s) => s.trim());

  if (dayTimes.length !== locations.length) {
    console.warn("daytimes and locations did not have same number of tokens");
  }

  const joined = dayTimes.map(
    (daytime, idx) => `${daytime}&${locations[idx] ?? ""}`,
  );

  const results: ScheduledMeeting[] = [];

  for (const entry of new Set(joined)) {
    const [daytimePart = "", locationPart = ""] = entry.split("&");

    // Require a day-of-week prefix followed by at least one time so that
    // strings like "TBA" don't parse "T" as Tuesday.
    const times = daytimePart.match(/\d\d:\d\d[APM]+/g) ?? [];
    if (times.length === 0) continue;

    const daysMatch = daytimePart.match(/^[MTWRF]+/);
    const days = (daysMatch?.[0] ?? "").split("");
    const startTime = times[0] ?? "";
    const endTime = times[1] ?? "";

    for (const day of days) {
      results.push({ location: locationPart, day, startTime, endTime });
    }
  }

  return results;
}

function cellText(cells: NodeListOf<HTMLTableCellElement>, idx: number): string {
  return cells[idx]?.textContent ?? "";
}

export async function scrapeSections(
  campId = "1",
  termId = "202101",
  subjId = "CSCI",
): Promise<Section[]> {
  const url = `${SCHEDULE_URL}?campId=${campId}&termId=${termId}&subjId=${subjId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  const dom = new JSDOM(text);

  const courses: Section[] = [];
  const courseNodes = dom.window.document.querySelectorAll("table");

  for (const courseNode of courseNodes) {
    const rows = courseNode.querySelectorAll("tr");
    const mainRow = rows[0];
    if (!mainRow) continue;

    const cells = mainRow.querySelectorAll("td");
    const status = cellText(cells, 0);
    if (status !== "OPEN" && status !== "CLOSED") continue;

    const crnText = cells[1]?.textContent;
    if (crnText == null) {
      console.warn("crn was unexpectedly null; skipping course");
      continue;
    }
    const crn = Number.parseInt(crnText, 10);

    const subject = cellText(cells, 2);
    // Section may be prefixed by a letter (e.g. "O10"), so keep as string
    const section = cellText(cells, 3);
    const name = cellText(cells, 4);
    // Credit may be a range or "ARR", so keep as string
    const credit = cellText(cells, 5).trim();
    const instructors = cellText(cells, 6)
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    const locationRaw = cellText(cells, 7);
    const dayTimeRaw = cellText(cells, 8);
    const [department, courseID] = normalizeSubject(subject);
    if (courseID === 0 || Number.isNaN(crn)) {
      console.warn(`Skipping section with unparseable subject/crn: subject=${JSON.stringify(subject)} crn=${crnText}`);
      continue;
    }
    const schedule = parseDayTimes(dayTimeRaw, locationRaw);

    const [startDate, endDate] = parseFromTo(cellText(cells, 9));

    courses.push({
      crn,
      department,
      courseID,
      section,
      name,
      credit,
      instructors,
      schedule,
      startDate,
      endDate,
    });
  }

  return courses;
}
