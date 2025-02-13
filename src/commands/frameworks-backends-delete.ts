import { Command } from "../command";
import { Options } from "../options";
import { needProjectId } from "../projectUtils";
import { FirebaseError } from "../error";
import * as gcp from "../gcp/frameworks";
import { promptOnce } from "../prompt";
import * as utils from "../utils";
import { logger } from "../logger";
import { DEFAULT_REGION, ALLOWED_REGIONS } from "../init/features/frameworks/constants";
const Table = require("cli-table");

const COLUMN_LENGTH = 20;
const TABLE_HEAD = [
  "Backend Id",
  "Repository Name",
  "Location",
  "URL",
  "Created Date",
  "Updated Date",
];

export const command = new Command("backends:delete")
  .description("Delete a backend from a Firebase project")
  .option("-l, --location <location>", "App Backend location", "")
  .option("-s, --backend <backend>", "Backend Id", "")
  .withForce()
  .action(async (options: Options) => {
    const projectId = needProjectId(options);
    let location = options.location as string;
    const backendId = options.backend as string;
    if (!backendId) {
      throw new FirebaseError("Backend id can't be empty.");
    }

    if (!location) {
      location = await promptOnce({
        name: "region",
        type: "list",
        default: DEFAULT_REGION,
        message: "Please select the region of the backend you'd like to delete:",
        choices: ALLOWED_REGIONS,
      });
    }

    const table = new Table({
      head: TABLE_HEAD,
      style: { head: ["green"] },
    });
    table.colWidths = COLUMN_LENGTH;

    let backend;
    try {
      backend = await gcp.getBackend(projectId, location, backendId);
      populateTable(backend, table);
    } catch (err: any) {
      throw new FirebaseError(`No backends found with given parameters. Command aborted.`, {
        original: err,
      });
    }

    utils.logWarning("You are about to permanently delete the backend:");
    logger.info(table.toString());

    const confirmDeletion = await promptOnce(
      {
        type: "confirm",
        name: "force",
        default: false,
        message: "Are you sure?",
      },
      options
    );
    if (!confirmDeletion) {
      throw new FirebaseError("Deletion Aborted");
    }

    try {
      await gcp.deleteBackend(projectId, location, backendId);
      utils.logSuccess(`Successfully deleted the backend: ${backendId}`);
    } catch (err: any) {
      throw new FirebaseError(
        `Failed to delete backend: ${backendId}. Please check the parameters you have provided.`,
        { original: err }
      );
    }

    return backend;
  });

function populateTable(backend: gcp.Backend, table: any) {
  const [location, , backendId] = backend.name.split("/").slice(3, 6);
  const entry = [
    backendId,
    backend.codebase.repository?.split("/").pop(),
    location,
    backend.uri,
    backend.createTime,
    backend.updateTime,
  ];
  const newRow = entry.map((name) => {
    const maxCellWidth = COLUMN_LENGTH - 2;
    const chunks = [];
    for (let i = 0; name && i < name.length; i += maxCellWidth) {
      chunks.push(name.substring(i, i + maxCellWidth));
    }
    return chunks.join("\n");
  });
  table.push(newRow);
}
