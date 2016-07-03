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

import {getVolume, volumeCompleter, suggestLayerName, findSourceGroup} from 'neuroglancer/datasource/factory';
import {LayerListSpecification, ManagedUserLayerWithSpecification} from 'neuroglancer/layer_specification';
import {Overlay} from 'neuroglancer/overlay';
import {DataType, VolumeType} from 'neuroglancer/sliceview/base';
import {MultiscaleVolumeChunkSource} from 'neuroglancer/sliceview/frontend';
import {CANCELLED, cancellableThen, cancelPromise} from 'neuroglancer/util/promise';
import {associateLabelWithElement} from 'neuroglancer/widget/associate_label';
import {AutocompleteTextInput, makeCompletionElementWithDescription} from 'neuroglancer/widget/autocomplete';
import {makeHiddenSubmitButton} from 'neuroglancer/widget/hidden_submit_button';

require('./layer_dialog.css');

export class LayerDialog extends Overlay {
  /**
   * Used for displaying status information.
   */
  statusElement = document.createElement('div');

  sourceInput: AutocompleteTextInput;
  submitElement = document.createElement('button');

  namePromptElement = document.createElement('label');
  nameInputElement = document.createElement('input');

  bflyChunkPrompt = document.createElement('label');
  bflyChunkInput = document.createElement('input');

  bflyResPrompt = document.createElement('label');
  bflyResInput = document.createElement('input');

  bflySizePrompt = document.createElement('label');
  bflySizeInput = document.createElement('input');

  bflyDatapathPrompt = document.createElement('label');
  bflyDatapathInput = document.createElement('input');

  bflyOffsetPrompt = document.createElement('label');
  bflyOffsetInput = document.createElement('input');

  volumePromise: Promise<void>|undefined;
  sourceValid: boolean = false;
  nameValid: boolean = true;

  constructor(
      public manager: LayerListSpecification,
      public existingLayer?: ManagedUserLayerWithSpecification) {
    super();
    let dialogElement = this.content;
    dialogElement.classList.add('add-layer-overlay');

    let sourceCompleter = (value: string) =>
        cancellableThen(volumeCompleter(value), originalResult => ({
                                                  completions: originalResult.completions,
                                                  makeElement: makeCompletionElementWithDescription,
                                                  offset: originalResult.offset,
                                                  showSingleResult: true,
                                                }));
    let sourceForm = document.createElement('form');
    sourceForm.className = 'source-form';
    this.registerEventListener(sourceForm, 'submit', (event: Event) => {
      event.preventDefault();
      this.validateSource(/*focusName=*/true);
    });

    let sourcePrompt = document.createElement('label');
    sourcePrompt.textContent = 'Source:';
    let sourceInput = this.sourceInput =
        this.registerDisposer(new AutocompleteTextInput({completer: sourceCompleter, delay: 0}));
    sourceInput.element.classList.add('add-layer-source');
    sourceInput.inputElement.addEventListener(
        'blur', event => { this.validateSource(/*focusName=*/false); });
    this.submitElement.disabled = true;
    sourceInput.inputChanged.add(() => {
      cancelPromise(this.volumePromise);
      this.volumePromise = undefined;
      this.sourceValid = false;
      this.submitElement.disabled = true;
      this.statusElement.textContent = '';
    });
    sourceForm.appendChild(sourcePrompt);
    sourceForm.appendChild(sourceInput.element);
    associateLabelWithElement(sourcePrompt, sourceInput.inputElement);
    let hiddenSourceSubmit = makeHiddenSubmitButton();
    sourceForm.appendChild(hiddenSourceSubmit);

    dialogElement.appendChild(sourceForm);

    let {statusElement, namePromptElement, nameInputElement, submitElement} = this;
    statusElement.className = 'dialog-status';

    let nameForm = document.createElement('form');
    nameForm.className = 'name-form';
    namePromptElement.textContent = 'Name:';
    nameInputElement.className = 'add-layer-name';
    nameInputElement.autocomplete = 'off';
    nameInputElement.spellcheck = false;

    nameInputElement.type = 'text';

    // Single form element.
    let bflyForm1 = document.createElement('form');
    bflyForm1.className = 'bfly-form';

    let bflyForm2 = document.createElement('form');
    bflyForm2.className = 'bfly-form';
    
    function editFormGroup(domNodePrompt, domNodeInput, promptString: String) {
      domNodePrompt.textContent = promptString;
      domNodeInput.className = 'add-layer-name';
      domNodeInput.autocomplete = 'off';
      domNodeInput.spellcheck = false;
      domNodeInput.type = 'text'; 
    }

    editFormGroup(this.bflyChunkPrompt, this.bflyChunkInput, "Chunk Size");
    editFormGroup(this.bflyOffsetPrompt, this.bflyOffsetInput, "Offset Size");
    editFormGroup(this.bflyResPrompt, this.bflyResInput, "Resolution");
    editFormGroup(this.bflySizePrompt, this.bflySizeInput, "Size");
    editFormGroup(this.bflyDatapathPrompt, this.bflyDatapathInput, "Datapath");

    bflyForm1.appendChild(this.bflyChunkPrompt);
    bflyForm1.appendChild(this.bflyChunkInput);

    bflyForm1.appendChild(this.bflyOffsetPrompt);
    bflyForm1.appendChild(this.bflyOffsetInput);

    bflyForm1.appendChild(this.bflyResPrompt);
    bflyForm1.appendChild(this.bflyResInput);

    bflyForm2.appendChild(this.bflySizePrompt);
    bflyForm2.appendChild(this.bflySizeInput);

    bflyForm2.appendChild(this.bflyDatapathPrompt);
    bflyForm2.appendChild(this.bflyDatapathInput);

    dialogElement.appendChild(bflyForm1);
    dialogElement.appendChild(bflyForm2);

    this.registerEventListener(nameInputElement, 'input', () => { this.validateName(); });

    submitElement.type = 'submit';

    associateLabelWithElement(namePromptElement, nameInputElement);

    nameForm.appendChild(namePromptElement);
    nameForm.appendChild(nameInputElement);
    nameForm.appendChild(submitElement);
    dialogElement.appendChild(nameForm);

    dialogElement.appendChild(statusElement);

    if (existingLayer !== undefined) {
      if (existingLayer.sourceUrl !== undefined) {
        sourceInput.value = existingLayer.sourceUrl;
        this.validateSource();
      } else {
        this.sourceValid = true;
      }
      sourceInput.disabled = true;
      nameInputElement.value = existingLayer.name;
      this.validateName();
      submitElement.textContent = 'Save';
      nameInputElement.focus();
    } else {
      let {managedLayers} = this.manager.layerManager;
      if (managedLayers.length > 0) {
        let lastLayer = managedLayers[managedLayers.length - 1];
        if (lastLayer instanceof ManagedUserLayerWithSpecification) {
          let {sourceUrl} = lastLayer;
          if (sourceUrl !== undefined) {
            let groupIndex = findSourceGroup(sourceUrl);
            sourceInput.value = sourceUrl.substring(0, groupIndex);
            sourceInput.inputElement.setSelectionRange(0, groupIndex);
          }
        }
      }
      sourceInput.inputElement.focus();
      submitElement.textContent = 'Add Layer';
    }

    this.registerEventListener(nameForm, 'submit', (event: Event) => {
      event.preventDefault();
      this.submit();
    });
  }


