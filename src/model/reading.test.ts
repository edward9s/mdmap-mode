import assert from "node:assert/strict";
import { test } from "node:test";

import { parseMarkdown } from "./parse.ts";
import { readingGroups } from "./reading.ts";

const parsed = parseMarkdown("# A\n- B\n- C\n  - E\n  - F\n- D\n", {
	title: "Note",
	rootPolicy: "h1",
});
const groups = (node: typeof parsed.root): string[][] =>
	readingGroups(node).map((group) => group.map((part) => part.text));

test("reads a parent and its direct children before descending", () => {
	assert.deepEqual(groups(parsed.root), [
		["A", "B", "C", "D"],
		["C", "E", "F"],
	]);
});

test("starts at the selected branch without reading its ancestors or siblings", () => {
	const selected = parsed.root.children[1];
	assert.equal(selected.text, "C");
	assert.deepEqual(groups(selected), [["C", "E", "F"]]);
});

test("a selected leaf is read once", () => {
	assert.deepEqual(groups(parsed.root.children[0]), [["B"]]);
});

