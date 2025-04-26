import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "fs";

import { JSONParse, JSONStringify } from "json-with-bigint";

import path from "path";
import { createPatchConfig } from "./patch-generator";

/**
 * Applies patches to a JSON schema
 * @param schema The original schema to patch
 * @param patchConfig The patch configuration
 * @returns The patched schema
 */
export function patchSchema(schema: any, patchConfig: any): any {
	// Create a deep clone of the schema to avoid modifying the original
	const patchedSchema = JSONParse(JSONStringify(schema));

	for (const patch of patchConfig.patches) {
		if (patch.path.startsWith("/")) patch.path = patch.path.slice(1);
		const pathParts = patch.path.split("/");
		let current = patchedSchema;

		// Navigate to the parent of the target location
		for (let i = 0; i < pathParts.length - 1; i++) {
			const part = pathParts[i];
			if (current[part.replaceAll("~1", "/")] === undefined) {
				current[part] = {};
			}
			current = current[part.replaceAll("~1", "/")];
		}

		const lastPart = pathParts[pathParts.length - 1];

		switch (patch.op) {
			case "add":
			case "replace":
				if (
					typeof patch.value === "object" &&
					!Array.isArray(patch.value) &&
					current[lastPart]
				) {
					// Merge objects if the target exists
					current[lastPart] = { ...current[lastPart], ...patch.value };
				} else {
					// Otherwise overwrite
					current[lastPart] = patch.value;
				}
				break;
			case "remove":
				delete current[lastPart];
				break;
			case "merge":
				if (
					current[lastPart] &&
					typeof current[lastPart] === "object" &&
					!Array.isArray(current[lastPart])
				) {
					current[lastPart] = deepMerge(current[lastPart], patch.value);
				} else {
					current[lastPart] = patch.value;
				}
				break;
			default:
				throw new Error(`Unsupported operation: ${patch.op}`);
		}
	}

	return patchedSchema;
}

/**
 * Deep merges two objects
 */
function deepMerge(target: any, source: any): any {
	if (typeof target !== "object" || typeof source !== "object") return source;

	const output = { ...target };
	for (const key in source) {
		if (source.hasOwnProperty(key)) {
			if (
				target.hasOwnProperty(key) &&
				typeof target[key] === "object" &&
				typeof source[key] === "object"
			) {
				output[key] = deepMerge(target[key], source[key]);
			} else {
				output[key] = source[key];
			}
		}
	}
	return output;
}

const commands = [
	{
		description: "Prepare the repo for editing.",
		command: "bun prep",
	},
	{
		description: "Generate a patch file by diffing two openapi specs.",
		command: "bun generate-patch [<original> <modified>]",
	},
	{
		description:
			"Patch the Discord openapi specs using the patches in the patches folder.",
		command: "bun generate-schema",
	},
];

function printHelp() {
	let outStr = "How to use:\n\n";
	for (const command of commands) {
		outStr += `\t${command.description}\n`;
		outStr += `\tExample: ${command.command}\n\n`;
	}

	outStr += `\n`;

	console.error(outStr);
}

function main() {
	if (process.argv.length < 3) {
		printHelp();
		process.exit(1);
	}

	const action = process.argv[2];

	switch (action) {
		case "generate-patch": {
			const originalPath = process.argv[3] ?? "specs/openapi_preview.json";
			const modifiedPath =
				process.argv[4] ?? "specs/openapi_preview.modified.json";
			if (!originalPath || !modifiedPath) {
				printHelp();
				process.exit(1);
			}

			const originalFile = JSONParse(
				readFileSync(originalPath, { encoding: "utf-8" }),
			);
			const modifiedFile = JSONParse(
				readFileSync(modifiedPath, { encoding: "utf-8" }),
			);

			const patches = createPatchConfig(originalFile, modifiedFile);

			const outPath = path.join(__dirname, "../patches/__new_patch.json");

			mkdirSync(path.join(__dirname, "../patches"), { recursive: true });
			writeFileSync(outPath, JSONStringify(patches, null, 2));

			console.log("New patch has been written to ", outPath);

			process.exit(0);
		}
		case "generate-schema": {
			const originalFile = readFileSync(
				path.join(__dirname, "../specs/openapi_preview.json"),
				{ encoding: "utf-8" },
			);
			const originalSchema = JSONParse(originalFile);
			const patchDir = path.join(__dirname, "../patches");
			const patchFiles = readdirSync(patchDir).filter((p) =>
				p.endsWith(".json"),
			);

			let patched = originalSchema;

			for (const file of patchFiles) {
				const filePath = path.join(patchDir, file);
				const body = JSONParse(readFileSync(filePath, { encoding: "utf-8" }));

				patched = patchSchema(patched, body);
				console.log(`Applied patches from ${file}`);
			}

			const outputPath = path.join(
				__dirname,
				"../generated/openapi_preview.json",
			);
			writeFileSync(outputPath, JSONStringify(patched, null, 2));

			console.log(`Written changes to ${outputPath}`);

			break;
		}
		case "prep": {
			const specDir = path.join(__dirname, "../specs");

			const isForced = process.argv[3] === "--force";

			if (
				!isForced &&
				existsSync(path.join(specDir, "openapi_preview.modified.json"))
			) {
				console.error(
					"specs/openapi_preview.modified.json already exists.\n",
					"If you really want to reset it, add '--force' after the command.",
				);
				process.exit(1);
			}

			copyFileSync(
				path.join(specDir, "openapi_preview.json"),
				path.join(specDir, "openapi_preview.modified.json"),
			);

			console.log(
				"Copied 'specs/openapi_preview.json' to 'specs/openapi_preview.modified.json'.",
			);
			console.log(
				"You should edit 'specs/openapi_preview.modified.json' and then run 'bun generate-patch'.",
			);
			console.log("This will create a file, 'patches/__new_patch.json'.");
			console.log(
				"You can apply the changes by running 'bun generate-schema'.",
			);
			console.log("This will be written to 'generated/openapi_preview.json'.");
			break;
		}
		default: {
			printHelp();
			process.exit(1);
		}
	}
}

main();
