<template>
  <div
    v-if="passages"
    class="project"
    @mousedown="canvasOnMouseDown($event)"
    @mousemove="onMouseMove($event)"
    @mouseup="canvasOnMouseUp($event)"
    @wheel="onWheel($event)"
  >
    <div class="content-container" :style="{ transform: `${translateStr} scale(${zoom})` }">
      <svg :style="svgStyle">
        <line v-for="line of lines" :key="line.key" :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2" @mouseenter="cursorOnElement(line)" @mouseleave="cursorOffElement(line)" :class="{ highlight: highlightElements.includes(line) }" />
      </svg>
      <div
        v-for="passage of passages"
        :key="passage.title"
        :style="{ left: `${passage.position.x}px`, top: `${passage.position.y}px`, width: `${passage.size.width}px`, height: `${passage.size.height}px` }"
        :class="{ highlight: highlightElements.includes(passage) }"
        @mouseenter="cursorOnElement(passage);"
        @mouseleave="cursorOffElement(passage)"
        @mousedown.stop="passageOnMouseDown($event, passage)"
        @mouseup.stop="passageOnMouseUp($event)"
        @click="logPassage(passage)"
        class="passage"
      >
        {{ passage.title }}
      </div>
    </div>
    <button v-if="canSave" @click="saveChanges()" class="btn save-btn">Save</button>
    <transition name="slide">
      <div class="message" :class="messageState" v-if="message">{{ message }}</div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator';
import { Story, Passage, StoryData } from '@/types';
import { fs } from '@/node';
import { ChokiEvent, filesInFolder, watchFolder } from '@/util/file-utils';
import { getPassagesFromFiles, savePassages } from '@/util/passage-reader';
import { eventNames } from 'cluster';

interface Pos {
  x: number;
  y: number;
}

interface Line {
  fromPassage: Passage;
  toPassage: Passage;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  key: string;
}

@Component
export default class ProjectView extends Vue {
  @Prop() rootPath!: string;
  public allFiles: string[] = [];
  public passages: Passage[] = [];
  public movedPassages: Passage[] = [];
  public saving = false;
  public message = '';
  public messageState: 'success' | 'error' = 'success';

  public translate = { x: 0, y: 0 };
  public zoom = 1;
  public hoveredElement: Line | Passage | null = null;
  public lastMousePositionCanvas: Pos | null = null;
  public lastMousePositionPassage: Pos | null = null;
  public movingPassage: Passage | null = null;

  public get canSave(): boolean {
    return !this.saving && this.movedPassages.length > 0;
  }

  public get translateStr(): string {
    return `translate(${Math.round(this.translate.x * 1000) / 1000}px, ${Math.round(this.translate.y * 1000) / 1000}px)`;
  }

  public get svgStyle(): string {
    let maxX = 0;
    let maxY = 0;
    for (const passage of this.passages) {
      const passageMaxX = passage.position.x + passage.size.width;
      const passageMaxY = passage.position.y + passage.size.height;
      maxX = Math.max(maxX, passageMaxX);
      maxY = Math.max(maxY, passageMaxY);
    }
    return `width: ${maxX * 1.1}px; height: ${maxY * 1.1}px;`;
  }

  public get lines(): Line[] {
    const isMovingPassage = this.movingPassage !== null;
    const passages = this.passages;
    if (isMovingPassage) return [];
    
    const lines: Line[] = [];
    for (const passage of passages) {
      for (const linkedPassage of passage.linksTo) {
        lines.push({
          x1: passage.position.x + (passage.size.width / 2),
          y1: passage.position.y + (passage.size.height / 2),
          x2: linkedPassage.position.x + (linkedPassage.size.width / 2),
          y2: linkedPassage.position.y + (linkedPassage.size.height / 2),
          key: `line-${passage.title}-${linkedPassage.title}`,
          fromPassage: passage,
          toPassage: linkedPassage,
        });
      }
    }
    return lines;
  }

  public get highlightElements(): Array<Line | Passage> {
    const highlightElements: Array<Line | Passage> = [];
    if (this.hoveredElement) {
      highlightElements.push(this.hoveredElement);
      if ('title' in this.hoveredElement) {
        // Its a passage
        // add lines
        const highlightLines = this.lines.filter((line) => line.fromPassage === this.hoveredElement || line.toPassage === this.hoveredElement);
        highlightElements.push(...highlightLines);
        // add linked passages
        highlightElements.push(...this.hoveredElement.linksTo);
        highlightElements.push(...this.hoveredElement.linkedFrom);
      } else {
        // Its a line
        highlightElements.push(this.hoveredElement.fromPassage, this.hoveredElement.toPassage);
      }
    }
    return highlightElements;
  }

  // make drag and drop passages work

  public get tweeFiles(): string[] {
    return this.filterTweeFiles(this.allFiles);
  }

  public get jsFiles(): string[] {
    return this.allFiles.filter((filepath) => filepath.split('.').pop() === 'js');
  }

  public get cssFiles(): string[] {
    return this.allFiles.filter((filepath) => filepath.split('.').pop() === 'css');
  }

  public async created() {
    this.allFiles = filesInFolder(this.rootPath);
    this.passages = await getPassagesFromFiles(this.tweeFiles);
    watchFolder(this.rootPath, async ({ eventName, path}: { eventName: ChokiEvent; path: string }) => {
      if (eventName === 'add') {
        this.allFiles.push(path);
        this.passages.push(...await getPassagesFromFiles(this.filterTweeFiles([path])));
      } else if (eventName === 'unlink') {
        this.allFiles = this.allFiles.filter((file) => file !== path);
        this.passages = this.passages.filter((passage) => passage.file.path !== path);
      } else if (eventName === 'change') {
        this.passages = this.passages.filter((passage) => passage.file.path !== path);
        this.passages.push(...await getPassagesFromFiles(this.filterTweeFiles([path])));
      }
      // Update links
      this.passages.forEach((passage) => passage.updateLinks(this.passages));
    });
  }

