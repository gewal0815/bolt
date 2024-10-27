import { atom, map, type MapStore, type ReadableAtom, type WritableAtom } from 'nanostores';
import type { EditorDocument, ScrollPosition } from '~/components/editor/codemirror/CodeMirrorEditor';
import { ActionRunner } from '~/lib/runtime/action-runner';
import type { ActionCallbackData, ArtifactCallbackData } from '~/lib/runtime/message-parser';
import { webcontainer } from '~/lib/webcontainer';
import type { ITerminal } from '~/types/terminal';
import { unreachable } from '~/utils/unreachable';
import { EditorStore } from './editor';
import { FilesStore, type FileMap } from './files';
import { PreviewsStore } from './previews';
import { TerminalStore } from './terminal';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  openDatabase,
  saveFileInHistory,
  getAll,
  getFilesByChatId,
  getMessagesById,
  getMessagesByUrlId,
} from '~/lib/persistence/db';

import { createExtractorFromData } from 'node-unrar-js';
import fs from 'fs';

export interface ArtifactState {
  id: string;
  title: string;
  closed: boolean;
  runner: ActionRunner;
}

export type ArtifactUpdateState = Pick<ArtifactState, 'title' | 'closed'>;

type Artifacts = MapStore<Record<string, ArtifactState>>;

export type WorkbenchViewType = 'code' | 'preview';

export class WorkbenchStore {
  #previewsStore = new PreviewsStore(webcontainer);
  #filesStore = new FilesStore(webcontainer);
  #editorStore = new EditorStore(this.#filesStore);
  #terminalStore = new TerminalStore(webcontainer);

  artifacts: Artifacts = import.meta.hot?.data.artifacts ?? map({});

  showUploadPanel: WritableAtom<boolean> = atom(false);
  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data.showWorkbench ?? atom(false);
  currentView: WritableAtom<WorkbenchViewType> = import.meta.hot?.data.currentView ?? atom('code');
  unsavedFiles: WritableAtom<Set<string>> = import.meta.hot?.data.unsavedFiles ?? atom(new Set<string>());
  modifiedFiles = new Set<string>();
  artifactIdList: string[] = [];

  private filesLoadedFromHistory = false;

  constructor() {
    if (import.meta.hot) {
      import.meta.hot.data.artifacts = this.artifacts;
      import.meta.hot.data.unsavedFiles = this.unsavedFiles;
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }

    // Call the method to load files from history
    this.init();
  }

  // New method to initialize the store
  async init() {
    await this.loadFilesFromHistory();
  }

