declare global {
  namespace App {}

  interface ImportMetaEnv {
    readonly VITE_INFOHUB_TARGET?: string;
  }

  interface FileSystemDirectoryHandle {
    values(): AsyncIterableIterator<FileSystemHandle>;
  }
}

declare module "@typescript-eslint/types" {
  export namespace TSESTree {
    export type Node = unknown;
  }
}

export {};
