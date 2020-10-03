<template>
    <div class="browse">
        <button type="button" class="btn browse-btn" @click="onElectronBrowseClick()">Open project</button>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { StoryData, Passage, FilePlus } from '@/types';
import Loading from './browse/Loading.vue';

@Component({
    components: {
        Loading,
    }
})
export default class BrowseView extends Vue {
  private selectedDirEventListener: (event: CustomEvent) => any = () => { /* noop */};

  public created(): void {
    this.selectedDirEventListener = (event: CustomEvent) => this.$emit('directory', event.detail);
    window.addEventListener('selected-dir' as any, this.selectedDirEventListener as any);
  }

  beforeDestroy(): void {
    window.removeEventListener('selected-dir' as any, this.selectedDirEventListener as any);
  }

  public onElectronBrowseClick() {
    postMessage({ type: 'select-dir' }, '*');
  }
}
</script>

<style lang="scss" scoped>
.browse {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.browse-btn {
    font-size: 40px;
    padding: 20px 80px;
    cursor: pointer;
    background-color: #444;
    border-radius: 5px;
    transition: all .15s ease-in-out;
    color: #F2F2F2;
    border: 0;

    &:hover {
        background-color: #555;
        color: #FFF;
    }
}
</style>
