import { fs, path } from '@/node';

export const filesInFolder = (folder: string): string[] => {
    const files = [];
    const items = fs.readdirSync(folder);
    for (const item of items) {
        const combinedPath = path.join(folder, item);
        const isDirectory = fs.lstatSync(combinedPath).isDirectory();
        if (isDirectory) {
            files.push(... filesInFolder(combinedPath));
        } else {
            files.push(combinedPath);
        }
    }
    return files;
};

export type ChokiEvent = 'add' | 'unlink' | 'change';
export const readFile = (filepath: string): Promise<string> => (window as any).readFile(filepath);  // eslint-disable-line
export const writeFile = (filepath: string, fileContent: string): Promise<void> => (window as any).writeFile(filepath, fileContent);  // eslint-disable-line
export const watchFolder = (filepath: string, callback: Function): void => (window as any).watchFolder(filepath, callback); // eslint-disable-line
