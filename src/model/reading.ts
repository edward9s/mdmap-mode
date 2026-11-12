import type { MindNode } from "./types.ts";

/**
 * Read one parent and all of its immediate children, then descend to each
 * child that itself has children. Leaf nodes are already read by their parent.
 *
 * The caller chooses the root: the entire map or a selected branch.
 */
export function readingGroups(root: MindNode): MindNode[][] {
	const groups: MindNode[][] = [];
	const visit = (node: MindNode, isRoot: boolean): void => {
		if (node.children.length > 0) {
			groups.push([node, ...node.children]);
			for (const child of node.children) visit(child, false);
		} else if (isRoot) {
			groups.push([node]);
		}
	};
	visit(root, true);
	return groups;
}
