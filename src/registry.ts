export type Risk = "read" | "write" | "share" | "send";

export interface MethodSpec {
  readonly name: string;
  readonly params: readonly string[];
  readonly risk: Risk;
  readonly summary: string;
}

const read = (name: string, params: readonly string[], summary: string): MethodSpec => ({ name, params, risk: "read", summary });
const write = (name: string, params: readonly string[], summary: string): MethodSpec => ({ name, params, risk: "write", summary });
const share = (name: string, params: readonly string[], summary: string): MethodSpec => ({ name, params, risk: "share", summary });
const send = (name: string, params: readonly string[], summary: string): MethodSpec => ({ name, params, risk: "send", summary });

// Source of truth: https://dev.evernote.com/doc/reference/NoteStore.html
// Authentication tokens and callbacks are injected by the official SDK and are therefore omitted.
export const METHODS = [
  read("getSyncState", [], "Get the account synchronization state."),
  read("getFilteredSyncChunk", ["afterUSN", "maxEntries", "filter"], "Get a filtered synchronization chunk."),
  read("getLinkedNotebookSyncState", ["linkedNotebook"], "Get sync state for a linked notebook."),
  read("getLinkedNotebookSyncChunk", ["linkedNotebook", "afterUSN", "maxEntries", "fullSyncOnly"], "Get a sync chunk for a linked notebook."),
  read("listNotebooks", [], "List notebooks visible to the account."),
  read("listAccessibleBusinessNotebooks", [], "List accessible business notebooks."),
  read("getNotebook", ["guid"], "Get a notebook by GUID."),
  read("getDefaultNotebook", [], "Get the default notebook."),
  write("createNotebook", ["notebook"], "Create a notebook."),
  write("updateNotebook", ["notebook"], "Update a notebook."),
  read("listTags", [], "List tags."),
  read("listTagsByNotebook", ["notebookGuid"], "List tags used in a notebook."),
  read("getTag", ["guid"], "Get a tag by GUID."),
  write("createTag", ["tag"], "Create a tag."),
  write("updateTag", ["tag"], "Update a tag."),
  read("listSearches", [], "List saved searches."),
  read("getSearch", ["guid"], "Get a saved search by GUID."),
  write("createSearch", ["search"], "Create a saved search."),
  write("updateSearch", ["search"], "Update a saved search."),
  read("findNoteOffset", ["filter", "guid"], "Find a note position in a filtered result set."),
  read("findNotesMetadata", ["filter", "offset", "maxNotes", "resultSpec"], "Search notes and return selected metadata."),
  read("findNoteCounts", ["filter", "withTrash"], "Count matching notes by notebook and tag."),
  read("getNoteWithResultSpec", ["guid", "resultSpec"], "Get a note using a result specification."),
  read("getNote", ["guid", "withContent", "withResourcesData", "withResourcesRecognition", "withResourcesAlternateData"], "Get a note (deprecated compatibility method)."),
  read("getNoteApplicationData", ["guid"], "Get all note application data."),
  read("getNoteApplicationDataEntry", ["guid", "key"], "Get one note application data entry."),
  write("setNoteApplicationDataEntry", ["guid", "key", "value"], "Set one note application data entry."),
  read("getNoteContent", ["guid"], "Get note ENML content."),
  read("getNoteSearchText", ["guid", "noteOnly", "tokenizeForIndexing"], "Get note search text."),
  read("getResourceSearchText", ["guid"], "Get resource search text."),
  read("getNoteTagNames", ["guid"], "Get tag names for a note."),
  write("createNote", ["note"], "Create a note."),
  write("updateNote", ["note"], "Update a note; active=false is rejected by policy."),
  write("copyNote", ["noteGuid", "toNotebookGuid"], "Copy a note to another notebook."),
  read("listNoteVersions", ["noteGuid"], "List note versions."),
  read("getNoteVersion", ["noteGuid", "updateSequenceNum", "withResourcesData", "withResourcesRecognition", "withResourcesAlternateData"], "Get a historical note version."),
  read("getResource", ["guid", "withData", "withRecognition", "withAttributes", "withAlternateData"], "Get a resource."),
  read("getResourceApplicationData", ["guid"], "Get all resource application data."),
  read("getResourceApplicationDataEntry", ["guid", "key"], "Get one resource application data entry."),
  write("setResourceApplicationDataEntry", ["guid", "key", "value"], "Set one resource application data entry."),
  write("updateResource", ["resource"], "Update resource metadata."),
  read("getResourceData", ["guid"], "Get raw resource data, encoded as base64 in MCP output."),
  read("getResourceByHash", ["noteGuid", "contentHash", "withData", "withRecognition", "withAlternateData"], "Get a resource by note GUID and MD5 hash."),
  read("getResourceRecognition", ["guid"], "Get resource recognition data."),
  read("getResourceAlternateData", ["guid"], "Get resource alternate data."),
  read("getResourceAttributes", ["guid"], "Get resource attributes."),
  read("getPublicNotebook", ["userId", "publicUri"], "Get public notebook metadata."),
  share("shareNotebook", ["sharedNotebook", "message"], "Share a notebook (deprecated compatibility method)."),
  share("createOrUpdateNotebookShares", ["shareTemplate"], "Create or update notebook shares."),
  share("updateSharedNotebook", ["sharedNotebook"], "Update a shared notebook (deprecated compatibility method)."),
  share("setNotebookRecipientSettings", ["notebookGuid", "recipientSettings"], "Set recipient settings for a shared notebook."),
  read("listSharedNotebooks", [], "List shared notebooks."),
  write("createLinkedNotebook", ["linkedNotebook"], "Create a linked notebook."),
  write("updateLinkedNotebook", ["linkedNotebook"], "Update a linked notebook."),
  read("listLinkedNotebooks", [], "List linked notebooks."),
  read("authenticateToSharedNotebook", ["shareKeyOrGlobalId"], "Authenticate to a shared notebook."),
  read("getSharedNotebookByAuth", [], "Get the shared notebook associated with the current shared token."),
  send("emailNote", ["parameters"], "Send a note by email."),
  share("shareNote", ["guid"], "Create or retrieve a public note share key."),
  read("authenticateToSharedNote", ["guid", "noteKey"], "Authenticate to a shared note."),
  read("findRelated", ["query", "resultSpec"], "Find related notes, notebooks, and tags."),
  write("updateNoteIfUsnMatches", ["note"], "Update a note only if its USN matches; active=false is rejected."),
  share("manageNotebookShares", ["parameters"], "Manage notebook share privileges; unshare operations are rejected."),
  read("getNotebookShares", ["notebookGuid"], "Get notebook share relationships.")
] as const satisfies readonly MethodSpec[];

export const BLOCKED_METHODS = [
  "deleteNote",
  "expungeNote",
  "expungeNotebook",
  "expungeTag",
  "expungeSearch",
  "expungeLinkedNotebook",
  "untagAll",
  "unsetNoteApplicationDataEntry",
  "unsetResourceApplicationDataEntry",
  "stopSharingNote"
] as const;

export const METHOD_BY_NAME = new Map<string, MethodSpec>(METHODS.map((method) => [method.name, method]));

export function searchMethods(query: string): MethodSpec[] {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [...METHODS];
  return METHODS.filter((method) => {
    const haystack = `${method.name} ${method.summary} ${method.risk} ${method.params.join(" ")}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}
