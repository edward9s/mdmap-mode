import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdown } from "./parse.ts";
import {
	DEFAULT_TEACHING_PROMPT,
	PREVIOUS_TEACHING_PROMPT,
	PREVIOUS_VERBOSE_TEACHING_PROMPT,
	PREVIOUS_COMPACT_TEACHING_PROMPT,
	branchOutline,
	frontmatterSourceUrl,
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

test("the concise teaching prompt preserves critical learning behavior", () => {
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("不要逐字朗讀心智圖"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("一道理解問題 → 等待回答"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("錯誤或模糊時明確糾正"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("如果我不懂，改用真正不同的例子或解釋方法"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("要求暫停時保留進度"));
	assert.ok(DEFAULT_TEACHING_PROMPT.includes("例外、不確定性或重要限制"));
	assert.ok(DEFAULT_TEACHING_PROMPT.length < PREVIOUS_VERBOSE_TEACHING_PROMPT.length);
	const message = teachingMessage(DEFAULT_TEACHING_PROMPT, "生物學", "- DNA 複製");
	assert.equal(message.match(/心智圖內容（來源筆記：/g)?.length, 1);
	assert.ok(DEFAULT_TEACHING_PROMPT.endsWith("等待我回答。"));
	assert.ok(!DEFAULT_TEACHING_PROMPT.endsWith("等待我回答."));
});

test("updates both bundled defaults but preserves customized text", () => {
	assert.equal(resolveTeachingPrompt(PREVIOUS_TEACHING_PROMPT), DEFAULT_TEACHING_PROMPT);
	assert.equal(resolveTeachingPrompt(PREVIOUS_VERBOSE_TEACHING_PROMPT), DEFAULT_TEACHING_PROMPT);
	assert.equal(resolveTeachingPrompt(PREVIOUS_COMPACT_TEACHING_PROMPT), DEFAULT_TEACHING_PROMPT);
	assert.equal(resolveTeachingPrompt(DEFAULT_TEACHING_PROMPT), DEFAULT_TEACHING_PROMPT);
	assert.equal(resolveTeachingPrompt("我自己的教學要求"), "我自己的教學要求");
	assert.equal(resolveTeachingPrompt(""), "");
});

test("adds source_url beside the source note when available", () => {
	const url = "https://example.org/original?item=42";
	const sourceUrl = frontmatterSourceUrl({ source_url: "  " + url + "  " });
	const message = teachingMessage("請解說。", "分生_生物技術_序列分析", "- 核酸指紋", sourceUrl);
	assert.equal(message, [
		"請解說。",
		"心智圖內容（來源筆記：分生_生物技術_序列分析）：\n來源網址：" + url,
		"- 核酸指紋",
	].join("\n\n"));
});

test("omits missing source_url and rejects invalid values", () => {
	assert.equal(frontmatterSourceUrl(null), null);
	assert.equal(frontmatterSourceUrl({}), null);
	assert.equal(frontmatterSourceUrl({ source_url: " " }), null);
	assert.equal(frontmatterSourceUrl({ source_url: null }), null);
	assert.throws(() => frontmatterSourceUrl({ source_url: 123 }), /source_url must be a string/);
	const message = teachingMessage("請解說。", "筆記 A", "- A", frontmatterSourceUrl({}));
	assert.equal(message, ["請解說。", "心智圖內容（來源筆記：筆記 A）：", "- A"].join("\n\n"));
});
