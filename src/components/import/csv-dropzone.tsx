// @ts-nocheck — pending rewrite (schema migration lot 2)
"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

export function CsvDropzone({
  onParsed,
}: {
  onParsed: (content: string, filename: string) => void;
}) {
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (accepted: File[]) => {
      setError(null);
      const file = accepted[0];
      if (!file) return;

      if (!file.name.endsWith(".csv")) {
        setError("Fichier CSV uniquement (.csv)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setError("Fichier trop grand (max 10 Mo)");
        return;
      }

      setFilename(file.name);
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        onParsed(content, file.name);
      };
      reader.readAsText(file, "UTF-8");
    },
    [onParsed]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50"
            : filename
              ? "border-green-400 bg-green-50"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
        }`}
      >
        <input {...getInputProps()} />
        {filename ? (
          <div>
            <div className="text-3xl mb-2">✅</div>
            <p className="font-medium text-green-700">{filename}</p>
            <p className="text-sm text-green-600 mt-1">Cliquez pour changer de fichier</p>
          </div>
        ) : (
          <div>
            <div className="text-3xl mb-2">📂</div>
            <p className="font-medium text-gray-700">Glissez votre fichier CSV ici</p>
            <p className="text-sm text-gray-500 mt-1">ou cliquez pour parcourir</p>
            <p className="text-xs text-gray-400 mt-2">Format accepté : .csv — max 10 Mo</p>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
