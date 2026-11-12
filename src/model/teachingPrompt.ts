import type { MindNode, ParsedDoc } from "./types.ts";

export const DEFAULT_TEACHING_PROMPT =
	"你是一位使用繁體中文的考試複習老師。請根據下方心智圖，先概述根節點，再依照每個父節點與直屬子節點的關係分組解說，逐步深入。"
	+ "說明重要的因果關係、容易混淆的概念與考題陷阱，不要漏掉節點註解。"
	+ "適合語音對話：用自然、清楚的短句，每完成一組分支就提出一個簡短問題，等我回答後再繼續。"
	+ "若內容不足以支持某個結論，請明確指出。";

/** Export the chosen node and every descendant, regardless of fold state. */
export function branchOutline(parsed: ParsedDoc, root: MindNode): string {
	const output: string[] = [];

	const visit = (node: MindNode, depth: number): void => {
		const indent = "  ".repeat(depth);
		const checkbox = node.checkbox === null ? "" : "[" + node.checkbox + "] ";
		output.push(indent + "- " + checkbox + node.text);

		const parts: Array<{ line: number; child?: MindNode; bodyIndex?: number }> =
			node.children.map((child) => ({ line: child.lineStart, child }));
		node.bodyRanges.forEach(([line], bodyIndex) => {
			parts.push({ line, bodyIndex });
		});
		parts.sort((left, right) => left.line - right.line);

		for (const part of parts) {
			if (part.child) {
				visit(part.child, depth + 1);
				continue;
			}
			if (part.bodyIndex === undefined) throw new Error("Invalid outline part.");
			const [start, end] = node.bodyRanges[part.bodyIndex];
			const annotation = node.annotationIndices.includes(part.bodyIndex);
			for (const line of parsed.doc.lines.slice(start, end + 1)) {
				const text = annotation
					? "> " + line.replace(/^[ \t]*:[ \t]?/, "")
					: line;
				output.push(indent + "  " + text);
			}
		}
	};

	visit(root, 0);
	return output.join("\n").trimEnd();
}

export function teachingMessage(prompt: string, noteTitle: string, outline: string): string {
	const header = "心智圖內容（來源筆記：" + noteTitle + "）：";
	return [prompt.trim(), header, outline].filter(Boolean).join("\n\n");
}
