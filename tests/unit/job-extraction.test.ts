import { describe, expect, it } from "vitest";
import { emptyExtraction, ground, type JobExtraction } from "@/lib/ai/job-extraction";

const posting = `Acme Robotics - Software Intern. Toronto, hybrid.
Compensation: $28 - $32 CAD per hour.
Requirements: Experience with Python or C++. Familiarity with Git.
Nice to have: Exposure to ROS.`;

const base = (over: Partial<JobExtraction>): JobExtraction => ({ ...emptyExtraction(), ...over });

describe("ground (extraction trust boundary)", () => {
  it("keeps a requirement quote that really is in the posting, ignoring case and spacing", () => {
    const out = ground(base({ must_have: [{ text: "Python or C++", source_snippet: "experience  with PYTHON or c++." }] }), posting);
    expect(out.must_have[0].source_snippet).toBe("experience  with PYTHON or c++.");
  });

  it("drops a quote the model invented but keeps the requirement", () => {
    const out = ground(base({ must_have: [{ text: "Kubernetes", source_snippet: "Must know Kubernetes in production" }] }), posting);
    expect(out.must_have[0].source_snippet).toBeNull();
    expect(out.must_have[0].text).toBe("Kubernetes");
  });

  it("flags salary text that is not in the posting, and leaves verbatim salary alone", () => {
    expect(ground(base({ salary_text: "$28 - $32 CAD per hour" }), posting).uncertain_fields).not.toContain("salary_text");
    expect(ground(base({ salary_text: "$900,000" }), posting).uncertain_fields).toContain("salary_text");
  });

  it("only accepts YYYY-MM-DD deadlines, and always asks the user to confirm them", () => {
    expect(ground(base({ deadline: "March 1" }), posting).deadline).toBeNull();
    const ok = ground(base({ deadline: "2027-03-01" }), posting);
    expect(ok.deadline).toBe("2027-03-01");
    expect(ok.uncertain_fields).toContain("deadline");
  });

  it("rejects non-http application links", () => {
    expect(ground(base({ application_link: "javascript:alert(1)" }), posting).application_link).toBeNull();
    expect(ground(base({ application_link: "https://acme.example/apply" }), posting).application_link).toBe("https://acme.example/apply");
  });
});
