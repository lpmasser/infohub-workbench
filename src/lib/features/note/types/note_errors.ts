// Conditions the note services branch on. The adapter maps the Web API's
// status codes to these; nothing matches on message text.

export class NoteVersionConflictError extends Error {
  constructor(path: string) {
    super(`${path} 已在别处修改，未覆盖`);
    this.name = "NoteVersionConflictError";
  }
}

export class NoteExistsError extends Error {
  constructor(path: string) {
    super(`${path} 已存在`);
    this.name = "NoteExistsError";
  }
}

export class NoteNotTextError extends Error {
  constructor(path: string) {
    super(`${path} 不是文本文件`);
    this.name = "NoteNotTextError";
  }
}
