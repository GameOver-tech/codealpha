import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button } from '../components/ui';
import { api } from '../lib/api';
import { Upload, File, X, Camera } from 'lucide-react';

export function UploadRecord() {
  const { jobId } = useParams();
  const navigate = useNavigate();
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
      navigate(`/interview/${jobId}/status/${result.interview_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <Card>
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Submit Your Interview</h1>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6">
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'upload'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={16} className="inline mr-1.5" />
              Upload File
            </button>
            <button
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'record'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
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
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                >
                  <Upload className="mx-auto mb-4 text-gray-400" size={40} />
                  <p className="text-gray-700 font-medium mb-1">
                    Drag & drop your recording here
                  </p>
                  <p className="text-gray-400 text-sm mb-4">
                    or click to browse files
                  </p>
                  <p className="text-gray-400 text-xs">
                    Supported: MP4, MOV, WebM, MP3, WAV, M4A (max 500MB)
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
                    <File className="text-blue-600" size={24} />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-600"
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
