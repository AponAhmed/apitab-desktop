import { create } from 'zustand';

/**
 * Holds the actual `File` objects chosen for a request's binary body or
 * form-data file fields, keyed by the owning row's id (or `binary:<requestId>`
 * for the whole-body case) — see types/request.ts's `KeyValue.fileName` /
 * `RequestBody.binaryFileName` for the persisted display-name counterpart.
 *
 * Deliberately NOT persisted: a `File` can't be serialized to disk, and
 * re-picking it after a reload/restart is the only option anyway. Requests
 * only ever reference a file by name in storage; the bytes exist purely for
 * the current session.
 */
interface FileState {
  files: Record<string, File>;
  setFile: (key: string, file: File) => void;
  removeFile: (key: string) => void;
}

export const useFileStore = create<FileState>()((set) => ({
  files: {},
  setFile: (key, file) => set((s) => ({ files: { ...s.files, [key]: file } })),
  removeFile: (key) =>
    set((s) => {
      const { [key]: _removed, ...rest } = s.files;
      return { files: rest };
    }),
}));

/** File-store key for a form-data row's file value. */
export const formDataFileKey = (rowId: string): string => rowId;

/** File-store key for a request's whole-body binary file. */
export const binaryFileKey = (requestId: string): string => `binary:${requestId}`;
