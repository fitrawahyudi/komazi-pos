// Browser shim for Node.js "stream" module used by xlsx-js-style
export class Readable {
  pipe() { return this; }
  on() { return this; }
  once() { return this; }
  emit() { return false; }
}

export class Writable {
  write() { return true; }
  end() { return this; }
  on() { return this; }
}

export class Transform extends Readable {}
export class Duplex extends Readable {}
export class Stream extends Readable {}

const streamModule = {
  Readable,
  Writable,
  Transform,
  Duplex,
  Stream,
};

export default streamModule;
