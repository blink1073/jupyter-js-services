// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import expect = require('expect.js');

import {
  ICheckpointModel, IContentsModel, IContentsOpts, ContentsManager,
} from '../../lib/contents';


import {
  RequestHandler, ajaxSettings, expectFailure
} from './utils';


let DEFAULT_FILE: IContentsModel = {
  name: "test",
  path: "",
  type: "file",
  created: "yesterday",
  last_modified: "today",
  writable: true,
  mimetype: "text/plain",
  content: "hello, world!",
  format: "text"
}

let DEFAULT_DIR: IContentsModel = {
  name: "bar",
  path: "/foo/bar",
  type: "file",
  created: "yesterday",
  last_modified: "today",
  writable: false,
  mimetype: "",
  content: "['buzz.txt', 'bazz.py']",
  format: "json"
}

let DEFAULT_CP: ICheckpointModel = {
  id: "1234",
  last_modified: "yesterday"
}


describe('jupyter.services - Contents', () => {

  describe('#constructor()', () => {

    it('should complete properly', (done) => {
      let contents = new ContentsManager("localhost");
      done();
    });

  });

  describe('#get()', () => {

    it('should get a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let get = contents.get("/foo", { type: "file", name: "test" });
      get.then(model => {
        expect(model.path).to.be(DEFAULT_FILE.path);
        done();
      });
    });

    it('should get a directory', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_DIR);
      });
      let get = contents.get("/foo", { type: "directory", name: "bar" });
      get.then(model => {
        expect(model.content).to.be(DEFAULT_DIR.content);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_DIR);
      });
      let get = contents.get("/foo", { type: "directory", name: "bar" });
      get.then(model => {
        expect(model.content).to.be(DEFAULT_DIR.content);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let dir = JSON.parse(JSON.stringify(DEFAULT_DIR));
      dir.name = 1
      let handler = new RequestHandler(() => {
        handler.respond(200, dir);
      });
      let get = contents.get("/foo", { type: "directory", name: "bar",
                                       format: "json", content: false });
      expectFailure(get, done, 'Invalid Contents Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_DIR);
      });
      let get = contents.get("/foo", { name: "bar" });
      expectFailure(get, done, 'Invalid Status: 201');
    });

  });

  describe('#newUntitled()', () => {

    it('should create a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_FILE);
      });
      contents.newUntitled("/foo").then(model => {
        expect(model.path).to.be(DEFAULT_FILE.path);
        done();
      });
    });

    it('should create a directory', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_DIR);
      });
      let newDir = contents.newUntitled("/foo", { type: "directory",
                                                  ext: "" });
      newDir.then(model => {
        expect(model.content).to.be(DEFAULT_DIR.content);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_DIR);
      });
      let newDir = contents.newUntitled("/foo", { type: "directory",
                                                  ext: "" });
      newDir.then(model => {
        expect(model.content).to.be(DEFAULT_DIR.content);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let dir = JSON.parse(JSON.stringify(DEFAULT_DIR));
      dir.name = 1
      let handler = new RequestHandler(() => {
        handler.respond(201, dir);
      });
      let newFile = contents.newUntitled("/foo", { type: "file", ext: "py" });
      expectFailure(newFile, done, 'Invalid Contents Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_DIR);
      });
      let newDir = contents.newUntitled("/foo", { name: "bar" });
      expectFailure(newDir, done, 'Invalid Status: 200');
    });

  });

  describe('#delete()', () => {

    it('should delete a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      contents.delete("/foo/bar.txt").then(() => {
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      contents.delete("/foo/bar.txt").then(() => {
        done();
      });
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, { });
      });
      let del = contents.delete("/foo/bar.txt");
      expectFailure(del, done, 'Invalid Status: 200');
    });

    it('should throw a specific error', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(400, { });
      });
      let del = contents.delete("/foo/");
      expectFailure(del, done, '');
    });

    it('should throw a general error', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(500, { });
      });
      let del = contents.delete("/foo/");
      expectFailure(del, done, '');
    });

  });

  describe('#rename()', () => {

    it('should rename a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let rename = contents.rename("/foo/bar.txt", "/foo/baz.txt");
      rename.then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let rename = contents.rename("/foo/bar.txt", "/foo/baz.txt");
      rename.then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let dir = JSON.parse(JSON.stringify(DEFAULT_FILE));
      delete dir.path;
      let handler = new RequestHandler(() => {
        handler.respond(200, dir);
      });
      let rename = contents.rename("/foo/bar.txt", "/foo/baz.txt");
      expectFailure(rename, done, 'Invalid Contents Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_FILE);
      });
      let rename = contents.rename("/foo/bar.txt", "/foo/baz.txt");
      expectFailure(rename, done, 'Invalid Status: 201');
    });

  });

  describe('#save()', () => {

    it('should save a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let save = contents.save("/foo", { type: "file", name: "test" });
      save.then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should create a new file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_FILE);
      });
      let save = contents.save("/foo", { type: "file", name: "test" });
      save.then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let save = contents.save("/foo", { type: "file", name: "test" });
      save.then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let file = JSON.parse(JSON.stringify(DEFAULT_FILE));
      delete file.format;
      let handler = new RequestHandler(() => {
        handler.respond(200, file);
      });
      let save = contents.save("/foo", { type: "file", name: "test" });
      expectFailure(save, done, 'Invalid Contents Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(204, DEFAULT_FILE);
      });
      let save = contents.save("/foo", { type: "file", name: "test" });
      expectFailure(save, done, 'Invalid Status: 204');
    });

  });

  describe('#copy()', () => {

    it('should copy a file', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_FILE);
      });
      contents.copy("/foo/bar.txt", "/baz").then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_FILE);
      });
      contents.copy("/foo/bar.txt", "/baz").then(model => {
        expect(model.created).to.be(DEFAULT_FILE.created);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let file = JSON.parse(JSON.stringify(DEFAULT_FILE));
      delete file.type;
      let handler = new RequestHandler(() => {
        handler.respond(201, file);
      });
      let copy = contents.copy("/foo/bar.txt", "/baz");
      expectFailure(copy, done, 'Invalid Contents Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      let copy = contents.copy("/foo/bar.txt", "/baz");
      expectFailure(copy, done, 'Invalid Status: 200');
    });

  });

  describe('#createCheckpoint()', () => {

    it('should create a checkpoint', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_CP);
      });
      let checkpoint = contents.createCheckpoint("/foo/bar.txt");
      checkpoint.then(model => {
        expect(model.last_modified).to.be(DEFAULT_CP.last_modified);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(201, DEFAULT_CP);
      });
      let checkpoint = contents.createCheckpoint("/foo/bar.txt");
      checkpoint.then(model => {
        expect(model.last_modified).to.be(DEFAULT_CP.last_modified);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let cp = JSON.parse(JSON.stringify(DEFAULT_CP));
      delete cp.last_modified;
      let handler = new RequestHandler(() => {
        handler.respond(201, cp);
      });
      let checkpoint = contents.createCheckpoint("/foo/bar.txt");
      expectFailure(checkpoint, done, 'Invalid Checkpoint Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_CP);
      });
      let checkpoint = contents.createCheckpoint("/foo/bar.txt");
      expectFailure(checkpoint, done, 'Invalid Status: 200');
    });

  });

  describe('#listCheckpoints()', () => {

    it('should list the checkpoints', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, [DEFAULT_CP, DEFAULT_CP]);
      });
      let checkpoints = contents.listCheckpoints("/foo/bar.txt");
      checkpoints.then((obj: ICheckpointModel[]) => {
        expect(obj[0].last_modified).to.be(DEFAULT_CP.last_modified);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(200, [DEFAULT_CP, DEFAULT_CP]);
      });
      let checkpoints = contents.listCheckpoints("/foo/bar.txt");
      checkpoints.then((obj: ICheckpointModel[]) => {
        expect(obj[0].last_modified).to.be(DEFAULT_CP.last_modified);
        done();
      });
    });

    it('should fail for an incorrect model', (done) => {
      let contents = new ContentsManager("localhost");
      let cp = JSON.parse(JSON.stringify(DEFAULT_CP));
      delete cp.id;
      let handler = new RequestHandler(() => {
        handler.respond(200, [cp, DEFAULT_CP]);
      });
      let checkpoints = contents.listCheckpoints("/foo/bar.txt");
      let second = () => {
        handler.onRequest = () => {
          handler.respond(200, DEFAULT_CP);
        };
        let checkpoints = contents.listCheckpoints("/foo/bar.txt");
        expectFailure(checkpoints, done, 'Invalid Checkpoint list');
      }

      expectFailure(checkpoints, second, 'Invalid Checkpoint Model');
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(201, { });
      });
      let checkpoints = contents.listCheckpoints("/foo/bar.txt");
      expectFailure(checkpoints, done, 'Invalid Status: 201');
    });

  });

  describe('#restoreCheckpoint()', () => {

    it('should create a checkpoint', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      let checkpoint = contents.restoreCheckpoint("/foo/bar.txt",
                                                  DEFAULT_CP.id);
      checkpoint.then(() => {
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      let checkpoint = contents.restoreCheckpoint("/foo/bar.txt",
                                                  DEFAULT_CP.id);
      checkpoint.then(() => {
        done();
      });
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, { });
      });
      let checkpoint = contents.restoreCheckpoint("/foo/bar.txt",
                                                  DEFAULT_CP.id);
      expectFailure(checkpoint, done, 'Invalid Status: 200');
    });

  });

  describe('#deleteCheckpoint()', () => {

    it('should delete a checkpoint', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      contents.deleteCheckpoint("/foo/bar.txt", DEFAULT_CP.id)
      .then(() => { done(); });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(204, { });
      });
      contents.deleteCheckpoint("/foo/bar.txt", DEFAULT_CP.id)
      .then(() => { done(); });
    });

    it('should fail for an incorrect response', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, { });
      });
      let checkpoint = contents.deleteCheckpoint("/foo/bar.txt",
                                                  DEFAULT_CP.id);
      expectFailure(checkpoint, done, 'Invalid Status: 200');
    });

  });

  describe('#listContents()', () => {

    it('should get a directory', (done) => {
      let contents = new ContentsManager("localhost");
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      contents.listContents("/foo").then(model => {
        expect(model.path).to.be(DEFAULT_FILE.path);
        done();
      });
    });

    it('should accept ajax options', (done) => {
      let contents = new ContentsManager("localhost", ajaxSettings);
      let handler = new RequestHandler(() => {
        handler.respond(200, DEFAULT_FILE);
      });
      contents.listContents("/foo").then(model => {
        expect(model.path).to.be(DEFAULT_FILE.path);
        done();
      });
    });

  });
});