  isNameValid() {
    let name = this.nameInputElement.value;
    if (name === '') {
      return false;
    }
    let otherLayer = this.manager.layerManager.getLayerByName(name);
    return otherLayer === undefined || otherLayer === this.existingLayer;
  }

  submit() {

    var that = this;

    // TODO noice ES6 arrow binding :)
    if (this.isRhoanaSource()) {
      this.dispatchVolumePromise(function(err){
        if (!err) {

          

          // Do not call this if all rhoana specific vals are not fullfilled.
          that.checkValidity();
        }
      })
    }

    that.checkValidity();

  }

  isRhoanaSource() {
    return this.sourceInput.value.indexOf('butterfly') > -1;
  }


  checkValidity() {
    if (this.sourceValid && this.isNameValid()) {
      if (this.existingLayer) {
        this.existingLayer.name = this.nameInputElement.value;
        this.manager.layerManager.layersChanged.dispatch();
      } else {
        this.manager.layerManager.addManagedLayer(
            this.manager.getLayer(this.nameInputElement.value, this.sourceInput.value));
      }
      this.dispose();
    }
  }

  validateName() {
    let {nameInputElement} = this;
    let nameValid = this.nameValid = this.isNameValid();
    if (nameValid) {
      nameInputElement.classList.add('valid-input');
      nameInputElement.classList.remove('invalid-input');
    } else {
      nameInputElement.classList.remove('valid-input');
      nameInputElement.classList.add('invalid-input');
    }
    this.validityChanged();
  }

  validityChanged() { this.submitElement.disabled = !(this.nameValid && this.sourceValid); }

  validateSource(focusName: boolean = false) {
    let url = this.sourceInput.value;
    if (url === '') {
      return;
    }
    try {
      let baseSuggestedName = suggestLayerName(url);
      let {nameInputElement} = this;
      if (this.nameInputElement.value === '') {
        let suggestedName = baseSuggestedName;
        let suffix = 0;
        while (this.manager.layerManager.getLayerByName(suggestedName) !== undefined) {
          suggestedName = baseSuggestedName + (++suffix);
        }
        nameInputElement.value = suggestedName;
        nameInputElement.setSelectionRange(0, suggestedName.length);
        this.validateName();
      }
      if (focusName) {
        nameInputElement.focus();
      }
    } catch (error) {
      this.setError(error.message);
      return;
    }


    // Do not check validity of bfly. For now.
    if (this.isRhoanaSource()) {
      this.sourceValid = true;
      this.setInfo(``);
      this.validityChanged();
      return;
    }

    this.dispatchVolumePromise(undefined);
  }

  dispatchVolumePromise(callback: Function) {
    let url = this.sourceInput.value;
    this.setInfo('Validating volume source...');
    let volumePromise =
        new Promise<MultiscaleVolumeChunkSource>(resolve => { resolve(getVolume(url)); });
    this.volumePromise = cancellableThen(volumePromise, source => {
      this.sourceValid = true;
      this.setInfo(
          `${VolumeType[source.volumeType].toLowerCase()}: ${source.numChannels}-channel ${DataType[source.dataType].toLowerCase()}`);
      this.validityChanged();
      callback(false);
    });
    volumePromise.catch((reason: Error) => {
      if (reason === CANCELLED) {
        // TODO: some return val for err callback bfly. 
        return;
      }
      callback(true);
      this.setError(reason.message);
    });   
  }

  setInfo(message: string) {
    this.statusElement.className = 'dialog-status dialog-status-info';
    this.statusElement.textContent = message;
  }

  setError(message: string) {
    this.statusElement.className = 'dialog-status dialog-status-error';
    this.statusElement.textContent = message;
  }
};
