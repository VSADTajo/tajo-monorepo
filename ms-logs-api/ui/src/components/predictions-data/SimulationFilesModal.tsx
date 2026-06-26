import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, FolderInput, FolderOutput, HardDrive, Loader2, X } from 'lucide-react';
import { downloadSimulationFile, listSimulationFiles } from './api';
import { formatIsoDate, formatSimDate } from './format';
import type { SftpFileMeta, SimulationFolder, SimulationItem } from './types';

interface SimulationFilesModalProps {
    stationName: string;
    stationCode: string;
    simulation: SimulationItem;
    onClose: () => void;
}

function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return '-';
    if (bytes < 1024) return `${bytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(1)} ${units[unitIndex]}`;
}

interface FileListProps {
    title: string;
    icon: React.ReactNode;
    files: SftpFileMeta[];
    folder: SimulationFolder;
    downloadingName: string | null;
    onDownload: (folder: SimulationFolder, name: string) => void;
}

function FileList({ title, icon, files, folder, downloadingName, onDownload }: FileListProps) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-slate-300">
                {icon}
                <span>{title}</span>
                <span className="text-slate-600">&middot; {files.length} archivo{files.length === 1 ? '' : 's'}</span>
            </div>
            {files.length === 0 ? (
                <p className="text-xs text-slate-600 border border-dashed border-slate-700/60 rounded-lg px-4 py-5 text-center">
                    Sin archivos en esta carpeta
                </p>
            ) : (
                <div className="border border-slate-700/50 rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-slate-800/60 text-slate-400">
                                <th className="text-left font-medium px-4 py-2">Archivo</th>
                                <th className="text-right font-medium px-4 py-2 w-24">Tamano</th>
                                <th className="text-left font-medium px-4 py-2 w-44">Modificado</th>
                                <th className="px-4 py-2 w-12"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {files.map((file) => {
                                const isDownloading = downloadingName === `${folder}/${file.name}`;
                                return (
                                    <tr key={file.name} className="border-t border-slate-700/50 hover:bg-slate-800/30">
                                        <td className="px-4 py-2 text-slate-200">
                                            <span className="flex items-center gap-2">
                                                <FileText size={13} className="text-slate-500 shrink-0" />
                                                <span className="truncate max-w-[280px]" title={file.name}>{file.name}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-right text-slate-400">{formatBytes(file.size)}</td>
                                        <td className="px-4 py-2 text-slate-500">{formatIsoDate(file.modifiedAt)}</td>
                                        <td className="px-4 py-2 text-right">
                                            <button
                                                onClick={() => onDownload(folder, file.name)}
                                                disabled={isDownloading}
                                                title="Descargar"
                                                className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
                                            >
                                                {isDownloading ? (
                                                    <Loader2 size={14} className="animate-spin" />
                                                ) : (
                                                    <Download size={14} />
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default function SimulationFilesModal({ stationName, stationCode, simulation, onClose }: SimulationFilesModalProps) {
    const [downloadingName, setDownloadingName] = useState<string | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['simulation-files', simulation.id],
        queryFn: ({ signal }) => listSimulationFiles(simulation.id, signal),
        staleTime: 30 * 1000,
    });

    async function handleDownload(folder: SimulationFolder, name: string) {
        setDownloadError(null);
        setDownloadingName(`${folder}/${name}`);
        try {
            await downloadSimulationFile(simulation.id, folder, name);
        } catch {
            setDownloadError(`No se pudo descargar "${name}"`);
        } finally {
            setDownloadingName(null);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                            <HardDrive className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-slate-100">Archivos SFTP de la simulacion</h3>
                            <p className="text-xs text-slate-400">
                                {stationName} ({stationCode}) &middot; Simulacion {formatSimDate(simulation.simulationDate)} &middot;{' '}
                                <span className="text-slate-300">{simulation.status}</span>
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto px-5 py-4 space-y-5">
                    {downloadError && (
                        <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
                            {downloadError}
                        </p>
                    )}

                    {isLoading ? (
                        <p className="text-center text-slate-500 py-10">Cargando archivos...</p>
                    ) : isError ? (
                        <p className="text-center text-red-400 py-10">Error al cargar los archivos de la simulacion</p>
                    ) : (
                        <>
                            <FileList
                                title="Input"
                                icon={<FolderInput size={14} className="text-emerald-400" />}
                                files={data?.input ?? []}
                                folder="input"
                                downloadingName={downloadingName}
                                onDownload={handleDownload}
                            />
                            <FileList
                                title="Output"
                                icon={<FolderOutput size={14} className="text-amber-400" />}
                                files={data?.output ?? []}
                                folder="output"
                                downloadingName={downloadingName}
                                onDownload={handleDownload}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
