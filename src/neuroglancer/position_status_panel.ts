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

import {ViewerPositionState} from 'neuroglancer/viewer_state';
import {RefCounted} from 'neuroglancer/util/disposable';
import {vec3, AXES_NAMES} from 'neuroglancer/util/geom';

require('./position_status_panel.css');

export class PositionStatusPanel extends RefCounted {
  private positionElements = new Array<HTMLInputElement>();
  private mouseElement: HTMLSpanElement;
  private needsUpdate: number = null;
  private tempPosition = vec3.create();

  constructor(public element: HTMLElement, public viewer: ViewerPositionState) {
    super();
    element.setAttribute('class', 'position-status-panel');
    let {positionElements} = this;
    for (let i = 0; i < 3; ++i) {
      let label = element.ownerDocument.createElement('label');
      label.className = 'position-status-coord';
      let input = element.ownerDocument.createElement('input');
      input.type = 'number';
      input.className = 'position-status-coord';
      label.textContent = AXES_NAMES[i];
      label.appendChild(input);
      element.appendChild(label);
      positionElements.push(input);
      let nextInputIsChange = false;
      this.registerEventListener(
          input, 'change', (event: Event) => { this.handleCoordinateChange(); });
      this.registerEventListener(input, 'input', (event: Event) => {
        if (nextInputIsChange) {
          this.handleCoordinateChange();
          nextInputIsChange = false;
        }
        return true;
      });
      this.registerEventListener(input, 'wheel', (event: WheelEvent) => {
        nextInputIsChange = true;
        input.focus();
        return true;
      });
      this.registerEventListener(input, 'keydown', (event: MouseEvent) => {
        nextInputIsChange = false;
        return true;
      });
      this.registerEventListener(input, 'mousedown', (event: MouseEvent) => {
        nextInputIsChange = true;
        return true;
      });
      this.registerEventListener(input, 'click', (event: MouseEvent) => { return true; });
      this.registerEventListener(input, 'blur', (event: MouseEvent) => {
        nextInputIsChange = false;
        return true;
      });
    }
    let mouseElement = this.mouseElement = document.createElement('span');
    mouseElement.className = 'position-status-mouse';
    element.appendChild(mouseElement);

    let {navigationState, mouseState} = viewer;

    this.registerSignalBinding(navigationState.pose.changed.add(this.handleChange, this));
    this.registerSignalBinding(mouseState.changed.add(this.handleChange, this));
    this.handleChange();
  }

  handleChange() {
    if (this.needsUpdate == null) {
      this.needsUpdate = requestAnimationFrame(this.update.bind(this));
      // console.log(`Requested animation frame at ${Date.now()}`);
    }
  }

  handleCoordinateChange() {
    let positionElements = this.positionElements;
    let position = this.viewer.navigationState.pose.position;
    let voxelPosition = this.tempPosition;
    if (!position.voxelCoordinatesValid) {
      return;
    }
    position.getVoxelCoordinates(voxelPosition);
    for (let i = 0; i < 3; ++i) {
      let value = parseFloat(positionElements[i].value);
      if (!Number.isNaN(value)) {
        voxelPosition[i] = value;
      }
    }
    position.setVoxelCoordinates(voxelPosition);
  }

  update() {
    this.needsUpdate = null;
    let {navigationState, mouseState} = this.viewer;
    let voxelPosition = this.tempPosition;
    let position = navigationState.pose.position;
    // console.log("updating position view", this.navigationState.position.voxelCoordinatesValid);
    if (position.getVoxelCoordinates(voxelPosition)) {
      // console.log("got new position: " + voxelPosition);
      let positionElements = this.positionElements;

      for (let i = 0; i < 3; ++i) {
        let value = voxelPosition[i];
        positionElements[i].value = '' + Math.floor(value);
      }
    }

    let voxelSize = position.voxelSize;

    {
      let text = '';
      if (mouseState.active) {
        voxelSize.voxelFromSpatial(voxelPosition, mouseState.position);
        let p = voxelPosition;
        text = `x ${Math.round(p[0])}  y ${Math.round(p[1])}  z ${Math.round(p[2])}`;
      }
      this.mouseElement.textContent = text;
    }
  }

  disposed() {
    for (let x of this.positionElements) {
      this.element.removeChild(x);
    }
    this.positionElements = null;
    this.element = null;
  }
};
