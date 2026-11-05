// Fakes of the native image tool and file system for photo tests. Files are a map of uri → size.
// Use in a test file:
//   jest.mock('expo-image-manipulator', () => jest.requireActual('../../../test/photo-mocks').manipulatorModule);
//   jest.mock('expo-file-system', () => jest.requireActual('../../../test/photo-mocks').fileSystemModule);

export const mockFiles = {
  sizes: new Map<string, number>(),
  saved: [] as Array<{ format: string; compress: number }>,
  resized: [] as unknown[],
  /** The decode limits the image tool was given. */
  loaded: [] as unknown[],
  /** The size the image tool reads from the next picked photo. */
  rendered: { width: 1200, height: 800 },
  /** The size of the JPEG the image tool writes. */
  outBytes: 2_345_678,
  reset() {
    this.sizes.clear();
    this.saved = [];
    this.resized = [];
    this.loaded = [];
    this.rendered = { width: 1200, height: 800 };
    this.outBytes = 2_345_678;
  },
};

export const manipulatorModule = {
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri: string, options?: unknown) => {
      mockFiles.loaded.push(options);
      let size = { ...mockFiles.rendered };
      const ctx = {
        resize: (to: { width?: number; height?: number }) => {
          mockFiles.resized.push(to);
          const scale = to.width ? to.width / size.width : to.height! / size.height;
          size = { width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
          return ctx;
        },
        renderAsync: async () => ({
          width: size.width,
          height: size.height,
          release: () => undefined,
          saveAsync: async (opts: { format: string; compress: number }) => {
            mockFiles.saved.push(opts);
            const out = `file:///cache/ImageManipulator/${uri.split('/').pop()}.jpg`;
            mockFiles.sizes.set(out, mockFiles.outBytes);
            return { uri: out, width: size.width, height: size.height };
          },
        }),
        release: () => undefined,
      };
      return ctx;
    },
  },
};

const join = (parts: unknown[]) => parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri).replace(/\/$/, '')).join('/');

class Directory {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = `${join(parts)}/`;
  }
  get exists() {
    return true;
  }
  create() {}
}

class File {
  uri: string;
  constructor(...parts: unknown[]) {
    this.uri = join(parts);
  }
  get exists() {
    return mockFiles.sizes.has(this.uri);
  }
  get size() {
    return mockFiles.sizes.get(this.uri) ?? 0;
  }
  async copy(dest: File) {
    if (!mockFiles.sizes.has(this.uri)) throw new Error('File not found');
    mockFiles.sizes.set(dest.uri, mockFiles.sizes.get(this.uri)!);
  }
  delete() {
    if (!mockFiles.sizes.has(this.uri)) throw new Error('File not found');
    mockFiles.sizes.delete(this.uri);
  }
  async arrayBuffer() {
    if (!mockFiles.sizes.has(this.uri)) throw new Error('File not found');
    return new ArrayBuffer(mockFiles.sizes.get(this.uri)!);
  }
}

export const fileSystemModule = { Directory, File, Paths: { document: { uri: 'file:///doc/' }, cache: { uri: 'file:///cache/' } } };
