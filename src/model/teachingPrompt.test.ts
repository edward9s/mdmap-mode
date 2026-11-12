import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdown } from "./parse.ts";
import {
	DEFAULT_TEACHING_PROMPT,
	PREVIOUS_TEACHING_PROMPT,
	branchOutline,
	resolveTeachingPrompt,
	teachingMessage,
} from "./teachingPrompt.ts";

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

test("the teaching prompt prioritizes understanding and one question at a time", () => {
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("不要逐字朗讀心智圖"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("一段講解、一道問題、等待回答"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("不要將模糊或錯誤的回答直接判定為正確"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("當我要求暫停時，保留目前的學習進度"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("忠實保留重要條件與限制"));
	const message = teachingMessage(DEFAULT_TEACHING_PROMPT, "生物學", "- DNA 複製");
	assert.equal(message.match(/心智圖內容（來源筆記：/g)?.length, 1);
});

test("updates the former bundled default but preserves customized text", () => {
	assert.equal(resolveTeachingPrompt(PREVIOUS_TEACHING_PROMPT), DEFAULT_TEACHING_PROMPT);
	assert.equal(resolveTeachingPrompt("我自己的教學要求"), "我自己的教學要求");
});
