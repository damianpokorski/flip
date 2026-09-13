import { describe, expect, test } from "bun:test";
import { parseCodes } from "./codes";

describe("parseCodes", () => {
	test("parses a single code", () => {
		expect(parseCodes("200")).toEqual([200]);
	});

	test("parses multiple comma-separated codes", () => {
		expect(parseCodes("200,401")).toEqual([200, 401]);
	});

	test("trims whitespace around each code", () => {
		expect(parseCodes("200, 401 ,  204")).toEqual([200, 401, 204]);
	});
});
