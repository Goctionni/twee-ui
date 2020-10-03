<template>
  <ProjectView v-if="directory" :rootPath="directory" />
  <BrowseView v-else @directory="setDirectory($event)" />
</template>

<script lang="ts">
import { Component, Vue } from 'vue-property-decorator';
import { Story } from '@/types';

import BrowseView from './views/BrowseView.vue';
import ProjectView from './views/ProjectView.vue';


@Component({
  components: { BrowseView, ProjectView },
})
export default class App extends Vue {
  public directory = '';

  public setDirectory(directrory: string): void {
    this.directory = directrory;
  }
}
</script>

<style lang="scss">
@import './fonts';

@include declareFontfaces();

html, body {
  padding: 0;
  margin: 0;
  background: #333;
  color: #F2F2F2;
  font-family: $bodyFamily;
}

h1, h2, h3, h4, h5, h6, label.btn, button.btn {
  font-family: $headingFamily;
  font-weight: normal;
  margin: 0;
}

label.btn {
  white-space: nowrap;
  user-select: none;
}

p {
  margin: 0;
}

p + p {
  margin-top: 1em;
}


</style>
