/**
 * @license
 * Copyright 2016 Google Inc.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Facility for storing global state in the url hash.

import {Signal} from 'signals';
import {urlSafeStringify, urlSafeParse} from 'neuroglancer/util/json';

// Maps keys to objects.
let trackedKeys = new Map<string, Trackable>();
// Maps objects to keys.
let trackedObjects = new Map<Trackable, string>();

let currentHashState: any = {};
let updatingObject: Trackable = null;
let updatedObjects = new Set<Trackable>();
let lastHash: string = null;
let pendingUpdate: number = null;

const UPDATE_DELAY = 500;

export interface Trackable {
  restoreState: (x: any) => void;
  changed: Signal;
  toJSON: () => any;
}

function updateTrackedObjectsFromHash() {
  // console.log("updateTrackedObjectsFromHash called");
  debugger;
  try {
    let s = location.href.replace(/^[^#]+/, '');
    // console.log(`hash str: ${s}`);
    if (s === '' || s === '#' || s === '#!') {
      s = '#!{}';
    }
    if (s.startsWith('#!')) {
      s = s.slice(2);
      // Firefox always %-encodes the URL even if it is not typed that way.
      s = decodeURI(s);
      if (s === lastHash) {
        // We caused this update.
        return;
      }
      lastHash = s;
      let state = urlSafeParse(s);
      if (typeof state === 'object') {
        updateTrackedObjects(state);
      }
      debugger;
    } else {
      lastHash = null;
    }
  } catch (e) {
    // Failed to parse hash, ignore.
    console.log(e);
  }
}

function restoreObjectState(key: string, obj: Trackable) {
  debugger;
  try {
    updatingObject = obj;
    obj.restoreState(currentHashState[key]);
  } catch (e) {
    console.log(`Failed to restore ${key} state: ${e}`);
  } finally {
    updatingObject = null;
  }
}

function updateTrackedObjects(newState: any) {
  currentHashState = newState;
  for (let key of Object.keys(currentHashState)) {
    let obj = trackedKeys.get(key);
    if (obj !== undefined) {
      restoreObjectState(key, obj);
    }
  }
}

function scheduleUpdate() {
  // Wait another UPDATE_DELAY ms before updating hash.
  if (pendingUpdate != null) {
    clearTimeout(pendingUpdate);
  }
  pendingUpdate = setTimeout(updateHash, UPDATE_DELAY);
}

export function delayHashUpdate() {
  if (pendingUpdate != null) {
    scheduleUpdate();
  }
}

function updateHash() {
  pendingUpdate = null;
  // console.log(`updateHash at ${Date.now()}`);
  let updated = false;
  for (let obj of updatedObjects) {
    let key = trackedObjects.get(obj);
    if (key === undefined) {
      if (currentHashState.hasOwnProperty(key)) {
        updated = true;
      }
      // Object may have been unregistered after update event.
      continue;
    }
    updated = true;
    currentHashState[key] = obj.toJSON();
  }
  updatedObjects.clear();
  if (updated) {
    let newHash = urlSafeStringify(currentHashState);
    if (newHash !== lastHash) {
      lastHash = newHash;
      // console.log(`replaceState at ${Date.now()}`);
      debugger;
      if (lastHash === '{}') {
        history.replaceState(null, null, '#');
      } else {
        history.replaceState(null, null, '#!' + lastHash);
      }
      debugger;
      // console.log(`replaceState done at ${Date.now()}`);
    }
    // window.location.hash = lastHash;
  }
}

addEventListener('hashchange', updateTrackedObjectsFromHash);

// Called with this == the object.
function handleObjectUpdate(this: Trackable) {
  let obj = this;
  if (updatingObject === obj) {
    // We caused this event, so ignore it.
    return;
  }
  updatedObjects.add(obj);
  scheduleUpdate();
}

export function registerTrackable(key: string, obj: Trackable) {
  debugger;

  if (trackedKeys.has(key)) {
    throw new Error(`Key ${JSON.stringify(key)} already registered.`);
  }
  if (trackedObjects.has(obj)) {
    throw new Error(`Object already registered.`);
  }
  trackedKeys.set(key, obj);
  trackedObjects.set(obj, key);
  if (currentHashState.hasOwnProperty(key)) {
    // console.log(`registering ${key} which has existing state`);
    obj.restoreState(currentHashState[key]);
    // console.log(obj);
  }
  obj.changed.add(handleObjectUpdate, obj);
  handleObjectUpdate.call(obj);
};

export function unregisterTrackable(keyOrObject: string | Trackable) {
  let obj = trackedKeys.get(<string>keyOrObject);
  let key: string;
  if (obj !== undefined) {
    key = <string>keyOrObject;
  } else {
    key = trackedObjects.get(<Trackable>keyOrObject);
    if (key === undefined) {
      throw new Error('Key or object not registered.');
    }
    obj = <Trackable>keyOrObject;
  }
  trackedKeys.delete(key);
  trackedObjects.delete(obj);
  obj.changed.remove(handleObjectUpdate, obj);
  handleObjectUpdate.call(obj);
};

// Initialize currentHashState.
updateTrackedObjectsFromHash();

export { trackedObjects, currentHashState };
