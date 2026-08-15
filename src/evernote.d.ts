declare module "evernote" {
  export interface NoteStoreClient {
    [method: string]: ((...args: unknown[]) => Promise<unknown>) | unknown;
  }

  export class Client {
    constructor(options: {
      token: string;
      sandbox: boolean;
      china: boolean;
      serviceHost?: string;
    });
    getNoteStore(noteStoreUrl: string): NoteStoreClient;
  }
}
