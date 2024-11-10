// workbench.tsx
import { useStore } from '@nanostores/react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { computed } from 'nanostores';
import { memo, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  type OnChangeCallback as OnEditorChange,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { IconButton } from '~/components/ui/IconButton';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/components/ui/Slider';
import { workbenchStore, type WorkbenchViewType } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { cubicEasingFn } from '~/utils/easings';
import { renderLogger } from '~/utils/logger';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';
import { UploadPanel } from '~/components/workbench/UploadPanelContainer';
import { useDropzone } from 'react-dropzone';
import ChatInterface from '~/components/agentInterface/ChatInterface';


interface WorkspaceProps {
  chatStarted?: boolean;
  isStreaming?: boolean;
}

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WorkbenchViewType> = {
  left: {
    value: 'code',
    text: 'Code',
  },
  right: {
    value: 'preview',
    text: 'Preview',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

export const Workbench = memo(({ chatStarted, isStreaming }: WorkspaceProps) => {
  renderLogger.trace('Workbench');

  const [showUploadButtons, setShowUploadButtons] = useState(false); // Add state for upload buttons visibility

  const hasPreview = useStore(computed(workbenchStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const selectedFile = useStore(workbenchStore.selectedFile);
  const currentDocument = useStore(workbenchStore.currentDocument);
  const unsavedFiles = useStore(workbenchStore.unsavedFiles);
  const files = useStore(workbenchStore.files);
  const selectedView = useStore(workbenchStore.currentView);

  const setSelectedView = (view: WorkbenchViewType) => {
    workbenchStore.currentView.set(view);
  };

  useEffect(() => {
    if (hasPreview) {
      setSelectedView('preview');
    }
  }, [hasPreview]);

  useEffect(() => {
    workbenchStore.setDocuments(files);
  }, [files]);

  const onDropFile = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      acceptedFiles.forEach((file) => workbenchStore.handleFileUpload(file));
    }
  }, []);

  const { getRootProps: getRootPropsFile, getInputProps: getInputPropsFile } = useDropzone({
    onDrop: onDropFile,
    accept: {
      'application/javascript': ['.js'],
      'application/json': ['.json'],
      'text/typescript': ['.ts', '.tsx'],
      'text/jsx': ['.jsx'],
      'text/html': ['.html'],
      'text/css': ['.css', '.scss'],
      'text/x-c': ['.c', '.cpp'],
      'text/x-java-source': ['.java'],
      'text/x-python': ['.py'],
      'text/x-csharp': ['.cs'],
      'text/x-go': ['.go'],
      'text/x-ruby': ['.rb'],
      'application/x-httpd-php': ['.php'],
      'application/xml': ['.xml'],
      'application/sql': ['.sql'],
      'application/x-sh': ['.sh'],
      'text/markdown': ['.md'],
    },
    multiple: true,
  });

  const [isChatOpen, setIsChatOpen] = useState(false);

  const openChatInterface = () => {
    setIsChatOpen(true);
  };

  const closeChatInterface = () => {
    setIsChatOpen(false);
  };


  const onDropProject = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      workbenchStore.handleProjectUpload(file);
    }
  }, []);

  const { getRootProps: getRootPropsProject, getInputProps: getInputPropsProject } = useDropzone({
    onDrop: onDropProject,
    accept: {
      'application/zip': ['.zip'],
      'application/x-rar-compressed': ['.rar'],
    },
  });

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[left,width] duration-200 bolt-ease-cubic-bezier',
            {
              'left-[var(--workbench-left)]': showWorkbench,
              'left-[100%]': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-6">
            <div className="h-full flex flex-col bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-bolt-elements-borderColor">
                <Slider selected={selectedView} options={sliderOptions} setSelected={setSelectedView} />
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <>
                    {/* Existing buttons */}
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.downloadZip();
                      }}
                    >
                      <div className="i-ph:code" />
                      Download Code
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        workbenchStore.toggleTerminal(!workbenchStore.showTerminal.get());
                      }}
                    >
                      <div className="i-ph:terminal" />
                      Toggle Terminal
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => setShowUploadButtons(!showUploadButtons)}
                    >
                      <div className="i-ph:upload" />
                      Upload Options
                    </PanelHeaderButton>
                    {/* Add your Chat Icon Button here */}
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      onClick={() => {
                        // Handle the logic to open the chat interface
                        openChatInterface();
                      }}
                    >
                      <div className="i-ph:chat-centered" />
                      Chat
                    </PanelHeaderButton>
                  </>
                )}
                <IconButton
                  icon="i-ph:x-circle"
                  className="-mr-1"
                  size="xl"
                  onClick={() => {
                    workbenchStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View
                  initial={{ x: selectedView === 'code' ? 0 : '-100%' }}
                  animate={{ x: selectedView === 'code' ? 0 : '-100%' }}
                >
                  <EditorPanel
                    editorDocument={currentDocument}
                    isStreaming={isStreaming}
                    selectedFile={selectedFile}
                    files={files}
                    unsavedFiles={unsavedFiles}
                    onFileSelect={(filePath) => {
                      workbenchStore.setSelectedFile(filePath);
                    }}
                    onEditorScroll={(position) => {
                      workbenchStore.setCurrentDocumentScrollPosition(position);
                    }}
                    onEditorChange={(update) => {
                      workbenchStore.setCurrentDocumentContent(update.content);
                    }}
                    onFileSave={() => {
                      workbenchStore
                        .saveCurrentDocument()
                        .then(() => toast.success('File saved successfully!'))
                        .catch(() => toast.error('Failed to update file content'));
                    }}
                    onFileReset={() => {
                      workbenchStore.resetCurrentDocument();
                    }}
                  />
                </View>
                <View
                  initial={{ x: selectedView === 'preview' ? 0 : '100%' }}
                  animate={{ x: selectedView === 'preview' ? 0 : '100%' }}
                >
                  <Preview />
                </View>
                {showUploadButtons && (
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor flex justify-start gap-4">
                    <div {...getRootPropsFile()}>
                      <input {...getInputPropsFile()} />
                      <PanelHeaderButton className="text-sm">
                        <div className="i-ph:upload" />
                        Upload File
                      </PanelHeaderButton>
                    </div>
                    <div {...getRootPropsProject()}>
                      <input {...getInputPropsProject()} />
                      <PanelHeaderButton className="text-sm">
                        <div className="i-ph:upload" />
                        Upload Project
                      </PanelHeaderButton>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {isChatOpen && <ChatInterface onClose={closeChatInterface} />}
      </motion.div>
    )
  );
});

interface ViewProps extends HTMLMotionProps<'div'> {
  children: JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
