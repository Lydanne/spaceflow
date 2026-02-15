export interface GitCommit {
  sha: string;
  message: string;
  author?: {
    name?: string;
    email?: string;
    date?: string;
  };
}

export interface GitChangedFile {
  filename: string;
  status: string;
  patch?: string;
}

export interface GitDiffFile {
  filename: string;
  patch: string;
}

export interface GitRunOptions {
  cwd?: string;
  maxBuffer?: number;
}
