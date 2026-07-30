import { useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { api } from '../lib/api';
import { useToast } from '../contexts/ToastContext';
import { Upload, File, X, Camera, ArrowLeft } from 'lucide-react';

export function UploadRecord() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'upload' | 'record'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !jobId) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('job_id', jobId);

      const result = await api.upload('/interviews/upload', formData);
      toast({ title: 'Interview submitted!', description: 'Your recording is being processed.', type: 'success' });
      navigate(`/interview/${jobId}/status/${result.interview_id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
      toast({ title: 'Upload failed', description: msg, type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto">
        <Link
          to={`/interview/${jobId}`}
          className="inline-flex items-center gap-1.5 text-sm mb-6 transition-colors"
          style={{ color: 'var(--color-body)' }}
        >
          <ArrowLeft size={16} />
          Back
        </Link>

        <Card>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-heading)' }}>Upload or Record Your Interview</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-body)' }}>Choose how you'd like to submit your interview recording.</p>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'upload'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={16} className="inline mr-1.5" />
              Upload File
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'record'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white'
              }`}
              onClick={() => setActiveTab('record')}
            >
              <Camera size={16} className="inline mr-1.5" />
              Record
            </button>
          </div>

          {activeTab === 'upload' ? (
            <>
              {/* Drop zone */}
              {!selectedFile && (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-[#4F6EF7] hover:bg-blue-50/30 transition-colors"
                >
                  <Upload className="mx-auto mb-4 text-gray-400" size={40} />
                  <p className="text-gray-700 font-medium mb-1">
                    Drag & drop your file here
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    or
                    <span className="text-[#4F6EF7] font-medium mx-1">Choose File</span>
                    to browse
                  </p>
                  <p className="text-gray-400 text-xs">
                    Supports: mp4, mov, mp3, wav — Max 500MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp4,.mov,.avi,.webm,.mkv,.mp3,.wav,.m4a,.ogg"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              {/* Selected file */}
              {selectedFile && (
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-3">
                    <File className="text-[#4F6EF7]" size={24} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600 mb-4 bg-red-50 rounded-lg p-3">{error}</p>
              )}

              <Button
                fullWidth
                disabled={!selectedFile || uploading}
                onClick={handleSubmit}
                className="mt-2"
              >
                {uploading ? 'Uploading...' : 'Submit Interview'}
              </Button>
            </>
          ) : (
            /* Record tab placeholder */
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center">
              <Camera className="mx-auto mb-4 text-gray-400" size={48} />
              <p className="text-gray-500 font-medium">Recording feature coming soon</p>
              <p className="text-gray-400 text-sm mt-1">Please use the Upload File tab for now</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
