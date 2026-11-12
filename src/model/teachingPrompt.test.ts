import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdown } from "./parse.ts";
import { branchOutline, teachingMessage } from "./teachingPrompt.ts";

const parsed = parseMarkdown(
	"# A\n: 父註解\n\n- B\n- C\n  : 子註解\n  - E\n  - F\n- D\n",
	{ title: "Note", rootPolicy: "h1" },
);

test("exports hierarchy and annotations in document order", () => {
	assert.equal(branchOutline(parsed, parsed.root), [
		"- A",
		"  > 父註解",
		"  - B",
		"  - C",
		"    > 子註解",
		"    - E",
		"    - F",
		"  - D",
	].join("\n"));
});

test("selected branch includes every descendant and excludes siblings", () => {
	assert.equal(branchOutline(parsed, parsed.root.children[1]), [
		"- C",
		"  > 子註解",
		"  - E",
		"  - F",
	].join("\n"));
});

test("a selected leaf produces only its own content", () => {
	assert.equal(branchOutline(parsed, parsed.root.children[0]), "- B");
});

test("preserves source paragraphs, checkboxes and links", () => {
	const source = parseMarkdown(
		"# [[A|標題]]\n\nIntro text.\n\n- [x] **重點**\n",
		{ title: "Note", rootPolicy: "h1" },
	);
	assert.equal(branchOutline(source, source.root), [
		"- [[A|標題]]",
		"  ",
		"  Intro text.",
		"  ",
		"  - [x] **重點**",
	].join("\n"));
});

test("the message includes editable prompt and source title", () => {
	assert.equal(teachingMessage("請解說。\n", "筆記 A", "- C\n  - E"), [
		"請解說。",
		"心智圖內容（來源筆記：筆記 A）：",
		"- C\n  - E",
	].join("\n\n"));
});