  public filterTweeFiles(files: string[]): string[] {
    return files.filter((filepath) => ['twee', 'tw'].includes(filepath.split('.').pop() as string));
  }

  public cursorOnElement(element: Line | Passage) {
    this.hoveredElement = element;
  }

  public cursorOffElement(element: Line | Passage) {
    if (this.hoveredElement === element) {
      this.hoveredElement = null;
    }
  }

  public canvasOnMouseDown(event: MouseEvent): void {
    this.lastMousePositionCanvas = { x: event.clientX, y: event.clientY };
  }

  public onMouseMove(event: MouseEvent): void {
    if (this.movingPassage && this.lastMousePositionPassage) {
      const delta: Pos = { x: this.lastMousePositionPassage.x - event.clientX, y: this.lastMousePositionPassage.y - event.clientY };
      this.movingPassage.position.x -= (delta.x / this.zoom);
      this.movingPassage.position.y -= (delta.y / this.zoom);
      this.lastMousePositionPassage = { x: event.clientX, y: event.clientY };
      if (!this.movedPassages.includes(this.movingPassage)) this.movedPassages.push(this.movingPassage);
    } else if (this.lastMousePositionCanvas) {
      const delta: Pos = { x: this.lastMousePositionCanvas.x - event.clientX, y: this.lastMousePositionCanvas.y - event.clientY };
      this.translate.x -= delta.x;
      this.translate.y -= delta.y;
      this.lastMousePositionCanvas = { x: event.clientX, y: event.clientY };
    }
  }

  public canvasOnMouseUp(event: MouseEvent): void {
    this.lastMousePositionCanvas = null;
  }

  public passageOnMouseDown(event: MouseEvent, passage: Passage): void {
    this.movingPassage = passage;
    this.lastMousePositionPassage = { x: event.clientX, y: event.clientY };
  }

  public passageOnMouseUp(event: MouseEvent): void {
    if (this.movingPassage && this.movingPassage.position.x < 0) this.movingPassage.position.x = 0;
    if (this.movingPassage && this.movingPassage.position.y < 0) this.movingPassage.position.y = 0;

    this.movingPassage = null;
    this.lastMousePositionPassage = null;
  }

  public onWheel(event: WheelEvent): void {
    const zoomAmount = (event.deltaY > 0)
      ? (event.deltaY / 1000)       // deltaY 100  -> .1
      // 1/.9 = 1.11111
      : 1 - (1 / (1 + (event.deltaY / 1000)));                            // deltaY -100 -> -.11111
    const zoomMod = 1 - zoomAmount;

    const leftOfClientX = event.clientX - this.translate.x;
    const leftOfClientXTarget = leftOfClientX * zoomMod;
    this.translate.x += (leftOfClientX - leftOfClientXTarget);
    const topOfClientY = event.clientY - this.translate.y;
    const topOfClientYTarget = topOfClientY * zoomMod;
    this.translate.y += (topOfClientY - topOfClientYTarget);
    this.zoom *= zoomMod;
  }

  public saveChanges(): void {
    this.saving = true;
    savePassages(this.movedPassages).then(() => {
      this.movedPassages = [];
      this.saving = false;
      this.showMessage('Changes were saved successfully', 'success');
    }, () => {
      this.showMessage('Something went wrong saving changes', 'error');
    });
  }

  public showMessage(message: string, messageState: 'success' | 'error'): void {
    this.message = message;
    this.messageState = messageState;
    setTimeout(() => {
      if (this.message === message && this.messageState === messageState) {
        this.message = '';
      }
    }, 1000);
  }

  public logPassage(passage: Passage) {
    console.log({ passage });
  }

  public autoPosition(): void {
    // for each file, find number of links to other files
    // find StoryData
    // findpassage with name storydata.start
    // start with the given passages from the start file
    // next up is file with most links from start
    // next up is file with most links from previous
    // etc
  }
}
</script>

<style lang="scss" scoped>
svg {
  min-width: 100vw;
  min-height: 100vh;
  background-color: rgba(255, 255, 255, .1);
}

.project {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: #222;
}

.content-container {
  overflow: visible;
  position: relative;
  transform-origin: top left;
}

.passage {
  position: absolute;
  overflow: hidden;
  background-color: #555;
  padding: 5px;
  cursor: pointer;
  user-select: none;
  border-radius: 4px;
  box-sizing: border-box;

  &.highlight {
    background-color: #5A5;
  }

  &:hover {
    background-color: #363;
  }
}

line {
  stroke:rgb(200,200,200);
  stroke-width:2;

  &.highlight {
    stroke:rgb(100,255,100);
  }
}

.save-btn {
    font-size: 20px;
    padding: 10px 30px;
    cursor: pointer;
    background-color: #444;
    border-radius: 4px;
    transition: all .15s ease-in-out;
    color: #F2F2F2;
    border: 0;
    position: absolute;
    top: 20px;
    right: 20px;

    &:hover {
        background-color: #555;
        color: #FFF;
    }
}

.message {
    font-size: 20px;
    padding: 10px 30px;
    cursor: pointer;
    background-color: #444;
    border-radius: 4px;
    transition: all .15s ease-in-out;
    color: #F2F2F2;
    border: 0;
    position: absolute;
    top: 20px;
    right: 20px;

    &.success {
      background-color: #363;
    }

    &.error {
      background-color: #644;
    }
}

.slide-enter-active, .slide-leave-active {
  transition: transform .25s, opacity .25s;
}
.slide-enter, .slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

</style>
