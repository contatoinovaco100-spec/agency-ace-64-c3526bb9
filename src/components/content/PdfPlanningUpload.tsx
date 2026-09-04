import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileText, FileSpreadsheet, Loader2, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { parsePlanningFile, type PlanningItem } from '@/lib/pdfPlanningParser';

interface PdfPlanningUploadProps {
  onParsed: (items: PlanningItem[], rawText: string) => void;
}

export function PdfPlanningUpload({ onParsed }: PdfPlanningUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isExcel = (name?: string | null) => {
    if (!name) return false;
    const lower = name.toLowerCase();
    return lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv');
  };

  const handleFile = useCallback(async (file: File) => {
    const lowerName = file.name.toLowerCase();
    const valid = lowerName.endsWith('.pdf') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || file.type.includes('pdf') || file.type.includes('spreadsheet') || file.type.includes('excel');

    if (!valid) {
      setError('Por favor, selecione um arquivo Excel (.xlsx / .xls) ou PDF (.pdf).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('O arquivo é muito grande. Máximo 20MB.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setIsProcessing(true);

    try {
      const items = await parsePlanningFile(file);
      if (items.length === 0) {
        setError('Nenhum item com título/conteúdo foi encontrado no arquivo. Verifique a planilha ou PDF.');
        setIsProcessing(false);
        return;
      }

      toast.success(`${items.length} itens extraídos do ${isExcel(file.name) ? 'Excel' : 'PDF'} com sucesso!`);
      onParsed(items, '');
    } catch (err: any) {
      console.error('File parse error:', err);
      setError(`Erro ao processar o arquivo: ${err.message || 'Tente novamente'}`);
    } finally {
      setIsProcessing(false);
    }
  }, [onParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    if (inputRef.current) inputRef.current.value = '';
  }, [handleFile]);

  const reset = () => {
    setFileName(null);
    setError(null);
    setIsProcessing(false);
  };

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.xlsx,.xls,.csv,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
        onChange={handleInputChange}
        className="hidden"
      />

      <AnimatePresence mode="wait">
        {fileName && !error ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="border border-primary/30 bg-primary/5 rounded-2xl p-8 text-center"
          >
            {isProcessing ? (
              <div className="space-y-4">
                <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
                <div>
                  <p className="text-white font-semibold">Processando arquivo...</p>
                  <p className="text-zinc-400 text-sm mt-1">{fileName}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {isExcel(fileName) ? (
                  <FileSpreadsheet className="w-12 h-12 text-emerald-400 mx-auto" />
                ) : (
                  <FileText className="w-12 h-12 text-primary mx-auto" />
                )}
                <div>
                  <p className="text-white font-semibold">{fileName}</p>
                  <p className="text-emerald-400 text-sm mt-1">Planejamento processado com sucesso!</p>
                </div>
                <Button variant="outline" size="sm" onClick={reset} className="border-white/10">
                  <X className="w-4 h-4 mr-2" />
                  Enviar outro arquivo
                </Button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="upload"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
              transition-all duration-200
              ${isDragging
                ? 'border-primary bg-primary/10 scale-[1.02]'
                : 'border-white/10 hover:border-primary/40 hover:bg-primary/5'
              }
              ${error ? 'border-red-500/50 bg-red-500/5' : ''}
            `}
          >
            <div className="space-y-4">
              {error ? (
                <>
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
                  <div>
                    <p className="text-red-400 font-semibold">{error}</p>
                    <p className="text-zinc-500 text-sm mt-2">Clique ou arraste um arquivo Excel ou PDF para tentar novamente</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <FileSpreadsheet className={`w-10 h-10 transition-colors ${isDragging ? 'text-emerald-400' : 'text-emerald-500/70'}`} />
                    <span className="text-zinc-600 font-bold">ou</span>
                    <Upload className={`w-10 h-10 transition-colors ${isDragging ? 'text-primary' : 'text-zinc-500'}`} />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-base">
                      {isDragging ? 'Solte o arquivo Excel ou PDF aqui' : 'Arraste a Planilha Excel (.xlsx) ou PDF'}
                    </p>
                    <p className="text-zinc-500 text-sm mt-1">
                      Compatível com Excel, Google Sheets (.xlsx) e PDF • Máximo 20MB
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button variant="outline" size="sm" className="border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10">
                      <FileSpreadsheet className="w-4 h-4 mr-1.5" />
                      Selecionar Excel / PDF
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

