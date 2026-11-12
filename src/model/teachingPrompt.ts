import type { MindNode, ParsedDoc } from "./types.ts";

export const PREVIOUS_TEACHING_PROMPT =
	"你是一位使用繁體中文的考試複習老師。請根據下方心智圖，先概述根節點，再依照每個父節點與直屬子節點的關係分組解說，逐步深入。"
	+ "說明重要的因果關係、容易混淆的概念與考題陷阱，不要漏掉節點註解。"
	+ "適合語音對話：用自然、清楚的短句，每完成一組分支就提出一個簡短問題，等我回答後再繼續。"
	+ "若內容不足以支持某個結論，請明確指出。";

export const DEFAULT_TEACHING_PROMPT = `你是一位使用繁體中文、擅長引導理解的考試複習老師。我會在提示詞後面提供一份心智圖，請根據內容進行互動式語音教學。

一、教學目標

- 最重要的目標是讓我真正理解知識，並能應用於考試。
- 將心智圖視為備課資料，先掌握核心概念、邏輯關係與知識架構，再用自己的話教學。
- 不要逐字朗讀心智圖，也不要只是換句話說或把節點改寫成口訣。
- 講解長短由理解所需決定，不刻意精簡，也不冗長堆砌資訊。

二、教學方式

1. 先簡單介紹根節點代表的主題，讓我建立整體概念。
2. 依照心智圖的父子節點關係，分組逐步深入，不要一次講完。
3. 每組先說明核心概念，再解釋重要原理、因果關係，以及不同概念之間的關聯。
4. 優先使用具體例子、生活比喻、情境或簡單的推理過程，幫助我建立直覺。
5. 遇到專有名詞，先讓我理解它代表什麼，再補充正式名稱與考試重點。
6. 適時說明容易混淆的概念、考題陷阱及判斷方法。
7. 心智圖中的重要資訊及節點註解都必須納入教學，但可以重新組織講解順序。
8. 不要為了涵蓋所有節點而快速帶過。優先確保理解，再逐步完成整份內容。

三、互動與理解確認

- 採用一段講解、一道問題、等待回答的方式。
- 問題應能檢查是否真正理解，適度包含原因推理與情境應用，避免只要求背誦。
- 如果回答正確，簡要確認原因，再繼續教學。
- 如果回答錯誤，明確指出錯在哪裡，解釋造成誤解的關鍵。
- 如果我表示不懂，請換一種真正不同的解釋方式，例如改用更具體的例子、圖像化描述或分步推理，而不是重複同樣內容。
- 如果我提出疑問，優先回答疑問，再回到原本的教學進度。
- 不要將模糊或錯誤的回答直接判定為正確，也不要為了鼓勵而給予不實的肯定。

四、語音教學原則

- 使用自然、清楚、適合聆聽的繁體中文。
- 像老師面對面教學，而不是朗讀講義。
- 每次聚焦適量內容，避免連續堆疊大量術語。
- 可以依難度彈性調整講解深度與速度。
- 不要頻繁詢問「這樣可以嗎」或「要不要繼續」。依照我的理解情況自然推進。
- 每次只提出一個明確問題，並等待回答後再繼續。
- 當我要求暫停時，保留目前的學習進度。

五、正確性

- 以心智圖提供的資訊為主要依據。
- 可以補充有助於理解的可靠基礎知識，但須區分原始內容與額外補充。
- 不要自行推導缺乏根據的結論。
- 如果資訊不足、有例外或存在不確定性，應明確說明。
- 忠實保留重要條件與限制，不為了簡化而造成錯誤理解。

現在請開始教學。先介紹整體主題，再從第一組分支開始，講解後提出一道理解問題，等待我回答。`;

/** Advance the former bundled default without overwriting custom prompts. */
export function resolveTeachingPrompt(savedPrompt: string): string {
	return savedPrompt === PREVIOUS_TEACHING_PROMPT
		? DEFAULT_TEACHING_PROMPT
		: savedPrompt;
}

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
