import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Props {
  value: string;
  onChange: (url: string) => void;
  clientId?: string;
  label?: string;
  accept?: string;
  /** Show a preview thumbnail */
  preview?: boolean;
}

export function QuizMediaUploader({
  value, onChange, clientId = "shared", label = "Imagem", accept = "image/*", preview = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 8 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("quiz-media").upload(path, file, {
        cacheControl: "31536000", upsert: false,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("quiz-media").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      toast({ title: "Erro no upload", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      {preview && value && (
        <div className="relative inline-block">
          <img src={value} alt="" className="max-h-24 rounded-md border border-border" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Button
          type="button" size="sm" variant="outline"
          onClick={() => inputRef.current?.click()} disabled={uploading}
          className="shrink-0"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1" />}
          Upload
        </Button>
        <Input
          placeholder="ou cole uma URL"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="text-xs"
        />
      </div>
      <input
        ref={inputRef} type="file" accept={accept} className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {!value && !uploading && (
        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3 w-3" /> JPG, PNG, WebP até 8 MB
        </div>
      )}
    </div>
  );
}
