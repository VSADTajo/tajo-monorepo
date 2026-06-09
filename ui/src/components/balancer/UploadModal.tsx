import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Trash2, FileText, AlertCircle, Loader2, Plus } from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (files: File[]) => void;
  targetTimestamp: string;
  formattedTimestamp: string;
  isUploading: boolean;
  initialFiles: File[];
  location?: 'root' | 'recover';
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Extract basin name from filename (handles both formats)
function extractBasinName(filename: string): string {
  // Format: YYYYMMDDHHMM__BasinName.state or BasinName.state
  if (filename.includes('__')) {
    const parts = filename.split('__');
    return parts[1]?.replace('.state', '') || filename.replace('.state', '');
  }
  return filename.replace('.state', '');
}

function UploadModalContent({
  isOpen,
  onClose,
  onConfirm,
  targetTimestamp,
  formattedTimestamp,
  isUploading,
  initialFiles,
  location = 'root',
}: UploadModalProps) {
  const [files, setFiles] = useState<File[]>(initialFiles);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset files when modal opens/closes or initialFiles change
  useEffect(() => {
    if (isOpen) {
      setFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  if (!isOpen) return null;

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_f: File, i: number) => i !== index));
  };

  const handleAddMoreFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const newFiles = e.target.files;
    if (newFiles && newFiles.length > 0) {
      const newFileArray = Array.from(newFiles) as File[];

      // Validate all files are .state
      const invalidFiles = newFileArray.filter((f) => !f.name.endsWith('.state'));
      if (invalidFiles.length > 0) {
        alert(`Only .state files allowed. Invalid: ${invalidFiles.map((f) => f.name).join(', ')}`);
        e.target.value = '';
        return;
      }

      // If duplicate basin names, replace the old ones
      const updatedFiles = [...files];
      for (const newFile of newFileArray) {
        const newBasinName = extractBasinName(newFile.name);
        const existingIndex = updatedFiles.findIndex((f) => extractBasinName(f.name) === newBasinName);
        if (existingIndex >= 0) {
          updatedFiles[existingIndex] = newFile;
        } else if (updatedFiles.length < 6) {
          updatedFiles.push(newFile);
        }
      }

      setFiles(updatedFiles.slice(0, 6)); // Max 6 files
    }
    e.target.value = '';
  };

  const handleConfirm = async () => {
    if (files.length === 6) {
      await onConfirm(files);
      // Close modal after successful upload (always 6 files)
      onClose();
    }
  };

  const isValid = files.length === 6;
  // Root never has timestamp, only recover has timestamps
  const isRoot = location === 'root' || targetTimestamp === 'current' || targetTimestamp === 'unknown';

  // Generate the new filename preview
  const getNewFilename = (basinName: string) => {
    if (isRoot) {
      return `${basinName}.state`;
    }
    return `${targetTimestamp}__${basinName}.state`;
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div>
            <h3 className="text-lg font-semibold text-white">
              {isRoot ? 'Update Active States' : 'Update State Files'}
            </h3>
            {!isRoot && (
              <p className="text-sm text-slate-400 mt-1">
                Target: <span className="text-amber-400">{formattedTimestamp}</span>
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-4 mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              {isRoot ? (
                <>
                  Files will be renamed to <code className="bg-slate-700 px-1 rounded">BasinName.state</code> format
                  (without timestamp prefix) to replace the current active states.
                </>
              ) : (
                <>
                  Files will be renamed to <code className="bg-slate-700 px-1 rounded">{targetTimestamp}__BasinName.state</code> format
                  to replace the states for this specific time.
                </>
              )}
            </div>
          </div>
        </div>

        {/* File list */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-400">
              Selected files: <span className={isValid ? 'text-emerald-400' : files.length > 0 ? 'text-amber-400' : 'text-rose-400'}>{files.length}/6</span>
            </span>
            {files.length < 6 && (
              <button
                onClick={handleAddMoreFiles}
                disabled={isUploading}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                Add Files
              </button>
            )}
          </div>

          {/* Hidden file input for adding more files */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".state"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {files.length === 0 ? (
              <div
                onClick={handleAddMoreFiles}
                className="p-8 text-center text-slate-500 border-2 border-dashed border-slate-600 rounded-lg cursor-pointer hover:border-blue-500 hover:text-blue-400 transition-colors"
              >
                <Plus className="w-8 h-8 mx-auto mb-2" />
                Click to select .state files
              </div>
            ) : (
              files.map((file: File, index: number) => {
                const basinName = extractBasinName(file.name);
                const newFilename = getNewFilename(basinName);

                return (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{file.name}</p>
                        <p className="text-xs text-slate-500">
                          {formatBytes(file.size)} → <span className="text-emerald-400">{newFilename}</span>
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      disabled={isUploading}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 rounded transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Add more files hint */}
          {files.length > 0 && files.length < 6 && (
            <p className="text-xs text-slate-500 mt-2 text-center">
              Need {6 - files.length} more file{6 - files.length > 1 ? 's' : ''}. You must upload exactly 6 files. Click "Add Files" above.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isValid || isUploading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload & Replace
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UploadModal(props: UploadModalProps) {
  if (!props.isOpen) return null;

  // Render modal in document.body using portal
  return createPortal(
    <UploadModalContent {...props} />,
    document.body
  );
}
