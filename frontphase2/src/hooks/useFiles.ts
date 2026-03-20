'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  filesApiGet,
  filesApiUpload,
  filesApiDelete,
  type FileEntityType,
  type EntityFile,
} from '../lib/api';

export function useFiles(entityType: FileEntityType, entityId: string | null | undefined) {
  const [files, setFiles] = useState<EntityFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!entityId || !entityType) {
      setFiles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await filesApiGet(entityType, entityId);
      const list = Array.isArray(res?.data) ? res.data : [];
      setFiles(list);
    } catch (e: any) {
      setError(e?.message || 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const uploadFile = useCallback(
    async (file: File, fileType: string = 'JD') => {
      if (!entityId || !entityType) return;
      setUploading(true);
      setError(null);
      try {
        const res = await filesApiUpload(entityType, entityId, file, fileType);
        if (res?.data) {
          setFiles((prev) => [res.data, ...prev]);
        }
      } catch (e: any) {
        setError(e?.message || 'Upload failed');
        throw e;
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId]
  );

  const deleteFile = useCallback(
    async (fileId: string) => {
      if (!entityId || !entityType) return;
      setError(null);
      try {
        await filesApiDelete(entityType, entityId, fileId);
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } catch (e: any) {
        setError(e?.message || 'Delete failed');
        throw e;
      }
    },
    [entityType, entityId]
  );

  return {
    files,
    loading,
    uploading,
    error,
    refresh: fetchFiles,
    uploadFile,
    deleteFile,
  };
}
