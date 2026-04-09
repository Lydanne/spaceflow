import type { ChangedFile } from "@spaceflow/core";
import { extname } from "path";
import type { FileStatusCount } from "./types/changed-file-collection";

/**
 * 变更文件集合，封装 ChangedFile[] 并提供常用访问器。
 */
export class ChangedFileCollection implements Iterable<ChangedFile> {
  private readonly _files: ChangedFile[];

  constructor(files: ChangedFile[]) {
    this._files = files;
  }

  static from(files: ChangedFile[]): ChangedFileCollection {
    return new ChangedFileCollection(files);
  }

  static empty(): ChangedFileCollection {
    return new ChangedFileCollection([]);
  }

  get length(): number {
    return this._files.length;
  }

  toArray(): ChangedFile[] {
    return [...this._files];
  }

  [Symbol.iterator](): Iterator<ChangedFile> {
    return this._files[Symbol.iterator]();
  }

  filenames(): string[] {
    return this._files.map((f) => f.filename ?? "").filter(Boolean);
  }

  extensions(): Set<string> {
    const exts = new Set<string>();
    for (const f of this._files) {
      if (f.filename) {
        const ext = extname(f.filename).replace(/^\./, "").toLowerCase();
        if (ext) exts.add(ext);
      }
    }
    return exts;
  }

  has(filename: string): boolean {
    return this._files.some((f) => f.filename === filename);
  }

  filter(predicate: (file: ChangedFile) => boolean): ChangedFileCollection {
    return new ChangedFileCollection(this._files.filter(predicate));
  }

  map<T>(fn: (file: ChangedFile) => T): T[] {
    return this._files.map(fn);
  }

  countByStatus(): FileStatusCount {
    let added = 0,
      modified = 0,
      deleted = 0;
    for (const f of this._files) {
      if (f.status === "added") added++;
      else if (f.status === "modified") modified++;
      else if (f.status === "deleted") deleted++;
    }
    return { added, modified, deleted };
  }

  nonDeletedFiles(): ChangedFileCollection {
    return this.filter((f) => f.status !== "deleted" && !!f.filename);
  }

  filterByFilenames(names: Iterable<string>): ChangedFileCollection {
    const nameSet = new Set(names);
    return this.filter((f) => !!f.filename && nameSet.has(f.filename));
  }

  filterByCommitFiles(commitFilenames: Iterable<string>): ChangedFileCollection {
    const nameSet = new Set(commitFilenames);
    return this.filter((f) => !!f.filename && nameSet.has(f.filename));
  }
}
