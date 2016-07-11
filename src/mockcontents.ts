// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.
'use strict';

import {
  IAjaxSettings
} from 'jupyter-js-utils';

import {
  IContents
} from './contents';


export
class MockContentsManager implements IContents.IManager {

  methods: string[] = [];

  DEFAULT_TEXT = 'the quick brown fox jumped over the lazy dog';

  /**
   * Create a file with default content.
   */
  createFile(path: string): void {
    this._files[path] = {
      name: path.split('/').pop(),
      path: path,
      type: 'file',
      content: this.DEFAULT_TEXT
    };
  }

  /**
   * Create a directory with some default content.
   */
  createFolder(path: string): void {
    if (path[path.length - 1] === '\\') {
      path = path.slice(0, path.length - 1);
    }
    for (let name in ['foo', 'bar', 'baz']) {
      let file = `${path}/${name}.txt`;
      this.createFile(file);
    }
    this._files[path] = {
      name: path.split('/').pop(),
      path,
      type: 'directory'
    };
  }

  /**
   * Get a path in the format it was saved or created in.
   */
  get(path: string, options: IContents.IFetchOptions = {}): Promise<IContents.IModel> {
    this.methods.push('get');
    if (path[path.length - 1] === '\\') {
      path = path.slice(0, path.length - 1);
    }
    let model = this._files[path];
    if (!model) {
      return Promise.reject(new Error('Path not found'));
    }
    if (model.type === 'directory') {
      let content: IContents.IModel[] = [];
      for (path in this._files) {
        let file = this._files[path];
        let dname = path.slice(0, path.length - file.name.length - 1);
        if (dname === model.path) {
          content.push(file);
        }
      }
      model.content = content;
    }
    return Promise.resolve(this._copyModel(model));
  }

  newUntitled(options: IContents.ICreateOptions = {}): Promise<IContents.IModel> {
    this.methods.push('newUntitled');
    let ext = options.ext || '';
    let name = `untitled${ext}`;
    let path = `${options.path}/${name}`;
    let format: IContents.FileFormat = 'text';
    if (options.type === 'notebook') {
      format = 'json';
    }
    let model = {
      name,
      path,
      format,
      type: options.type || 'file',
      content: this.DEFAULT_TEXT
    };
    this._files[path] = model;
    return Promise.resolve(this._copyModel(model));
  }

  delete(path: string): Promise<void> {
    this.methods.push('delete');
    delete this._files[path];
    return Promise.resolve(void 0);
  }

  rename(path: string, newPath: string): Promise<IContents.IModel> {
    this.methods.push('rename');
    let model = this._files[path];
    if (!model) {
      return Promise.reject(new Error('Path not found'));
    }
    model.name = newPath.split('/').pop();
    model.path = newPath;
    delete this._files[path];
    this._files[newPath] = model;
    return Promise.resolve(model);
  }

  save(path: string, options: IContents.IModel = {}): Promise<IContents.IModel> {
    this.methods.push('save');
    if (options) {
      this._files[path] = this._copyModel(options);
    }
    return Promise.resolve(options);
  }

  copy(path: string, toDir: string): Promise<IContents.IModel> {
    this.methods.push('copy');
    let model = this._files[path];
    if (!model) {
      return Promise.reject(new Error('Path not found'));
    }
    let newModel = JSON.parse(JSON.stringify(model)) as IContents.IModel;
    newModel.path = `${toDir}/${model.name}`;
    this._files[newModel.path] = newModel;
    return Promise.resolve(newModel);
  }

  createCheckpoint(path: string): Promise<IContents.ICheckpointModel> {
    this.methods.push('createCheckpoint');
    let fileModel = this._files[path];
    if (!fileModel) {
      return Promise.reject(new Error('Path not found'));
    }
    let checkpoints: IContents.ICheckpointModel[] = this._checkpoints[path] || [];
    let id = String(this._id++);
    let date = new Date(Date.now());
    let last_modified = date.toISOString();
    let model: IContents.ICheckpointModel = { id, last_modified };
    checkpoints.push(model);
    this._checkpoints[path] = checkpoints;
    this._fileSnaps[id] = this._copyModel(fileModel);
    return Promise.resolve(model);
  }

  listCheckpoints(path: string): Promise<IContents.ICheckpointModel[]> {
    this.methods.push('listCheckpoints');
    let checkpoints: IContents.ICheckpointModel[] = this._checkpoints[path] || [];
    return Promise.resolve(checkpoints);
  }

  restoreCheckpoint(path: string, checkpointID: string): Promise<void> {
    this.methods.push('restoreCheckpoint');
    this._files[path] = this._copyModel(this._fileSnaps[checkpointID]);
    return Promise.resolve(void 0);
  }

  deleteCheckpoint(path: string, checkpointID: string): Promise<void> {
    this.methods.push('deleteCheckpoint');
    delete this._fileSnaps[checkpointID];
    return Promise.resolve(void 0);
  }

  private _copyModel(model: IContents.IModel): IContents.IModel {
    return JSON.parse(JSON.stringify(model)) as IContents.IModel;
  }

  ajaxSettings: IAjaxSettings = {};

  private _files: { [key: string]: IContents.IModel } = Object.create(null);
  private _checkpoints: { [key: string]: IContents.ICheckpointModel[] } = Object.create(null);
  private _fileSnaps: { [key: string]: IContents.IModel } = Object.create(null);
  private _id = 0;
}
