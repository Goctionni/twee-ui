export interface PassageMeta {
    position?: string;
    size?: string;
    [key: string]: unknown;
}

export interface Passage {
    titleLine: string;
    title: string;
    tags: string[];
    meta: PassageMeta;
    position: { x: number; y: number; };
    size: { width: number; height: number; };
    content: string;
    textLinks: string[];
    linksTo: Passage[];
    linkedFrom: Passage[];
    updateLinks: (allPassages: Passage[]) => void;
    // includes: Passage[];
    file: {
        name: string;
        path: string;
        passages: Passage[];
    }
}

export interface StoryData {
    bla?: string;
}

export interface FilePlus extends File {
    path: string;
    ext?: string;
}

export interface Story {
    storyData: StoryData;
    passages: Passage[];
    jsFiles: FilePlus[];
    cssFiles: FilePlus[];
}