  // Adjusted method to load files from history
  async loadFilesFromHistory() {
    if (this.filesLoadedFromHistory) {
      return; // Prevent multiple loads
    }
    this.filesLoadedFromHistory = true;

    // Open the database
    const db = await openDatabase();
    if (!db) {
      console.error('Failed to open the database');
      return;
    }

    // Retrieve the chatId from the URL
    const url = new URL(window.location.href);
    const pathSegments = url.pathname.split('/');
    let chatId = pathSegments[pathSegments.length - 1]; // Get the last segment of the path
    if (!chatId) {
      console.error('No chat ID found in the URL');
      return;
    }

    // Fetch the chat entry using the chatId
    let chatEntry = await getMessagesById(db, chatId);
    if (!chatEntry) {
      // Try fetching by URL ID if not found by chatId
      chatEntry = await getMessagesByUrlId(db, chatId);
    }
    if (!chatEntry) {
      console.error(`No chat found with ID: ${chatId}`);
      return;
    }

    // Fetch the files associated with the chatId
    const files = await getFilesByChatId(db, chatEntry.id);
    if (!files || files.length === 0) {
      console.log('No files found in history for this chat');
      return;
    }

    // For each file, add it to the files store and set the selected file
    files.forEach((file, index) => {
      const { filePath, fileContent } = file;

      // Add the file to the files store
      this.#filesStore.files.setKey(filePath, {
        type: 'file',
        content: fileContent,
        isBinary: false,
      });

      // Set the first file as the selected file
      if (index === 0) {
        this.setSelectedFile(filePath);
      }
    });
  }

  get previews() {
    return this.#previewsStore.previews;
  }

  get files() {
    return this.#filesStore.files;
  }

  get currentDocument(): ReadableAtom<EditorDocument | undefined> {
    return this.#editorStore.currentDocument;
  }

  get selectedFile(): ReadableAtom<string | undefined> {
    return this.#editorStore.selectedFile;
  }

  get firstArtifact(): ArtifactState | undefined {
    return this.#getArtifact(this.artifactIdList[0]);
  }

  get filesCount(): number {
    return this.#filesStore.filesCount;
  }

  get showTerminal() {
    return this.#terminalStore.showTerminal;
  }

  toggleTerminal(value?: boolean) {
    this.#terminalStore.toggleTerminal(value);
  }

  attachTerminal(terminal: ITerminal) {
    this.#terminalStore.attachTerminal(terminal);
  }

  onTerminalResize(cols: number, rows: number) {
    this.#terminalStore.onTerminalResize(cols, rows);
  }

  setDocuments(files: FileMap) {
    this.#editorStore.setDocuments(files);

    if (this.#filesStore.filesCount > 0 && this.currentDocument.get() === undefined) {
      // we find the first file and select it
      for (const [filePath, dirent] of Object.entries(files)) {
        if (dirent?.type === 'file') {
          this.setSelectedFile(filePath);
          break;
        }
      }
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  setShowUploadPanel(show: boolean) {
    this.showUploadPanel.set(show);
  }

  setCurrentDocumentContent(newContent: string) {
    const filePath = this.currentDocument.get()?.filePath;

    if (!filePath) {
      return;
    }

    const originalContent = this.#filesStore.getFile(filePath)?.content;
    const unsavedChanges = originalContent !== undefined && originalContent !== newContent;

    this.#editorStore.updateFile(filePath, newContent);

    const currentDocument = this.currentDocument.get();

    if (currentDocument) {
      const previousUnsavedFiles = this.unsavedFiles.get();

      if (unsavedChanges && previousUnsavedFiles.has(currentDocument.filePath)) {
        return;
      }

      const newUnsavedFiles = new Set(previousUnsavedFiles);

      if (unsavedChanges) {
        newUnsavedFiles.add(currentDocument.filePath);
      } else {
        newUnsavedFiles.delete(currentDocument.filePath);
      }

      this.unsavedFiles.set(newUnsavedFiles);
    }
  }

  setCurrentDocumentScrollPosition(position: ScrollPosition) {
    const editorDocument = this.currentDocument.get();

    if (!editorDocument) {
      return;
    }

    const { filePath } = editorDocument;

    this.#editorStore.updateScrollPosition(filePath, position);
  }

  setSelectedFile(filePath: string | undefined) {
    this.#editorStore.setSelectedFile(filePath);
  }

  async saveFile(filePath: string) {
    const documents = this.#editorStore.documents.get();
    const document = documents[filePath];

    if (document === undefined) {
      return;
    }

    await this.#filesStore.saveFile(filePath, document.value);

    const newUnsavedFiles = new Set(this.unsavedFiles.get());
    newUnsavedFiles.delete(filePath);

    this.unsavedFiles.set(newUnsavedFiles);
  }

  async saveCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    await this.saveFile(currentDocument.filePath);
  }

  resetCurrentDocument() {
    const currentDocument = this.currentDocument.get();

    if (currentDocument === undefined) {
      return;
    }

    const { filePath } = currentDocument;
    const file = this.#filesStore.getFile(filePath);

    if (!file) {
      return;
    }

    this.setCurrentDocumentContent(file.content);
  }

  async saveAllFiles() {
    for (const filePath of this.unsavedFiles.get()) {
      await this.saveFile(filePath);
    }
  }

  getFileModifcations() {
    return this.#filesStore.getFileModifications();
  }

  resetAllFileModifications() {
    this.#filesStore.resetFileModifications();
  }

  abortAllActions() {
    // TODO: what do we wanna do and how do we wanna recover from this?
  }

  addArtifact({ messageId, title, id }: ArtifactCallbackData) {
    const artifact = this.#getArtifact(messageId);

    if (artifact) {
      return;
    }

    if (!this.artifactIdList.includes(messageId)) {
      this.artifactIdList.push(messageId);
    }

    this.artifacts.setKey(messageId, {
      id,
      title,
      closed: false,
      runner: new ActionRunner(webcontainer),
    });
  }

  updateArtifact({ messageId }: ArtifactCallbackData, state: Partial<ArtifactUpdateState>) {
    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      return;
    }

    this.artifacts.setKey(messageId, { ...artifact, ...state });
  }

  async addAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.addAction(data);
  }

  async runAction(data: ActionCallbackData) {
    const { messageId } = data;

    const artifact = this.#getArtifact(messageId);

    if (!artifact) {
      unreachable('Artifact not found');
    }

    artifact.runner.runAction(data);
  }

  #getArtifact(id: string) {
    const artifacts = this.artifacts.get();
    return artifacts[id];
  }

  async downloadZip() {
    const zip = new JSZip();
    const files = this.files.get();

    for (const [filePath, dirent] of Object.entries(files)) {
      if (dirent?.type === 'file' && !dirent.isBinary) {
        // Remove '/home/project/' from the beginning of the path
        const relativePath = filePath.replace(/^\/home\/project\//, '');

        // Split the path into segments
        const pathSegments = relativePath.split('/');

        // If there's more than one segment, we need to create folders
        if (pathSegments.length > 1) {
          let currentFolder = zip;
          for (let i = 0; i < pathSegments.length - 1; i++) {
            currentFolder = currentFolder.folder(pathSegments[i])!;
          }
          currentFolder.file(pathSegments[pathSegments.length - 1], dirent.content);
        } else {
          // If there's only one segment, it's a file in the root
          zip.file(relativePath, dirent.content);
        }
      }
    }

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'project.zip');
  }

  // New Method: Handle File Upload and Set Selected File
  async handleFileUpload(file: File) {
    const reader = new FileReader();

    reader.onload = async () => {
      const fileContent = reader.result as string;
      const filePath = `/home/project/${file.name}`;

      // Add the uploaded file to the files store
      this.#filesStore.files.setKey(filePath, {
        type: 'file',
        content: fileContent,
        isBinary: false,
      });

      // Set the uploaded file as the selected file
      this.setSelectedFile(filePath);

      // Open the database
      const db = await openDatabase();
      if (!db) {
        console.error('Failed to open the database');
        return;
      }

      // Fetch the chatId from the URL
      const url = new URL(window.location.href);
      const pathSegments = url.pathname.split('/');
      let chatId = pathSegments[pathSegments.length - 1];
      if (!chatId) {
        console.error('No chat ID found in the URL');
        return;
      }

      // Fetch the chat entry using the chatId
      let chatEntry = await getMessagesById(db, chatId);
      if (!chatEntry) {
        // Try fetching by URL ID if not found by chatId
        chatEntry = await getMessagesByUrlId(db, chatId);
      }
      if (!chatEntry) {
        console.error(`No chat found with ID: ${chatId}`);
        return;
      }

      // Save the file information in the fileHistory table with the chatId
      await saveFileInHistory(db, chatEntry.id, filePath, fileContent);

      console.log(`File saved in the fileHistory table with chatId: ${chatEntry.id}`);
    };

    reader.readAsText(file);
  }

  // New Method: Handle Project File Upload and Set Selected File (ZIP and RAR Support)
  async handleProjectUpload(file: File) {
    if (file.name.endsWith('.zip')) {
      await this.#extractZipFile(file);
    } else if (file.name.endsWith('.rar')) {
      await this.#extractRarFile(file);
    }
  }

  async #extractZipFile(file: File) {
    const zip = await JSZip.loadAsync(file);

    zip.forEach(async (relativePath, file) => {
      if (!file.dir) {
        const content = await file.async('string');
        const filePath = `/home/project/${relativePath}`;
        console.log('Extracted ZIP file filepath:', filePath);
        console.log('Extracted ZIP file content:', content);
        // Add the extracted file to the files store
        this.#filesStore.files.setKey(filePath, {
          type: 'file',
          content,
          isBinary: false,
        });

        // Set the uploaded file as the selected file
        this.setSelectedFile(filePath);
      }
    });
  }

  // Load WASM in Node.js or Browser Environments
  async #loadWasmBinary(): Promise<ArrayBuffer> {
    if (typeof window !== 'undefined') {
      // Browser environment (using fetch)
      const response = await fetch('/unrar.wasm');
      return await response.arrayBuffer();
    } else {
      // Node.js environment (using fs)
      return fs.readFileSync(require.resolve('node-unrar-js/esm/js/unrar.wasm'));
    }
  }

  // Extract RAR Files
  async #extractRarFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const wasmBinary = await this.#loadWasmBinary(); // Load WASM

    // Create the extractor from the in-memory ArrayBuffer
    const extractor = await createExtractorFromData({ data: arrayBuffer, wasmBinary });

    // Extract the files from the RAR archive
    const extracted = extractor.extract();
    extracted.files.forEach((fileEntry) => {
      if (!fileEntry.fileHeader.flags.directory) {
        const content = new TextDecoder().decode(fileEntry.extraction!);
        const filePath = `/home/project/${fileEntry.fileHeader.name}`;
        console.log('Extracted RAR file filepath:', filePath);
        console.log('Extracted RAR file content:', content);
        // Add the extracted file to the files store
        this.#filesStore.files.setKey(filePath, {
          type: 'file',
          content,
          isBinary: false,
        });

        // Set the uploaded file as the selected file
        this.setSelectedFile(filePath);
      }
    });
  }
}

export const workbenchStore = new WorkbenchStore();
