interface Patch {
	path: string;
	op: "add" | "replace" | "remove";
	value?: any;
}

interface PatchConfig {
	$schema?: string;
	patches: Patch[];
}

function generatePatches(
	original: any,
	modified: any,
	basePath: string = "",
): Patch[] {
	const patches: Patch[] = [];

	// If modified is undefined/null, everything needs to be removed
	if (modified === undefined || modified === null) {
		if (original !== undefined && original !== null) {
			patches.push({ path: basePath, op: "remove" });
		}
		return patches;
	}

	// If original is undefined/null, everything needs to be added
	if (original === undefined || original === null) {
		patches.push({ path: basePath, op: "add", value: modified });
		return patches;
	}

	// Handle primitive values
	if (typeof modified !== "object" || modified === null) {
		if (original !== modified) {
			patches.push({ path: basePath, op: "replace", value: modified });
		}
		return patches;
	}

	// Handle arrays
	if (Array.isArray(modified)) {
		if (!Array.isArray(original) || original.length !== modified.length) {
			patches.push({ path: basePath, op: "replace", value: modified });
		} else {
			for (let i = 0; i < modified.length; i++) {
				patches.push(
					...generatePatches(original[i], modified[i], `${basePath}/${i}`),
				);
			}
		}
		return patches;
	}

	// Handle objects
	const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);

	for (const key of allKeys) {
		const currentPath = basePath
			? `${basePath}/${key.replaceAll("/", "~1")}`
			: key;

		if (!(key in modified)) {
			// Key was removed
			patches.push({ path: currentPath, op: "remove" });
		} else if (!(key in original)) {
			// Key was added
			patches.push({ path: currentPath, op: "add", value: modified[key] });
		} else {
			// Key exists in both - recurse
			patches.push(
				...generatePatches(original[key], modified[key], currentPath),
			);
		}
	}

	return patches;
}

/**
 * Filters and optimizes patches to minimize the number of operations
 */
function optimizePatches(patches: Patch[]): Patch[] {
	const pathMap = new Map<string, Patch>();

	// Process patches in reverse order to handle nested paths correctly
	for (const patch of [...patches].reverse()) {
		// Check if this path is already covered by a parent patch
		let isCovered = false;
		for (const [existingPath] of pathMap) {
			if (patch.path.startsWith(existingPath + "/")) {
				isCovered = true;
				break;
			}
		}

		if (!isCovered) {
			pathMap.set(patch.path, patch);
		}
	}

	// Convert back to array and sort by path
	return Array.from(pathMap.values()).sort((a, b) =>
		a.path.localeCompare(b.path),
	);
}

/**
 * Creates a patch configuration from two schemas
 */
export function createPatchConfig(original: any, modified: any): PatchConfig {
	const patches = generatePatches(original, modified);
	const optimized = optimizePatches(patches);

	optimized.forEach((o) => {
		if (!o.path.startsWith("/")) {
			o.path = `/${o.path}`;
		}
	});

	return {
		$schema: "../schema.json",
		patches: optimized,
	};
}
