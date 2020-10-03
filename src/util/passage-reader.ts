import { Passage, PassageMeta } from "@/types";
import { path } from '@/node';
import { readFile, writeFile } from './file-utils';

export const getPassagesFromFiles = (filepaths: string[]): Promise<Passage[]> => {
    return new Promise((resolve, reject) => {
        const promises = filepaths.map((filepath) => getPassagesFromFile(filepath)); // eslint-disable-line
        Promise.all(promises).then((fileResults) => {
            const allPassages: Passage[] = [];
            for (const fileResult of fileResults) {
                allPassages.push(...fileResult);
            }
            resolve(allPassages);
        }, reject);
    });
};

export const savePassages = (passages: Passage[]): Promise<void> => {
    return new Promise((resolve, reject) => {
        const changesInFiles: string[] = [];
        for (const passage of passages) {
            if (!changesInFiles.includes(passage.file.path)) changesInFiles.push(passage.file.path);
        }

        for (const filePath of changesInFiles) {
            const filePassages = passages.filter((passage) => passage.file.path === filePath);
            readFile(filePath).then((fileContent) => { // eslint-disable-line
                for (const passage of filePassages) {
                    const newMeta = Object.assign(passage.meta, {
                        position: `${Math.round(passage.position.x)},${Math.round(passage.position.y)}`,
                        size: `${passage.size.width},${passage.size.height}`,
                    });
                    const oldTitle = passage.titleLine;
                    const tags = passage.tags.length ? ` [${passage.tags.join(' ')}]` : '';
                    const newTitle = `:: ${passage.title}${tags} ${JSON.stringify(newMeta)}`;
                    fileContent = fileContent.replace(oldTitle, newTitle);
                    passage.titleLine = newTitle;
                }
                writeFile(filePath, fileContent).then(resolve, reject); // eslint-disable-line
            }, reject);
        }
    });
};

const getPassagesFromFile = async (filepath: string): Promise<Passage[]> => {
    return new Promise((resolve, reject) => {
        readFile(filepath).then((filecontent) => {
            const passages: Passage[] = [];
            let passage: Passage | null = null;
            const lines = filecontent.split('\n');
            for (const line of lines) {
                if (line.substr(0, 2) === '::') {
                    passage = parsePassageTitle(line, filepath, passages); // eslint-disable-line
                    passages.push(passage);
                } else if (passage) {
                    passage.content += line + '\n';
                }
            }
            initPassageLinks(passages); // eslint-disable-line
            resolve(passages);
        }, reject);
    });
};

const initPassageLinks = (passages: Passage[]) => {
    for (const passage of passages) {
        // Possible link syntaxes:
        // [[link]]
        // [[text|link]]
        // [[link][setter]]
        // [[text|link][setter]]
        // Split passage.content into parts that start with [[, remove the first part, so every part _starts with_ a link
        const parts = passage.content.split('[[').slice(1);
        passage.textLinks = parts.filter((part) => part.indexOf(']]') !== -1).map((part) => ((part.split(']').shift() as string).split('|').pop() as string).trim());
        passage.updateLinks(passages);
    }
};

function updatePassageLinks(this: Passage, allPassages: Passage[]): void {
    this.linksTo = allPassages.filter((linkedPassage) => this.textLinks.some((textLink) => linkedPassage.title === textLink));
    this.linksTo.forEach((linkedToPassage) => linkedToPassage.linkedFrom.push(this));
}

const parsePassageTitle = (titleLine: string, filepath: string, passagesInFile: Passage[]): Passage => {
    const { title, tagsPart, metaPart } = extractTitleParts(titleLine.substr(2)); // eslint-disable-line

    const filename = filepath.split(path.sep).pop() as string;
    const tags = tagsPart.split(' ') || [];
    let meta = {};
    try {
        meta = !metaPart ? {} : JSON.parse(metaPart) || {};
    } catch(e) {
        console.warn('Invalid passage metadata');
    }

    const passage: Passage = {
        titleLine,
        title,
        file: {
            name: filename,
            path: filepath,
            passages: passagesInFile,
        },
        meta,
        position: getMetaPosition(meta), // eslint-disable-line
        size: getMetaSize(meta), // eslint-disable-line
        tags,
        textLinks: [],
        linksTo: [],
        linkedFrom: [],
        content: '',
        updateLinks: updatePassageLinks,
    };
    return passage;
};

enum TitleLinePart {
    title = 'title',
    tags = 'tagsPart',
    meta = 'metaPart',
}

const extractTitleParts = (line: string): { title: string; tagsPart: string; metaPart: string } => {
    let part = TitleLinePart.title;
    const output = {
        title: '',
        tagsPart: '',
        metaPart: '',
    };
    const characters = line.split('');
    for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        // Add escape and escaped character to the current part
        if (char === '\\') {
            output[part] += char + characters[i + 1];
            i++;
            continue;
        }

        if (part === TitleLinePart.title) {
            if (char === '[') {
                part = TitleLinePart.tags;
                continue;
            } else if (char === '{') {
                part = TitleLinePart.meta;
            } else {
                output.title += char;
            }
        }

        if (part === TitleLinePart.tags) {
            if (char === ']') {
                part = TitleLinePart.meta;
                i++;
            } else {
                output.tagsPart += char;
            }
        }

        if (part === TitleLinePart.meta) {
            output.metaPart = line.substr(i);
            break;
        }
    }

    return {
        title: output.title.trim(),
        tagsPart: output.tagsPart.trim().substr(1, output.tagsPart.trim().length - 2),
        metaPart: output.metaPart.trim(),
    };
};

const getMetaPosition = (meta: PassageMeta): { x: number; y: number } => {
    if (!meta || !meta.position) {
        return { x: 0, y: 0 };
    }
    const [x, y] = meta.position.split(',').map((str: string) => parseFloat(str));
    return { x, y };
};

const getMetaSize = (meta: PassageMeta): { width: number; height: number } => {
    if (!meta || !meta.size) {
        return { width: 100, height: 100 };
    }
    const [width, height] = meta.size.split(',').map((str: string) => parseFloat(str));
    return { width, height };
};

