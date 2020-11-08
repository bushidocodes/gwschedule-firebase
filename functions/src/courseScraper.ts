import { JSDOM } from "jsdom";
import fetch from "node-fetch";
// import * as fs from "fs";

// Returns a tuple of [department, course_id]
const normalizeSubject = (input: String): [String, Number] => {
  let result: [String, Number] = ["", 0];
  let temp = input.trim().split(/\s+/g);
  result[0] = temp[0].trim();
  result[1] = parseInt(temp[1]);
  return result;
};

interface ScheduledMeeting {
  location: String;
  day: String;
  startTime: String;
  endTime: String;
}

interface Section {
  crn: Number;
  department: String;
  courseID: Number;
  section: String;
  name: String;
  credit: String;
  instructors: String[];
  schedule: ScheduledMeeting[];
  startDate: String;
  endDate: String;
}

const parseDayTimes = (
  dayTimesRaw: String,
  locationsRaw: String
): ScheduledMeeting[] => {
  // For some reason, a course listing might show multiple entries
  let dayTimes = dayTimesRaw.split("AND");
  let locations = locationsRaw.split("AND");

  if (dayTimes.length != locations.length) {
    console.error("daytimes and locations did not have same number of tokens");
  }

  let joinedValues = dayTimes.map(
    (daytime, idx) => `${daytime}&${locations[idx]}`
  );

  let results: ScheduledMeeting[] = [];

  Array.from(new Set(joinedValues)).forEach((str) => {
    let [daytime, location] = str.split("&").map((tok) => tok.trim());

    // Days
    let daysMatch = daytime.match(/^[MTWRF]+/g);
    let daysMatchStr = daysMatch && daysMatch[0] ? daysMatch[0] : "";
    let days = daysMatchStr.split("");

    //Times
    const time = daytime.match(/\d\d:\d\d[APM]+/g);
    const startTime = (time && time[0]) || "";
    const endTime = (time && time[1]) || "";

    for (let day of days) {
      results.push({ location, day, startTime, endTime });
    }
  });

  return results;
};

// Returns a tuple of [startDate, endDate]
function parseFromTo(input: String): [String, String] {
  let raw = input.split("-");
  if (raw.length != 2) {
    console.warn(`parseFromTo expected two-tuple, split to ${raw.length}`);
    return ["", ""];
  }

  const [startDate, endDate] = raw.map((token) => token.trim());

  return [startDate, endDate];
}

export async function scrapeSections(
  campId: String = "1",
  termId: String = "202101",
  subjId: String = "CSCI"
): Promise<Section[]> {
  let courses: Array<Section> = [];

  // Retrieve the HTML page as raw text and load into in-memory DOM
  const response = await fetch(
    `https://my.gwu.edu/mod/pws/print.cfm?campId=${campId}&termId=${termId}&subjId=${subjId}`
  );
  const text = await response.text();
  const dom = new JSDOM(text);

  // Parse the HTML table and scrape into structured representation
  let courseNodes = dom.window.document.querySelectorAll("table");

  for (let courseNode of courseNodes) {
    let rows = courseNode.querySelectorAll("tr");
    let mainRow = rows[0];
    let cells = mainRow.querySelectorAll("td");
    let status = cells[0].textContent;
    if (status !== "OPEN" && status !== "CLOSED") continue;

    // Parse crn
    let crn: Number = 0;
    if (cells[1] == null) {
      console.warn("crn was unexpectedly null. Skipping course");
      continue;
    } else {
      crn = parseInt(cells[1].textContent || "");
    }

    // Parse subject
    let subject = cells[2].textContent || "";

    // Parse section
    // Note: Section was originally of type number.
    // However, a section can be prepended by a letter of some kind. i.e. O10
    let section = cells[3].textContent || "";

    // Parse name
    let name = cells[4].textContent || "";

    // Parse credits
    // Credits uses a string because it can be the value ARR
    // TODO: Handle courses with a range of credits
    let credit = (cells[5].textContent || "").trim();

    // Parse instructors name
    let instructors = (cells[6].textContent || "")
      .split(";")
      .map((str) => str.trim());

    // Parse location and day time into ScheduledMeetings
    let locationRaw = cells[7].textContent || "";
    let dayTimeRaw = cells[8].textContent || "";
    let [department, courseID] = normalizeSubject(subject);
    let schedule: ScheduledMeeting[] = parseDayTimes(dayTimeRaw, locationRaw);

    // Parse cours start and end dates
    let fromTo = cells[9].textContent || "";
    let [startDate, endDate] = parseFromTo(fromTo);

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

  // fs.writeFileSync("./test.json", JSON.stringify(courses));
}
